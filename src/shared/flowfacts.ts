// What a function does besides calling: from the syntax tree clangd already gave (its node kinds and clang's own
// dump of each node, with resolved types), so every fact restates something the compiler worked out. Exact for the
// code as written; nothing here guesses from names except the curated library tables below.
import type { AstNode, Pos, Range } from './flowrun';

export interface Effects {
  /** The class whose members writes and reads name (from clangd's call item), when a method. */
  owner?: string;
  /** The function gives back a value (its type is not void). */
  returnsValue: boolean;
  /** Members of its own object it assigns to (directly, or through [] / ++ / += on them). */
  writes: string[];
  /** Members it reads or uses otherwise (calls their methods: whether such a call changes them is not decided here). */
  reads: string[];
  /** Variables outside the function (globals, statics) it assigns to, and those it reads. */
  globalWrites: string[];
  globalReads: string[];
  /** Locks it takes: the lock's text (`mtx_`, `&lock`). */
  locks: string[];
  /** What it allocates (`new Request`, `malloc`, `make_unique<Foo>`). */
  allocates: string[];
  /** What it throws. */
  throws: string[];
  /** Calls whose result the statement throws away (where the callee's name is): checked against the callee's returnsValue. */
  dropped: Range[];
  /** Members (and globals) it both changes and reads: writes and globalWrites list them, reads and globalReads don't. */
  readsToo?: string[];
  globalReadsToo?: string[];
  /** Its parameters in order, with their types as clang wrote them (`const std::atomic<bool> &`). */
  params?: { name: string; type: string }[];
  /** Parameters it assigns to, and those it reads (a parameter a local of the same name hides is not counted). */
  paramWrites?: string[];
  paramReads?: string[];
  /** Parameters only ever read for their value (so the value passed holds throughout), with their canonical types. */
  paramValues?: Record<string, string>;
  /** Declared never to return ([[noreturn]], _Noreturn, __attribute__((noreturn)), __declspec(noreturn)) where it is defined. */
  noreturn?: true;
}
/** A never-returns marking, as any of C, C++, GCC/clang or MSVC write it. */
const NORETURN_MARK = /\[\[\s*(?:gnu::|std::)?noreturn\s*\]\]|\b_Noreturn\b|__attribute__\s*\(\(\s*(?:__)?noreturn(?:__)?\s*\)\)|__declspec\s*\(\s*noreturn\s*\)/;

const LOCK_TYPE = /\b(?:lock_guard|unique_lock|scoped_lock|shared_lock)\b/;
const LOCK_CALL = /^(?:pthread_mutex_(?:timed)?lock|pthread_rwlock_(?:rd|wr)lock|EnterCriticalSection|AcquireSRWLock\w+|WaitForSingleObject|xSemaphoreTake\w*|semTake|_*txe?_mutex_get|k_mutex_lock|osMutexAcquire|mtx_lock|OSMutexPend|rt_mutex_take)$/;
const ALLOC_CALL = /^(?:malloc|calloc|realloc|strdup|aligned_alloc|pvPortMalloc|make_unique|make_shared|allocate_shared|_*txe?_byte_allocate|k_malloc|rt_malloc)$/;
const ASSIGN = /^(?:=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=)$/;

const kids = (n: AstNode) => n.children ?? [];
const arc = (n: AstNode) => ((n as { arcana?: string }).arcana ?? '');
/** The quoted type in a node's dump: `'int'`, `'mapped_type':'int'` → the first. */
const typeOf = (n: AstNode) => /'([^']*)'/.exec(arc(n).replace(/<[^>]*>/, ''))?.[1] ?? '';

/** The member a node names when it is `this->m` or an implicit member (`m` inside a method), else null. */
function ownMember(n: AstNode): string | null {
  if (n.kind !== 'Member') return null;
  const base = kids(n)[0];
  return base && base.kind === 'CXXThis' ? n.detail ?? null : null;
}

