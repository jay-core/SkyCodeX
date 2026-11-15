import { For, Show, createMemo, createSignal, createEffect, on, onMount, onCleanup, JSX } from 'solid-js';
import Split from './Split';
import { seq, trail, runStatus, stepMove } from '../lib/flowstore';
import { stepWays, stepNumbers, ordinal } from '../../shared/flowseq';
import { detailCard, DetailCard } from '../../shared/metrofacts';
import { openFile } from '../lib/store';
import { basename } from '../lib/api';
import { lines, textTick } from '../lib/seqtext';
import SeqCode, { CodeCall } from './SeqCode';
import { hwheel } from '../lib/hwheel';
import { stepLinks, sourceOf } from '../../shared/gridlinks';
import { junctionWords, Junction } from '../../shared/junctions';

const short = (n: string) => n.replace(/^.*::(?=[^:]+$)/, '');
const escH = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const underlineCall = (text: string, name: string, at = -1) => {
  const i = at >= 0 && text.startsWith(name, at) ? at : text.indexOf(name);
  return i < 0 ? escH(text) : `${escH(text.slice(0, i))}<span class="cbx on">${escH(name)}</span>${escH(text.slice(i + name.length))}`;
};

export const [gridPick, setGridPick] = createSignal<{ at: number; cell: number[] } | null>(null);
export const [junctionPick, setJunctionPick] = createSignal<Junction | null>(null);
export const junctionNav: { next?: (dir: number) => void; whatIf?: (j: Junction) => { ask: string; go: () => void } | null } = {};

const CARD_KEY = 'flow.cardH', CARD_MIN = 170, CODE_MIN = 110;
const savedCard = (() => { try { const v = Number(localStorage.getItem(CARD_KEY)); return v >= CARD_MIN ? v : 260; } catch { return 260; } })();
const [cardH, setCardH] = createSignal(savedCard);

