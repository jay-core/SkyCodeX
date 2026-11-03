// Two runs of the same entry point lined up row by row: under two build settings (configurations), or, later, at two
// commits (what a change does). A row is the same row in both when it is reached the same way: the same function,
// called the same how-many-th time from the same row of the same caller, all the way up. What only one run has is
// said so: a row only the shown run has carries `only`; a row only the other has is a ghost in place, after the
// shown run's row that comes before it in the caller.
import type { Run, RunRow, Ghost } from './flowrun';

/** Each row's path from the start: caller's path, then this row's function and which call of it in that caller. */
function paths(run: Run): string[] {
  const out: string[] = [], seen = new Map<string, number>();
  run.rows.forEach((r, i) => {
    const id = r.kind === 'indirect' ? `?${r.text ?? r.name}` : r.kind === 'value' ? `=${r.key}` : r.key;
    const up = r.caller == null ? '' : out[r.caller];
    const k = `${up}\u0001${id}`, n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    out[i] = `${k}#${n}`;
  });
  return out;
}
const before = (a: RunRow['at'], b: RunRow['at']) => !!a && !!b && (a.line < b.line || (a.line === b.line && a.character < b.character));

/**
 * The shown run with what the other run has differently: rows only the shown run has say `only` (the topmost of
 * each new part), and every topmost row only the other has becomes a ghost, with how many rows it holds inside.
 * Calls are placed by where they are made, so this is for two runs of the same text (two settings).
 */
export function alignRuns(shown: Run, other: Run, onlyHere: string, onlyThere: string): { run: Run; added: number; removed: number } {
  const ps = paths(shown), po = paths(other);
  const inShown = new Map(ps.map((p, i) => [p, i])), inOther = new Set(po);
  const rows = shown.rows.map((r, i) => {
    const top = !inOther.has(ps[i]) && (r.caller == null || inOther.has(ps[r.caller]));
    return top ? { ...r, only: onlyHere } : r;
  });
  const ghosts: Ghost[] = [...(shown.ghosts ?? [])];
  let removed = 0;
  other.rows.forEach((r, i) => {
    if (inShown.has(po[i]) || r.caller == null) return;
    const owner = inShown.get(po[r.caller]);
    if (owner == null) return;   // inside a part the shown run doesn't have: counted in that part's ghost
    removed++;
    // after the last of the owner's own rows called before it, or right after the owner
    let after = owner;
    for (let j = owner + 1; j <= shown.rows[owner].last; j++) {
      const s = shown.rows[j];
      if (s.caller === owner && before(s.at, r.at)) after = s.last;
    }
    const inside = r.last - i;
    ghosts.push({ after, owner, names: [r.name], why: `${onlyThere}${inside ? ` · ${inside} more inside` : ''}` });
  });
  const added = rows.filter((r) => (r as RunRow).only).length;
  return { run: { ...shown, rows, ghosts: ghosts.sort((a, b) => a.after - b.after) }, added, removed };
}

// ---------- what a change does: two versions of the code ----------

/** A function the same in two versions of the code: its file within the project, its name, its parameters' types. */
function idOf(run: Run, i: number, root: string): string {
  const r = run.rows[i];
  if (r.kind === 'indirect') return `?${r.text ?? r.name}`;
  const rel = r.file.startsWith(root) ? r.file.slice(root.length).replace(/^[\\/]+/, '').replace(/\\/g, '/') : r.file;
  const ps = run.effects?.[r.key]?.params?.map((p) => p.type).join(', ') ?? '';
  return `${r.kind === 'value' ? '=' : ''}${rel}::${r.name}(${ps})`;
}
/** Like paths, but by what a function is rather than where its name is (lines move between versions). */
function idPaths(run: Run, root: string): string[] {
  const out: string[] = [], seen = new Map<string, number>();
  run.rows.forEach((r, i) => {
    const up = r.caller == null ? '' : out[r.caller], k = `${up}\u0001${idOf(run, i, root)}`, n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    out[i] = `${k}#${n}`;
  });
  return out;
}
/** A function's lines as written, each trimmed, keyed by its step (the text a change is measured on). */
export function functionTexts(run: Run, read: (file: string) => string | null): Record<string, string[]> {
  const out: Record<string, string[]> = {}, files = new Map<string, string[] | null>();
  for (const r of run.rows) {
    if (r.kind !== 'step' || !r.lines || out[r.key]) continue;
    if (!files.has(r.file)) { const t = read(r.file); files.set(r.file, t == null ? null : t.split('\n')); }
    const L = files.get(r.file);
    if (L) out[r.key] = L.slice(r.start, r.start + r.lines).map((l) => l.trim()).filter(Boolean);
  }
  return out;
}
/** How many lines differ between two versions of a function: those not in their longest common sequence, both sides. */
function linesChanged(a: string[], b: string[]): number {
  const m = a.length, n = b.length, d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) d[i][j] = a[i] === b[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  return m + n - 2 * d[0][0];
}
/** The conditions and loops a row sits in within its own caller, innermost last, as written. */
function within(run: Run, i: number): string[] {
  const r = run.rows[i];
  return r.frames.map((f) => run.frames[f]).filter((f) => f.owner === r.caller && (f.kind === 'arm' || f.kind === 'guard' || f.kind === 'loop'))
    .map((f) => (f.kind === 'arm' && f.label !== 'then' ? `${f.text} · ${f.label}` : f.text));
}

