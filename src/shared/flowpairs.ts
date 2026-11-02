// Pairs that don't close: something a function opens (a lock, memory, a file) and a way out of it where it is still
// open. Read from the function's own flow tree (src/shared/flowrun.ts), path by path: the states every path can be
// in are carried through branches, loops (until they stop changing) and early exits. A path through a goto, or into
// a call that never returns, is left unjudged rather than guessed. Grade: possible — the path is in the code, but
// whether it can run depends on its conditions, which may be linked.
import type { FlowNode, StmtKind, Target } from './flowrun';

/** One kind of pair: the calls that open and close it, by the callee's name (library functions only). */
interface Kind { what: string; open: RegExp; close: RegExp; by: 'arg' | 'result' }
const KINDS: Kind[] = [
  { what: 'lock', by: 'arg', open: /^(?:pthread_mutex_(?:timed)?lock|pthread_rwlock_(?:rd|wr)lock|pthread_spin_lock|mtx_(?:timed)?lock|EnterCriticalSection|AcquireSRWLock(?:Exclusive|Shared)|xSemaphoreTake(?:Recursive)?|semTake|k_mutex_lock|k_sem_take|osMutexAcquire|_*txe?_mutex_get|rt_mutex_take|OSMutexPend)$/,
    close: /^(?:pthread_mutex_unlock|pthread_rwlock_unlock|pthread_spin_unlock|mtx_unlock|LeaveCriticalSection|ReleaseSRWLock(?:Exclusive|Shared)|xSemaphoreGive(?:Recursive)?|semGive|k_mutex_unlock|k_sem_give|osMutexRelease|_*txe?_mutex_put|rt_mutex_release|OSMutexPost)$/ },
  { what: 'memory', by: 'result', open: /^(?:malloc|calloc|realloc|strdup|strndup|aligned_alloc|pvPortMalloc|k_malloc|rt_malloc)$/, close: /^(?:free|vPortFree|k_free|rt_free)$/ },
  { what: 'file', by: 'result', open: /^(?:fopen|fdopen|tmpfile|popen)$/, close: /^(?:fclose|pclose)$/ },
  { what: 'folder', by: 'result', open: /^(?:opendir|fdopendir)$/, close: /^closedir$/ },
];
/** std::mutex and its kin: x.lock() … x.unlock() on the same object. */
const MEMBER_LOCK = /^(?:lock|lock_shared)$/, MEMBER_UNLOCK = /^(?:unlock|unlock_shared)$/;

/** Whether the analyser should keep a call's arguments as written (only calls that open or close something). */
export const PAIR_CALL = new RegExp(`${KINDS.flatMap((k) => [k.open.source, k.close.source]).join('|')}|^(?:lock|lock_shared|unlock|unlock_shared)$`);

/** Something still open at a way out: what, where it was opened, and the way out with the conditions on the path. */
export interface Unclosed {
  what: string;                 // lock, memory, file, folder
  name: string;                 // the lock or variable as written: `&mtx`, `buf`
  opened: { line: number; text: string };
  exit: { kind: StmtKind | 'end'; line: number; text: string };
  path: string[];               // the conditions on the way, as written, in order (`if (n < 0)`, `while (more) · pass`)
}

type Held = Map<string, { n: number; line: number; text: string; what: string; name: string }>;
interface State { held: Held; path: string[] }
const keyOf = (s: State) => [...s.held].filter(([, v]) => v.n > 0).map(([k, v]) => `${k}=${v.n}`).sort().join(',');
const copy = (s: State, step?: string): State => ({ held: new Map([...s.held].map(([k, v]) => [k, { ...v }])), path: step ? [...s.path, step] : s.path });
/** The same resources held the same number of times: one state, the first path found kept as its example. */
const merge = (xs: State[]) => { const m = new Map<string, State>(); for (const x of xs) if (!m.has(keyOf(x))) m.set(keyOf(x), x); return [...m.values()]; };
const norm = (a: string) => a.replace(/\s+/g, '').replace(/^\(+|\)+$/g, '').replace(/^&/, '');

/** What a call opens or closes, if anything: the kind and the name it is matched on. */
function role(n: Extract<FlowNode, { t: 'call' }>, stmt: string): { open: boolean; what: string; name: string } | null {
  if (n.to.project) return null;
  const name = n.to.name.replace(/^.*::/, '');
  if (n.obj != null && (MEMBER_LOCK.test(name) || MEMBER_UNLOCK.test(name)) && /mutex/i.test(n.to.container)) return { open: MEMBER_LOCK.test(name), what: 'lock', name: n.obj };
  for (const k of KINDS) {
    const open = k.open.test(name), close = k.close.test(name);
    if (!open && !close) continue;
    if (k.by === 'arg' || close) { const a = n.args?.[0]; return a ? { open, what: k.what, name: norm(a) } : null; }
    // what an open returns goes into a variable: `p = malloc(n)`, `FILE *f = fopen(…)`
    const m = /(?:^|[^=!<>])\b([A-Za-z_]\w*(?:(?:\.|->)[A-Za-z_]\w*)*)\s*(?:\[[^\]]*\])?\s*=(?!=)[^;]*\b\w*\(/.exec(stmt);
    return m ? { open, what: k.what, name: m[1] } : null;
  }
  return null;
}

