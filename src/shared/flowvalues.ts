// Values settled per call: a constant passed in settles a condition for that call only (`draw(true)` makes
// `if (clear)` true there, so its else cannot happen in that call). Read from clang's syntax tree, not the text, so the
// condition is the one the compiler sees (macros expanded), with its types and the conversions it inserted. Exact or
// nothing: a condition settles only when every part it needs is understood — integer, bool and pointer values,
// parameters the function only ever reads, the built-in operators — and anything else (a call, a member, a float, a
// cast to a class, sizeof) leaves it open. What C and C++ leave undefined or to the implementation (signed overflow,
// shifting a negative, a signed conversion out of range) leaves it open too. Where the platform matters (the width of
// int and long, whether char is signed) the condition is worked out for each choice and settles only when all agree.
import type { AstNode } from './flowrun';

/** A condition, an argument or a case label, as the syntax tree has it; `?` is anything not understood. */
export type Expr =
  | { k: 'int'; v: string; ty: string }                     // an integer, char or bool literal: its value and type
  | { k: 'null' }                                           // nullptr
  | { k: 'str' }                                            // a string literal (never null)
  | { k: 'param'; name: string }                            // a parameter of the function, by name
  | { k: 'cast'; how: string; ty: string; a: Expr }         // a conversion, implicit or written, by clang's kind for it
  | { k: 'un'; op: string; ty: string; a: Expr }
  | { k: 'bin'; op: string; ty: string; a: Expr; b: Expr }
  | { k: 'cond'; ty: string; c: Expr; a: Expr; b: Expr }
  | { k: '?' };

const Q: Expr = { k: '?' };
const kids = (n: AstNode) => n.children ?? [];
const exprs = (n: AstNode) => kids(n).filter((c) => c.role === 'expression');
const arc = (n: AstNode) => ((n as { arcana?: string }).arcana ?? '');
/** The dump after the node's name, address and source range: `'int' <LValueToRValue>`, `'UINT':'unsigned int' '='`. */
const rest = (a: string) => { const q = a.indexOf("'"), r = a.indexOf('<'); return r >= 0 && r < q ? a.slice(a.indexOf('>', r) + 1) : a.slice(Math.max(0, q)); };
/** A node's type, the canonical one when clang gives both (`'UINT':'unsigned int'` → unsigned int). */
const typeIn = (a: string) => { const m = /'([^']*)'(?::'([^']*)')?/.exec(rest(a)); return m ? (m[2] ?? m[1]) : ''; };
const BIN = new Set(['+', '-', '*', '/', '%', '<<', '>>', '&', '|', '^', '==', '!=', '<', '<=', '>', '>=', '&&', '||']);

/** The expression a syntax tree node computes, as far as it is understood. */
export function exprOf(n: AstNode | undefined): Expr {
  if (!n) return Q;
  const a = arc(n), ty = typeIn(a), e = exprs(n);
  switch (n.kind) {
    case 'Paren': return exprOf(e[0]);
    case 'IntegerLiteral': { const v = /\s(\d+)\s*$/.exec(a)?.[1]; return v && ty ? { k: 'int', v, ty } : Q; }
    // a char literal's value is the same on every platform only below 128
    case 'CharacterLiteral': { const v = /\s(\d+)\s*$/.exec(a)?.[1]; return v && ty && Number(v) < 128 ? { k: 'int', v, ty } : Q; }
    case 'CXXBoolLiteral': { const b = /\b(true|false)\s*$/.exec(a)?.[1]; return b ? { k: 'int', v: b === 'true' ? '1' : '0', ty: 'bool' } : Q; }
    case 'CXXNullPtrLiteral': return { k: 'null' };
    case 'GNUNull': return ty ? { k: 'int', v: '0', ty } : Q;
    case 'StringLiteral': return { k: 'str' };
    case 'Constant': return exprOf(e[0]);
    case 'ImplicitCast': case 'CStyleCast': case 'CXXStaticCast': case 'CXXFunctionalCast': {
      const how = /<([A-Za-z]+)>/.exec(rest(a).replace(/'[^']*'/g, ''))?.[1];
      return how && ty ? { k: 'cast', how, ty, a: exprOf(e[0]) } : Q;
    }
    case 'DeclRef': return / ParmVar /.test(a) && n.detail ? { k: 'param', name: n.detail } : Q;
    case 'UnaryOperator': { const op = /\bprefix '([^']+)'/.exec(a)?.[1]; return op && /^[!~+-]$/.test(op) && ty ? { k: 'un', op, ty, a: exprOf(e[0]) } : Q; }
    case 'BinaryOperator': return n.detail && BIN.has(n.detail) && ty && e.length === 2 ? { k: 'bin', op: n.detail, ty, a: exprOf(e[0]), b: exprOf(e[1]) } : Q;
    case 'ConditionalOperator': return ty && e.length === 3 ? { k: 'cond', ty, c: exprOf(e[0]), a: exprOf(e[1]), b: exprOf(e[2]) } : Q;
    default: return Q;
  }
}

