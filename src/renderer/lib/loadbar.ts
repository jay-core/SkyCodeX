export type PartState = 'wait' | 'run' | 'done';
export interface LoadPart { state: PartState; done?: number; of?: number }
export interface BarPart { state: PartState; fill: number | null }
export interface LoadInputs {
  lsp: 'off' | 'starting' | 'ready' | 'failed';
  built: boolean;
  indexing: boolean;
  index: { done?: number; of?: number; pct?: number } | null;
  settling: boolean;
  retrying: boolean;
  entry: LoadPart;
  trace: LoadPart;
  read: LoadPart;
}

export const PART_NAMES = ['Entry points', 'Index', 'Trace', 'Reading each function', 'Stable'] as const;
export const PART_MEANINGS = [
  "Finding where programs start: main functions, or a library's public functions when there is no main.",
  "clangd reading the project's files, so each call can be followed to its definition.",
  'Following calls from the chosen program, one function at a time.',
  'Reading every function the program reaches, to build its steps.',
  'Tracing again every 2 s until two passes agree and every called function is listed; stops after 60 s at most.',
];

export const running = (i: LoadInputs) => i.entry.state === 'run' || i.trace.state === 'run' || i.read.state === 'run';

export function ready(i: LoadInputs): boolean {
  return i.lsp !== 'starting' && i.built && !i.indexing && !i.settling && !i.retrying && !running(i);
}

const known = (p: LoadPart): number | null => (p.of != null && p.of > 0 && p.done != null ? Math.min(1, Math.max(0, p.done / p.of)) : null);

export function parts(i: LoadInputs): BarPart[] {
  if (ready(i)) return Array.from({ length: 5 }, () => ({ state: 'done' as const, fill: null }));
  const index: BarPart = i.indexing
    ? { state: 'run', fill: i.index?.of ? Math.min(1, (i.index.done ?? 0) / i.index.of) : i.index?.pct != null ? i.index.pct / 100 : null }
    : { state: i.lsp === 'ready' || i.lsp === 'failed' ? 'done' : 'wait', fill: null };
  const step = (p: LoadPart): BarPart => ({ state: p.state, fill: p.state === 'run' ? known(p) : null });
  const stable: BarPart = i.settling || i.retrying ? { state: 'run', fill: null } : { state: [i.entry, i.trace, i.read].every((p) => p.state === 'done') && !running(i) ? 'done' : 'wait', fill: null };
  return [step(i.entry), index, step(i.trace), step(i.read), stable];
}

export interface Grid { x0: number; x1: number; cols: number; rows: number; dx: number; dy: number; r: number; h: number }

export function grid(x0: number, x1: number, h: number, r: number, space: number): Grid {
  const cols = Math.max(1, Math.round((x1 - x0 - 2 * r) / space)), rows = Math.max(1, Math.round((h - 2 * r) / space));
  return { x0, x1, cols, rows, dx: (x1 - x0 - 2 * r) / cols, dy: (h - 2 * r) / rows, r, h };
}
export const dotX = (g: Grid, c: number) => g.x0 + g.r + c * g.dx;
export const dotY = (g: Grid, row: number) => g.r + row * g.dy;

export const ARROW_PERIOD = 3600, TAIL_SHARE = 0.4, MOVING_TOP = 0.85;

export function front(g: Grid, fill: number): number {
  return g.x0 + fill * (g.x1 - g.x0 + g.h / 2);
}

export function movingFront(g: Grid, phase: number): number {
  const tail = (g.x1 - g.x0) * TAIL_SHARE, from = g.x0 - g.h / 2 - 1, to = g.x1 + g.h / 2 + tail;
  return from + (phase - Math.floor(phase)) * (to - from);
}

const cover = (g: Grid, x: number, y: number, f: number) => Math.min(1, Math.max(0, (f - Math.abs(y - g.h / 2) - x) / g.dx + 1));

export function level(g: Grid, part: BarPart, x: number, y: number, moving: number): number {
  if (part.state === 'done') return 1;
  if (part.state === 'wait') return 0;
  if (part.fill != null) return part.fill <= 0 ? 0 : cover(g, x, y, front(g, part.fill));
  const f = movingFront(g, moving), body = f - g.h / 2, tail = body - (g.x1 - g.x0) * TAIL_SHARE;
  const fade = Math.min(1, Math.max(0, (x - tail) / Math.max(1e-6, body - tail)));
  return MOVING_TOP * fade * cover(g, x, y, f);
}

export function ease(shown: number, target: number, ms: number, tau = 60): number {
  if (target <= shown) return target;
  const next = shown + (target - shown) * (1 - Math.exp(-ms / tau));
  return target - next < 0.0005 ? target : next;
}