export function effects(fn: AstNode, text: string): Effects {
  const out: Effects = { returnsValue: false, writes: [], reads: [], globalWrites: [], globalReads: [], locks: [], allocates: [], throws: [], dropped: [] };
  // `record 'void (const std::string &, int)'`: the part before the parameter list is the return type
  const sig = /'([^'(]*)\(/.exec(arc(fn))?.[1]?.trim() ?? '';
  out.returnsValue = !!sig && sig !== 'void' && !/^(CXXConstructor|CXXDestructor)$/.test(fn.kind);
  // the head of the definition, up to its body, with the [[…]] attribute groups written just before it (clang's range
  // for `[[noreturn]] void f()` starts after them): where a never-returns marking is written
  const body = (fn.children ?? []).find((c) => c.kind === 'Compound');
  if (fn.range && body?.range) {
    const head = sliceRange(text, { start: fn.range.start, end: body.range.start });
    if (NORETURN_MARK.test(head) || NORETURN_MARK.test(attributesBefore(text, offsetIn(text, fn.range.start)))) out.noreturn = true;
  }
  const locals = new Set<string>();
  const parent = new Map<AstNode, AstNode>();
  const all: AstNode[] = [];
  const index = (n: AstNode) => { all.push(n); for (const c of kids(n)) { parent.set(c, n); index(c); } };
  index(fn);
  for (const n of all) if ((n.kind === 'Var' || n.kind === 'ParmVar' || n.kind === 'Binding' || n.kind === 'Decomposition') && n.detail) locals.add(n.detail);
  for (const n of all) if (n.kind === 'ParmVar' && n.detail) locals.add(n.detail);
  // parameters show in the dump of the function's type node as ParmVarDecl
  for (const n of all) { const m = /ParmVarDecl .* (?:used |referenced )?(\w+) '/.exec(arc(n)); if (m) locals.add(m[1]); }
  const src = (r?: Range) => (r ? sliceRange(text, r) : '');
  const add = (l: string[], v: string) => { if (v && !l.includes(v)) l.push(v); };

  /** Whether n is written: the left side of an assignment, ++/--, or inside that left side ([] on it). */
  const written = (n: AstNode): boolean => {
    let c: AstNode = n;
    for (let p = parent.get(c); p; c = p, p = parent.get(p)) {
      if ((p.kind === 'BinaryOperator' || p.kind === 'CompoundAssignOperator') && ASSIGN.test(p.detail ?? '')) return kids(p)[0] === c;
      if (p.kind === 'UnaryOperator' && /^(\+\+|--)$/.test(p.detail ?? '')) return true;
      if (p.kind === 'CXXOperatorCall' && /'(?:=|\+=|-=|\+\+|--|\[\])'/.test(arc(p))) { if (kids(p)[1] === c) return !/'\[\]'/.test(arc(p)) || written(p); return false; }
      if (p.kind !== 'ImplicitCast' && p.kind !== 'Paren' && p.kind !== 'MaterializeTemporary' && p.kind !== 'ExprWithCleanups' && p.kind !== 'CXXOperatorCall') return false;
    }
    return false;
  };

  for (const n of all) {
    const m = ownMember(n);
    // a method called on this object (this->flush()) is a call, not a member
    if (m && !(parent.get(n)?.kind === 'CXXMemberCall' && kids(parent.get(n)!)[0] === n)) { add(written(n) ? out.writes : out.reads, m); continue; }
    if (m) continue;
    // a variable from outside the function; constants (std::string::npos) cannot change, so they are left out
    if (n.kind === 'DeclRef' && / Var /.test(arc(n)) && n.detail && !locals.has(n.detail) && !/^const\b|\bconstexpr\b/.test(typeOf(n))) add(written(n) ? out.globalWrites : out.globalReads, n.detail);
    if (n.kind === 'CXXNew') add(out.allocates, `new ${typeOf(n).replace(/\s*\*$/, '')}`);
    if (n.kind === 'CXXThrow') add(out.throws, kids(n)[0] ? typeOf(kids(n)[0]) || src(kids(n)[0].range) : 'rethrow');
    if (n.kind === 'Var' && LOCK_TYPE.test(arc(n))) add(out.locks, src(n.range).replace(/^.*?[({]\s*/, '').replace(/\s*[)}].*$/, '') || n.detail || 'a lock');
    if (n.kind === 'Call' || n.kind === 'CXXMemberCall') {
      const callee = calleeName(n);
      if (callee && LOCK_CALL.test(callee)) add(out.locks, firstArg(n, src) || callee);
      if (callee === 'lock' && n.kind === 'CXXMemberCall') add(out.locks, src(kids(kids(n)[0] ?? ({} as AstNode))[0]?.range) || 'a lock');
      if (callee && ALLOC_CALL.test(callee)) add(out.allocates, callee);
      // a call that is a whole statement: its result, if any, is thrown away
      let s: AstNode = n, p = parent.get(n);
      while (p && (p.kind === 'ExprWithCleanups' || p.kind === 'CXXBindTemporary' || p.kind === 'MaterializeTemporary')) { s = p; p = parent.get(p); }
      const at = calleeAt(n);
      if (p && p.kind === 'Compound' && kids(p).includes(s) && at) out.dropped.push(at);
    }
  }
  // parameters, in order, from the function's type (ParmVarDecl), and how the body uses them
  // (its own prototype's only: a lambda inside has parameters of its own)
  const proto = kids(fn).find((c) => c.kind === 'FunctionProto');
  const parm = (n: AstNode) => /ParmVarDecl .* (?:used |referenced )?(\w+) '([^']*)'/.exec(arc(n));
  const params: { name: string; type: string }[] = [];
  for (const n of proto ? kids(proto) : []) { const m = n.kind === 'ParmVar' ? parm(n) : null; if (m && !params.some((p) => p.name === m[1])) params.push({ name: m[1], type: m[2] }); }
  if (params.length) {
    out.params = params;
    const names = new Set(params.map((p) => p.name)), own = new Set(proto ? kids(proto) : []);
    // a local, or a lambda's parameter, of the same name hides it: none of its uses are counted
    const hidden = new Set(all.filter((n) => (n.kind === 'Var' || (n.kind === 'ParmVar' && !own.has(n))) && (n.detail ?? parm(n)?.[1]) && names.has((n.detail ?? parm(n)?.[1])!)).map((n) => (n.detail ?? parm(n)?.[1])!));
    const pw: string[] = [], pr: string[] = [];
    for (const n of all) if (n.kind === 'DeclRef' && / ParmVar /.test(arc(n)) && n.detail && names.has(n.detail) && !hidden.has(n.detail)) add(written(n) ? pw : pr, n.detail);
    if (pw.length) out.paramWrites = pw;
    const reads = pr.filter((r) => !pw.includes(r));
    if (reads.length) out.paramReads = reads;
    // parameters whose every use reads the value (clang's lvalue-to-rvalue conversion on it): never assigned, never
    // bound to a reference, pointed to or captured by reference, so the value a call passes holds throughout
    const canon = new Map<string, string>();
    for (const n of proto ? kids(proto) : []) { const m = n.kind === 'ParmVar' ? /ParmVarDecl .* (?:used |referenced )?(\w+) '([^']*)'(?::'([^']*)')?/.exec(arc(n)) : null; if (m) canon.set(m[1], m[3] ?? m[2]); }
    const uses = new Map<string, boolean>();
    for (const n of all) {
      if (n.kind !== 'DeclRef' || !/ ParmVar /.test(arc(n)) || !n.detail || !names.has(n.detail)) continue;
      let p = parent.get(n);
      while (p && p.kind === 'Paren') p = parent.get(p);
      uses.set(n.detail, (uses.get(n.detail) ?? true) && !!p && p.kind === 'ImplicitCast' && p.detail === 'LValueToRValue');
    }
    const values: Record<string, string> = {};
    for (const [name, ok] of uses) { const t = canon.get(name); if (ok && t && !hidden.has(name) && !/[&]|\bvolatile\b/.test(t)) values[name] = t; }
    if (Object.keys(values).length) out.paramValues = values;
  }
  const both = out.reads.filter((r) => out.writes.includes(r)), gboth = out.globalReads.filter((r) => out.globalWrites.includes(r));
  if (both.length) out.readsToo = both;
  if (gboth.length) out.globalReadsToo = gboth;
  for (const w of out.writes) out.reads = out.reads.filter((r) => r !== w);
  for (const w of out.globalWrites) out.globalReads = out.globalReads.filter((r) => r !== w);
  return out;
}

