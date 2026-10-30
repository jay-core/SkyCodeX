// The analyser behind the flow view. Two parts, both pure (no Electron, no DOM) so they can be tested:
//
//  1. analyseFunction: what one function does, in the order it does it, from clangd's syntax tree
//     (textDocument/ast) and its outgoing calls (callHierarchy/outgoingCalls). Evaluation order follows the language:
//     arguments before the call, a `for`'s increment after its body, `&&` / `||` / `?:` make their right side
//     conditional, statements after an early `return` / `continue` only run when it was not taken, a lambda's body
//     runs later (or on a thread, when it is handed to std::thread and the like), a range-for's range is read once.
//     Nothing is guessed: a call whose order the language leaves open is marked, a call through a pointer or a
//     std::function is shown as indirect, a function named but not called is a value.
//
//  2. walkRun: every step from an entry point, numbered in execution order. A function is opened the first time it
//     runs; later calls are references to that step.

import type { Effects } from './flowfacts';

export interface Pos { line: number; character: number }
export interface Range { start: Pos; end: Pos }
/** A node of clangd's syntax tree, as textDocument/ast returns it. */
export interface AstNode { kind: string; role?: string; detail?: string; range?: Range; children?: AstNode[] }
/** A function a call reaches, as the call hierarchy names it. */
export interface Target { key: string; name: string; project: boolean; ctor: boolean; container: string }
/** One outgoing call of the call hierarchy: the callee and every place this function names it. */
export interface OutCall { to: Target; fromRanges: Range[] }

export type FlowNode =
  /** a call to a function; unsequenced: the language leaves its order against a sibling argument open */
  | { t: 'call'; to: Target; at: Pos; unsequenced?: boolean; approx?: boolean }
  /** a function named but not called here: a callback, a function pointer, a thread's start routine */
  | { t: 'value'; to: Target; at: Pos }
  /**
   * a call whose target is not known here: through a pointer, a member pointer or a std::function; dependent (in a
   * template: resolved per instantiation); or unresolved (the compiler could not make sense of it — a missing
   * include or define in this file's build settings)
   */
  | { t: 'indirect'; via: Via; text: string; at: Pos }
  | { t: 'stmt'; kind: StmtKind; line: number; text: string; body: FlowNode[] }
  /** cond always runs; then one arm (or none). For && and ||, the one arm is the right-hand side. */
  | { t: 'branch'; kind: 'if' | 'switch' | '?:' | '&&' | '||' | 'try'; text: string; line: number; cond: FlowNode[]; arms: Arm[] }
  /** once: before the first pass (a for's init, a range-for's range); each: every pass, in order */
  | { t: 'loop'; kind: 'while' | 'for' | 'for each' | 'do'; text: string; line: number; count: number | null; once: FlowNode[]; each: FlowNode[] }
  /** a lambda's body: runs when the lambda is called, or on a new thread */
  | { t: 'deferred'; kind: 'lambda' | 'thread'; text: string; line: number; body: FlowNode[] }
  /** a static local's initializer: the first time only */
  | { t: 'once'; text: string; line: number; body: FlowNode[] }
  /** what follows an early exit (`if (x) return …;`): runs only when that exit was not taken */
  | { t: 'guard'; text: string; exit: StmtKind; line: number; body: FlowNode[] };
export type Via = 'pointer' | 'member pointer' | 'std::function' | 'dependent' | 'unresolved';
export interface Arm { label: string; line: number; body: FlowNode[]; fallsThrough?: boolean }
export type StmtKind = 'code' | 'return' | 'break' | 'continue' | 'throw' | 'goto' | 'co_return';
/** dropped: places the index names a function but the syntax tree shows no call (a built-in operator, say) */
export interface FnFlow { body: FlowNode[]; dropped: { name: string; at: Pos }[] }

const CALLS = new Set(['Call', 'CXXMemberCall', 'CUDAKernelCall', 'UserDefinedLiteral']);
const CONSTRUCTS = new Set(['CXXConstruct', 'CXXTemporaryObject', 'CXXInheritedCtorInit', 'CXXNew']);
const BUILTIN_OPS = new Set(['BinaryOperator', 'UnaryOperator', 'CompoundAssignOperator', 'ArraySubscript', 'ConditionalOperator', 'BinaryConditionalOperator']);
const DEPENDENT = new Set(['CXXDependentScopeMember', 'DependentScopeDeclRef', 'UnresolvedLookup', 'UnresolvedMember', 'CXXUnresolvedConstruct']);
const UNEVALUATED = new Set(['UnaryExprOrTypeTrait', 'CXXNoexcept', 'CXXTypeid', 'CXXUuidof', 'Requires', 'Concept', 'CXXDefaultArg', 'CXXDefaultInit']);
const SKIP_ROLES = new Set(['type', 'specifier', 'template name', 'template argument']);
const EXITS: StmtKind[] = ['return', 'break', 'continue', 'throw', 'goto', 'co_return'];
/** Calls that start a thread with the callable they are given. */
/** Calls that start a thread or an RTOS task with the function they are given (RTOS APIs often behind a wrapper: ThreadX's tx_thread_create is _txe_thread_create). */
export const THREAD_START = /^(?:std::)?(?:thread|jthread|async|pthread_create|_beginthread(?:ex)?|CreateThread|xTaskCreate\w*|k_thread_create|taskSpawn|task_create|rt_thread_(?:create|init)|osThreadNew|osThreadCreate|_*txe?_thread_create|OSTaskCreate\w*|OS_(?:TASK_)?Create\w*|QtConcurrent::run)$/;
const ASSIGN = /^(?:=|\*=|\/=|%=|\+=|-=|<<=|>>=|&=|\^=|\|=)$/;
const LEFT_FIRST = /^(?:<<|>>|\[\]|->\*|,)$/;