export interface Side { run: Run; root: string; texts: Record<string, string[]> }
/**
 * What a change does: the newer version's run, with what changed from the older one. Rows the newer one adds are
 * `change: 'added'`; a function both have whose lines differ is `'changed'` (`changed · 2 lines`); a row now under
 * another condition says so (`now inside if (ok)`); every topmost row only the older one has is a ghost in place
 * (kind removed), after the call made before it in the older version. Calls are lined up by what they call and in
 * which order, never by line, so code that only moved changes nothing. Summary: one line, the change in words.
 */
export function alignChange(newer: Side, older: Side, olderLabel: string): { run: Run; summary: string; added: number; removed: number; changed: number; moved: number } {
  const pn = idPaths(newer.run, newer.root), po = idPaths(older.run, older.root);
  const inNew = new Map(pn.map((p, i) => [p, i])), inOld = new Map(po.map((p, i) => [p, i]));
  const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
  const words: string[] = [], addedIn = new Map<string, number>(), moves: string[] = [];
  let changed = 0, removed = 0;
  const rows = newer.run.rows.map((r, i): RunRow => {
    const o = inOld.get(pn[i]);
    if (o == null) {
      if (r.caller == null || inOld.has(pn[r.caller])) { const w = short(newer.run.rows[r.caller ?? i].name); addedIn.set(w, (addedIn.get(w) ?? 0) + 1); }
      return { ...r, change: 'added', changeNote: 'added' };
    }
    const or = older.run.rows[o];
    const notes: string[] = [];
    let change: RunRow['change'];
    if (r.kind === 'step' && or.kind === 'step') {
      const a = newer.texts[r.key], b = older.texts[or.key];
      if (a && b) { const n = linesChanged(a, b); if (n) { change = 'changed'; changed++; notes.push(`changed · ${n} line${n > 1 ? 's' : ''}`); } }
    }
    const wn = within(newer.run, i), wo = within(older.run, o);
    if (wn.join('\u0001') !== wo.join('\u0001')) {
      const note = wn.length > wo.length || (wn.length && !wo.includes(wn[wn.length - 1])) ? `now inside ${wn[wn.length - 1]}` : `no longer inside ${wo[wo.length - 1]}`;
      notes.push(note);
      moves.push(`${short(r.name)} ${note}`);
    }
    return notes.length ? { ...r, ...(change ? { change } : {}), changeNote: notes.join(' · ') } : r;
  });
  const ghosts: Ghost[] = [...(newer.run.ghosts ?? [])];
  const gone: string[] = [];
  older.run.rows.forEach((r, i) => {
    if (inNew.has(po[i]) || r.caller == null || !inNew.has(po[r.caller])) return;
    const owner = inNew.get(po[r.caller])!;
    removed++;
    // after the call made just before it in the older version that the newer one still makes
    let after = owner;
    for (let j = i - 1; j > r.caller; j--) {
      const s = older.run.rows[j];
      if (s.caller !== r.caller) continue;
      const m = inNew.get(po[j]);
      if (m != null) { after = newer.run.rows[m].last; break; }
    }
    const inside = r.last - i;
    ghosts.push({ after, owner, names: [r.name], why: `removed · in ${olderLabel}${inside ? ` · ${inside} more inside` : ''}`, kind: 'removed' });
    gone.push(`− ${short(r.name)} from ${short(newer.run.rows[owner].name)}`);
  });
  for (const [w, n] of addedIn) words.push(`+ ${n} step${n > 1 ? 's' : ''} in ${w}`);
  words.push(...gone, ...moves);
  if (changed) words.push(`${changed} step${changed > 1 ? 's' : ''} changed`);
  const added = [...addedIn.values()].reduce((a, b) => a + b, 0);
  return { run: { ...newer.run, rows, ghosts: ghosts.sort((a, b) => a.after - b.after) }, summary: words.length ? words.join(' · ') : `no change to what this run does since ${olderLabel}`, added, removed, changed, moved: moves.length };
}

/**
 * The macros a text's preprocessor conditions test (#if, #ifdef, #ifndef, #elif, #elifdef), with the numbers they are
 * compared with: the choices a settings menu can offer. Read from the text only to list them; what code a setting
 * keeps is always the compiler's.
 */
export function macrosTested(text: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const SKIP = new Set(['defined', 'if', 'ifdef', 'ifndef', 'elif', 'elifdef', 'elifndef', '__has_include', '__has_include_next', '__has_attribute', '__has_builtin', '__has_feature', '__has_cpp_attribute', '__has_extension', 'true', 'false']);
  for (const m of text.matchAll(/^[ \t]*#[ \t]*(if|ifdef|ifndef|elif|elifdef|elifndef)\b([^\n]*(?:\\\n[^\n]*)*)/gm)) {
    const cond = m[2].replace(/\/\/.*$|\/\*[\s\S]*?\*\//g, ' ').replace(/__has_\w+\s*\([^)]*\)/g, ' ');
    for (const w of cond.matchAll(/[A-Za-z_]\w*/g)) {
      const name = w[0];
      if (SKIP.has(name) || /^\d/.test(name)) continue;
      if (!out.has(name)) out.set(name, new Set());
      // NAME == 2, NAME >= 3 …: the numbers it is compared with
      const after = cond.slice(w.index! + name.length);
      const v = /^\s*(?:==|!=|>=|<=|>|<)\s*(\d+)\b/.exec(after)?.[1];
      if (v) out.get(name)!.add(v);
    }
  }
  return out;
}