/** Every resource a function's body opens and leaves open at one of its ways out, one report per resource and way out. */
export function unclosed(body: FlowNode[], neverReturns: (to: Target) => boolean = () => false): Unclosed[] {
  const out: Unclosed[] = [], seen = new Set<string>();
  const report = (s: State, exit: Unclosed['exit']) => {
    for (const v of s.held.values()) {
      if (v.n <= 0) continue;
      const k = `${v.what}:${v.name}@${exit.line}:${exit.kind}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ what: v.what, name: v.name, opened: { line: v.line, text: v.text }, exit, path: s.path });
    }
  };
  // a loop's breaks and continues, innermost last
  const loops: { breaks: State[]; continues: State[] }[] = [];
  const calls = (list: FlowNode[], states: State[], stmt: string, line: number): State[] => {
    let cur = states;
    for (const n of list) {
      if (n.t === 'call' && (n.noreturn || (n.to.project && neverReturns(n.to)))) return [];   // the program ends here: nothing to judge
      if (n.t !== 'call') { if (n.t === 'stmt') cur = calls(n.body, cur, n.text, n.line); continue; }
      const r = role(n, stmt);
      if (!r) continue;
      const id = `${r.what}:${r.name}`;
      cur = cur.map((s) => {
        const t = copy(s), h = t.held.get(id);
        if (r.open) t.held.set(id, { n: Math.min(2, (h?.n ?? 0) + 1), line, text: stmt, what: r.what, name: r.name });
        else if (h) h.n = Math.max(0, h.n - 1);
        return t;
      });
    }
    return cur;
  };
  const walk = (list: FlowNode[], states: State[]): State[] => {
    let cur = states;
    for (const n of list) {
      if (!cur.length) break;
      switch (n.t) {
        case 'call': cur = calls([n], cur, n.to.name, n.at.line); break;
        case 'stmt': {
          cur = calls(n.body, cur, n.text, n.line);
          if (n.kind === 'return' || n.kind === 'throw' || n.kind === 'co_return') { for (const s of cur) report(s, { kind: n.kind, line: n.line, text: n.text }); cur = []; }
          else if (n.kind === 'goto') cur = [];   // where it lands is not in the tree: not judged
          else if (n.kind === 'break' && loops.length) { loops[loops.length - 1].breaks.push(...cur); cur = []; }
          else if (n.kind === 'continue' && loops.length) { loops[loops.length - 1].continues.push(...cur); cur = []; }
          break;
        }
        case 'guard': cur = walk(n.body, cur); break;
        case 'once': cur = merge([...cur, ...walk(n.body, cur)]); break;
        case 'branch': {
          const c = walk(n.cond, cur);
          const full = n.kind === 'if' ? n.arms.length === 2 : n.kind === 'switch' ? n.arms.some((a) => a.label.split(' · ').includes('default')) : n.kind === '?:';
          const after: State[] = full ? [] : c.map((s) => copy(s, `${n.text} · not taken`));
          // a switch arm that falls through runs on into the next one
          let fall: State[] = [];
          for (const a of n.arms) {
            const into = merge([...c.map((s) => copy(s, a.label === 'then' ? n.text : `${n.text} · ${a.label}`)), ...fall]);
            const res = walk(a.body, into);
            if (n.kind === 'switch' && a.fallsThrough && a !== n.arms[n.arms.length - 1]) fall = res; else { after.push(...res); fall = []; }
          }
          cur = merge(after);
          break;
        }
        case 'loop': {
          const before = walk(n.once, cur), pass = (xs: State[]) => xs.map((s) => copy(s, `${n.text} · pass`));
          const lp = { breaks: [] as State[], continues: [] as State[] };
          loops.push(lp);
          /** One pass from these states: where it ends, its continues included. */
          const run = (from: State[]) => { lp.continues = []; const r = walk(n.each, pass(from)); return merge([...r, ...lp.continues]); };
          // the states at the top of a pass: before the loop (a do always runs once first), then after each pass,
          // until a pass brings no new one (counts stop at 2, so this ends)
          let done = n.kind === 'do' ? run(before) : merge(before), frontier = done;
          for (let i = 0; i < 16 && frontier.length; i++) {
            const fresh = run(frontier).filter((s) => !done.some((d) => keyOf(d) === keyOf(s)));
            done = merge([...done, ...fresh]);
            frontier = fresh;
          }
          loops.pop();
          cur = merge([...done, ...lp.breaks]);
          break;
        }
        default: break;   // value, indirect: open nothing; deferred: another function's body
      }
    }
    return cur;
  };
  const end = walk(body, [{ held: new Map(), path: [] }]);
  for (const s of end) report(s, { kind: 'end', line: -1, text: 'the end of the function' });
  return out;
}