const before = (a: Pos, b: Pos) => a.line < b.line || (a.line === b.line && a.character <= b.character);
const within = (r: Range, outer: Range) => before(outer.start, r.start) && before(r.end, outer.end);
const kids = (n: AstNode) => n.children ?? [];
/** Statements read from their source text (header, keyword, declaration), which need a range to be read. */
const SHAPED = new Set(['If', 'Switch', 'While', 'Do', 'For', 'CXXForRange', 'CXXTry', 'Return', 'Break', 'Continue', 'Goto', 'IndirectGoto', 'CoreturnStmt', 'Coreturn', 'Decl']);

/**
 * What one function does, in evaluation order. text is the function's whole file. A tree the analyser cannot follow
 * still gives the function's calls, in source order and marked approximate, so one odd function never stops a run.
 */
export function analyseFunction(ast: AstNode, text: string, calls: OutCall[]): FnFlow {
  try { return new Analyser(ast, text, calls).run(); } catch {
    const at = calls.flatMap((c) => c.fromRanges.map((r) => ({ to: c.to, at: r.start }))).sort((a, b) => (before(a.at, b.at) ? -1 : 1));
    return { body: at.map((x): FlowNode => ({ t: 'call', to: x.to, at: x.at, approx: true })), dropped: [] };
  }
}

class Analyser {
  private starts: number[] = [0];
  private parent = new Map<AstNode, AstNode>();
  private sites = new Map<AstNode, { to: Target; at: Pos }[]>();
  private values = new Map<AstNode, { to: Target; at: Pos }[]>();
  private loose: { to: Target; range: Range; done: boolean }[] = [];
  private dropped: { name: string; at: Pos }[] = [];
  private all: AstNode[] = [];

