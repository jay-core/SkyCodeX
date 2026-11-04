// The flow page's preview pane, the same in both views: the selected step's code with the line that leads on marked,
// where it was called from, and the moves that work here.
import { For, Show, createMemo, createSignal } from 'solid-js';
import Split from './Split';
import { seq, trail, runStatus } from '../lib/flowstore';
import { stepWays } from '../../shared/flowseq';
import { openFile } from '../lib/store';
import { basename } from '../lib/api';
import { lines } from '../lib/seqtext';
import SeqCode from './SeqCode';

const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');

// the code pane's width on the flow page, shared by both views and kept between sessions
const WIDTH_KEY = 'litho.flow.codeW';
const savedW = (() => { try { const v = Number(localStorage.getItem(WIDTH_KEY)); return v >= 280 ? v : 440; } catch { return 440; } })();
export const [stepW, setStepW] = createSignal(savedW);
/** The divider before the code pane: dragging left widens the pane; the diagram keeps at least 420 px. */
export function StepSplit() {
  return <Split onDrag={(dx) => setStepW(Math.round(Math.max(280, Math.min(window.innerWidth - 420, stepW() - dx))))}
    onEnd={() => { try { localStorage.setItem(WIDTH_KEY, String(stepW())); } catch { /* not kept */ } }} />;
}

/** Opens the editor at the selected step: the function, or for a call through a pointer the line making it. */
export function openStep() {
  const s = seq(), c = trail()[trail().length - 1];
  if (!s || !c || c.at >= s.items.length) return;
  const r = s.run.rows[s.items[c.at]];
  const file = r.kind === 'indirect' || r.kind === 'value' ? s.run.rows[r.caller!].file : r.file;
  const line = r.kind === 'indirect' || r.kind === 'value' ? r.at!.line : r.line;
  if (file) openFile(file, { line, character: 0 });
}

export default function StepPreview() {
  const cur = () => trail()[trail().length - 1];
  const S = () => seq();
  const atEnd = () => !!S() && !!cur() && cur()!.at >= S()!.items.length;
  const stepNo = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c || c.at >= s.items.length) return '';
    const r = s.run.rows[s.items[c.at]];
    return String(r.kind === 'step' ? r.n : r.kind === 'ref' ? s.run.rows[r.ref!].n : r.caller != null ? s.run.rows[r.caller].n : '');
  });
  const code = createMemo(() => {
    const c = cur(), s = S();
    if (!c || !s || c.at >= s.items.length) return null;
    const r = s.run.rows[s.items[c.at]];
    // an indirect call or a named function: its caller's code, at that line
    const fnRow = r.kind === 'indirect' || r.kind === 'value' ? r.caller! : r.kind === 'ref' ? r.ref! : s.items[c.at];
    const f = s.run.rows[fnRow];
    const L = lines(f.file);
    if (!L || !f.lines) return null;
    let hl = -1;
    if (r.kind === 'indirect' || r.kind === 'value') hl = r.at!.line;
    else if (c.at + 1 < s.items.length) { const nx = s.run.rows[s.items[c.at + 1]]; if (nx.caller === fnRow && nx.at) hl = nx.at.line; }
    return { file: f.file, start: f.start, text: L.slice(f.start, f.start + f.lines).join('\n'), hl };
  });
  const calledFrom = createMemo(() => {
    const c = cur(), s = S();
    if (!c || !s || c.at >= s.items.length) return null;
    const r = s.run.rows[s.items[c.at]];
    if (r.caller == null || !r.at) return null;
    const cf = s.run.rows[r.caller], L = lines(cf.file);
    return { name: short(cf.name), n: cf.n, file: basename(cf.file), line: r.at.line + 1, text: L?.[r.at.line]?.trim() ?? '' };
  });
  const ways = createMemo(() => (S() ? stepWays(S()!, trail()) : []));
  return (
    <div class="pane prev" style={{ width: `${stepW()}px`, flex: 'none' }}>
      <Show when={cur() && S()} fallback={<div class="empty">{runStatus() || 'the code of each step shows here'}</div>}>
        <div class="ph" style={{ padding: '0 20px' }}>
          <span style={{ color: 'var(--bright)' }}>{atEnd() ? 'end of the run' : stepNo() ? `step ${stepNo()}` : ''}</span>
          <span class="grow" /><Show when={!atEnd()}><button class="chip" onClick={openStep}>open file ›</button></Show>
        </div>
        <Show when={calledFrom()}>
          <div class="sfrom"><span class="h">from {calledFrom()!.n} {calledFrom()!.name} · {calledFrom()!.file}:{calledFrom()!.line}</span><code>{calledFrom()!.text}</code></div>
        </Show>
        <Show when={code()} keyed>{(c) => <SeqCode file={c.file} text={c.text} start={c.start} hl={c.hl} />}</Show>
        <Show when={!atEnd()}><div class="ways pv"><For each={ways()}>{([k, w]) => <span><b>{k}</b> {w}</span>}</For></div></Show>
      </Show>
    </div>
  );
}