/** A case label's value: its expression when understood, else the compiler's own (`'int'Int 3`) when small and not negative. */
export function caseOf(n: AstNode | undefined): Expr {
  if (!n) return Q;
  const x = exprOf(n);
  if (x.k !== '?' && !has(x, (y) => y.k === '?' || y.k === 'param')) return x;
  const v = n.kind === 'Constant' ? /Int (\d+)/.exec(arc(n))?.[1] : undefined;
  return v && BigInt(v) <= 32767n ? { k: 'int', v, ty: 'int' } : Q;
}

/** Whether any part of an expression is so. */
export function has(e: Expr, f: (x: Expr) => boolean): boolean {
  if (f(e)) return true;
  switch (e.k) {
    case 'cast': case 'un': return has(e.a, f);
    case 'bin': return has(e.a, f) || has(e.b, f);
    case 'cond': return has(e.c, f) || has(e.a, f) || has(e.b, f);
    default: return false;
  }
}
/** The parameters an expression reads. */
export function paramsIn(e: Expr): string[] {
  const out: string[] = [];
  has(e, (x) => { if (x.k === 'param' && !out.includes(x.name)) out.push(x.name); return false; });
  return out;
}

// ---------- platforms ----------

/** One choice of what the language leaves to the platform: the widths of int and long, and whether char is signed. */
interface Model { int: number; long: number; charSigned: boolean }
const MODELS: Model[] = [16, 32].flatMap((i) => [32, 64].flatMap((l) => [true, false].map((c) => ({ int: i, long: l, charSigned: c }))));
export const MODEL_COUNT = MODELS.length;

type IntType = { bits: number; signed: boolean; bool?: true };
/** The same type with top-level const dropped (`const int` → int, `char *const` → char *). */
export const plainType = (t: string) => { let s = t.replace(/\s+/g, ' ').trim(); s = /\*/.test(s) ? s.replace(/\s*\bconst$/, '') : s.replace(/^const /, '').replace(/ const$/, ''); return s; };
function typeOf(t: string, m: Model): IntType | 'ptr' | null {
  const s = plainType(t);
  if (/\bvolatile\b/.test(s)) return null;
  if (/\*$/.test(s) || s === 'std::nullptr_t' || s === 'nullptr_t') return 'ptr';
  switch (s) {
    case 'bool': case '_Bool': return { bits: 1, signed: false, bool: true };
    case 'char': return { bits: 8, signed: m.charSigned };
    case 'signed char': return { bits: 8, signed: true };
    case 'unsigned char': case 'char8_t': return { bits: 8, signed: false };
    case 'short': return { bits: 16, signed: true };
    case 'unsigned short': case 'char16_t': return { bits: 16, signed: false };
    case 'int': return { bits: m.int, signed: true };
    case 'unsigned int': return { bits: m.int, signed: false };
    case 'char32_t': return { bits: 32, signed: false };
    case 'long': return { bits: m.long, signed: true };
    case 'unsigned long': return { bits: m.long, signed: false };
    case 'long long': return { bits: 64, signed: true };
    case 'unsigned long long': return { bits: 64, signed: false };
    default: return null;
  }
}

// ---------- values ----------

/** A value: an integer (bool as 0 or 1), or a pointer known to be null or not. */
export type Num = { i: bigint } | { p: boolean };
/** A value in each platform model: null where it is not known, 'none' where that model cannot be the platform (a literal too large for it). */
export type Vals = (Num | null | 'none')[];
type R = Num | null | 'none';