  constructor(private ast: AstNode, private text: string, calls: OutCall[]) {
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) this.starts.push(i + 1);
    const index = (n: AstNode) => { this.all.push(n); for (const c of kids(n)) { this.parent.set(c, n); index(c); } };
    index(ast);
    for (const c of calls) for (const r of c.fromRanges) this.place(c.to, r);
  }

  private off(p: Pos) { return (this.starts[p.line] ?? this.text.length) + p.character; }
  private src(r: Range) { return this.text.slice(this.off(r.start), this.off(r.end)); }
  private oneLine(r: Range) { return this.src(r).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim(); }

  /**
   * The most specific node whose range holds r: the smallest one, and of equal ones the deepest. (Siblings can
   * overlap — a range-for's loop variable spans the whole header — so the first match on the way down is not enough.)
   */
  private deepest(r: Range): AstNode | null {
    let best: AstNode | null = null, size = Infinity;
    for (const n of this.all) {
      if (!n.range || !within(r, n.range)) continue;
      const len = this.off(n.range.end) - this.off(n.range.start);
      if (len <= size) { best = n; size = len; }   // this.all is in tree order, so an equal-sized later node is deeper
    }
    return best;
  }

  /** Decides what naming `to` at `r` is: a call (at which call node), a value, or (when the tree has no node there, as in a macro) loose. */
  private place(to: Target, r: Range) {
    const at = r.start;
    const d = this.deepest(r);
    if (!d || d === this.ast) { this.loose.push({ to, range: r, done: false }); return; }
    if (to.ctor) {
      for (let n: AstNode | undefined = d; n; n = this.parent.get(n)) if (CONSTRUCTS.has(n.kind)) return this.add(this.sites, n, to, at);
      // a constructor named in a member initializer or a base specifier: it runs where the initializer is
      for (let n: AstNode | undefined = d; n; n = this.parent.get(n)) if (n.kind === 'MemberInitializer' || n.kind === 'BaseInitializer') return this.add(this.sites, n, to, at);
      this.loose.push({ to, range: r, done: false });
      return;
    }
    let via: AstNode = d;
    for (let n = this.parent.get(d); n; via = n, n = this.parent.get(n)) {
      if (CALLS.has(n.kind) || n.kind === 'CXXOperatorCall') {
        if (kids(n)[0] === via) return this.add(this.sites, n, to, at);
        break;   // named inside an argument: passed, not called
      }
      if (CONSTRUCTS.has(n.kind) || n.role === 'statement' || n.role === 'declaration') break;
    }
    // the index can name an overloaded operator where the compiler used the built-in one (float * float): no call
    if (/^operator\W/.test(to.name) && BUILTIN_OPS.has(d.kind)) { this.dropped.push({ name: to.name, at }); return; }
    if (d.kind === 'DeclRef' || d.kind === 'Member' || d.kind === 'UnresolvedLookup' || d.kind === 'UnresolvedMember') this.add(this.values, d, to, at);
    else if (CALLS.has(d.kind) || d.kind === 'CXXOperatorCall' || CONSTRUCTS.has(d.kind)) this.add(this.sites, d, to, at);
    else this.loose.push({ to, range: r, done: false });
  }
  private add(m: Map<AstNode, { to: Target; at: Pos }[]>, n: AstNode, to: Target, at: Pos) {
    const l = m.get(n) ?? [];
    if (!l.some((x) => x.to.key === to.key && x.at.line === at.line && x.at.character === at.character)) l.push({ to, at });
    m.set(n, l.sort((a, b) => (before(a.at, b.at) ? -1 : 1)));
  }

  run(): FnFlow {
    const body: FlowNode[] = [];
    for (const c of kids(this.ast)) {
      if (c.kind === 'MemberInitializer' || c.kind === 'BaseInitializer' || c.kind === 'DelegatingInitializer') {
        const inner: FlowNode[] = [];
        for (const e of kids(c)) this.expr(e, inner, false);
        for (const s of this.sites.get(c) ?? []) inner.push({ t: 'call', to: s.to, at: s.at });
        if (inner.length) body.push(...inner);
      } else if (c.kind === 'Compound' || c.kind === 'CXXTry') body.push(...this.stmts([c]));
    }
    const rest = this.loose.filter((l) => !l.done);
    for (const l of rest) body.push({ t: 'call', to: l.to, at: l.range.start, approx: true });
    return { body, dropped: this.dropped };
  }

  // ---------- statements ----------

  /** A block of statements; what follows an early exit becomes a guard, what follows an unconditional exit never runs. */
  private stmts(list: AstNode[]): FlowNode[] {
    const flat: AstNode[] = [];
    for (const s of list) {
      if (s.kind === 'Compound') flat.push(...kids(s));
      else flat.push(s);
    }
    const out: FlowNode[] = [];
    for (let i = 0; i < flat.length; i++) {
      const nodes = this.stmt(flat[i]);
      out.push(...nodes);
      const last = nodes[nodes.length - 1];
      if (!last) continue;
      if (exits(last)) break;   // the rest of the block is unreachable
      const early = earlyExit(last);
      if (early && i + 1 < flat.length) {
        const rest = this.stmts(flat.slice(i + 1));
        if (rest.length) out.push({ t: 'guard', text: early.text, exit: early.exit, line: early.line, body: rest });
        break;
      }
    }
    return out;
  }

  private stmt(s: AstNode): FlowNode[] {
    if (!s.range && !kids(s).length) return [];
    // a statement the tree gives no place for (written by a macro): its parts are read in order, without its shape
    if (!s.range && SHAPED.has(s.kind)) return this.stmts(kids(s));
    const line = s.range?.start.line ?? 0;
    switch (s.kind) {
      case 'Compound': return this.stmts([s]);
      case 'Null': return [];
      case 'Label': case 'Attributed': return this.stmts(kids(s).filter((k) => k.role === 'statement' || k.role === 'expression'));
      case 'If': return [this.ifStmt(s)];
      case 'Switch': return [this.switchStmt(s)];
      case 'While': case 'Do': case 'For': case 'CXXForRange': return [this.loop(s)];
      case 'CXXTry': return [this.tryStmt(s)];
      case 'Return': case 'Break': case 'Continue': case 'Goto': case 'IndirectGoto': case 'CoreturnStmt': case 'Coreturn': {
        const kind: StmtKind = s.kind === 'Return' ? 'return' : s.kind === 'Break' ? 'break' : s.kind === 'Continue' ? 'continue' : /oreturn/.test(s.kind) ? 'co_return' : 'goto';
        const body: FlowNode[] = [];
        for (const e of kids(s)) this.expr(e, body, false);
        this.flushLoose(s, body);
        return [{ t: 'stmt', kind, line, text: this.oneLine(s.range!), body }];
      }
      case 'Decl': {
        const body: FlowNode[] = [];
        const isStatic = /^\s*(?:(?:const|constexpr|inline|volatile|\[\[[^\]]*\]\])\s+)*(?:static|thread_local)\b/.test(this.src(s.range!));
        for (const v of kids(s)) for (const e of kids(v)) if (!SKIP_ROLES.has(e.role ?? '')) this.expr(e, body, false);
        for (const v of kids(s)) for (const x of this.sites.get(v) ?? []) body.push({ t: 'call', to: x.to, at: x.at });
        this.flushLoose(s, body);
        const st: FlowNode = { t: 'stmt', kind: 'code', line, text: this.oneLine(s.range!), body };
        return isStatic && body.length ? [{ t: 'once', text: this.oneLine(s.range!), line, body: [st] }] : [st];
      }
      default: {
        // an expression statement (or anything else that holds expressions)
        const body: FlowNode[] = [];
        const kind: StmtKind = s.kind === 'CXXThrow' || (s.kind === 'ExprWithCleanups' && kids(s)[0]?.kind === 'CXXThrow') ? 'throw' : 'code';
        this.expr(s, body, false);
        this.flushLoose(s, body);
        return [{ t: 'stmt', kind, line, text: s.range ? this.oneLine(s.range) : '', body }];
      }
    }
  }

  /** Calls the tree has no node for (inside a macro, say) are placed at the statement that contains them. */
  private flushLoose(s: AstNode, out: FlowNode[]) {
    if (!s.range) return;
    for (const l of this.loose) if (!l.done && within(l.range, s.range)) { l.done = true; out.push({ t: 'call', to: l.to, at: l.range.start, approx: true }); }
  }

  /** Splits a statement's children into those inside its header's parentheses and those after. */
  private header(s: AstNode) {
    const start = this.off(s.range!.start), open = this.text.indexOf('(', start);
    const close = open < 0 ? -1 : matchParen(this.text, open);
    // by where a child starts: a range-for's loop variable ends past the parenthesis but belongs to the header
    const inHead = (c: AstNode) => !!c.range && close > 0 && this.off(c.range.start) > open && this.off(c.range.start) < close;
    const head = kids(s).filter(inHead), rest = kids(s).filter((c) => !inHead(c) && (c.role === 'statement' || c.role === 'expression' || c.kind === 'Compound'));
    return { head, rest, open, close, text: close > 0 ? this.text.slice(start, close + 1).replace(/\s+/g, ' ').trim() : '' };
  }

  private headExprs(head: AstNode[], out: FlowNode[]) {
    for (const h of head) {
      if (h.kind === 'Decl' || h.role === 'declaration') out.push(...this.stmt(h.kind === 'Decl' ? h : { kind: 'Decl', role: 'statement', range: h.range, children: [h] }));
      else this.expr(h, out, false);
    }
  }

  private ifStmt(s: AstNode): FlowNode {
    const h = this.header(s);
    const cond: FlowNode[] = [];
    this.headExprs(h.head, cond);
    const arms: Arm[] = [];
    if (h.rest[0]) arms.push({ label: 'then', line: h.rest[0].range?.start.line ?? s.range!.start.line, body: this.stmts([h.rest[0]]) });
    if (h.rest[1]) arms.push({ label: 'else', line: h.rest[1].range?.start.line ?? s.range!.start.line, body: this.stmts([h.rest[1]]) });
    return { t: 'branch', kind: 'if', text: h.text, line: s.range!.start.line, cond, arms };
  }

  private switchStmt(s: AstNode): FlowNode {
    const h = this.header(s);
    const cond: FlowNode[] = [];
    this.headExprs(h.head, cond);
    const arms: Arm[] = [];
    let cur: { labels: string[]; line: number; list: AstNode[] } | null = null;
    const flush = () => { if (cur) { const body = this.stmts(cur.list); const last = body[body.length - 1]; arms.push({ label: cur.labels.join(' · '), line: cur.line, body, fallsThrough: !last || !exits(last) }); } };
    const visitCase = (c: AstNode) => {
      // case 1: case 2: stmt — the labels chain through the case's last child
      if (c.kind === 'Case' || c.kind === 'Default') {
        const label = c.kind === 'Default' ? 'default' : 'case ' + (kids(c)[0]?.range ? this.oneLine(kids(c)[0].range!) : '');
        if (!cur || cur.list.length) { flush(); cur = { labels: [label], line: c.range?.start.line ?? 0, list: [] }; } else cur.labels.push(label);
        const sub = kids(c)[kids(c).length - 1];
        if (sub && sub !== kids(c)[0] || c.kind === 'Default' && sub) visitCase(sub);
        return;
      }
      if (!cur) cur = { labels: ['before any case'], line: c.range?.start.line ?? 0, list: [] };
      cur.list.push(c);
    };
    for (const b of h.rest) for (const c of b.kind === 'Compound' ? kids(b) : [b]) visitCase(c);
    flush();
    for (const a of arms) if (a.body.length && last(a.body)?.t === 'stmt' && (last(a.body) as { kind: StmtKind }).kind === 'break') a.body.pop();   // a case's closing break is how it ends, not a step
    return { t: 'branch', kind: 'switch', text: h.text, line: s.range!.start.line, cond, arms };
  }

  private tryStmt(s: AstNode): FlowNode {
    const body = kids(s).filter((c) => c.kind === 'Compound');
    const cond = this.stmts(body.slice(0, 1));
    const arms: Arm[] = kids(s).filter((c) => c.kind === 'CXXCatch').map((c) => {
      const t = this.oneLine(c.range!);
      return { label: t.slice(0, t.indexOf(')') + 1) || 'catch', line: c.range!.start.line, body: this.stmts(kids(c).filter((k) => k.kind === 'Compound')) };
    });
    return { t: 'branch', kind: 'try', text: 'try', line: s.range!.start.line, cond, arms };
  }

  private loop(s: AstNode): FlowNode {
    const line = s.range!.start.line;
    if (s.kind === 'Do') {
      const body = kids(s).find((c) => c.role === 'statement' || c.kind === 'Compound');
      const cond = kids(s).filter((c) => c !== body && c.role === 'expression');
      const each = this.stmts(body ? [body] : []);
      for (const c of cond) this.expr(c, each, false);
      const t = this.oneLine(s.range!);
      return { t: 'loop', kind: 'do', text: 'do … ' + t.slice(t.lastIndexOf('while')).replace(/;$/, ''), line, count: null, once: [], each };
    }
    const h = this.header(s);
    const once: FlowNode[] = [], each: FlowNode[] = [];
    if (s.kind === 'While') {
      this.headExprs(h.head, each);
      each.push(...this.stmts(h.rest));
      return { t: 'loop', kind: 'while', text: h.text, line, count: null, once, each };
    }
    if (s.kind === 'For') {
      // init ; cond ; inc — told apart by where the header's own semicolons are
      const semis = topLevel(this.text, h.open, h.close, ';');
      const part = (c: AstNode) => { const o = this.off(c.range!.start); return o < (semis[0] ?? Infinity) ? 0 : o < (semis[1] ?? Infinity) ? 1 : 2; };
      this.headExprs(h.head.filter((c) => part(c) === 0), once);
      this.headExprs(h.head.filter((c) => part(c) === 1), each);
      each.push(...this.stmts(h.rest));
      this.headExprs(h.head.filter((c) => part(c) === 2), each);
      return { t: 'loop', kind: 'for', text: h.text, line, count: forCount(h.text, this.src(s.range!).slice(h.close - this.off(s.range!.start) + 1)), once, each };
    }
    // range-for: an init-statement and the range are read once; the loop variable is set on every pass
    const colon = topLevel(this.text, h.open, h.close, ':')[0] ?? h.close;
    for (const c of h.head) {
      if (this.off(c.range!.start) > colon) this.expr(c, once, false);
      else if (c.kind === 'Decl' && kids(c).some((v) => kids(v).some((e) => !SKIP_ROLES.has(e.role ?? '')))) (topLevel(this.text, h.open, colon, ';').length && this.off(c.range!.end) <= (topLevel(this.text, h.open, colon, ';')[0] ?? 0) ? once : each).push(...this.stmt(c));
    }
    each.push(...this.stmts(h.rest));
    return { t: 'loop', kind: 'for each', text: h.text, line, count: null, once, each };
  }

  // ---------- expressions, in evaluation order ----------

  private expr(n: AstNode, out: FlowNode[], threadArg: boolean): void {
    if (SKIP_ROLES.has(n.role ?? '') || UNEVALUATED.has(n.kind)) return;
    if (n.kind === 'Lambda') {
      // captures are evaluated here; the body runs when the lambda is called (or on the thread it is handed to)
      const body = kids(n).find((c) => c.kind === 'Compound');
      for (const c of kids(n)) if (c !== body && c.role === 'expression' && c.kind !== 'CXXThis') this.expr(c, out, false);
      out.push({ t: 'deferred', kind: threadArg ? 'thread' : 'lambda', text: firstLine(this.src(n.range!)), line: n.range!.start.line, body: body ? this.stmts([body]) : [] });
      return;
    }
    const c = kids(n);
    if (n.kind === 'BinaryOperator' && (n.detail === '&&' || n.detail === '||')) {
      const cond: FlowNode[] = [], rhs: FlowNode[] = [];
      this.expr(c[0], cond, false);
      if (c[1]) this.expr(c[1], rhs, false);
      if (!rhs.length) { out.push(...cond); return; }
      out.push({ t: 'branch', kind: n.detail, text: c[0].range ? this.oneLine(c[0].range) : '', line: n.range!.start.line, cond, arms: [{ label: c[1].range ? this.oneLine(c[1].range) : '', line: c[1].range?.start.line ?? 0, body: rhs }] });
      return;
    }
    if (n.kind === 'ConditionalOperator' || n.kind === 'BinaryConditionalOperator') {
      const cond: FlowNode[] = [], a: FlowNode[] = [], b: FlowNode[] = [];
      this.expr(c[0], cond, false);
      if (n.kind === 'ConditionalOperator') { if (c[1]) this.expr(c[1], a, false); if (c[2]) this.expr(c[2], b, false); }
      else if (c[c.length - 1]) this.expr(c[c.length - 1], b, false);
      if (!a.length && !b.length) { out.push(...cond); return; }
      out.push({ t: 'branch', kind: '?:', text: c[0].range ? this.oneLine(c[0].range) : '', line: n.range!.start.line, cond, arms: [{ label: 'then', line: c[1]?.range?.start.line ?? 0, body: a }, { label: 'else', line: c[c.length - 1]?.range?.start.line ?? 0, body: b }] });
      return;
    }
    if ((n.kind === 'BinaryOperator' || n.kind === 'CompoundAssignOperator') && ASSIGN.test(n.detail ?? '')) {
      // C++17: the right side of an assignment is evaluated before the left
      if (c[1]) this.expr(c[1], out, false);
      this.expr(c[0], out, false);
      return;
    }
    if (n.kind === 'CXXOperatorCall') {
      const op = unwrap(c[0])?.detail ?? '';
      const operands = c.slice(1);
      const order = ASSIGN.test(op.replace(/^operator/, '')) ? [...operands].reverse() : operands;
      this.args(order, out, false, !LEFT_FIRST.test(op.replace(/^operator/, '')) && !ASSIGN.test(op.replace(/^operator/, '')));
      const sites = this.sites.get(n) ?? [];
      const fn = sites.find((s) => s.to.name === 'operator()' && !s.to.project && /\bfunction\b/.test(s.to.container));
      if (op === 'operator()' && fn) out.push({ t: 'indirect', via: 'std::function', text: c[1]?.range ? this.oneLine(c[1].range) : '', at: n.range!.start });
      else for (const s of sites) out.push({ t: 'call', to: s.to, at: s.at });
      return;
    }
    if (CALLS.has(n.kind)) {
      const callee = c[0];
      const starts = THREAD_START.test(calleeName(callee) ?? '');
      if (callee) this.expr(callee, out, false);
      this.args(c.slice(1), out, starts, true);
      const sites = this.sites.get(n) ?? [];
      const ind: Via | null = n.kind === 'Call' ? indirectVia(callee) : n.kind === 'CXXMemberCall' && memberPointer(callee) ? 'member pointer' : null;
      if (ind && !sites.some((s) => s.to.project)) out.push({ t: 'indirect', via: ind, text: callee?.range ? this.oneLine(callee.range) : '', at: n.range!.start });
      for (const s of sites) out.push({ t: 'call', to: s.to, at: s.at });
      return;
    }
    if (CONSTRUCTS.has(n.kind)) {
      const starts = n.kind !== 'CXXNew' && THREAD_START.test(n.detail ?? '');
      this.args(c.filter((k) => !SKIP_ROLES.has(k.role ?? '')), out, starts, true);
      for (const s of this.sites.get(n) ?? []) out.push({ t: 'call', to: s.to, at: s.at });
      return;
    }
    for (const k of c) this.expr(k, out, threadArg);
    for (const v of this.values.get(n) ?? []) out.push(threadArg ? { t: 'deferred', kind: 'thread', text: v.to.name, line: v.at.line, body: [{ t: 'call', to: v.to, at: v.at }] } : { t: 'value', to: v.to, at: v.at });
    for (const s of this.sites.get(n) ?? []) out.push({ t: 'call', to: s.to, at: s.at });
  }

  /** Arguments, left to right as written; when two of them call project functions, which runs first is the compiler's choice. */
  private args(list: AstNode[], out: FlowNode[], threadArg: boolean, unsequenced: boolean) {
    const parts = list.map((a) => { const o: FlowNode[] = []; this.expr(a, o, threadArg); return o; });
    const withCalls = parts.filter((p) => p.some(hasCall)).length;
    for (const p of parts) {
      if (unsequenced && withCalls > 1) markUnsequenced(p);
      out.push(...p);
    }
  }
}