function calleeName(call: AstNode): string | null {
  const c = kids(call)[0];
  if (!c) return null;
  if (c.kind === 'Member') return c.detail ?? null;
  let d: AstNode | undefined = c;
  while (d && d.kind === 'ImplicitCast') d = kids(d)[0];
  return d && (d.kind === 'DeclRef' || d.kind === 'UnresolvedLookup') ? (d.detail ?? null) : null;
}
/** Where a call's callee is named: the name itself (`handle` in handle(req), `emplace` in out.emplace(…)). */
function calleeAt(call: AstNode): Range | null {
  let c = kids(call)[0];
  while (c && c.kind === 'ImplicitCast') c = kids(c)[0];
  if (!c?.range) return null;
  if (c.kind === 'Member' && c.detail) return { start: { line: c.range.end.line, character: Math.max(0, c.range.end.character - c.detail.length) }, end: c.range.end };
  return c.range;
}
function firstArg(call: AstNode, src: (r?: Range) => string): string {
  const a = kids(call)[1];
  return a ? src(a.range).replace(/^&/, '') : '';
}
/** The C++ attribute groups ([[…]]) written directly before an offset, separated only by whitespace. */
function attributesBefore(text: string, off: number): string {
  let i = off;
  for (;;) {
    let j = i;
    while (j > 0 && /\s/.test(text[j - 1])) j--;
    if (j < 2 || text.slice(j - 2, j) !== ']]') return text.slice(i, off);
    const open = text.lastIndexOf('[[', j - 2);
    if (open < 0) return text.slice(i, off);
    i = open;
  }
}
const offsetIn = (text: string, p: Pos) => { let off = 0; for (let l = 0; l < p.line; l++) { const k = text.indexOf('\n', off); if (k < 0) return text.length; off = k + 1; } return off + p.character; };
function sliceRange(text: string, r: Range): string {
  const off = (p: Pos) => { let o = 0; for (let l = 0; l < p.line; l++) { const i = text.indexOf('\n', o); if (i < 0) return text.length; o = i + 1; } return o + p.character; };
  return text.slice(off(r.start), off(r.end)).replace(/\s+/g, ' ').trim();
}