/** v as a value of type t: unsigned wraps, signed must fit (otherwise the language leaves it undefined or to the platform). */
function into(v: bigint, t: IntType): bigint | null {
  if (t.bool) return v === 0n || v === 1n ? v : null;
  if (!t.signed) { const m = 1n << BigInt(t.bits); return ((v % m) + m) % m; }
  const h = 1n << BigInt(t.bits - 1);
  return v >= -h && v < h ? v : null;
}
const truth = (n: Num) => ('i' in n ? n.i !== 0n : n.p);

function ev(e: Expr, m: Model, known: (name: string) => R): R {
  switch (e.k) {
    case '?': case 'str': return null;
    case 'null': return { p: false };
    case 'param': return null;   // read only through its lvalue-to-rvalue conversion, below
    case 'int': {
      const t = typeOf(e.ty, m);
      if (!t || t === 'ptr') return null;
      const v = BigInt(e.v);
      return into(v, { ...t, bool: undefined }) === v ? { i: v } : 'none';
    }
    case 'cast': {
      const t = typeOf(e.ty, m);
      if (!t) return null;
      if (e.how === 'LValueToRValue') {
        if (e.a.k !== 'param') return null;
        // a parameter's value is the one passed (src/shared/flowfacts.ts paramValues), already of its type
        return known(e.a.name);
      }
      if (e.how === 'ArrayToPointerDecay') return e.a.k === 'str' && t === 'ptr' ? { p: true } : null;
      if (e.how === 'NullToPointer') return t === 'ptr' ? { p: false } : null;
      const a = ev(e.a, m, known);
      if (a == null || a === 'none') return a;
      switch (e.how) {
        case 'IntegralToBoolean': return 'i' in a && t !== 'ptr' && t.bool ? { i: a.i !== 0n ? 1n : 0n } : null;
        case 'PointerToBoolean': return 'p' in a && t !== 'ptr' && t.bool ? { i: a.p ? 1n : 0n } : null;
        case 'IntegralCast': { if (!('i' in a) || t === 'ptr') return null; const v = t.bool ? (a.i !== 0n ? 1n : 0n) : into(a.i, t); return v == null ? null : { i: v }; }
        case 'NoOp': case 'BitCast': return ('p' in a) === (t === 'ptr') ? a : null;
        default: return null;
      }
    }
    case 'un': {
      const t = typeOf(e.ty, m), a = ev(e.a, m, known);
      if (a == null || a === 'none' || !t || t === 'ptr') return a === 'none' ? a : null;
      if (e.op === '!') return { i: truth(a) ? 0n : 1n };
      if (!('i' in a)) return null;
      const v = into(e.op === '-' ? -a.i : e.op === '~' ? ~a.i : a.i, t);
      return v == null ? null : { i: v };
    }
    case 'cond': {
      const c = ev(e.c, m, known);
      if (c == null || c === 'none') return c;
      return ev(truth(c) ? e.a : e.b, m, known);
    }
    case 'bin': {
      const t = typeOf(e.ty, m);
      if (!t || t === 'ptr') return null;
      const a = ev(e.a, m, known);
      if (a === 'none') return a;
      if (e.op === '&&' || e.op === '||') {
        const and = e.op === '&&';
        // the right side runs only when the left does not decide: a left side that decides settles it on its own,
        // and a right side that decides settles it whatever the left was
        if (a && truth(a) !== and) return { i: and ? 0n : 1n };
        const b = ev(e.b, m, known);
        if (b === 'none') return b;
        if (b && truth(b) !== and) return { i: and ? 0n : 1n };
        return a && b ? { i: and ? 1n : 0n } : null;
      }
      const b = ev(e.b, m, known);
      if (b === 'none') return b;
      if (!a || !b) return null;
      if ('p' in a || 'p' in b) {
        // pointers: only whether they are equal, and only when one of them is null
        if (!('p' in a && 'p' in b) || (e.op !== '==' && e.op !== '!=') || (a.p && b.p)) return null;
        return { i: (a.p === b.p) === (e.op === '==') ? 1n : 0n };
      }
      const x = a.i, y = b.i;
      const cmp = (r: boolean) => ({ i: r ? 1n : 0n });
      switch (e.op) {
        case '==': return cmp(x === y);
        case '!=': return cmp(x !== y);
        case '<': return cmp(x < y);
        case '<=': return cmp(x <= y);
        case '>': return cmp(x > y);
        case '>=': return cmp(x >= y);
      }
      let v: bigint;
      switch (e.op) {
        case '+': v = x + y; break;
        case '-': v = x - y; break;
        case '*': v = x * y; break;
        case '/': case '%': {
          if (y === 0n) return null;
          if (t.signed && y === -1n && x === -(1n << BigInt(t.bits - 1))) return null;
          v = e.op === '/' ? x / y : x % y;   // both truncate toward zero, as C and C++ do
          break;
        }
        case '<<': case '>>': {
          if (y < 0n || y >= BigInt(t.bits) || (t.signed && x < 0n)) return null;
          v = e.op === '<<' ? x << y : x >> y;
          break;
        }
        case '&': v = x & y; break;
        case '|': v = x | y; break;
        case '^': v = x ^ y; break;
        default: return null;
      }
      const r = into(v, t);
      return r == null ? null : { i: r };
    }
  }
}