const last = <T>(a: T[]) => a[a.length - 1];
const firstLine = (s: string) => { const l = s.split('\n')[0].trim(); return l.length < s.trim().length ? l + ' …' : l; };
function unwrap(n: AstNode | undefined): AstNode | undefined {
  while (n && (n.kind === 'ImplicitCast' || n.kind === 'Paren' || n.kind === 'MaterializeTemporary' || n.kind === 'ExprWithCleanups')) n = kids(n)[0];
  return n;
}
function calleeName(n: AstNode | undefined): string | null {
  const u = unwrap(n);
  if (!u) return null;
  if (u.kind === 'DeclRef' || u.kind === 'UnresolvedLookup') {
    const ns = kids(u).filter((k) => k.role === 'specifier').map((k) => k.detail ?? '').join('');
    return ns + (u.detail ?? '');
  }
  if (u.kind === 'Member' || u.kind === 'UnresolvedMember') return u.detail ?? null;
  return null;
}
/**
 * A plain call is direct when its callee is a function (the compiler decays it to a pointer). Otherwise: dependent
 * inside a template, unresolved where the compiler gave up, and through a pointer for anything else.
 */
function indirectVia(callee: AstNode | undefined): Via | null {
  let n = callee;
  while (n && n.kind === 'Paren') n = kids(n)[0];
  if (!n) return null;
  if (n.kind === 'ImplicitCast' && n.detail === 'FunctionToPointerDecay') return null;
  if (n.kind === 'DeclRef' || n.kind === 'Member') return null;   // a builtin, or a function the cast above was left out for
  if (contains(n, (k) => k.kind === 'Recovery')) return 'unresolved';
  if (DEPENDENT.has(n.kind)) return 'dependent';
  return 'pointer';
}
function contains(n: AstNode, f: (k: AstNode) => boolean): boolean { return f(n) || kids(n).some((k) => contains(k, f)); }
function memberPointer(callee: AstNode | undefined): boolean {
  let n = callee;
  while (n && (n.kind === 'Paren' || n.kind === 'ImplicitCast')) n = kids(n)[0];
  return !!n && n.kind === 'BinaryOperator' && (n.detail === '->*' || n.detail === '.*');
}
function hasCall(n: FlowNode): boolean {
  switch (n.t) {
    case 'call': return n.to.project;
    case 'indirect': return true;
    case 'value': return false;
    case 'stmt': case 'deferred': case 'once': case 'guard': return n.body.some(hasCall);
    case 'branch': return n.cond.some(hasCall) || n.arms.some((a) => a.body.some(hasCall));
    case 'loop': return n.once.some(hasCall) || n.each.some(hasCall);
  }
}
function markUnsequenced(list: FlowNode[]) {
  for (const n of list) {
    if (n.t === 'call' && n.to.project) n.unsequenced = true;
    else if (n.t === 'branch') { markUnsequenced(n.cond); for (const a of n.arms) markUnsequenced(a.body); }
  }
}
/** A statement that always leaves the block. */
function exits(n: FlowNode): boolean {
  if (n.t === 'stmt') return EXITS.includes(n.kind);
  if (n.t === 'branch' && (n.kind === 'if' || n.kind === 'switch' || n.kind === 'try')) {
    const full = n.kind === 'if' ? n.arms.length === 2 : n.kind === 'switch' ? n.arms.some((a) => a.label.split(' · ').includes('default')) : true;
    return full && n.arms.length > 0 && n.arms.every((a) => { const l = last(a.body); return !!l && exits(l) && !(n.kind === 'switch' && l.t === 'stmt' && l.kind === 'break'); })
      && (n.kind !== 'try' || (!!last(n.cond) && exits(last(n.cond)!)));
  }
  if (n.t === 'guard') { const l = last(n.body); return !!l && exits(l); }
  return false;
}
/** An if whose taken arm leaves the block while the other does not: what follows runs only when it was not taken. */
function earlyExit(n: FlowNode): { text: string; exit: StmtKind; line: number } | null {
  if (n.t !== 'branch' || n.kind !== 'if') return null;
  const ex = n.arms.map((a) => { const l = last(a.body); return l && exits(l) ? exitKind(l) : null; });
  if (ex.every((e) => e) && n.arms.length === 2) return null;   // both leave: handled by exits()
  const i = ex.findIndex((e) => e);
  if (i < 0) return null;
  return { text: n.arms[i].label === 'then' ? n.text : `${n.text} … else`, exit: ex[i]!, line: n.line };
}
function exitKind(n: FlowNode): StmtKind {
  if (n.t === 'stmt') return n.kind;
  if (n.t === 'branch') { for (const a of n.arms) { const l = last(a.body); if (l) return exitKind(l); } }
  if (n.t === 'guard') { const l = last(n.body); if (l) return exitKind(l); }
  return 'return';
}

