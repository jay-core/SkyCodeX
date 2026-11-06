// The flow page's preview pane, the same in both views: the selected step's code with the line that leads on marked,
// where it was called from, and the moves that work here.
import { For, Show, createMemo, createSignal, onMount, onCleanup, JSX } from 'solid-js';
import Split from './Split';
import { seq, trail, runStatus, stepMove } from '../lib/flowstore';
import { stepWays, stepNumbers, ordinal } from '../../shared/flowseq';
import { detailCard, DetailCard } from '../../shared/metrofacts';
import { openFile } from '../lib/store';
import { basename } from '../lib/api';
import { lines } from '../lib/seqtext';
import SeqCode, { CodeCall } from './SeqCode';

const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
const escH = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** The calling line with the called name outlined, as calls are in the folder tab's preview panes (escaped; first match). */
const underlineCall = (text: string, name: string) => { const e = escH(text), n = escH(name), i = e.indexOf(n); return i < 0 ? e : `${e.slice(0, i)}<span class="cbx on">${n}</span>${e.slice(i + n.length)}`; };

/** A grid square chosen in the grid view: the call it holds (its first item) and every item in it. */
export const [gridPick, setGridPick] = createSignal<{ at: number; cell: number[] } | null>(null);

// the card's height on the flow page, kept between sessions; it never shrinks below what shows the call comfortably
const CARD_KEY = 'flow.cardH', CARD_MIN = 170, CODE_MIN = 110;
const savedCard = (() => { try { const v = Number(localStorage.getItem(CARD_KEY)); return v >= CARD_MIN ? v : 260; } catch { return 260; } })();
const [cardH, setCardH] = createSignal(savedCard);

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
  // STEP only counts up (its place in the run); ƒ is the function's own number, with which call of it this is
  const nums = createMemo(() => (S() ? stepNumbers(S()!) : []));
  const here = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c || c.at >= s.items.length) return null;
    const r = s.run.rows[s.items[c.at]], n = nums()[c.at], fnRow = r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref] : r;
    return { step: c.at + 1, of: s.items.length, fn: n?.fn ?? 0, call: n?.call ?? 1, name: short(r.kind === 'indirect' ? (r.text ?? r.name) : fnRow.name) };
  });
  // the card: the grid's chosen square, else the current step
  const card = createMemo((): (DetailCard & { tag: string }) | null => {
    const s = S(), c = cur(), g = gridPick();
    if (!s || !c || c.at >= s.items.length) return null;
    try {
      if (g && g.at < s.items.length) return { ...detailCard(s, g.at, g.cell, c.at, nums(), (f) => lines(f)), tag: 'SELECTED' };
      return { ...detailCard(s, c.at, null, c.at, nums(), (f) => lines(f)), tag: `STEP ${c.at + 1}` };
    } catch { return null; }
  });
  const go = (it: number) => { stepMove({ jump: it }); };
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
    // the calls this function makes in the run, outlined in its code: a click goes to that step
    const calls: CodeCall[] = [];
    s.items.forEach((row, i) => {
      const x = s.run.rows[row];
      if (x.caller !== fnRow || !x.at || x.approx) return;
      const name = short(x.kind === 'ref' && x.ref != null ? s.run.rows[x.ref].name : x.kind === 'indirect' || x.kind === 'value' ? (x.via ?? x.name) : x.name);
      const line = L[x.at.line] ?? '', ch = line.indexOf(name, Math.max(0, x.at.character - name.length));
      calls.push({ line: x.at.line, ch: ch >= 0 ? ch : x.at.character, len: name.length, item: i, now: i === c.at + 1 });
    });
    return { file: f.file, start: f.start, text: L.slice(f.start, f.start + f.lines).join('\n'), hl, calls };
  });
  const calledFrom = createMemo(() => {
    const c = cur(), s = S();
    if (!c || !s || c.at >= s.items.length) return null;
    const r = s.run.rows[s.items[c.at]];
    if (r.caller == null || !r.at) return null;
    const cf = s.run.rows[r.caller], L = lines(cf.file);
    return { name: short(cf.name), n: cf.n, file: basename(cf.file), line: r.at.line + 1, text: L?.[r.at.line]?.trim() ?? '', call: short(r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref].name : r.name) };
  });
  const ways = createMemo(() => (S() ? stepWays(S()!, trail()) : []));
  let box: HTMLDivElement | undefined, link!: SVGSVGElement, raf = 0;
  // the selected step (a metro row, or a grid square) is joined to its details by a fine dotted gold line
  const drawLink = () => {
    raf = requestAnimationFrame(drawLink);
    const picked = gridPick() ? (document.querySelector('.gview .gcell.pk') as HTMLElement | null) : null;
    const sel = picked ?? (document.querySelector('.seqv .srow.sel, .gview .gcell.on') as HTMLElement | null);
    if (!link) return;
    if (!sel || !box || !box.isConnected) { if (link.innerHTML) link.innerHTML = ''; return; }
    const a = sel.getBoundingClientRect(), b = box.getBoundingClientRect(), view = (sel.closest('.seqv, .gview') as HTMLElement).getBoundingClientRect();
    if (a.bottom < view.top || a.top > view.bottom) { if (link.innerHTML) link.innerHTML = ''; return; }
    const x1 = a.right, y1 = a.top + a.height / 2, x2 = b.left, y2 = b.top + 22, m = x1 + (x2 - x1) * 0.55;
    const d = `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
    if (link.dataset.d !== d) { link.dataset.d = d; link.innerHTML = `<path d="${d}" fill="none" stroke="#e3d6ad" stroke-width="0.9" stroke-dasharray="1.5 4" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="2.2" fill="#e3d6ad"/><circle cx="${x2}" cy="${y2}" r="2" fill="#e3d6ad"/>`; }
  };
  onMount(() => { raf = requestAnimationFrame(drawLink); });
  // the divider between the code and the card: up grows the card until all of it shows, down grows the code until
  // the card is at its comfortable minimum
  let inner: HTMLDivElement | undefined, pane!: HTMLDivElement;
  // the card's tallest: all of its content (plus its 1 px border, top and bottom), and never so tall that the code
  // falls below CODE_MIN; measured from the code's top to the card's bottom, less what sits between them
  const maxCard = () => {
    const wrap = pane?.querySelector('.scodewrap') as HTMLElement | null, br = box?.getBoundingClientRect();
    if (!wrap || !br || !inner) return cardH();
    const wr = wrap.getBoundingClientRect(), between = br.top - wr.bottom;
    const room = br.bottom - wr.top - between - CODE_MIN;
    return Math.max(CARD_MIN, Math.min(inner.scrollHeight + 2, Math.floor(room)));
  };
  const dragCard = (e: PointerEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement, y0 = e.clientY, h0 = cardH();
    try { el.setPointerCapture(e.pointerId); } catch { /* the window listeners still follow it */ }
    el.classList.add('drag');
    const move = (m: PointerEvent) => setCardH(Math.round(Math.max(CARD_MIN, Math.min(maxCard(), h0 - (m.clientY - y0)))));
    const up = () => { el.classList.remove('drag'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); try { localStorage.setItem(CARD_KEY, String(cardH())); } catch { /* not kept */ } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  onCleanup(() => cancelAnimationFrame(raf));
  return (
    <div class="pane prev sprev" ref={pane} style={{ width: `${stepW()}px`, flex: 'none' }}>
      <svg class="slink" ref={link} aria-hidden="true" />
      <Show when={cur() && S()} fallback={<div class="empty">{runStatus() || 'the code of each step shows here'}</div>}>
        <div class="ph" style={{ padding: '0 20px' }}>
          <Show when={here()} fallback={<span style={{ color: 'var(--bright)' }}>{atEnd() ? 'end of the run' : ''}</span>}>{(h) => (
            <>
              <span class="pstep">STEP<b>{h().step}</b>of {h().of}</span>
              <span class="pfn" title="the function's own number, and which of its calls this is">{h().fn ? `ƒ${h().fn} ` : ''}{h().name}<small>{ordinal(h().call)} call</small></span>
            </>
          )}</Show>
          <span class="grow" /><Show when={!atEnd()}><button class="chip" onClick={openStep}>open file ›</button></Show>
        </div>
        <Show when={calledFrom()}>
          <div class="sfrom"><span class="h">from <b>ƒ{calledFrom()!.n} {calledFrom()!.name}</b> · {calledFrom()!.file} line {calledFrom()!.line}</span><code innerHTML={underlineCall(calledFrom()!.text, calledFrom()!.call)} /></div>
          <div class="sconn" />
        </Show>
        <Show when={code()?.calls.length}><div class="clk">{here() ? `step ${here()!.step} · ƒ${here()!.fn} ${here()!.name}, ${ordinal(here()!.call)} call · ` : ''}click an outlined call to go to its step</div></Show>
        <div class="scodewrap"><Show when={code()} keyed>{(c) => <SeqCode file={c.file} text={c.text} start={c.start} hl={c.hl} calls={c.calls} onJump={go} />}</Show></div>
        <Show when={!atEnd()}><div class="ways pv"><For each={ways()}>{([k, w]) => <span><b>{k}</b> {w}</span>}</For></div></Show>
        <Show when={card()}>{(cd) => (
          <>
            <div class="hdiv" role="separator" aria-orientation="horizontal" title="drag to share the height between the code and the card" onPointerDown={dragCard}><span class="grip" /></div>
            <div class="ibx full" ref={box} style={{ height: `${cardH()}px` }}>
              <div class="in" ref={inner}>
                <div class="h"><span class="tg">{cd().tag}</span><span class="w">{cd().head}</span></div>
                <Sec t="times called"><div class="big2"><b>{cd().timesCalled}</b> call{cd().timesCalled === 1 ? '' : 's'} to {cd().callee.name} in this run · {cd().callers.map((c) => `${c.count} from ${c.name}`).join(', ')}</div></Sec>
                <Sec t={cd().tag === 'SELECTED' ? 'the calls in this square' : 'every call'}>
                  <For each={cd().calls}>{(c) => (
                    <div class="cl" classList={{ now: c.state === 'now', dn: c.state === 'done' }} onClick={() => go(c.item)} title="go to this step">
                      <span class="sp">step {c.step}</span><span class="o">{ordinal(c.nth)}{c.state === 'now' ? ' · now' : ''}</span><span class="lc">{basename(c.file)}:{c.line}</span>
                      <code innerHTML={underlineCall(c.code, cd().callee.name)} />
                    </div>
                  )}</For>
                </Sec>
                <Show when={cd().caller}>{(cl) => (
                  <Sec t="caller"><div class="kv">
                    <span>function</span><span>ƒ{cl().fn} {cl().name} · {basename(cl().file)}:{cl().line}</span>
                    <span>makes</span><span>{cl().makes.map((m) => `${m.name} (${m.steps.join(', ')})`).join(', ')}</span>
                    <Show when={cl().inside}><span>inside</span><span><code>{cl().inside}</code></span></Show>
                  </div></Sec>
                )}</Show>
                <Sec t="called"><div class="kv">
                  <span>function</span><span>ƒ{cd().callee.fn} {cd().callee.name} · {basename(cd().callee.file)}:{cd().callee.from}–{cd().callee.to} · {cd().callee.to - cd().callee.from + 1} lines</span>
                  <Show when={cd().callee.signature}><span>signature</span><span><code>{cd().callee.signature}</code></span></Show>
                  <Show when={cd().passesIn}><span>passes in</span><span><code>{cd().passesIn}</code></span></Show>
                  <Show when={cd().getsBack}><span>gets back</span><span>{cd().getsBack}</span></Show>
                  <Show when={cd().itsCalls.length}><span>calls</span><span>{cd().itsCalls.map((m) => `${m.name} (${m.steps.join(', ')})`).join(', ')}</span></Show>
                  <Show when={cd().library.length}><span>library</span><span>{cd().library.join(', ')} (not followed)</span></Show>
                  <Show when={cd().loops}><span>loops</span><span>{cd().loops}</span></Show>
                  <Show when={cd().waysOut.length}><span>ways out</span><span>{cd().waysOut.map((w) => `${w.text} (line ${w.line}${w.early ? ', early' : ''})`).join(' · ')}</span></Show>
                </div></Sec>
                <Sec t="effects"><div class="kv">
                  <span>changes</span><span>{cd().effects.changes}</span>
                  <span>outside</span><span>{cd().effects.outside}</span>
                  <span>pure?</span><span>{cd().effects.pure}</span>
                  <span>thread</span><span>{cd().effects.thread}</span>
                </div></Sec>
                <Sec t="notes"><div class="kv">
                  <span>comment</span><span>{cd().comment ? `“${cd().comment}”` : 'none above it'}</span>
                  <span>findings</span><span>{cd().findings.length ? cd().findings.join(' · ') : 'none'}</span>
                  <span>across</span><span>{cd().across}</span>
                </div></Sec>
                <div class="src">every fact from clangd, the parser or SkyCodeX’s analyses · click a call to go to its step</div>
              </div>
            </div>
          </>
        )}</Show>
      </Show>
    </div>
  );
}

/** One titled section of the card. */
function Sec(props: { t: string; children: JSX.Element }) {
  return <div class="sec"><h6>{props.t}</h6>{props.children}</div>;
}