/** An expression's value in every platform model, with the parameters' values given the same way. */
export function valuesOf(e: Expr, known: (name: string) => Vals | undefined): Vals {
  return MODELS.map((m, i) => ev(e, m, (n) => known(n)?.[i] ?? null));
}
/** The value when every possible platform gives one: the same one, or (same: false) different ones. */
export function settledValue(v: Vals): { all: Num[]; same: boolean } | null {
  const ok = v.filter((x) => x !== 'none');
  if (!ok.length || ok.some((x) => x == null)) return null;
  const all = ok as Num[];
  const k = (n: Num) => ('i' in n ? `i${n.i}` : `p${n.p}`);
  return { all, same: all.every((x) => k(x) === k(all[0])) };
}
/** Whether a condition is true, false, or not settled (null), on every possible platform. */
export function truthOf(e: Expr, known: (name: string) => Vals | undefined): boolean | null {
  const s = settledValue(valuesOf(e, known));
  if (!s) return null;
  const t = s.all.map(truth);
  return t.every((x) => x === t[0]) ? t[0] : null;
}

/**
 * Which arms of a switch can run: the one whose case matches (or default when none does) and those it falls through
 * to. null when the value or any label is not settled, or a label is outside the range the value can take as written
 * (then the conversion the compiler made decides, which is not read here).
 */
export function switchArms(test: Expr, ty: string, arms: { cases: (Expr | null)[]; isDefault: boolean[]; fallsThrough: boolean }[], known: (name: string) => Vals | undefined): boolean[] | null {
  const v = valuesOf(test, known);
  const out: boolean[][] = [];
  for (let mi = 0; mi < MODELS.length; mi++) {
    const x = v[mi];
    if (x === 'none') continue;
    if (x == null || !('i' in x)) return null;
    const t = typeOf(ty, MODELS[mi]);
    if (!t || t === 'ptr') return null;
    let matched = -1, dflt = -1;
    for (let a = 0; a < arms.length; a++) {
      arms[a].cases.forEach((c, j) => {
        if (arms[a].isDefault[j]) { dflt = a; return; }
        const cv = c ? ev(c, MODELS[mi], () => null) : null;
        if (cv == null || cv === 'none' || !('i' in cv) || into(cv.i, t) !== cv.i) { matched = -2; return; }
        if (matched >= -1 && cv.i === x.i) matched = a;
      });
      if (matched === -2) return null;
    }
    const start = matched >= 0 ? matched : dflt;
    const runs = arms.map(() => false);
    for (let a = start; a >= 0 && a < arms.length; a++) { runs[a] = true; if (!arms[a].fallsThrough) break; }
    out.push(runs);
  }
  if (!out.length || out.some((r) => r.join() !== out[0].join())) return null;
  return out[0];
}

/** A settled value as a reader would say it: true / false for a bool, the number, null / not null for a pointer. */
export function showValue(v: Vals, type: string): string | null {
  const s = settledValue(v);
  if (!s || !s.same) return null;
  const n = s.all[0];
  if ('p' in n) return n.p ? 'not null' : 'null';
  return /^(?:bool|_Bool)$/.test(plainType(type)) ? (n.i ? 'true' : 'false') : String(n.i);
}