/** The closing parenthesis of the one at `open`, skipping strings, characters and comments. */
export function matchParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' || ch === "'") { i = skipQuoted(s, i); continue; }
    if (ch === '/' && s[i + 1] === '/') { const e = s.indexOf('\n', i); i = e < 0 ? s.length : e; continue; }
    if (ch === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 1; continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i;
  }
  return -1;
}
function skipQuoted(s: string, i: number): number {
  const q = s[i];
  // raw strings: R"tag( … )tag"
  if (q === '"' && s[i - 1] === 'R') { const m = /^"([^(\s]*)\(/.exec(s.slice(i)); if (m) { const e = s.indexOf(`)${m[1]}"`, i); return e < 0 ? s.length : e + m[1].length + 1; } }
  for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === q || s[j] === '\n') return j; }
  return s.length;
}
/** Offsets of `ch` at the top level between open and close (not inside nested brackets, strings or a `::`). */
function topLevel(s: string, open: number, close: number, ch: string): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = open + 1; i < close; i++) {
    const c = s[i];
    if (c === '"' || c === "'") { i = skipQuoted(s, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (depth === 0 && c === ch) {
      if (ch === ':' && (s[i + 1] === ':' || s[i - 1] === ':')) continue;
      out.push(i);
    }
  }
  return out;
}
/**
 * The number of passes of `for (int i = A; i < B; ++i)` with literal bounds — only when it is certain:
 * the body never assigns the counter, takes its address, or leaves early.
 */
export function forCount(head: string, body: string): number | null {
  const m = /^for\s*\(\s*(?:(?:unsigned|signed|int|long|short|size_t|std::size_t|auto|u?int\d+_t|std::u?int\d+_t)\s+)*(\w+)\s*=\s*(-?\d+)\s*;\s*\1\s*(<|<=|!=)\s*(-?\d+)\s*;\s*(?:\+\+\s*\1|\1\s*\+\+|\1\s*\+=\s*1)\s*\)$/.exec(head);
  if (!m) return null;
  const [, v, a, op, b] = m;
  const code = body.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  if (/\b(break|return|goto|throw|co_return|longjmp|exit|abort)\b/.test(code)) return null;
  if (new RegExp(`(\\+\\+|--)\\s*\\b${v}\\b|\\b${v}\\b\\s*(\\+\\+|--|[-+*/%&|^]?=(?!=)|<<=|>>=)|&\\s*\\b${v}\\b`).test(code)) return null;
  const n = Number(b) - Number(a) + (op === '<=' ? 1 : 0);
  return n >= 0 ? n : 0;
}

/**
 * A function's extent, from the compiler: the syntax tree's root when it is the function. Call items from outgoing
 * calls can carry the declaration's first line only, which would cut its code short and fold long helpers.
 */
const FN_KIND = /^(Function|CXXMethod|CXXConstructor|CXXDestructor|CXXConversion|FunctionTemplate)$/;
/** The function in a syntax tree asked for by its range: itself, or the one inside a wrapper (extern "C" { … }, a template). */
export function functionNode(ast: AstNode | null | undefined): AstNode | null {
  if (!ast) return null;
  const queue = [ast];
  for (let i = 0; i < queue.length && i < 64; i++) { if (FN_KIND.test(queue[i].kind)) return queue[i]; queue.push(...kids(queue[i])); }
  return ast;
}

export function fnExtent(ast: AstNode | null | undefined, fallback: Range): { start: number; lines: number } {
  const r = ast?.range && /^(Function|CXXMethod|CXXConstructor|CXXDestructor|CXXConversion|FunctionTemplate)$/.test(ast.kind) ? ast.range : fallback;
  return { start: r.start.line, lines: r.end.line - r.start.line + 1 };
}

// ---------- the run ----------

/** What the run needs to know about a function. */
export interface FnInfo { name: string; file: string; line: number; start?: number; lines: number; flow: FnFlow; overrides?: Target[]; effects?: Effects }

/**
 * One row of the run, in execution order. A step is numbered; a ref is a later call of a function already opened
 * (it points at that step); indirect and value rows are what the analyser can say about calls it cannot follow.
 */
export interface RunRow {
  kind: 'step' | 'ref' | 'indirect' | 'value';
  n: number;                 // the step's number (0 for rows that are not steps)
  key: string;               // the function (steps, refs, values)
  name: string;
  file: string;
  line: number;              // the line of the function's name (0-based)
  start: number;             // the function's first line, return type included (0-based)
  caller: number | null;     // the row of the step this runs inside
  at: Pos | null;            // where the caller makes the call
  depth: number;
  frames: number[];          // frames around this row, outermost first
  thread: boolean;           // runs on a thread another step started
  last: number;              // the last row inside this step (itself when it calls nothing)
  ref?: number;              // ref: the row of the step it refers to
  recursive?: boolean;       // ref: a call back into a step still running
  unsequenced?: boolean;
  approx?: boolean;          // placed at its statement, not its exact position (a macro)
  via?: string;              // indirect: how (pointer, std::function, …); value: the callee
  could?: string[];          // indirect: functions it may reach — those whose address the code takes (probable, not proved)
  text?: string;
  lines: number;             // the function's length in lines (0 when unknown)
}
export interface RunFrame {
  kind: 'loop' | 'arm' | 'guard' | 'lambda' | 'thread' | 'once' | 'virtual';
  text: string;              // the loop or condition as written
  label: string;             // the arm: then, else, case 3, the right side of && …
  count: number | null;      // a loop's passes, when certain
  fallsThrough?: boolean;    // a switch arm that runs on into the next one
  owner: number;             // the row of the function it is in
  line: number;
  from: number; to: number;  // the rows inside it
  parent: number | null;
}
/** effects: what each function of the run does besides calling (src/shared/flowfacts.ts), by its key. */
export interface Run { rows: RunRow[]; frames: RunFrame[]; missing: string[]; effects?: Record<string, Effects> }

/** Every step from the entry point, numbered in execution order. flows: the facts of each function, by key. */
export function walkRun(start: string, flows: (key: string) => FnInfo | undefined): Run {
  const rows: RunRow[] = [], frames: RunFrame[] = [];
  const opened = new Map<string, number>();   // function → its step row
  const running = new Set<string>();
  const missing = new Set<string>();
  let n = 0;

  const open = (key: string, caller: number | null, at: Pos | null, frameStack: number[], thread: boolean, extra: Partial<RunRow> = {}): void => {
    const info = flows(key);
    const depth = caller == null ? 0 : rows[caller].depth + 1;
    const seen = opened.get(key);
    if (seen != null) {
      rows.push({ kind: 'ref', n: 0, key, name: rows[seen].name, file: rows[seen].file, line: rows[seen].line, start: rows[seen].start, caller, at, depth, frames: [...frameStack], thread, last: rows.length, ref: seen, recursive: running.has(key), lines: rows[seen].lines, ...extra });
      return;
    }
    const row = rows.length;
    rows.push({ kind: 'step', n: ++n, key, name: info?.name ?? key, file: info?.file ?? '', line: info?.line ?? 0, start: info?.start ?? info?.line ?? 0, caller, at, depth, frames: [...frameStack], thread, last: row, lines: info?.lines ?? 0, ...extra });
    opened.set(key, row);
    if (!info) { missing.add(key); return; }
    running.add(key);
    walk(info.flow.body, row, [], thread);
    running.delete(key);
    rows[row].last = rows.length - 1;
  };

  const frame = (f: Omit<RunFrame, 'from' | 'to' | 'parent'>, stack: number[], body: () => void) => {
    const id = frames.length;
    frames.push({ ...f, from: rows.length, to: rows.length - 1, parent: stack.length ? stack[stack.length - 1] : null });
    stack.push(id);
    body();
    stack.pop();
    frames[id].to = rows.length - 1;
  };

  /** stack: the frames open inside the current function, outermost first (the caller's are on its row). */
  const walk = (list: FlowNode[], owner: number, stack: number[], thread: boolean): void => {
    const around = () => [...rows[owner].frames, ...stack];
    for (const node of list) {
      switch (node.t) {
        case 'call': {
          if (!node.to.project) break;
          const info = flows(node.to.key);
          const extra: Partial<RunRow> = { unsequenced: node.unsequenced, approx: node.approx };
          if (info?.overrides?.length) {
            frame({ kind: 'virtual', text: `${node.to.name} · one of ${info.overrides.length + 1}`, label: '', count: null, owner, line: node.at.line }, stack, () => {
              open(node.to.key, owner, node.at, around(), thread, extra);
              for (const o of info.overrides!) open(o.key, owner, node.at, around(), thread, extra);
            });
          } else open(node.to.key, owner, node.at, around(), thread, extra);
          break;
        }
        case 'value':
          if (node.to.project) rows.push({ kind: 'value', n: 0, key: node.to.key, name: node.to.name, file: '', line: 0, start: 0, caller: owner, at: node.at, depth: rows[owner].depth + 1, frames: around(), thread, last: rows.length, via: node.to.name, lines: 0 });
          break;
        case 'indirect':
          rows.push({ kind: 'indirect', n: 0, key: '', name: node.text, file: '', line: 0, start: 0, caller: owner, at: node.at, depth: rows[owner].depth + 1, frames: around(), thread, last: rows.length, via: node.via, text: node.text, lines: 0 });
          break;
        case 'stmt': walk(node.body, owner, stack, thread); break;
        case 'once': frame({ kind: 'once', text: node.text, label: '', count: null, owner, line: node.line }, stack, () => walk(node.body, owner, stack, thread)); break;
        case 'guard': frame({ kind: 'guard', text: node.text, label: node.exit, count: null, owner, line: node.line }, stack, () => walk(node.body, owner, stack, thread)); break;
        case 'deferred': frame({ kind: node.kind, text: node.text, label: '', count: null, owner, line: node.line }, stack, () => walk(node.body, owner, stack, thread || node.kind === 'thread')); break;
        case 'branch':
          walk(node.cond, owner, stack, thread);
          for (const a of node.arms) frame({ kind: 'arm', text: node.text, label: node.kind === '&&' || node.kind === '||' ? `${node.kind} ${a.label}` : a.label, count: null, owner, line: a.line, ...(a.fallsThrough && a !== node.arms[node.arms.length - 1] ? { fallsThrough: true } : {}) }, stack, () => walk(a.body, owner, stack, thread));
          break;
        case 'loop':
          walk(node.once, owner, stack, thread);
          frame({ kind: 'loop', text: node.text, label: node.kind, count: node.count, owner, line: node.line }, stack, () => walk(node.each, owner, stack, thread));
          break;
      }
    }
  };

  open(start, null, null, [], false);
  // frames with no rows inside say nothing about the run; their ids are kept stable by leaving them in place
  const fx: Record<string, Effects> = {};
  for (const k of opened.keys()) { const e = flows(k)?.effects; if (e) fx[k] = e; }
  return { rows, frames, missing: [...missing], effects: fx };
}