const WIDTH_KEY = 'litho.flow.codeW';
const savedW = (() => { try { const v = Number(localStorage.getItem(WIDTH_KEY)); return v >= 280 ? v : 440; } catch { return 440; } })();
export const [stepW, setStepW] = createSignal(savedW);
export function StepSplit() {
  return <Split onDrag={(dx) => setStepW(Math.round(Math.max(280, Math.min(window.innerWidth - 420, stepW() - dx))))}
    onEnd={() => { try { localStorage.setItem(WIDTH_KEY, String(stepW())); } catch {  } }} />;
}

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
  const nums = createMemo(() => (S() ? stepNumbers(S()!) : []));
  const here = createMemo(() => {
    const s = S(), c = cur();
    if (!s || !c || c.at >= s.items.length) return null;
    const r = s.run.rows[s.items[c.at]], n = nums()[c.at], fnRow = r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref] : r;
    return { step: c.at + 1, of: s.items.length, fn: n?.fn ?? 0, call: n?.call ?? 1, name: short(r.kind === 'indirect' ? (r.text ?? r.name) : fnRow.name) };
  });
  const [fail, setFail] = createSignal('');
  const failed = (what: string, e: unknown) => { queueMicrotask(() => setFail(`${what} could not be worked out: ${String(e)}`)); return null; };
  createEffect(on([S, cur, gridPick, junctionPick], () => setFail(''), { defer: true }));
  const card = createMemo((): (DetailCard & { tag: string }) | null => {
    const s = S(), c = cur(), g = gridPick();
    if (!s || !c || c.at >= s.items.length) return null;
    try {
      if (g && g.at < s.items.length) return { ...detailCard(s, g.at, g.cell, c.at, nums(), (f) => lines(f)), tag: 'SELECTED' };
      return { ...detailCard(s, c.at, null, c.at, nums(), (f) => lines(f)), tag: `STEP ${c.at + 1}` };
    } catch (e) { return failed('the step card', e); }
  });
  const go = (it: number) => { stepMove({ jump: it }); };
  const jp = () => { const j = junctionPick(), s = S(); return j && s && s.items[j.owner] === j.ownerRow ? j : null; };
  const links = createMemo(() => {
    const s = S(), c = cur();
    textTick();
    if (!s || !c || c.at >= s.items.length) return null;
    try { return stepLinks(s, c.at, (f) => lines(f)); } catch (e) { return failed('what this step takes and gives', e); }
  });
  const jcard = createMemo(() => {
    const j = jp(), s = S();
    if (!j || !s) return null;
    textTick();
    try {
      const R = s.run.rows, owner = R[j.ownerRow], w = junctionWords(s, j), get = (f: string) => lines(f);
      const next = j.after + 1 <= s.lastItem[j.owner] ? s.items[j.after + 1] : owner.last + 1;
      const words = [...new Set(j.cond.match(/[A-Za-z_]\w*/g) ?? [])].filter((v) => !/^(?:if|else|of|while|switch|case|default|return|true|false|nullptr|this|sizeof)$/.test(v) && !new RegExp(`\\b${v}\\s*\\(`).test(j.cond));
      const decided = words.flatMap((v) => {
        const src = sourceOf(s, j.ownerRow, next, v, get);
        if (!src) return [];
        const at = R[src.row].at;
        return [{ v, text: src.kind === 'param' ? src.text : `${src.text} · step ${s.itemOf[src.row] + 1}${at ? ` · ${basename(owner.file)}:${at.line + 1}` : ''}` }];
      });
      const steps = j.kind === 'exit' ? (j.steps > 0 ? `steps ${j.after + 2}–${s.lastItem[j.owner] + 1}` : '') : j.span ? `steps ${j.span[0] + 1}–${j.span[1] + 1}` : '';
      return {
        head: `${j.cond} · ${basename(j.file)}:${j.line + 1}`, owner: short(owner.name), fn: nums()[j.owner]?.fn ?? owner.n,
        then: `${w.then} · line ${j.thenLine + 1}${j.kind === 'exit' && steps ? ` · ${steps} don’t run` : j.kind === 'arm' && steps ? ` · ${steps}` : ''}`,
        else: `${w.else}${j.kind === 'exit' && steps ? ` · ${steps}` : j.kind === 'arm' && steps ? ` · ${steps} don’t run` : ''}`,
        decided, junctions: j.inFn, whatIf: junctionNav.whatIf?.(j) ?? null,
        waysOut: (s.run.exits?.[owner.key] ?? []).filter((x) => x.kind === 'return' || x.kind === 'throw' || x.kind === 'co_return' || x.kind === 'noreturn').map((x) => `${x.text.replace(/;\s*$/, '')} · line ${x.line + 1}`),
      };
    } catch (e) { return failed('the junction card', e); }
  });
  const code = createMemo(() => {
    const c = cur(), s = S(), j = jp();
    if (!c || !s || (!j && c.at >= s.items.length)) return null;
    let fnRow: number, hl = -1;
    if (j) { fnRow = j.ownerRow; hl = j.line; }
    else {
      const r = s.run.rows[s.items[c.at]];
      fnRow = r.kind === 'indirect' || r.kind === 'value' ? r.caller! : r.kind === 'ref' ? r.ref! : s.items[c.at];
      if (r.kind === 'indirect' || r.kind === 'value') hl = r.at!.line;
      else if (c.at + 1 < s.items.length) { const nx = s.run.rows[s.items[c.at + 1]]; if (nx.caller === fnRow && nx.at) hl = nx.at.line; }
    }
    const f = s.run.rows[fnRow];
    const L = lines(f.file);
    if (!L || !f.lines) return null;
    const calls: CodeCall[] = [];
    s.items.forEach((row, i) => {
      const x = s.run.rows[row];
      if (x.caller !== fnRow || !x.at || x.approx) return;
      const name = short(x.kind === 'ref' && x.ref != null ? s.run.rows[x.ref].name : x.kind === 'indirect' || x.kind === 'value' ? (x.via ?? x.name) : x.name);
      const line = L[x.at.line] ?? '', ch = line.indexOf(name, Math.max(0, x.at.character - name.length));
      calls.push({ line: x.at.line, ch: ch >= 0 ? ch : x.at.character, len: name.length, item: i, now: !j && i === c.at + 1 });
    });
    return { file: f.file, start: f.start, text: L.slice(f.start, f.start + f.lines).join('\n'), hl, calls };
  });
  const calledFrom = createMemo(() => {
    const c = cur(), s = S();
    if (!c || !s || c.at >= s.items.length) return null;
    const r = s.run.rows[s.items[c.at]];
    if (r.caller == null || !r.at) return null;
    const cf = s.run.rows[r.caller], L = lines(cf.file);
    const raw = L?.[r.at.line] ?? '';
    return { name: short(cf.name), n: cf.n, file: basename(cf.file), line: r.at.line + 1, text: raw.trim(), col: r.at.character - (raw.length - raw.trimStart().length), call: short(r.kind === 'ref' && r.ref != null ? s.run.rows[r.ref].name : r.name) };
  });
  const ways = createMemo(() => (S() ? stepWays(S()!, trail()) : []));
  let box: HTMLDivElement | undefined, link!: SVGSVGElement, raf = 0;
  const clearLink = () => { if (link.innerHTML) link.innerHTML = ''; delete link.dataset.d; return ''; };
  const paintLink = (): string => {
    const picked = gridPick() ? (document.querySelector('.gview .gcell.pk') as HTMLElement | null) : null;
    const sel = picked ?? (document.querySelector(jp() ? '.seqv .sjn.on' : '.seqv .srow.sel, .gview .gcell.on') as HTMLElement | null);
    if (!link) return '';
    if (!sel || !box || !box.isConnected) return clearLink();
    const a = sel.getBoundingClientRect(), b = box.getBoundingClientRect(), view = (sel.closest('.seqv, .gview') as HTMLElement).getBoundingClientRect();
    if (a.bottom < view.top || a.top > view.bottom) return clearLink();
    const rowEnd = sel.closest('.gview') ? (document.querySelector('.gview .gtot') as HTMLElement | null)?.getBoundingClientRect().right : undefined;
    const hd = box.querySelector('.h')?.getBoundingClientRect();
    const x1 = rowEnd != null ? rowEnd + 2 : a.right, y1 = a.top + a.height / 2, x2 = b.left, y2 = hd ? (hd.top + hd.bottom) / 2 : b.top, m = x1 + (x2 - x1) * 0.55;
    const d = `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
    if (link.dataset.d !== d) { link.dataset.d = d; link.innerHTML = `<path d="${d}" fill="none" stroke="#e3d6ad" stroke-width="0.9" stroke-dasharray="1.5 4" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="2.2" fill="#e3d6ad"/><circle cx="${x2}" cy="${y2}" r="2" fill="#e3d6ad"/>`; }
    return d;
  };
  let idle = 0, lastLink = '';
  const drawLink = () => {
    const d = paintLink();
    if (d === lastLink) idle++; else { idle = 0; lastLink = d; }
    raf = idle < 30 ? requestAnimationFrame(drawLink) : 0;
  };
  const wake = () => { idle = 0; if (!raf) raf = requestAnimationFrame(drawLink); };
  const WAKE = ['scroll', 'resize', 'wheel', 'keydown', 'pointermove', 'pointerdown', 'transitionrun', 'animationstart'];
  onMount(() => { raf = requestAnimationFrame(drawLink); for (const ev of WAKE) window.addEventListener(ev, wake, true); });
  onCleanup(() => { for (const ev of WAKE) window.removeEventListener(ev, wake, true); });
  createEffect(on([S, cur, gridPick, junctionPick, card, jcard], wake));
  let inner: HTMLDivElement | undefined, pane!: HTMLDivElement;
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
    try { el.setPointerCapture(e.pointerId); } catch {  }
    el.classList.add('drag');
    const move = (m: PointerEvent) => setCardH(Math.round(Math.max(CARD_MIN, Math.min(maxCard(), h0 - (m.clientY - y0)))));
    const up = () => { el.classList.remove('drag'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); try { localStorage.setItem(CARD_KEY, String(cardH())); } catch {  } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  onCleanup(() => cancelAnimationFrame(raf));
  return (
    <div class="pane prev sprev" ref={pane} style={{ width: `${stepW()}px`, flex: 'none' }}>
      <svg class="slink" ref={link} aria-hidden="true" />
      <Show when={cur() && S()} fallback={<div class="empty">{runStatus() || 'the code of each step shows here'}</div>}>
        <div class="ph" style={{ padding: '0 20px' }}>
          <Show when={jcard()} fallback={
            <Show when={here()} fallback={<span style={{ color: 'var(--bright)' }}>{atEnd() ? 'end of the run' : ''}</span>}>{(h) => (
              <>
                <span class="pstep"><i class="selmk" />STEP<b>{h().step}</b>of {h().of}</span>
                <span class="pfn" title={`${h().fn ? `ƒ${h().fn} ` : ''}${h().name} · its ${ordinal(h().call)} call`}>{h().fn ? `ƒ${h().fn} ` : ''}{h().name}<small>{ordinal(h().call)} call</small></span>
              </>
            )}</Show>
          }>{(jc) => (
            <>
              <span class="pstep"><i class="selmk" />JUNCTION</span>
              <span class="pfn" title={`${jc().fn ? `ƒ${jc().fn} ` : ''}${jc().owner}`}>{jc().fn ? `ƒ${jc().fn} ` : ''}{jc().owner}</span>
            </>
          )}</Show>
          <span class="grow" /><Show when={jp() || !atEnd()}><button class="chip" onClick={() => { const j = jp(); if (j) openFile(j.file, { line: j.line, character: 0 }); else openStep(); }}>open file ›</button></Show>
        </div>
        <Show when={fail()}><div class="sfrom"><span class="h">{fail()}</span></div></Show>
        <Show when={!jp() && calledFrom()}>
          <div class="sfrom"><span class="h">from <b>ƒ{calledFrom()!.n} {calledFrom()!.name}</b> · {calledFrom()!.file} line {calledFrom()!.line}</span><code onWheel={hwheel} innerHTML={underlineCall(calledFrom()!.text, calledFrom()!.call, calledFrom()!.col)} /></div>
          <div class="sconn" />
        </Show>
        <Show when={!jp() && code()?.calls.length}><div class="clk">{here() ? `step ${here()!.step} · ƒ${here()!.fn} ${here()!.name}, ${ordinal(here()!.call)} call · ` : ''}click an outlined call to go to its step</div></Show>
        <div class="scodewrap"><Show when={code()} keyed>{(c) => <SeqCode file={c.file} text={c.text} start={c.start} hl={c.hl} calls={c.calls} onJump={go} />}</Show></div>
        <Show when={!atEnd()}><div class="ways pv"><For each={ways()}>{([k, w]) => <span><b>{k}</b> {w}</span>}</For></div></Show>
        <Show when={jcard()}>{(jc) => (
          <>
            <div class="hdiv" role="separator" aria-orientation="horizontal" title="drag to share the height between the code and the card" onPointerDown={dragCard}><span class="grip" /></div>
            <div class="ibx full" ref={box} style={{ height: `${cardH()}px` }}>
              <div class="in" ref={inner}>
                <div class="h"><span class="tg">JUNCTION</span><span class="w" title={jc().head}>{jc().head}</span></div>
                <Sec t="the two tracks"><div class="kv">
                  <span>then</span><span>{jc().then}</span>
                  <span>else</span><span>{jc().else}</span>
                </div></Sec>
                <Show when={jc().decided.length}><Sec t="decided by"><div class="kv"><For each={jc().decided}>{(d) => <><span>{d.v}</span><span>{d.text}</span></>}</For></div></Sec></Show>
                <Sec t={`in ${jc().owner}`}><div class="kv">
                  <span>junctions</span><span>{jc().junctions}</span>
                  <Show when={jc().waysOut.length}><span>ways out</span><span>{jc().waysOut.join(' · ')}</span></Show>
                </div></Sec>
                <div class="jbtns">
                  <Show when={jc().whatIf}>{(w) => <button class="chip" title="the existing what-if: which steps would not run" onClick={() => w().go()}>{w().ask} ⇄</button>}</Show>
                  <button class="chip" title="the previous junction in the run" onClick={() => junctionNav.next?.(-1)}>◆ previous</button>
                  <button class="chip" title="the next junction in the run" onClick={() => junctionNav.next?.(1)}>◆ next junction</button>
                </div>
                <div class="src">every fact from the parser and SkyCodeX’s analyses · Esc or a step returns to the step</div>
              </div>
            </div>
          </>
        )}</Show>
        <Show when={!jp() && card()}>{(cd) => (
          <>
            <div class="hdiv" role="separator" aria-orientation="horizontal" title="drag to share the height between the code and the card" onPointerDown={dragCard}><span class="grip" /></div>
            <div class="ibx full" ref={box} style={{ height: `${cardH()}px` }}>
              <div class="in" ref={inner}>
                <div class="h"><span class="tg">{cd().tag}</span><span class="w" title={cd().head}>{cd().head}</span></div>
                <Sec t="times called"><div class="big2"><b>{cd().timesCalled}</b> call{cd().timesCalled === 1 ? '' : 's'} to {cd().callee.name} in this run · {cd().callers.map((c) => `${c.count} from ${c.name}`).join(', ')}</div></Sec>
                <Sec t={cd().tag === 'SELECTED' ? 'the calls in this square' : 'every call'}>
                  <For each={cd().calls}>{(c) => (
                    <div class="cl" classList={{ now: c.state === 'now', dn: c.state === 'done' }} onClick={() => go(c.item)} title={`go to this step · ${c.code}`}>
                      <span class="sp">step {c.step}</span><span class="o">{ordinal(c.nth)}{c.state === 'now' ? ' · now' : ''}</span><span class="lc">{basename(c.file)}:{c.line}</span>
                      <code innerHTML={underlineCall(c.code, cd().callee.name, c.col)} />
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
                  <Show when={cd().uses.length}><span>uses</span><span>{cd().uses.join(', ')} · short helpers folded into this step</span></Show>
                  <Show when={cd().library.length}><span>library</span><span>{cd().library.join(', ')} (not followed)</span></Show>
                  <Show when={cd().loops}><span>loops</span><span>{cd().loops}</span></Show>
                  <Show when={cd().waysOut.length}><span>ways out</span><span>{cd().waysOut.map((w) => `${w.text} (line ${w.line}${w.early ? ', early' : ''})`).join(' · ')}</span></Show>
                </div></Sec>
                <Show when={cd().tag.startsWith('STEP') && links()}>{(lk) => (
                  <>
                    <Show when={lk().takes.length}><Sec t="takes"><div class="kv"><For each={lk().takes}>{(t) => <><span>{t.param || 'argument'}</span><span><code>{t.arg}</code>{t.how ? ` · ${t.how}` : ''}{t.from ? ` · from ${t.from}` : ''}</span></>}</For></div></Sec></Show>
                    <Show when={lk().gives.to.length || lk().decisions.length}><Sec t="gives"><div class="kv">
                      <Show when={lk().gives.what}><span>value</span><span><code>{lk().gives.what}</code></span></Show>
                      <Show when={lk().gives.to.length}><span>read by</span><span>{lk().gives.to.join(' · ')}</span></Show>
                      <Show when={lk().decisions.length}><span>decides</span><span>{lk().decisions.map((d) => `${d.text} · line ${d.line + 1}`).join(' · ')}</span></Show>
                    </div></Sec></Show>
                  </>
                )}</Show>
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

function Sec(props: { t: string; children: JSX.Element }) {
  return <div class="sec"><h6>{props.t}</h6>{props.children}</div>;
}
