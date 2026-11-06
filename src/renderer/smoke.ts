// Scripted run used to verify a build end to end (`npm run smoke`): drives the real UI and captures screenshots.
import { api } from './lib/api';
import { root, openFile, getMainView, setPage, setSettingsOpen, openFolder, settings, cursorPos, info, applySettings, problems } from './lib/store';
import { relPath, basename } from './lib/api';
import { openSearch, result } from './lib/search';
import { installedFonts } from './lib/fonts';
import { levels, focusCard, refreshForCursor, unresolvedCard } from './lib/preview';
import { lspState, indexing } from './lib/lsp';
import { quickOpen, palette, setPalette, applyWorkspaceEdit, COMMANDS } from './lib/actions';
import { setMenuOpen } from './components/AppMenu';
import { files, states, setFiles } from './lib/store';
import { offsetToPos } from './lib/cm';
import { definitionAt } from './lib/lsp';
import { langOf } from './lib/langs';
import { buildFlow, buildRun, findEntries, resolveEntry } from './lib/flow';
import { rankEntries } from '../shared/entries';
import { setFlowView, changed, seq, entries, lane, entryStart, runStatus, programs, settlingNow, status, graph, trail, setting, comparing } from './lib/flowstore';
import { pal } from './lib/lines';
import { fileToUri } from './lib/api';
import { fixesIn } from './lib/repair';
import { applyEdit, isCast } from '../shared/repair';
import { undo, undoDepth } from '@codemirror/commands';

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Frame times while an animation runs: a dropped frame is one over 25 ms. */
async function frames(run: () => unknown, ms: number) {
  const d: number[] = [];
  let last = performance.now(), on = true;
  const tick = (t: number) => { d.push(t - last); last = t; if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await run(); await sleep(ms); on = false;
  const f = d.slice(1);
  return { frames: f.length, worstMs: +Math.max(...f).toFixed(1), dropped: f.filter((x) => x > 25).length, avgMs: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1) };
}
/** Frame times while run() and the next ms play out: how many, the slowest 5% (p95), the slowest, and how many missed 60 fps. */
async function frameStats(run: () => unknown, ms: number) {
  const d: number[] = [];
  let last = 0, on = true;
  const slow: string[] = [];
  const tick = (t: number) => { if (last) { d.push(t - last); if (t - last > 80) slow.push(`${Math.round(t - last)}:${status().slice(0, 40)}|${runStatus().slice(0, 30)}|${settlingNow() ? 'settle' : ''}|${indexing() ? 'idx' : ''}`); } last = t; if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await run(); await sleep(ms); on = false;
  const f = [...d].sort((a, b) => a - b);
  return { slow, n: f.length, p95: +(f[Math.floor(f.length * 0.95)] ?? 0).toFixed(1), max: +(f[f.length - 1] ?? 0).toFixed(1), over: f.filter((x) => x > 16.7 * 1.5).length };
}
async function until(cond: () => boolean, ms: number, tick?: () => void) {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) { tick?.(); await sleep(250); }
  return cond();
}
/** Waits until cond has held for `hold` ms without a break (e.g. clangd idle, not merely between two jobs). */
async function quiet(cond: () => boolean, hold: number, ms: number) {
  const end = Date.now() + ms;
  let since = cond() ? Date.now() : 0;
  while (Date.now() < end) {
    if (!cond()) since = 0; else if (!since) since = Date.now(); else if (Date.now() - since >= hold) return true;
    await sleep(100);
  }
  return false;
}

export async function runSmoke() {
  const report: Record<string, unknown> = {};
  if (info()?.scenario === 'compiler') return compilerDemo(report);
  if (info()?.scenario === 'fonts') return fontsDemo(report);
  if (info()?.scenario === 'defs') return defsDemo(report);
  if (info()?.scenario === 'anyheader') return anyHeaderDemo(report);
  if (info()?.scenario === 'boot') return bootCheck(report);
  if (info()?.scenario === 'large') return largeCheck(report);
  if (info()?.scenario === 'engine') return engineCheck(report);
  if (info()?.scenario === 'programs') return programsCheck(report);
  if (info()?.scenario === 'folder') return folderCheck(report);
  if (info()?.scenario === 'colors') return colorsCheck(report);
  if (info()?.scenario === 'revisit') return revisitCheck(report);
  if (info()?.scenario === 'exits') return exitsCheck(report);
  if (info()?.scenario === 'jump') return jumpCheck(report);
  if (info()?.scenario === 'findings') return findingsCheck(report);
  if (info()?.scenario === 'watch') return watchCheck(report);
  if (info()?.scenario === 'values') return valuesCheck(report);
  if (info()?.scenario === 'configs') return configsCheck(report);
  if (info()?.scenario === 'change') return changeCheck(report);
  if (info()?.scenario === 'repair') return repairCheck(report);
  if (info()?.scenario === 'hold') return;   // opens the folder and waits: a recorder drives the window (src/concepts/flow/ux)
  try {
    await until(() => lspState() === 'ready', 20000);
    report.lsp = lspState();
    const file = `${root()}/src/server.cpp`;
    await openFile(file);
    await sleep(400);
    const v = getMainView()!;
    const text = v.state.doc.toString();
    const at = text.indexOf('auto handler = route(') + 6;
    v.dispatch({ selection: { anchor: at }, scrollIntoView: true });
    v.focus();
    const pos = offsetToPos(v.state.doc, at);
    report.level1Ready = await until(() => (levels()[0]?.cards.length ?? 0) >= 5, 40000, () => refreshForCursor(file, pos, true));
    // once clangd has finished indexing, every call in the project resolves to its definition (an empty level resolves nothing)
    report.indexQuiet = await quiet(() => !indexing(), 2000, 180000);
    report.level1Resolved = await until(() => (levels()[0]?.cards.length ?? 0) > 0 && !levels()[0].cards.some(unresolvedCard), 40000);
    await sleep(900);
    report.level1 = levels()[0]?.cards.map((c) => c.name);
    await api.smoke.capture('1-editor-preview');
    const callAt = v.state.doc.toString().indexOf('metrics_.record(') + 10;
    v.dispatch({ selection: { anchor: callAt } });
    await sleep(900);
    report.litCard = document.querySelector('.card.lit .nm')?.textContent ?? null;
    report.dimmedCards = document.querySelectorAll('.pcol.haslit .card:not(.lit)').length;
    // every call in the editor is outlined in its card's colour; no connector is drawn until one is hovered
    const boxes = () => [...document.querySelectorAll('.code .callbox')] as HTMLElement[];
    const linkPaths = () => document.querySelectorAll('svg.links path').length;
    report.callBoxes = { editor: boxes().length, sites: levels()[0]?.cards.reduce((n, c) => n + c.fromRanges.length, 0) ?? 0,
      // every outline names its card, and wears that card's colour
      mismatched: boxes().filter((e) => { const [li, k] = (e.dataset.call ?? '').split(':').map(Number); const c = levels()[li]?.cards[k]; const plain = !!c && /^[A-Za-z_]\w*$/.test(c.name.replace(/^.*::/, '')); return !c || e.style.getPropertyValue('--c').trim() !== pal(k) || (plain && !c.name.endsWith(e.textContent ?? '\u0000')); }).map((e) => e.textContent) };
    report.connectorsAtRest = linkPaths();
    const hoverBox = async (el: Element | undefined) => { el?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await sleep(250); };
    const rec = boxes().find((e) => e.textContent === 'record');
    await hoverBox(rec);
    report.hoverConnector = { paths: linkPaths(), color: rec?.style.getPropertyValue('--c') ?? null };
    await api.smoke.capture('1b-hover-call');
    await hoverBox(document.querySelector('.shiftbar') ?? undefined);
    report.connectorsAfterHover = linkPaths();
    // parse_headers → trim → is_space: two levels below it (split calls only the standard library)
    boxes().find((e) => e.textContent === 'parse_headers')?.click();
    await until(() => /deep|leaf/.test(document.querySelector('.pcol [data-card^="0:"].lit .depth')?.textContent ?? ''), 10000);
    report.depthParseHeaders = document.querySelector('.pcol [data-card^="0:"].lit .depth')?.textContent ?? null;
    report.clickedConnector = linkPaths();
    document.querySelector('.pane.prev .shiftbar')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(250);
    report.clickedConnectorCleared = linkPaths();

    const idx = levels()[0]?.cards.findIndex((c) => /parse_headers/.test(c.name)) ?? -1;
    if (idx >= 0) {
      await focusCard(0, idx);
      await until(() => !!levels()[1] && !levels()[1].cards.some(unresolvedCard) && levels()[1].cards.length > 0, 20000);
      await sleep(700);
      report.level2 = levels()[1]?.cards.map((c) => c.name);
      await api.smoke.capture('2-level-two');
      // pane 1's focused card is pane 2's source: its calls are outlined too
      const src = () => [...document.querySelectorAll(`.pcol [data-card="0:${idx}"] .callbox`)] as HTMLElement[];
      await until(() => src().length > 0, 5000);
      report.pane2Source = { boxes: src().length, sites: levels()[1]?.cards.reduce((n, c) => n + c.fromRanges.length, 0) ?? 0 };
      // a click on an outline lights its card in pane 2, scrolls it into view and measures how deep it goes
      const split = src().find((e) => e.textContent === 'split');
      split?.click();
      await until(() => !!document.querySelector('.pcol [data-card^="1:"] .depth:not(:empty)') && !/…/.test(document.querySelector('.pcol [data-card^="1:"] .depth')?.textContent ?? '…'), 10000);
      await sleep(400);
      report.pane2Click = { lit: document.querySelector('.pcol [data-card^="1:"].lit .nm')?.textContent ?? null, depth: document.querySelector('.pcol [data-card^="1:"].lit .depth')?.textContent ?? null };
      split?.scrollIntoView({ block: 'center' });
      await sleep(200);
      await hoverBox(split);
      report.pane2Hover = linkPaths();
      await api.smoke.capture('2b-pane2-click');
      // clicked, it keeps its connector after the mouse leaves; a click elsewhere clears it
      await hoverBox(document.querySelector('.shiftbar') ?? undefined);
      report.stuckConnector = linkPaths();
      const p1 = document.querySelectorAll('.pcol')[0] as HTMLElement;
      p1.scrollTop = p1.scrollHeight;
      await sleep(250);
      await hoverBox(split);
      report.hiddenSourceHover = { inView: (() => { const a = split!.getBoundingClientRect(), b = p1.getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; })(), paths: linkPaths() };   // scrolled out of pane 1: nothing to connect from
      p1.scrollTop = 0;
      document.querySelector('.pane.prev .shiftbar')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(250);
      report.connectorAfterClickElsewhere = linkPaths();
      document.querySelector('.pane.prev .shiftbar')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (document.querySelectorAll('.pcol')[1] as HTMLElement).scrollTop = 0; (document.querySelectorAll('.pcol')[0] as HTMLElement).scrollTop = 0;
    }
    report.motion = {} as Record<string, unknown>;
    (report.motion as any).shift = await frames(() => (document.querySelector('.shiftbar button:last-child') as HTMLButtonElement)?.click(), 1300);
    report.afterShift = levels().length;
    await api.smoke.capture('3-shifted');
    (report.motion as any).shiftBack = await frames(() => (document.querySelector('.shiftbar button:first-child') as HTMLButtonElement)?.click(), 1100);
    // clicking an outline glides its card into view and holds it lit until a click elsewhere
    const pc0 = document.querySelector('.pcol') as HTMLElement;
    pc0.scrollTop = pc0.scrollHeight;
    await sleep(300);
    const first = boxes().find((e) => e.dataset.call === '0:0');
    (report.motion as any).outlineScroll = await frames(() => first?.click(), 900);
    const sqh = pc0.querySelector('[data-card="0:0"] .card-h')!.getBoundingClientRect(), pcr = pc0.getBoundingClientRect();
    report.outlineClickReveals = sqh.top >= pcr.top - 1 && sqh.bottom <= pcr.bottom;
    await sleep(400);
    const pinnedLit = () => document.querySelector('.pcol [data-card^="0:"].lit .nm')?.textContent ?? null;
    const held = pinnedLit();
    pc0.scrollTop += 120; await sleep(300);
    const afterScroll = pinnedLit();
    document.querySelector('.pane.prev .shiftbar')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(300);
    report.outlinePin = { clicked: levels()[0]?.cards[0]?.name, held, afterScroll, afterClickElsewhere: pinnedLit() };
    // hovering a call whose card is scrolled out of its pane: the connector goes to the pane's edge, with the card's name
    pc0.scrollTop = 0; await sleep(50);
    const lastK = (levels()[0]?.cards.length ?? 1) - 1;
    pc0.scrollTop = (pc0.querySelector(`[data-card="0:${lastK}"]`) as HTMLElement).offsetTop > pc0.clientHeight ? 0 : pc0.scrollHeight;
    await sleep(300);
    await hoverBox(boxes().find((e) => e.dataset.call === `0:${lastK}`));
    const stub = [...document.querySelectorAll('svg.links text')].map((t) => t.textContent);
    report.offscreenHover = { card: levels()[0]?.cards[lastK]?.name, stub: stub[0] ?? null };
    await api.smoke.capture('3c-hover-offscreen');
    await hoverBox(document.querySelector('.shiftbar') ?? undefined);
    pc0.scrollTop = 0;

    // quick open and rename (the rename is never saved)
    await quickOpen(); await sleep(400);
    report.quickOpenItems = palette()?.items?.length ?? 0;
    await api.smoke.capture('3b-quick-open');
    setPalette(null);
    const kaAt = v.state.doc.toString().indexOf('keep_alive(headers)') + 2;
    const edit = await api.lsp.request('textDocument/rename', { textDocument: { uri: 'file://' + encodeURI(file) }, position: offsetToPos(v.state.doc, kaAt), newName: 'wants_keep_alive' }) as any;
    report.renameFiles = await applyWorkspaceEdit(edit);
    report.renameApplied = [...states.entries()].filter(([, st]) => st.doc.toString().includes('wants_keep_alive')).map(([f]) => f.split('/').pop());
    (report.motion as any).settingsOpen = await frames(() => setSettingsOpen(true), 1200);
    await api.smoke.capture('4-settings');
    // settings: installed fonts, typed numbers, live slider value
    const fonts = await installedFonts();
    report.fontsListed = fonts.length;
    report.monoFonts = fonts.filter((f) => f.mono).slice(0, 6).map((f) => f.name);
    const ctls = [...document.querySelectorAll('.set .ctl')] as HTMLElement[];
    const sizeCtl = ctls.find((c) => c.querySelector('.lab')?.textContent?.startsWith('code size'))!;
    const box = sizeCtl.querySelector('.num') as HTMLInputElement;
    box.value = '15'; box.dispatchEvent(new InputEvent('input', { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(500);
    report.typedFontSize = settings()['font.size'];
    const rng = sizeCtl.querySelector('input[type=range]') as HTMLInputElement;
    rng.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    rng.value = '22'; rng.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(150);
    report.sliderLive = { bubble: sizeCtl.querySelector('.bubble')?.textContent, box: box.value, cssSize: document.documentElement.style.getPropertyValue('--code-size') };
    await api.smoke.capture('4b-settings-slider');
    rng.value = '13'; rng.dispatchEvent(new Event('input', { bubbles: true })); rng.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);
    report.fontSizeRestored = settings()['font.size'];
    const famCtl = ctls.find((c) => c.querySelector('.lab')?.textContent?.startsWith('code font'))!;
    (famCtl.querySelector('.combo input') as HTMLInputElement).focus();
    await until(() => !!famCtl.querySelector('.combo-list button'), 4000);
    report.fontOptions = famCtl.querySelectorAll('.combo-list button').length;
    report.fontGroups = [...famCtl.querySelectorAll('.combo-g')].map((g) => g.textContent);
    await api.smoke.capture('4c-settings-fonts');
    (famCtl.querySelector('.combo input') as HTMLInputElement).blur();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const pageBtn = (n: string) => ([...document.querySelectorAll('.set .pv button')] as HTMLButtonElement[]).find((x) => x.textContent === n)!;
    // weights: the bundled code font lists its six real weights; picking one restyles the editor
    await until(() => document.querySelectorAll('.set .weights button').length > 0, 3000);
    const wBtns = [...document.querySelectorAll('.set .ctl')].find((c) => c.querySelector('.lab')?.textContent?.startsWith('code weight'))!.querySelectorAll('.weights button');
    report.codeWeights = [...wBtns].map((x) => x.textContent);
    ([...wBtns].find((x) => x.firstChild?.textContent === 'light') as HTMLButtonElement).click();
    await sleep(400);
    report.editorWeight = getComputedStyle(document.querySelector('.cm-scroller')!).fontWeight;
    await api.smoke.capture('4g-settings-weight');
    await api.settings.set('font.weight', 400);
    pageBtn('clangd').click(); await sleep(300);
    await api.smoke.capture('4e-settings-clangd');
    setSettingsOpen(false);
    await sleep(300);
    (document.querySelector('.wctl') as HTMLElement).style.transition = 'none';
    (document.querySelector('.wctl') as HTMLElement).style.opacity = '1';
    await sleep(100);
    report.windowIcons = [...document.querySelectorAll('.wctl svg')].map((s) => Math.round(s.getBoundingClientRect().width));
    await api.smoke.capture('4d-window-controls');
    (document.querySelector('.wctl') as HTMLElement).style.opacity = '';
    (document.querySelector('.wctl') as HTMLElement).style.transition = '';

    setFlowView('grid');
    setPage('flow');
    report.flowReady = await until(() => document.querySelectorAll('.gview .gcell.has').length >= 4, 45000);
    await sleep(1200);
    report.gridHeads = { rows: [...document.querySelectorAll('.gview .grh b')].map((e) => e.textContent), cols: [...document.querySelectorAll('.gview .gch b')].map(headText) };
    report.gridSummary = document.querySelector('.gview .gtop')?.textContent;
    report.gridTotals = { rows: document.querySelectorAll('.gview .grh').length, timesCalled: document.querySelectorAll('.gtot .t').length, cols: document.querySelectorAll('.gview .gch').length, callsItMakes: document.querySelectorAll('.gmk .m').length };
    // the rename above is unsaved: the change ripple marks the renamed function
    report.flowRipple = [...document.querySelectorAll('.gview .grh.chg b, .gview .gch.chg b')].map(headText);
    report.flowChanged = [...changed()].map((i) => { const r = seq()!.run.rows[i]; return `${r.name} ${r.file.split('/').pop()}:${r.start}+${r.lines}`; });
    report.gridCollisions = auditGrid();
    await api.smoke.capture('5-flow-grid');
    {
      // hover a square: its row and column tint, a hand pointer, a tag over no square that holds a call
      const sq = [...document.querySelectorAll('.gview .gcell.has')] as HTMLElement[];
      const target = sq.find((e) => e.querySelectorAll('i').length >= 2) ?? sq[0];
      target.dispatchEvent(new MouseEvent('mouseenter'));
      await sleep(400);
      const tag = document.querySelector('.gtag')?.getBoundingClientRect();
      report.gridHover = { tag: document.querySelector('.gtag')?.textContent ?? null, tinted: document.querySelectorAll('.gview .gcell.hl').length, outlined: !!document.querySelector('.gview .gcell.hv'), pointer: getComputedStyle(target).cursor,
        coversSquares: tag ? sq.filter((e) => e !== target && overlap(e.getBoundingClientRect(), tag)).length : -1 };
      await api.smoke.capture('6-grid-hover');
      // a click opens the square in place, and the card says what it holds
      target.click();
      await sleep(800);
      report.gridOpen = { steps: [...document.querySelectorAll('.gview .gcell.pk .gstep')].map((e) => e.textContent), card: document.querySelector('.sprev .ibx.full .tg')?.textContent ?? null, cardHead: document.querySelector('.sprev .ibx.full .h .w')?.textContent ?? null, link: !!document.querySelector('svg.slink path') };
      await api.smoke.capture('7-grid-open');
      // a step in the open square: the run goes there
      const gs = [...document.querySelectorAll('.gview .gcell.pk .gstep')] as HTMLElement[], last = gs[gs.length - 1];
      const want = Number(/step (\d+)/.exec(last?.textContent ?? '')?.[1] ?? 0);
      last?.click();
      await sleep(700);
      report.gridStepGo = { want, now: Number(document.querySelector('.sprev .pstep b')?.textContent ?? 0), header: document.querySelector('.ghd')?.textContent ?? null };
      (document.querySelector('.gview') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
    }
    setPage('editor');
    await sleep(400);
    // standard-library cards: show source inline
    await api.settings.set('preview.include_std', true);
    await sleep(300);
    const v2 = getMainView()!;
    const hAt = v2.state.doc.toString().indexOf('auto handler = route(') + 6;
    v2.dispatch({ selection: { anchor: hAt } });
    await until(() => !!document.querySelector('.card .chip'), 15000, () => refreshForCursor(file, offsetToPos(v2.state.doc, hAt), true));
    const stdCard = [...document.querySelectorAll('.card')].find((c) => c.querySelector('.chip')) as HTMLElement | undefined;
    report.stdCards = document.querySelectorAll('.card .chip').length;
    report.stdSourceShown = (stdCard?.querySelectorAll('.cm-line').length ?? 0) > 1;
    // the preview splits: drag the handle between the two card columns, pan a card sideways
    const col0 = document.querySelector('.pcol') as HTMLElement, w0 = col0.offsetWidth;
    const handle = document.querySelector('.psplit') as HTMLElement, hx = handle.getBoundingClientRect().left + 3;
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: hx, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: hx + 120 }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: hx + 120 }));
    await sleep(300);
    report.columnResized = col0.offsetWidth - w0;
    const sc = [...document.querySelectorAll('.card .cm-scroller')].find((e) => e.scrollWidth > e.clientWidth + 4) as HTMLElement | undefined;
    if (sc) { sc.scrollLeft = 60; await sleep(100); }
    report.cardPans = sc ? sc.scrollLeft > 0 : 'no wide card';
    report.linksClipped = !!document.querySelector('svg.links g[clip-path]');
    await api.smoke.capture('9a-std-source');
    try { localStorage.removeItem('litho.preview.split'); } catch { /* fine */ }
    await api.settings.set('preview.include_std', true);
    // tabs close, the ··· menu, new file
    report.tabsBefore = document.querySelectorAll('.hdr .tab').length;
    // the rename above left these tabs unsaved: closing asks first, and a smoke run answers "close anyway" (nothing is saved)
    const ask = window.confirm;
    window.confirm = () => true;
    (document.querySelector('.hdr .tab:last-child .tabx') as HTMLButtonElement | null)?.click();
    await sleep(300);
    window.confirm = ask;
    report.tabsAfter = document.querySelectorAll('.hdr .tab').length;
    setMenuOpen(true); await sleep(400);
    report.menuItems = document.querySelectorAll('.appmenu button').length;
    await api.smoke.capture('9b-menu');
    setMenuOpen(false);
    COMMANDS.newFile(); await sleep(300);
    palette()?.prompt?.accept('smoke_new.cpp'); setPalette(null); await sleep(900);
    report.newFileActive = files.active.split('/').pop();
    // typing cost: 300 single-character edits in the open file (the edits are undone afterwards, never saved)
    await openFile(file); await sleep(400);
    const pv = getMainView()!;
    const at0 = pv.state.doc.toString().indexOf('return res;');
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) pv.dispatch({ changes: { from: at0 + i, insert: 'x' } });
    report.msPerKeystroke = +((performance.now() - t0) / 300).toFixed(3);
    pv.dispatch({ changes: { from: at0, to: at0 + 300 } });
    // cursor moves inside one function: no clangd round trip once symbols are cached
    const t1 = performance.now();
    for (let i = 0; i < 20; i++) await refreshForCursor(file, offsetToPos(pv.state.doc, at0 - 20 - i));
    report.msPerCursorRefresh = +((performance.now() - t1) / 20).toFixed(2);
    // preview can be hidden and shown
    const before = !!document.querySelector('.pane.prev .shiftbar');
    await api.settings.set('preview.enabled', false); await sleep(500);
    report.previewHidden = before && !document.querySelector('.pane.prev .shiftbar') && document.querySelector('svg.links')?.innerHTML === '';
    await api.smoke.capture('9c-preview-hidden');
    await api.settings.set('preview.enabled', true); await sleep(800);
    report.previewShownAgain = !!document.querySelector('.pane.prev .shiftbar');
    // call-like things after the functions: macros, static_assert, lambdas, calls through pointers
    const probe = `${root()}/probe/probe.cpp`;
    if (await api.fs.exists(probe)) {
      await openFile(probe); await sleep(500);
      const pvw = getMainView()!, tAt = pvw.state.doc.toString().indexOf('int target()') + 4;
      pvw.dispatch({ selection: { anchor: tAt } });
      await until(() => (levels()[0]?.cards ?? []).some((c) => c.kind !== 'call'), 20000, () => refreshForCursor(probe, offsetToPos(pvw.state.doc, tAt), true));
      await sleep(800);
      report.callLike = (levels()[0]?.cards ?? []).map((c) => `${c.kind}:${c.name}`);
      report.dividers = { cards: document.querySelectorAll('.pcol .pdiv').length };
      await api.smoke.capture('9d-call-like');
      await api.settings.set('preview.include_other', false);
      await until(() => !(levels()[0]?.cards ?? []).some((c) => c.kind !== 'call'), 8000);
      report.callLikeHidden = !(levels()[0]?.cards ?? []).some((c) => c.kind !== 'call');
      await api.settings.set('preview.include_other', true);
      await openFile(file);
    }
    // the three searches (any case) and the play controls
    setPage('editor'); setFiles('active', ''); await sleep(300);
    const ff = document.querySelector('.ffind input') as HTMLInputElement;
    ff.value = 'SERVER'; ff.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => document.querySelectorAll('.found .ti:not(.fdir)').length > 0, 8000);
    report.fileFilter = [...document.querySelectorAll('.found .ti:not(.fdir)')].map((e) => e.textContent);
    await api.smoke.capture('10a-file-filter');
    ff.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(200);
    report.fileFilterCleared = !document.querySelector('.found') && !!document.querySelector('.files .tree');
    openSearch('Keep_Alive');
    await until(() => !result.running && result.hits.length > 0, 15000); await sleep(300);
    report.contentSearch = { matches: result.matches, files: result.files, shown: document.querySelectorAll('.cres .hit').length, marked: document.querySelectorAll('.cres mark').length };
    await api.smoke.capture('10b-content-search');
    (document.querySelector('.cres .hit') as HTMLElement)?.click(); await sleep(600);
    report.contentSearchOpened = { closed: !document.querySelector('.csearch'), file: basename(files.active), line: getMainView()?.state.doc.lineAt(getMainView()!.state.selection.main.head).number };
    await openFile(file);
    await until(() => !!document.querySelector('.pcol .card .cm-content'), 15000);
    const cv = document.querySelector('.pcol .card .cm-content') as HTMLElement | null;
    if (cv) { cv.focus(); COMMANDS.find(); await sleep(300); }
    report.cardSearch = !!document.querySelector('.pcol .card .cm-search') && !document.querySelector('.cm-editor .cm-search:not(.pcol *)');
    await api.smoke.capture('10c-card-search');
    (document.querySelector('.pcol .card .cm-search input') as HTMLInputElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setPage('flow'); setFlowView('metro');
    await until(() => !!document.querySelector('.seqv .playc'), 10000);
    const pc = (n: number) => document.querySelectorAll('.playc button')[n] as HTMLButtonElement;
    const stepAt = () => document.querySelector('.seqk')?.textContent ?? '';
    const a0 = stepAt(); pc(2).click(); await sleep(400); const a1 = stepAt();
    pc(1).click(); await sleep(1200); const playingOn = pc(1).getAttribute('aria-pressed'); pc(1).click(); await sleep(200);
    pc(0).click(); await sleep(300); const restarted = pc(1).getAttribute('aria-pressed'); pc(1).click();
    setFlowView('grid'); await until(() => !!document.querySelector('.gview') && !!document.querySelector('.playc'), 10000);
    // the grid's export asks where to save (a system dialog), so a smoke run only checks it is offered
    report.pngExport = { offered: [...document.querySelectorAll('.ph .chip')].some((c) => c.textContent === 'export') };
    report.playControls = { stepMoved: a0 !== a1, playing: playingOn, restartPlays: restarted, boxes: document.querySelectorAll('.playc button').length };
    await api.smoke.capture('10d-play-controls');
    setPage('editor');
    // switching folders: clangd must come back up
    const sub = `${root()}/src`;
    await openFolder(sub);
    report.reopenLsp = (await until(() => lspState() === 'ready', 15000)) ? 'ready' : lspState();
    await sleep(600);
    await api.smoke.capture('9-reopened-folder');
  } catch (e) {
    errors.push(`smoke: ${e}`);
  }
  for (const f of files.list) if (f.dirty) await api.buffers.drop(f.path);   // leave no unsaved smoke edits behind
  report.errors = errors;
  await api.smoke.done(report);
}


/** `--scenario compiler`: the compiler window — engine, versions from GitHub, moving, minimising; nothing is installed. */
async function compilerDemo(report: Record<string, unknown>) {
  try {
    await until(() => lspState() === 'ready', 20000);
    report.lsp = lspState();
    const ci = (await api.compiler.info()) as any;
    report.engine = { setting: ci.setting, active: ci.active, version: ci.activeVersion, inbuilt: ci.inbuilt, system: ci.system };
    report.headers = ci.headers; report.packsDir = ci.packsDir; report.packs = ci.packs.length;
    (([...document.querySelectorAll('.appbar .barbtn')] as HTMLButtonElement[]).find((b) => b.textContent === 'compiler'))?.click();
    await until(() => !!document.querySelector('.cwin .cbig'), 5000);
    await sleep(500);
    const w = document.querySelector('.cwin') as HTMLElement;
    report.window = { title: document.querySelector('.cwin-h .t')?.textContent, big: document.querySelector('.cwin .cbig')?.textContent, sub: document.querySelector('.cwin .csub')?.textContent };
    await api.smoke.capture('c1-compiler');
    // background clicks don't close it
    document.querySelector('.body')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    document.body.click();
    await sleep(200);
    report.staysOpen = !!document.querySelector('.cwin');
    // drag by the title bar
    const r0 = w.getBoundingClientRect(), h = document.querySelector('.cwin-h') as HTMLElement;
    h.dispatchEvent(new PointerEvent('pointerdown', { clientX: r0.left + 60, clientY: r0.top + 15, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: r0.left + 60 - 180, clientY: r0.top + 15 + 90 }));
    window.dispatchEvent(new PointerEvent('pointerup', {}));
    await sleep(200);
    const r1 = w.getBoundingClientRect();
    report.moved = [Math.round(r1.left - r0.left), Math.round(r1.top - r0.top)];
    // versions straight from the official releases (metadata only)
    const links = () => [...document.querySelectorAll('.cwin .lnk')] as HTMLButtonElement[];
    links().find((b) => /check for clangd updates/.test(b.textContent ?? ''))?.click();
    await until(() => !/looking|check for/.test(document.querySelectorAll('.cwin .crow')[0]?.textContent ?? 'looking'), 15000);
    report.clangdUpdate = document.querySelectorAll('.cwin .crow')[0]?.textContent;
    links().find((b) => /install a toolchain/.test(b.textContent ?? ''))?.click();
    await until(() => document.querySelectorAll('.cwin .cvers button').length > 0 || /couldn/.test(document.querySelector('.cwin .cvers')?.textContent ?? ''), 15000);
    report.toolchainVersions = [...document.querySelectorAll('.cwin .cvers button')].slice(0, 5).map((b) => b.textContent);
    (document.querySelector('.cwin .cvers button') as HTMLButtonElement | null)?.click();
    await sleep(300);
    report.confirm = document.querySelector('.cwin .cconfirm')?.textContent ?? null;
    await api.smoke.capture('c2-compiler-versions');
    ([...document.querySelectorAll('.cwin .cconfirm .lnk')] as HTMLButtonElement[]).find((b) => b.textContent === 'cancel')?.click();
    // minimise to the title bar, then expand
    (document.querySelector('.cwin-h button') as HTMLButtonElement).click();
    await sleep(200);
    report.minimised = !document.querySelector('.cwin-b');
    await api.smoke.capture('c3-compiler-minimised');
    (document.querySelector('.cwin-h button') as HTMLButtonElement).click();
    await sleep(200);
    (document.querySelector('.cwin-h button.x') as HTMLButtonElement).click();
    await sleep(200);
    report.closedByButton = !document.querySelector('.cwin');
    try { localStorage.removeItem('litho.compiler.pos'); } catch { /* fine */ }
  } catch (e) {
    errors.push(`compiler demo: ${e}`);
  }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario fonts`: every bundled code-font weight loads from the app and renders fixed-width. */
async function fontsDemo(report: Record<string, unknown>) {
  try {
    const fam = String(settings()['font.family']);
    report.setting = fam;
    const weights: Record<number, unknown> = {};
    const ctx = document.createElement('canvas').getContext('2d')!;
    for (const w of [100, 200, 300, 400, 500, 600, 700]) {
      const faces = await document.fonts.load(`${w} 16px "ArX F1"`);
      ctx.font = `${w} 20px "ArX F1", serif`;
      const mono = Math.abs(ctx.measureText('iiiiiiiiii').width - ctx.measureText('WWWWWWWWWW').width) < 0.5;
      weights[w] = { loaded: faces.length > 0 && document.fonts.check(`${w} 16px "ArX F1"`), mono, src: faces[0] ? (faces[0] as any).family : null };
    }
    report.weights = weights;
    report.oldName = document.fonts.check('400 16px "ARX F1"') && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'ARX F1');
    await until(() => lspState() === 'ready', 20000);
    await openFile(`${root()}/src/server.cpp`); await sleep(800);
    report.editorFont = getComputedStyle(document.querySelector('.cm-content')!).fontFamily;
    await api.smoke.capture('f1-arx-f1');
  } catch (e) {
    errors.push(`fonts demo: ${e}`);
  }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario extras`: help and the tour, translations, spelling, flow pins and folders, code style, to-do list,
 *  the reference without its pack, and run with checks / profile on a project made from a template (in the scratch folder). */

/** `--scenario defs`: go to definition into standard headers, by request and by ⌘-click. */
async function defsDemo(report: Record<string, unknown>) {
  try {
    await until(() => lspState() === 'ready', 20000);
    const src = (await api.fs.sources(root()) as string[]).find((f) => /server\.cpp$/.test(f))!;
    await openFile(src);
    await sleep(1500);
    const doc = getMainView()!.state.doc;
    const lines = doc.toString().split('\n');
    const inc = lines.findIndex((l) => /#include <thread>/.test(l));
    const use = lines.findIndex((l) => /std::thread/.test(l));
    const r1 = await definitionAt(src, { line: inc, character: lines[inc].indexOf('thread') + 1 });
    const r2 = await definitionAt(src, { line: use, character: lines[use].indexOf('thread') + 1 });
    report.byRequest = { include: r1, symbol: r2 };
    // ⌘-click on std::thread
    const v = getMainView()!;
    const off = doc.line(use + 1).from + lines[use].indexOf('thread') + 2;
    v.dispatch({ selection: { anchor: off }, scrollIntoView: true });
    await sleep(300);
    const c = v.coordsAtPos(off)!;
    v.contentDOM.dispatchEvent(new MouseEvent('mousedown', { clientX: c.left + 2, clientY: c.top + 4, metaKey: true, bubbles: true, button: 0 }));
    await sleep(2500);
    report.afterClick = { active: files.active, cursor: cursorPos(), lines: getMainView()?.state.doc.lines, firstLine: getMainView()?.state.doc.line(1).text };
    await api.smoke.capture('d1-after-click');
    if (r1) {
      await openFile(r1.file, { line: r1.line, character: r1.character }); await sleep(800); report.openInclude = { active: files.active, lines: getMainView()?.state.doc.lines }; await api.smoke.capture('d2-include');
      // from inside <ostream> (no extension): the last #include (in the active branch) and a use of a std name in code
      const os = r1.file.replace(/thread$/, 'ostream');
      await openFile(os);
      await sleep(1500);
      const hl = getMainView()!.state.doc.toString().split('\n');
      const end = hl.findIndex((l) => l.includes('*/'));
      const incs = hl.map((l, k) => [l, k] as const).filter(([l, k]) => k > end && /#\s*include\s*</.test(l) && !/__cxx03/.test(l));
      const [il, hi] = incs[incs.length - 1];
      const hs = hl.findIndex((l, k) => k > end && /\b(basic_ostream|operator<<|char_traits)\b/.test(l) && !/^\s*#|^\s*\/\//.test(l));
      report.insideHeader = {
        file: os,
        include: [il.trim(), await definitionAt(os, { line: hi, character: il.indexOf('<') + 3 })],
        symbol: hs >= 0 ? [hl[hs].trim(), await definitionAt(os, { line: hs, character: hl[hs].search(/\b(basic_ostream|operator<<|char_traits)\b/) + 2 })] : null,
      };
    }
  } catch (e) { errors.push(`defs: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario anyheader`: headers with unusual extensions or none, outside any include folder, followed like any other. */
async function anyHeaderDemo(report: Record<string, unknown>) {
  try {
    const dir = root();   // a folder prepared by the caller (see the README's smoke notes)
    await until(() => lspState() === 'ready', 20000);
    const main = `${dir}/main.cpp`;
    await openFile(main);
    await sleep(2500);
    const at = (src: string, line: number, word: string) => {
      const t = states.get(src)!.doc.line(line + 1).text;
      return definitionAt(src, { line, character: t.indexOf(word) + 1 });
    };
    const out: Record<string, unknown> = {};
    const rel = (l: any) => (l ? `${l.file.slice(dir.length + 1)}:${l.line + 1}` : null);
    out.includeNoExt = rel(await at(main, 0, 'Config'));
    out.includeTcc = rel(await at(main, 1, 'impl'));
    out.fnInNoExt = rel(await at(main, 5, 'config_value'));
    out.templateInTcc = rel(await at(main, 5, 'twice'));
    out.macroTableDef = rel(await at(main, 5, 'alpha'));
    // inside the extensionless header: its own #include and a call
    const cfg = `${dir}/vendor/Config`;
    await openFile(cfg);
    await sleep(1500);
    out.configLanguage = langOf(cfg);
    out.insideNoExtInclude = rel(await at(cfg, 2, 'util'));
    out.insideNoExtCall = rel(await at(cfg, 3, 'helper'));
    out.defLanguage = langOf(`${dir}/ops.def`);
    out.tccLanguage = langOf(`${dir}/impl.tcc`);
    Object.assign(report, out);
  } catch (e) { errors.push(`anyheader: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario boot`: the quick check run on each system's packaged app: engine, previews, definitions, flow. */
async function bootCheck(report: Record<string, unknown>) {
  try {
    const ci = (await api.compiler.info()) as any;
    report.platform = info()?.platform;
    report.clangd = { active: ci.active, version: ci.activeVersion, inbuilt: !!ci.inbuilt && ci.active === ci.inbuilt.path };
    report.lsp = (await until(() => lspState() === 'ready', 60000)) ? 'ready' : lspState();
    const src = (await api.fs.sources(root()) as string[]).find((f) => /server\.cpp$/.test(f));
    if (src) {
      await openFile(src);
      const v = getMainView()!, lines = v.state.doc.toString().split('\n');
      const at = lines.findIndex((l) => /Response Server::handle/.test(l));
      v.dispatch({ selection: { anchor: v.state.doc.line(at + 3).from + 4 } });
      await until(() => document.querySelectorAll('.pcol .card').length > 0, 60000);
      report.previewCards = document.querySelectorAll('.pcol .card').length;
      report.definition = !!(await definitionAt(src, { line: at, character: lines[at].indexOf('handle') + 1 }));
    }
    // the flow is read once clangd has indexed the project (no indexing for 2 s running), as a person would see it
    await quiet(() => !indexing(), 2000, 180000);
    setPage('flow');
    setFlowView('metro');
    await until(() => document.querySelectorAll('.seqv .srow').length > 3 && !runStatus(), 60000);
    await quiet(() => !settlingNow() && !runStatus(), 1000, 60000);
    await sleep(800);
    report.seqRows = document.querySelectorAll('.seqv .srow').length;
    // the steps the page shows, compared with a fresh trace below (the page must not keep an incomplete graph)
    report.viewSteps = seq()?.run.rows.filter((r) => r.kind === 'step').map((r) => r.name.replace(/^.*::/, ''));
    // all code everywhere: the code rows make room and nothing lands on anything else
    const allRows = document.querySelectorAll('.seqv .srow:not(.sfold)').length;
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await sleep(700);
    report.seqAround = { before: allRows, after: document.querySelectorAll('.seqv .srow:not(.sfold)').length, folds: document.querySelectorAll('.seqv .sfold').length, collisions: auditSequence().slice(0, 3) };
    await api.smoke.capture('boot-seq-around');
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }));
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }));
    await sleep(900);
    report.seqCode = { rows: document.querySelectorAll('.seqv .sline').length, collisions: auditSequence().slice(0, 3) };
    await api.smoke.capture('boot-seq-all-code');
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }));
    await sleep(300);
    report.seqCollisions = [] as string[];
    // walk with the keyboard, checking every state for text on text
    const seqv = document.querySelector('.seqv') as HTMLElement;
    const press = async (key: string, shiftKey = false) => { seqv.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true })); await sleep(650); };
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'r', 'l', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'End']) {
      await press(k);
      (report.seqCollisions as string[]).push(...auditSequence().map((x) => `${k}: ${x}`));
    }
    await press('Home');
    for (let i = 0; i < 14; i++) await press('ArrowRight');
    (report.seqCollisions as string[]).push(...auditSequence());
    await api.smoke.capture('seq-handle');
    report.seqCodeLines = document.querySelectorAll('.scode .cm-line').length;
    // the lines around the call in the step's box; a folded call (and the audit with it); chapters from the spine
    report.seqCallCode = document.querySelectorAll('.sband .scall > div:not(.from)').length;
    await press('Home'); for (let i = 0; i < 9; i++) await press('ArrowRight');
    await press('F', true);
    report.seqFold = !!document.querySelector('.srow.sfold');
    (report.seqCollisions as string[]).push(...auditSequence().map((x) => `folded: ${x}`));
    await press('F', true);
    const spine = document.querySelector('.sspine') as HTMLElement, sr = spine.getBoundingClientRect();
    spine.dispatchEvent(new MouseEvent('mousemove', { clientX: sr.left + 3, clientY: sr.top + sr.height / 2, bubbles: true }));
    await sleep(500);
    report.seqChapters = document.querySelectorAll('.schap button').length;
    spine.dispatchEvent(new MouseEvent('mouseleave'));
    await sleep(500);
    await press('Home');
    for (let i = 0; i < 14; i++) await press('ArrowRight');
    report.seqUses = [...document.querySelectorAll('.seqv .srow .u')].map((e) => e.textContent);
    report.seqHeader = document.querySelector('.ph .seqk')?.textContent;
    const stepName = (document.querySelector('.ph .seqpath')?.textContent ?? '').split('›').pop()!.trim();
    seqv.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await until(() => document.querySelectorAll('.gview .gcell.has').length > 0, 60000);
    await sleep(600);
    report.gridSquares = document.querySelectorAll('.gview .gcell.has').length;
    // the grid: the same step is the lit square, its called function named in gold; no text on other text
    report.gridKeptStep = !!stepName && [...document.querySelectorAll('.gview .grh.on b')].some((e) => e.textContent === stepName);
    report.gridCollisionsAfterTab = auditGrid();
    await api.smoke.capture('grid-kept-step');
    setFlowView('metro');
    await sleep(300);
    report.seqKeptStep = document.querySelector('.ph .seqk')?.textContent === report.seqHeader;
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(500);
    // every route between main and split: two (⇧-click both names)
    const headNamed = (n: string) => [...document.querySelectorAll('.gview .grh, .gview .gch')].find((e) => headText(e.querySelector('b')) === n) as HTMLElement | undefined;
    headNamed('main')?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await sleep(300);
    headNamed('split')?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await sleep(500);
    report.gridRoutes = document.querySelectorAll('.bxr').length;
    await api.smoke.capture('grid-routes');
    (document.querySelector('.gview') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setFlowView('metro');
    await sleep(300);
    // the analyser end to end, through the app's own clangd: every step from main, in execution order
    const entry = rankEntries(await findEntries(root()))[0];
    report.entry = entry?.rel;
    const g = await buildFlow(root(), undefined, entry ? [await resolveEntry(entry)] : []);
    const run = await buildRun(g.lanes[0].start);
    report.runSteps = run.rows.filter((r) => r.kind === 'step').map((r) => r.name.replace(/^.*::/, ''));
    report.runIndirect = run.rows.filter((r) => r.kind === 'indirect').map((r) => `${r.via} ${r.text}`);
    report.runMissing = run.missing.length;
    // the refresh button: everything is read and built again, and every view comes back
    const btn = document.querySelector('.appbar .refresh') as HTMLButtonElement | null;
    const t0r = performance.now();
    btn?.click();
    await sleep(100);
    const done = await until(() => !!btn && !btn.disabled, 120000);
    setFlowView('metro');
    await until(() => document.querySelectorAll('.seqv .srow').length > 3, 30000);
    report.refresh = { button: !!btn, finished: done, ms: Math.round(performance.now() - t0r), toast: document.querySelector('.toast')?.textContent ?? null, seqRows: document.querySelectorAll('.seqv .srow').length };
    setPage('editor');
    await sleep(500);
    await api.smoke.capture('boot');
  } catch (e) { errors.push(`boot: ${e} ${String((e as Error)?.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()).join(' ← ')}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** Two screen rectangles overlap by more than a pixel. */
const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
/** A grid name as read (column names carry zero-width break points after underscores). */
const headText = (e: Element | null) => (e?.textContent ?? '').replace(/​/g, '');
/** The grid's totals in sight: TIMES CALLED inside the pane's width, CALLS IT MAKES above the run bars (62 px). */
function totalsInSight(): string[] {
  const sc = document.querySelector('.gview .gscroll') as HTMLElement | null, t = document.querySelector('.gview .gtot'), m = document.querySelector('.gview .gmk');
  if (!sc || !t || !m) return ['no grid totals'];
  const v = sc.getBoundingClientRect(), tr = t.getBoundingClientRect(), mr = m.getBoundingClientRect(), right = v.left + sc.clientWidth, bottom = v.top + sc.clientHeight - 62;
  const out: string[] = [];
  if (tr.left < v.left - 1 || tr.right > right + 1) out.push(`TIMES CALLED at ${Math.round(tr.left)}–${Math.round(tr.right)}, outside the pane's ${Math.round(v.left)}–${Math.round(right)}`);
  if (mr.top < v.top - 1 || mr.top + 34 > bottom + 1) out.push(`CALLS IT MAKES at ${Math.round(mr.top)}–${Math.round(mr.top + 34)}, outside the pane's ${Math.round(v.top)}–${Math.round(bottom)}`);
  return out;
}

/**
 * Text on text in the grid, as drawn now: names, file bands, axis labels and totals never cover each other. The
 * sticky totals (TIMES CALLED, then CALLS IT MAKES under it) are opaque layers above the grid: text scrolled under one
 * is hidden, not overlapping, so only text in the same layer is compared, and a layer counts as covering only when
 * its background is really opaque.
 */
function auditGrid(): string[] {
  const view = document.querySelector('.gview .gscroll')?.getBoundingClientRect();
  if (!view) return ['no grid'];
  const opaque = (el: Element | null) => !!el && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(el).backgroundColor !== 'transparent';
  const layerOf = (e: Element) => { const t = e.closest('.gtot'), m = e.closest('.gmk'); return t && opaque(t) ? 2 : m && opaque(m) ? 1 : 0; };
  const items = [...document.querySelectorAll('.gview .grh b, .gview .gch b, .gview .gch span, .gview .gfb, .gview .grb span, .gview .gax, .gview .gtot .t, .gview .gmk .m')]
    .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent ?? '').replace(/​/g, '').trim().slice(0, 24), e, layer: layerOf(e) }))
    .filter((x) => x.t && x.r.width >= 1 && x.r.bottom > view.top && x.r.top < view.bottom && x.r.right > view.left && x.r.left < view.right);
  const out: string[] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.layer !== b.layer || a.e.contains(b.e) || b.e.contains(a.e) || a.e.parentElement === b.e.parentElement && a.e.parentElement?.classList.contains('gch')) continue;
    if (overlap(a.r, b.r)) out.push(`"${a.t}" over "${b.t}"`);
  }
  return out;
}

/**
 * Text on text in the sequence view: every piece of text is a box, and two boxes of different rows or labels that
 * intersect are a collision (design rule 7). Rows fade at the canvas edge, so only their visible part counts.
 */
export function auditSequence(): string[] {
  const view = document.querySelector('.seqv')?.getBoundingClientRect();
  if (!view) return ['no sequence view'];
  const boxes: { r: DOMRect; t: string; owner: Element }[] = [];
  for (const owner of document.querySelectorAll('.seqv .srow, .seqv .sline, .seqv .sframe > span, .seqv .slane, .seqv .sband .sum, .seqv .sband .facts > span, .seqv .sband .ways > span')) {
    const parts = owner.classList.contains('srow') ? [...owner.children] : [owner];
    const clip = owner.classList.contains('srow') ? owner.getBoundingClientRect() : null;
    for (const p of parts) {
      let r = p.getBoundingClientRect();
      if (clip) r = new DOMRect(r.x, r.y, Math.max(0, Math.min(r.right, clip.right - 32) - r.x), r.height);   // the faded end is not text
      if (r.width < 1 || r.height < 1 || r.bottom < view.top || r.top > view.bottom || r.right < view.left || r.left > view.right) continue;
      if (!(p.textContent ?? '').trim()) continue;
      boxes.push({ r, t: (p.textContent ?? '').trim().slice(0, 28), owner });
    }
  }
  const hits: string[] = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.owner === b.owner) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 1 && h > 1) hits.push(`${a.t} × ${b.t}`);
  }
  return hits;
}

/** A large real project (e.g. thorvg): how long each stage takes, and what never arrives. */
async function largeCheck(report: Record<string, unknown>) {
  const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
  // every stretch the window's thread was busy for 50 ms or more (it could not answer input or draw)
  const longTasks: { at: number; ms: number }[] = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push({ at: Math.round(e.startTime - t0), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch { /* not supported */ }
  const busy = (from: number, to: number) => { const xs = longTasks.filter((x) => x.at >= from && x.at < to); return { count: xs.length, maxMs: Math.max(0, ...xs.map((x) => x.ms)), totalMs: xs.reduce((a, x) => a + x.ms, 0) }; };
  const steps: Record<string, unknown> = {};
  report.steps = steps;
  try {
    steps.lsp = (await until(() => lspState() === 'ready', 120000)) ? at() : `not ready: ${lspState()}`;
    const t1 = performance.now();
    const srcs = (await api.fs.sources(root())) as string[];
    steps.sources = { count: srcs.length, ms: Math.round(performance.now() - t1) };
    steps.treeRows = document.querySelectorAll('.tree .row, .tree [role=treeitem]').length;
    const want = srcs.find((f) => /tvgPaint\.cpp$/.test(f)) ?? srcs.find((f) => /\.(cpp|cc|c)$/.test(f));
    if (want) {
      const t2 = performance.now();
      await openFile(want);
      steps.open = { file: relPath(root(), want), ms: Math.round(performance.now() - t2) };
      const v = getMainView()!, lines = v.state.doc.toString().split('\n');
      let ln = lines.findIndex((l) => /Paint::Impl::update\(/.test(l));
      if (ln < 0) ln = lines.findIndex((l) => /^\w.*\)\s*$/.test(l));
      v.dispatch({ selection: { anchor: v.state.doc.line(ln + 4).from + 4 } });
      const t3 = performance.now();
      const ok = await until(() => document.querySelectorAll('.pcol .card').length > 0, 90000);
      steps.previewCards = { count: document.querySelectorAll('.pcol .card').length, ms: ok ? Math.round(performance.now() - t3) : 'timed out', text: (document.querySelector('.pcol')?.textContent ?? '').slice(0, 200) };
      await api.smoke.capture('large-1-preview');
      const t4 = performance.now();
      const call = lines.findIndex((l, i) => i > ln && /\w+\(/.test(l));
      const name = (lines[call].match(/(\w+)\(/) ?? [])[1] ?? '';
      const d = await definitionAt(want, { line: call, character: lines[call].indexOf(name) + 1 });
      steps.definition = { of: name, to: d ? relPath(root(), (d as any).file ?? (d as any).uri ?? '') : null, ms: Math.round(performance.now() - t4) };
    }
    setFlowView('grid');
    setPage('flow');
    // a project with many mains opens on the list of them: the most likely one is picked, then back and again
    const tp = performance.now();
    await until(() => document.querySelectorAll('.progs .pr').length > 0, 30000);
    steps.programsMs = Math.round(performance.now() - tp);
    steps.programs = { rows: document.querySelectorAll('.progs .pr').length, groups: [...document.querySelectorAll('.progs .grp b')].map((b) => b.textContent).slice(0, 10), top: document.querySelector('.progs .pr.top')?.textContent };
    await api.smoke.capture('large-0-programs');
    steps.programsStatus = status();
    (document.querySelector('.progs .pr.top') as HTMLElement).click();
    const t5 = performance.now(), tClick = at();
    const flowStatus = () => document.querySelector('.flow')?.parentElement?.querySelector('.ph span')?.textContent ?? '';
    const drawn = () => document.querySelectorAll('.gview .gcell.has, .seqv .srow').length;
    const fl = await until(() => drawn() > 0 && !/tracing/.test(flowStatus()), 240000);
    steps.busyToFirstPicture = busy(tClick, at());
    steps.entry = { count: entries().length, chosen: entries()[lane()]?.rel, name: entries()[lane()]?.name, start: entryStart() };
    steps.flow = { status: flowStatus(), drawn: drawn(), ms: fl ? Math.round(performance.now() - t5) : 'timed out' };
    await sleep(1500);
    await api.smoke.capture('large-2-flow');
    // when clangd finishes indexing the flow rebuilds with the whole call graph
    const ix = await until(() => /indexing/.test(document.body.textContent ?? '') === false, 240000);
    await sleep(1000);
    await until(() => !/tracing/.test(flowStatus()), 240000);
    await sleep(1500);
    // the run of the first entry point, then the grid drawn from it: how long, how big (files × files first when large),
    // no text on other text, and a hovered square's tag wholly inside the window
    const t7 = performance.now();
    setFlowView('grid');
    await until(() => !!seq() && !runStatus() && document.querySelectorAll('.gview .gcell').length > 0, 240000);
    steps.runState = { runStatus: runStatus(), status: flowStatus(), rows: seq()?.run.rows.slice(0, 8).map((r: any) => `${r.kind} ${r.name ?? r.key ?? ''}`) };
    steps.run = { rows: seq()?.run.rows.length, steps: seq()?.run.rows.filter((r) => r.kind === 'step').length, ms: Math.round(performance.now() - t7) };
    const gridBad = auditGrid();
    steps.grid = { filesFirst: !!document.querySelector('.gview .gnote'), squares: document.querySelectorAll('.gview .gcell.has').length, rows: document.querySelectorAll('.gview .grh').length, cols: document.querySelectorAll('.gview .gch').length, collisions: gridBad.length, first: gridBad.slice(0, 2) };
    await api.smoke.capture('large-4-grid');
    const block = [...document.querySelectorAll('.gview .gcell.has')].sort((a, b) => (parseInt(b.textContent ?? '0') || 0) - (parseInt(a.textContent ?? '0') || 0))[0] as HTMLElement | undefined;
    if (document.querySelector('.gview .gnote')) { block?.click(); await sleep(800); }
    const sq = document.querySelector('.gview .gcell.has') as HTMLElement | null;
    sq?.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(300);
    const tr = document.querySelector('.gtag')?.getBoundingClientRect();
    steps.gridOpened = { squares: document.querySelectorAll('.gview .gcell.has').length, tagInside: tr ? tr.left >= 0 && tr.top >= 0 && tr.right <= innerWidth && tr.bottom <= innerHeight : null, collisions: auditGrid().length };
    await api.smoke.capture('large-5-grid-block');
    // the sequence on the same run: each step answers within a frame or two, and no text lands on other text
    setFlowView('metro');
    await until(() => document.querySelectorAll('.seqv .srow').length > 0, 30000);
    const sv = document.querySelector('.seqv') as HTMLElement, moves: number[] = [], seqBad: string[] = [];
    for (let i = 0; i < 25; i++) {
      const tm = performance.now();
      sv.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      moves.push(Math.round(performance.now() - tm));
      await sleep(120);
    }
    await sleep(600);
    seqBad.push(...auditSequence());
    steps.sequence = { rows: document.querySelectorAll('.seqv .srow').length, moveMsMax: Math.max(...moves), moveMsMedian: moves.sort((a, b) => a - b)[moves.length >> 1], collisions: seqBad.length, first: seqBad.slice(0, 2) };
    await api.smoke.capture('large-6-sequence');
    // frame times while things move: stepping, playing, the Tab switch between views, and playing the grid
    await api.smoke.profile(null);
    const tProf = performance.timeOrigin + performance.now();
    const key = (el: Element | null, k: string) => el?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    const motion: Record<string, unknown> = {};
    motion.seqStep = await frameStats(async () => { for (let i = 0; i < 10; i++) { key(document.querySelector('.seqv'), 'ArrowRight'); await sleep(150); } }, 300);
    motion.seqPlay = await frameStats(() => key(document.querySelector('.seqv'), ' '), 3000);
    key(document.querySelector('.seqv'), ' ');
    await sleep(300);
    motion.tabGlide = await frameStats(() => key(document.querySelector('.seqv'), 'Tab'), 1500);
    await until(() => document.querySelectorAll('.gview .gcell').length > 0, 10000);
    motion.gridPlay = await frameStats(() => key(document.querySelector('.gview'), ' '), 3000);
    key(document.querySelector('.gview'), ' ');
    await sleep(300);
    steps.motion = motion;
    steps.profile = { file: await api.smoke.profile('large-motion'), startedAt: tProf };
    setFlowView('metro');
    await until(() => document.querySelectorAll('.seqv .srow').length > 0, 30000);
    setFlowView('grid');
    const t8 = performance.now();
    let back = false;
    for (let f = 0; f < 1800 && !(back = document.querySelectorAll('.gview .gcell').length > 0); f++) await new Promise((r) => requestAnimationFrame(r));
    steps.gridBack = back ? Math.round(performance.now() - t8) : 'timed out';
    await sleep(800);
    (document.querySelector('.backp') as HTMLElement)?.click(); await sleep(400);
    const backList = document.querySelectorAll('.progs .pr').length;
    (document.querySelector('.progs .pr.top') as HTMLElement)?.click();
    steps.programsBack = { list: backList, again: await until(() => document.querySelectorAll('.gview .gcell').length > 0, 15000) };
    steps.flowIndexed = { indexed: ix, ms: Math.round(performance.now() - t5), status: flowStatus(), squares: document.querySelectorAll('.gview .gcell.has').length };
    await api.smoke.capture('large-2b-flow-indexed');
    setPage('editor');
    await sleep(3000);   // let indexing run, then see whether the window still answers
    const t6 = performance.now(); await sleep(0); await new Promise((r) => requestAnimationFrame(r));
    steps.frameAfterIndexMs = Math.round(performance.now() - t6);
    steps.indexing = (document.querySelector('.pcol')?.textContent ?? '').match(/index[^\n]{0,60}/i)?.[0] ?? null;
    await api.smoke.capture('large-3-after');
    // until the page settles (clangd done, no rebuild pending), when its picture is kept for next time
    steps.settled = (await quiet(() => !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 3000, 180000)) ? at() : 'not settled';
    await sleep(2000);
  } catch (e) { errors.push(`large: ${e}`); }
  report.totalMs = at();
  report.busy = { all: busy(0, Infinity), worst: [...longTasks].sort((a, b) => b.ms - a.ms).slice(0, 5) };
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario colors`: the colour sliders recolour the window while dragging; nothing is written unless let go. */
async function colorsCheck(report: Record<string, unknown>) {
  try {
    await until(() => lspState() === 'ready', 60000);
    const src = (await api.fs.sources(root()) as string[]).find((f) => /server\.cpp$/.test(f));
    if (src) { await openFile(src); const v = getMainView()!; const at = v.state.doc.toString().indexOf('auto handler = route(') + 6; v.dispatch({ selection: { anchor: at } }); }
    await until(() => document.querySelectorAll('.code .callbox').length > 3, 60000);
    await sleep(800);
    await api.smoke.capture('colors-1-outlines');
    setSettingsOpen(true);
    await sleep(900);
    const appearance = [...document.querySelectorAll('.set .pv button')].find((b) => b.textContent === 'appearance') as HTMLButtonElement | undefined;
    appearance?.click();
    await sleep(500);
    const head = [...document.querySelectorAll('.set .sechead')].find((h) => /^code/.test(h.textContent ?? '')) as HTMLElement | undefined;
    head?.scrollIntoView({ block: 'start' });
    await sleep(400);
    report.colorSections = [...document.querySelectorAll('.set .sechead > span:first-child')].map((e) => e.textContent);
    report.colorControls = document.querySelectorAll('.set .colorctl').length;
    await api.smoke.capture('colors-2-settings');
    const kwCss = () => getComputedStyle(document.documentElement).getPropertyValue('--kw').trim();
    const before = kwCss(), snapshot = { ...settings() };
    const ctl = [...document.querySelectorAll('.set .ctl')].find((c) => c.querySelector('.lab')?.textContent?.startsWith('keyword'));
    const hue = ctl?.querySelector('.cslide input[type=range]') as HTMLInputElement | undefined;
    if (hue) { hue.value = String((Number(hue.value) + 150) % 360); hue.dispatchEvent(new Event('input', { bubbles: true })); }
    await sleep(300);
    const file = (await api.fs.read(info()!.settingsFile).catch(() => '')) as string;
    report.livePreview = { before, during: kwCss(), written: /^\s*keyword\s*=/m.test(file) };
    await api.smoke.capture('colors-3-dragging');
    applySettings(snapshot, problems());   // as if the drag never happened: the theme comes back
    await sleep(200);
    report.restored = kwCss() === before;
    setSettingsOpen(false);
  } catch (e) { errors.push(`colors: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario folder`: from the flow tab, with no file open, the folder tab shows the folder's files. */
async function folderCheck(report: Record<string, unknown>) {
  try {
    setPage('flow');
    await sleep(800);
    const tab = [...document.querySelectorAll('.pivot button')].find((b) => b.textContent === 'folder') as HTMLButtonElement | undefined;
    report.folderTab = !!tab;
    tab?.click();
    await sleep(500);
    const pane = document.querySelector('.files') as HTMLElement | null;
    report.filesVisible = !!pane && pane.getBoundingClientRect().width > 0 && pane.getBoundingClientRect().height > 0;
    report.fileRows = document.querySelectorAll('.files .ti').length;
    report.tabOn = tab?.classList.contains('on') ?? false;
    await api.smoke.capture('folder-tab');
  } catch (e) { errors.push(`folder: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario engine` on samples/engine: overrides, calls through pointers, a thread, interrupt handlers as entries. */
async function engineCheck(report: Record<string, unknown>) {
  try {
    report.lsp = await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await until(() => document.querySelectorAll('.progs .pr').length > 0, 30000);
    report.entries = entries().map((e) => `${e.kind}:${e.label}`);
    (document.querySelector('.progs .pr.top') as HTMLElement).click();
    // clangd's index makes overrides findable: wait until the run reaches them
    await until(() => (seq()?.run.rows ?? []).some((r) => /Square::area|^area$/.test(r.name) && r.file.endsWith('engine.cpp') && r.kind === 'step') && (seq()?.run.rows.length ?? 0) > 6, 90000, () => {});
    await until(() => !runStatus(), 30000);
    const run = seq()!.run;
    report.rows = run.rows.map((r) => `${'  '.repeat(r.depth)}${r.kind === 'step' ? r.n : r.kind}${r.thread ? '(t)' : ''} ${r.kind === 'indirect' ? `${r.text} ⇢ ${(r.could ?? []).join(',')}` : r.name}`);
    report.virtualFrames = run.frames.filter((f) => f.kind === 'virtual').map((f) => f.text);
    await api.smoke.capture('engine-1-main');
    (document.querySelector('.backp') as HTMLElement).click(); await sleep(400);
    const isr = [...document.querySelectorAll('.progs .pr')].find((b) => /USART1_IRQHandler/.test(b.textContent ?? '')) as HTMLElement | undefined;
    isr?.click();
    await until(() => (seq()?.run.rows[0]?.name ?? '').includes('USART1') && !runStatus(), 30000);
    report.isrRows = seq()?.run.rows.map((r) => `${r.kind === 'step' ? r.n : r.kind} ${r.kind === 'indirect' ? `${r.text} ⇢ ${(r.could ?? []).join(',')}` : r.name}`);
    await api.smoke.capture('engine-2-isr');
  } catch (e) { errors.push(`engine: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario watch` on samples/tinyhttp: W watches running_ through its rename, V follows req.raw from handle. */
async function watchCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`watch: ${what}`); };
  const key = (k: string) => (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  const choose = async (typed: string) => {
    await until(() => !!document.querySelector('.spick input'), 3000);
    const inp = document.querySelector('.spick input') as HTMLInputElement;
    inp.value = typed; inp.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(150);
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(500);
  };
  const lit = () => [...document.querySelectorAll('.seqv .srow.fw')].map((r) => `${r.getAttribute('data-name')}: ${r.querySelector('.sw')?.textContent}`);
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    key('w');
    report.watchOptions = [...document.querySelectorAll('.spickl button')].map((b) => b.textContent).slice(0, 8);
    await choose('running_');
    report.watch = lit();
    report.watchDimmed = document.querySelectorAll('.seqv .srow.fq').length;
    await api.smoke.capture('watch-1-running');
    check((report.watch as string[]).join(' | ') === 'start: ▲ sets running_ · ▽ reads running_ | run: → running_ passed on as running · ▽ reads running | stop: ▲ sets running_', `watching running_ shows ${(report.watch as string[]).join(' | ')}`);
    key('Escape');
    await sleep(300);
    check(!document.querySelector('.seqv .srow.fw, .seqv .srow.fq'), 'Esc does not show the whole run again');
    // to handle, then follow req.raw
    const it = seq()!.items.findIndex((i) => seq()!.run.rows[i].kind === 'step' && /handle$/.test(seq()!.run.rows[i].name));
    (document.querySelectorAll('.seqv .srow')[0] as HTMLElement).click();
    await sleep(200);
    for (let k = 0; k < 40 && (trail().at(-1)?.at ?? -1) !== it; k++) { key('ArrowRight'); await sleep(60); }
    key('v');
    report.journeyOptions = [...document.querySelectorAll('.spickl button')].map((b) => b.textContent);
    await choose('req.raw');
    report.journey = lit();
    await api.smoke.capture('watch-2-journey');
    check((report.journey as string[]).join(' | ') === 'parse_headers: → req.raw passed on as raw · a copy · ▽ reads raw | split: → raw passed on as s · a copy · ▽ reads s', `following req.raw shows ${(report.journey as string[]).join(' | ')}`);
    // the grid names the same functions, saying how; the rest dim
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    report.journeyGrid = [...document.querySelectorAll('.gview .grh.fw')].map((r) => `${r.querySelector('b')?.textContent}: ${r.querySelector('.gw')?.textContent}`);
    const fwNames = [...new Set([...document.querySelectorAll('.gview .grh.fw b, .gview .gch.fw b')].map(headText))].sort();
    await api.smoke.capture('watch-3-grid');
    check(fwNames.join() === 'parse_headers,split', `the grid lights ${fwNames.join(', ')}`);
    check(auditGrid().length === 0, `text on text in the grid: ${auditGrid().slice(0, 3).join('; ')}`);
    check(totalsInSight().length === 0, `the grid's totals: ${totalsInSight().join('; ')}`);
  } catch (e) { errors.push(`watch: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario values` on samples/values: arms a call's values rule out fade, the first row of each saying why. */
async function valuesCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`values: ${what}`); };
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    const run = seq()!.run;
    report.dead = run.frames.filter((f) => f.dead).map((f) => `${run.rows[f.owner].name}: ${f.label} | ${f.dead}`);
    check((report.dead as string[]).length === 13, `the run rules out ${(report.dead as string[]).length} arms, not 13`);
    await sleep(500);
    report.said = [...document.querySelectorAll('.seqv .srow .sd')].map((s) => s.textContent);
    report.faded = document.querySelectorAll('.seqv .srow.sdead').length;
    await api.smoke.capture('values-1-sequence');
    check((report.said as string[]).includes('not in this call · clear is true here — passed by draw(true)'), `draw's else does not say why: ${(report.said as string[]).slice(0, 3).join(' | ')}`);
    check((report.faded as number) >= (report.said as string[]).length && (report.said as string[]).length > 0, 'no row fades');
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    report.gridDim = [...document.querySelectorAll('.gview .grh.dim b')].map((e) => e.textContent);
    await api.smoke.capture('values-2-grid');
    check((report.gridDim as string[]).includes('inner'), `inner, called only where it cannot happen, is not faded in the grid: ${(report.gridDim as string[]).join(', ')}`);
    check(auditGrid().length === 0, `text on text in the grid: ${auditGrid().slice(0, 3).join('; ')}`);
    check(totalsInSight().length === 0, `the grid's totals: ${totalsInSight().join('; ')}`);
  } catch (e) { errors.push(`values: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario configs` on samples/configs: if constexpr ghosts, then the code read again with DEBUG and BOARD=2. */
async function configsCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`configs: ${what}`); };
  const ghosts = () => [...document.querySelectorAll('.seqv .sline .gh')].map((g) => `${g.textContent} | ${g.nextElementSibling?.textContent ?? ''}`);
  // what only the setting runs: on its own row, or (a call that calls nothing, folded into its caller's "uses") on the caller's
  const only = () => [...document.querySelectorAll('.seqv .srow')].flatMap((r) => [...r.querySelectorAll('.nt')].filter((n) => /only with/.test(n.textContent ?? '')).map((n) => `${r.querySelector('.nm')?.textContent}: ${n.textContent}`));
  const click = (sel: string, text?: string) => { const el = [...document.querySelectorAll(sel)].find((x) => text == null || x.textContent?.trim() === text) as HTMLElement | undefined; el?.click(); return !!el; };
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    await sleep(400);
    report.asBuilt = ghosts();
    check((report.asBuilt as string[]).join(' ; ') === 'narrow | not in this build · sizeof(void *) == 8 is true ; narrow | not in this build · sizeof(char) == 2 is false', `if constexpr ghosts as built: ${(report.asBuilt as string[]).join(' ; ')}`);
    await api.smoke.capture('configs-1-as-built');
    check(click('.setc .chip'), 'no settings chip');
    await until(() => document.querySelectorAll('.setm .mr').length > 0, 10000);
    report.macros = [...document.querySelectorAll('.setm .mr .k')].map((k) => k.textContent);
    check((report.macros as string[]).join(',') === 'BOARD,DEBUG,NO_CHECKS', `the menu lists ${(report.macros as string[]).join(',')}`);
    await api.smoke.capture('configs-2-menu');
    const row = (k: string) => [...document.querySelectorAll('.setm .mr')].find((r) => r.querySelector('.k')?.textContent === k)!;
    ([...row('DEBUG').querySelectorAll('button')].find((b) => b.textContent === 'define') as HTMLElement).click();
    ([...row('BOARD').querySelectorAll('button')].find((b) => b.textContent === '2') as HTMLElement).click();
    await sleep(100);
    check(click('.setm .go'), 'no button to read the code with the setting');
    const t0 = Date.now();
    await until(() => setting()?.state !== 'reading', 180000);
    report.settingMs = Date.now() - t0;
    report.setting = { label: setting()?.label, state: setting()?.state, note: setting()?.note };
    check(setting()?.state === 'ready', `the setting did not read: ${setting()?.state} ${setting()?.note}`);
    await sleep(600);
    report.withSetting = ghosts();
    report.onlyInRun = seq()!.run.rows.filter((r) => r.only).map((r) => r.name);
    check((report.onlyInRun as string[]).join(',') === 'log_line,init_board_b', `the run marks ${(report.onlyInRun as string[]).join(',')}`);
    // into start, where its own calls show as rows
    (document.querySelectorAll('.seqv .srow')[0] as HTMLElement).click();
    await sleep(200);
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await sleep(700);
    report.only = only();
    await api.smoke.capture('configs-3-debug-board2');
    check((report.only as string[]).join(' | ') === 'start: only with DEBUG · BOARD=2: log_line, init_board_b', `only with the setting: ${(report.only as string[]).join(' | ')}`);
    check((report.withSetting as string[])[0] === 'init_board_a | only as built', `as built's own call is not a ghost in place: ${(report.withSetting as string[]).join(' ; ')}`);
    // as built again: nothing of the setting stays
    click('.setc .chip');
    await sleep(300);
    check(click('.setm .mi', 'as built'), 'no as built choice');
    await sleep(600);
    report.back = { only: only(), ghosts: ghosts() };
    check(!only().length && ghosts().length === 2, `as built again still shows the setting: ${JSON.stringify(report.back)}`);
  } catch (e) { errors.push(`configs: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/**
 * `--scenario repair` on samples/repair. Coverage: correct code broken one edit at a time, and how many of those errors
 * get a fix clangd confirms (and how many give back the code as it was). Then the editor: the fixes under broken.cpp's
 * three errors, the reason on hover, ✓, ✗, the next check, and undo.
 */
async function repairCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`repair: ${what}`); };
  const BREAKS: [string, string, string, string][] = [
    ['missing ;', 'repair.cpp', 'int sum = 0;', 'int sum = 0'],
    ['missing )', 'repair.cpp', 'count > 0) {', 'count > 0 {'],
    ['missing ]', 'repair.cpp', 'sum += v[i];', 'sum += v[i;'],
    ['missing }', 'repair.cpp', 'std::endl;\n  }\n', 'std::endl;\n'],
    ['stray }', 'repair.cpp', 'p->y; }', 'p->y; } }'],
    ['stray )', 'repair.cpp', 'return head;', 'return head);'],
    ['misspelt call', 'repair.cpp', 'total(numbers)', 'totl(numbers)'],
    ['misspelt variable', 'repair.cpp', 'count > 0', 'cont > 0'],
    ['misspelt keyword', 'repair.cpp', 'return sum;', 'retrun sum;'],
    ['string without std::', 'repair.cpp', 'std::string name', 'string name'],
    ['vector without std::', 'repair.cpp', 'std::vector<int> numbers', 'vector<int> numbers'],
    ['cout without std::', 'repair.cpp', 'std::cout <<', 'cout <<'],
    ['no #include <algorithm>', 'repair.cpp', '#include <algorithm>\n', ''],
    ['. on a pointer', 'repair.cpp', 'p->x *', 'p.x *'],
    ['-> on an object', 'repair.cpp', 'corner.x', 'corner->x'],
    ['missing *', 'repair.cpp', 'int head = *values;', 'int head = values;'],
    ['missing &', 'repair.cpp', 'fill(&count,', 'fill(count,'],
    ['no #include <stdio.h>', 'repair.c', '#include <stdio.h>\n', ''],
    ['no #include <string.h>', 'repair.c', '#include <string.h>\n', ''],
    ['missing ; (C)', 'repair.c', 'return 0;', 'return 0'],
  ];
  try {
    await until(() => lspState() === 'ready', 60000);
    const base: Record<string, string> = {};
    for (const f of ['repair.cpp', 'repair.c']) base[f] = (await api.fs.read(`${root()}/${f}`)) as string;
    const rows: unknown[] = [];
    let broken = 0, fixed = 0, original = 0;
    for (const [name, f, from, to] of BREAKS) {
      const good = base[f], file = `${root()}/${f}`;
      check(good.split(from).length === 2, `${name}: "${from}" is not in ${f} once`);
      const bad = good.replace(from, to), t0 = Date.now();
      const r = await api.repair.check(file, fileToUri(file), bad, true);
      const fixes = r.suggestions ?? [];
      check(r.ok, `${name}: ${r.message}`);
      if (r.errors) broken++;
      if (fixes.length) fixed++;
      const back = fixes.some((s) => applyEdit(bad, s.edit).replace(/\s+/g, '') === good.replace(/\s+/g, ''));   // as it was, but for spaces
      if (back) original++;
      for (const s of fixes) check(!isCast(s.edit.insert), `${name}: a cast was offered: ${s.edit.insert}`);
      // what clangd found, and each edit tried, where no fix gave back the code as it was
      rows.push({ name, errors: r.errors, fixes: fixes.map((s) => `${s.src} → ${JSON.stringify(s.edit.insert)}`), original: back, tries: r.tries, ms: Date.now() - t0, ...(back ? {} : { base: r.base, tried: r.tried }) });
    }
    report.coverage = { breaks: BREAKS.length, broken, fixed, original, rate: broken ? +(fixed / broken).toFixed(2) : 0 };
    report.breaks = rows;
    check(broken > 0 && fixed / broken >= 0.75, `coverage: ${JSON.stringify(report.coverage)}`);

    // the editor (first what the engine finds in broken.cpp as it is on disk, for the report)
    const file = `${root()}/broken.cpp`;
    report.direct = await api.repair.check(file, fileToUri(file), (await api.fs.read(file)) as string, true);
    await openFile(file);
    const v = () => getMainView()!;
    const shown = () => [...document.querySelectorAll('.code .rs')].map((r) => `${r.querySelector('.ed')?.textContent} | ${r.querySelector('.src')?.textContent}`);
    const rowOf = (re: RegExp) => [...document.querySelectorAll('.code .rs')].find((r) => re.test(r.querySelector('.src')?.textContent ?? '')) as HTMLElement | undefined;
    const note = () => document.querySelector('.hdr .rnote')?.textContent ?? '';
    // clang reads two errors at first: it skips the if's body while it recovers from the missing ), so the misspelt
    // call there shows only once the ) is in
    const STRING = 'struct Request { std::string path; int size; }; | clang · did you mean std::string';
    const t0 = Date.now();
    report.shown = await until(() => fixesIn(v().state).length >= 2, 120000);
    report.firstMs = Date.now() - t0;
    await sleep(600);
    report.rows = shown();
    report.note = note();
    check(JSON.stringify(report.rows) === JSON.stringify([STRING, 'if (validate(r) && check_size(r)) { | closes the ( opened at column 6']), `fixes shown: ${JSON.stringify(report.rows)}`);
    check(report.note === '2 errors · 2 fixes found, each checked with clangd', `status note: ${report.note}`);
    await api.smoke.capture('repair-1-fixes');

    // the reason, on hover: beside the fix, over no code
    rowOf(/closes the/)?.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(300);
    report.tip = document.querySelector('.rtip')?.textContent;
    check(report.tip === "The ( opened at column 6 is never closed. A ) here closes it. With it, this error is gone. clangd then reads the code it had skipped, and finds 1 more problem there, not made by this fix: use of undeclared identifier 'rout' (line 16).", `hover: ${report.tip}`);
    const tb = document.querySelector('.rtip')?.getBoundingClientRect();
    const textBox = (el: Element) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const over = (a: DOMRect, b: DOMRect) => a.width > 0 && b.width > 0 && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    report.tipCovers = tb ? [...document.querySelectorAll('.code .cm-line, .code .rs .ed, .code .rs .src, .code .why0')].filter((el) => over(tb, textBox(el))).map((el) => el.textContent) : ['no tip'];
    check(!(report.tipCovers as string[]).length, `the reason covers: ${JSON.stringify(report.tipCovers)}`);
    await api.smoke.capture('repair-2-reason');
    rowOf(/closes the/)?.dispatchEvent(new MouseEvent('mouseleave'));

    // ✓ applies that one fix, and nothing else
    const before = v().state.doc.toString();
    rowOf(/closes the/)?.querySelector('.ok')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(300);
    report.applied = v().state.doc.toString() === before.replace('check_size(r) {', 'check_size(r)) {');
    check(report.applied as boolean, `✓ changed: ${v().state.doc.line(15).text}`);
    check(!!document.querySelector('.code .applied'), 'no "applied" note on the line');
    report.afterYes = shown();
    await api.smoke.capture('repair-3-applied');

    // the next check reads the revealed error, with its own fix
    report.rechecked = await until(() => shown().length === 2 && !!rowOf(/did you mean route/), 60000);
    report.afterCheck = shown();
    report.noteAfterCheck = note();
    check(JSON.stringify(report.afterCheck) === JSON.stringify([STRING, 'routroute(r); | clang · did you mean route']) && report.noteAfterCheck === '2 errors · 2 fixes found, each checked with clangd',
      `after the next check: ${JSON.stringify(report.afterCheck)} (${note()})`);

    // ✗ hides a fix and changes no code; a later check doesn't bring it back
    rowOf(/did you mean route/)?.querySelector('.no')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(300);
    report.afterNo = shown();
    check(JSON.stringify(report.afterNo) === JSON.stringify([STRING]) && note() === '2 errors · 1 fix found, each checked with clangd', `after ✗: ${JSON.stringify(report.afterNo)} (${note()})`);
    check(v().state.doc.toString() === before.replace('check_size(r) {', 'check_size(r)) {'), '✗ changed the code');
    v().dispatch({ changes: { from: v().state.doc.length, insert: '\n' } });   // a change elsewhere: the file is checked again
    report.checkedAgain = await until(() => /checking/.test(note()), 5000) && await until(() => !/checking/.test(note()), 60000);
    await sleep(300);
    report.afterNoCheck = shown();
    check(!!report.checkedAgain && JSON.stringify(report.afterNoCheck) === JSON.stringify([STRING]), `✗ came back: ${JSON.stringify(report.afterNoCheck)} (${note()})`);

    // undo gives back the code exactly as it was
    report.undoDepth = undoDepth(v().state);
    while (undoDepth(v().state) > 0) undo(v());
    await sleep(300);
    check(v().state.doc.toString() === before, 'undo did not give back the code');
  } catch (e) { errors.push(`repair: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario change` on a git repository whose last commit is samples/change/v1 and whose files on disk are v2. */
async function changeCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`change: ${what}`); };
  const chip = () => [...document.querySelectorAll('.setc > .chip')].find((c) => /^(compare|compared)/.test(c.textContent ?? '')) as HTMLElement | undefined;
  const marks = () => Object.fromEntries([...document.querySelectorAll('.seqv .srow')].map((r) => [r.getAttribute('data-name') ?? r.querySelector('.nm')?.textContent ?? '', [...r.querySelectorAll('.nt')].map((n) => n.textContent ?? '').filter(Boolean)]).filter(([, v]) => (v as string[]).length));
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    report.before = marks();
    check(!!chip(), 'no compare chip');
    chip()?.click();
    await until(() => document.querySelectorAll('.setm .mr').length > 0, 15000);
    report.commits = [...document.querySelectorAll('.setm .mr .mi')].map((b) => b.textContent);
    ([...document.querySelectorAll('.setm .mr .mi')][0] as HTMLElement | undefined)?.click();
    const t0 = Date.now();
    await until(() => comparing()?.state !== 'reading', 180000);
    await until(() => !!comparing()?.summary, 15000);
    report.compareMs = Date.now() - t0;
    report.state = { state: comparing()?.state, note: comparing()?.note };
    report.summary = comparing()?.summary;
    check(report.summary === '+ 2 steps in handle · − log_request from start · route now inside if (validate(r) && check_size(r)) · 2 steps changed', `summary: ${report.summary} (${comparing()?.state} ${comparing()?.note})`);
    await sleep(600);
    report.csum = document.querySelector('.setc .csum')?.textContent;
    report.marks = marks();
    report.gone = [...document.querySelectorAll('.seqv .sline .gh.gone')].map((g) => `${g.textContent} | ${g.nextElementSibling?.textContent ?? ''}`);
    await api.smoke.capture('change-1-compared');
    check(report.csum === report.summary, 'the summary line is not shown');
    // validate folds into handle's uses; check_size and route keep their own rows, as they run only under the new test
    check(JSON.stringify(report.marks) === JSON.stringify({ start: ['◆ changed · 1 line   ~ in a macro'], handle: ['◆ changed · 2 lines', 'added: validate'], check_size: ['? validate(r) &&   added'], route: ['? if (validate(r) && check_size(r))   now inside if (validate(r) && check_size(r))'], 'end of the run': ['main returns'] }), `rows say ${JSON.stringify(report.marks)}`);
    check((report.gone as string[]).join(' ; ') === 'log_request | removed · in the last commit', `removed calls: ${(report.gone as string[]).join(' ; ')}`);
    // the grid shows the same, by colour, on the called functions' names. Its squares are steps: validate(r), which
    // always runs as part of handle's condition, has no step of its own (the metro folds it into handle's uses, marked
    // "added: validate" above), so it has no row in the grid; check_size, run only when validate passes, has a step.
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    report.grid = { added: [...document.querySelectorAll('.gview .grh.cadd b')].map((n) => n.textContent).sort(), changed: [...document.querySelectorAll('.gview .grh.cchg b')].map((n) => n.textContent).sort() };
    const validateIsStep = seq()!.items.some((row) => /(^|::)validate$/.test(seq()!.run.rows[row].name));
    const validateRow = [...document.querySelectorAll('.gview .grh b')].some((b) => b.textContent === 'validate');
    report.validate = { step: validateIsStep, gridRow: validateRow };
    await api.smoke.capture('change-2-grid');
    check(JSON.stringify(report.grid) === JSON.stringify({ added: ['check_size'], changed: ['handle', 'start'] }), `grid: ${JSON.stringify(report.grid)}`);
    check(!validateIsStep && !validateRow, `validate: ${JSON.stringify(report.validate)} (it runs inside handle's condition, so it has no step and no grid row)`);
    setFlowView('metro');
    await sleep(500);
    chip()?.click();
    await sleep(300);
    ([...document.querySelectorAll('.setm .mi')].find((b) => b.textContent === 'no comparison') as HTMLElement | undefined)?.click();
    await sleep(600);
    report.back = { marks: marks(), csum: !!document.querySelector('.setc .csum') };
    const back = report.back as { marks: object; csum: boolean };
    check(JSON.stringify(back.marks) === JSON.stringify(report.before) && !back.csum, `no comparison still shows one: ${JSON.stringify(back)} (before: ${JSON.stringify(report.before)})`);
  } catch (e) { errors.push(`change: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario findings` on any folder: the findings the sequence view lists for the chosen program, as shown. */
async function findingsCheck(report: Record<string, unknown>) {
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    (document.querySelector('.sfnd .chip') as HTMLElement | null)?.click();
    await sleep(400);
    report.findings = [...document.querySelectorAll('.sfndl button')].map((b) => b.textContent);
    // the run's ways out too (E), each with where it is, so they can be checked against the source
    const run = seq()!.run;
    report.program = entries()[lane()]?.rel;
    report.steps = run.rows.filter((r) => r.kind === 'step').length;
    report.waysOut = run.rows.flatMap((r) => (r.kind === 'step' ? (run.exits?.[r.key] ?? []).filter((x) => x.early).map((x) => `${relPath(root(), r.file)}:${x.line + 1} ${r.name}: ${x.kind}${x.callee ? ` ${x.callee}` : ''} | ${x.text} | ${x.when.join(' / ')}`) : []));
    report.pairs = Object.entries(run.pairs ?? {}).flatMap(([k, us]) => us.map((u) => `${run.rows.find((r) => r.key === k)?.name}: ${u.what} ${u.name} line ${u.opened.line + 1} → ${u.exit.kind} ${u.exit.line + 1} | ${u.path.join(' / ')}`));
    const box = document.querySelector('.sfndl')?.getBoundingClientRect();
    if (box && (box.left < 0 || box.right > innerWidth)) errors.push(`findings: the list runs off the window (${Math.round(box.left)}–${Math.round(box.right)} of ${innerWidth})`);
    await api.smoke.capture(`findings-${basename(root())}`);
  } catch (e) { errors.push(`findings: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario exits` on samples/exits: E dims the usual path and lights every way out, with what leads there. */
async function exitsCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`exits: ${what}`); };
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    const sv = document.querySelector('.seqv') as HTMLElement;
    sv.focus();
    sv.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    await sleep(500);
    const rows = [...document.querySelectorAll('.seqv .srow:not(.sfold)')] as HTMLElement[];
    const lit = rows.filter((r) => r.classList.contains('wx')).map((r) => `${r.getAttribute('data-name')}: ${r.querySelector('.sx')?.textContent}`);
    report.lit = lit;
    report.dimmed = rows.filter((r) => r.classList.contains('wq')).map((r) => r.getAttribute('data-name'));
    report.caption = document.querySelector('.scap')?.textContent ?? '';
    await api.smoke.capture('exits-1-ways-out');
    check(lit.some((l) => /^main: if \(setjmp\(restart\)\) → return 9 · 54 · \+1 more$/.test(l)), 'main does not show its two early ways out');
    check(lit.some((l) => /^parse: if \(!s\) → return -1 · 17 · \+3 more$/.test(l)), 'parse does not show its four early ways out');
    check(lit.some((l) => /^command: switch \(cmd\) · case 0 → return 0 · 30 · \+3 more$/.test(l)), 'command does not show its ways out');
    check(lit.some((l) => /^die: std::exit\(3\)/.test(l) || /^die: exit — never returns/.test(l)), 'die does not show exit');
    check(!lit.some((l) => /return v|return n|return rc|twice/.test(l)), 'a normal end is shown as a way out');
    sv.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    await sleep(300);
    check(!document.querySelector('.seqv .srow.wq, .seqv .srow.wx'), 'E again does not show the whole run');
    // the grid: the same functions' names light in the error colour
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    (document.querySelector('.gview') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'E', bubbles: true }));
    await sleep(500);
    report.grid = [...new Set([...document.querySelectorAll('.gview .grh.lv b, .gview .gch.lv b')].map(headText))].sort();
    await api.smoke.capture('exits-2-grid');
    check((report.grid as string[]).join() === 'command,die,halt,main,open_all,parse', `the grid lights ${(report.grid as string[]).join(', ')}`);
    const metroLit = [...new Set(lit.map((l) => l.slice(0, l.indexOf(': '))))];
    check(metroLit.every((n) => (report.grid as string[]).includes(n)), `the metro lights ${metroLit.join(', ')} but the grid lights ${(report.grid as string[]).join(', ')}`);
    check(auditGrid().length === 0, `text on text in the grid: ${auditGrid().slice(0, 3).join('; ')}`);
  } catch (e) { errors.push(`exits: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/**
 * `--scenario jump` on samples/tinyhttp: in both flow views, a click on a call outlined in the code preview moves the
 * run to that call's step; a grid square opens in place and fills the card; the divider keeps the card between its
 * comfortable minimum and its content, and the code at its minimum. Screenshots before and after each click.
 */
async function jumpCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`jump: ${what}`); };
  const stepNow = () => Number(document.querySelector('.sprev .pstep b')?.textContent ?? 0);
  const press = (sel: string, key: string) => (document.querySelector(sel) as HTMLElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  // walk until the current function's code shows calls outlined (a call other than the next one, to show a real jump)
  const toCalls = async (view: string) => {
    press(view, 'Home'); await sleep(300);
    for (let k = 0; k < 40 && !document.querySelector('.sprev .scode .cbx:not(.on)'); k++) { press(view, 'ArrowRight'); await sleep(250); }
    await sleep(600);
  };
  const clickCall = async (name: string) => {
    const boxes = [...document.querySelectorAll('.sprev .scode .cbx')] as HTMLElement[];
    const first = boxes.find((b) => !b.classList.contains('on'));
    if (!first) { check(false, `${name}: no outlined call other than the next step in the code preview`); return null; }
    const item = first.dataset.step!, want = Number(item) + 1, before = stepNow(), call = first.textContent, fnBefore = document.querySelector('.sprev .pfn')?.textContent ?? null;
    check(want !== before + 1 && want !== before, `${name}: the chosen call (step ${want}) is the current or the next step, so the click would prove nothing`);
    // CodeMirror may redraw a line at any time: the call is found again by its step just before each use
    const find = () => document.querySelector(`.sprev .scode .cbx[data-step="${item}"]`) as HTMLElement | null;
    // only the code's own scroller moves, so the call is on screen for the screenshot; nothing else in the window scrolls
    { const t0 = find(), sc = t0?.closest('.cm-scroller') as HTMLElement | null;
      if (t0 && sc) { const a = t0.getBoundingClientRect(), b = sc.getBoundingClientRect(); if (a.top < b.top || a.bottom > b.bottom) sc.scrollTop += a.top - b.top - b.height / 2; } }
    await sleep(300);
    // for the screenshot only: a ring drawn over the call to be clicked, outside the editor so its DOM is untouched
    const r0 = find()?.getBoundingClientRect();
    const ring = document.createElement('div');
    if (r0) { Object.assign(ring.style, { position: 'fixed', left: `${r0.left - 4}px`, top: `${r0.top - 4}px`, width: `${r0.width + 8}px`, height: `${r0.height + 8}px`, border: '2px solid #e0904f', pointerEvents: 'none', zIndex: '99' }); document.body.appendChild(ring); }
    await api.smoke.capture(`jump-${name}-1-before`);
    ring.remove();
    const target = find();
    if (!target) { check(false, `${name}: the call ${call} (step ${want}) left the code preview before the click`); return null; }
    const r = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 2, clientY: r.top + r.height / 2 }));
    await sleep(900);
    const now = stepNow();
    await api.smoke.capture(`jump-${name}-2-after`);
    check(now === want, `${name}: clicking ${call} (step ${want}) went to step ${now}, from ${before}`);
    return { call, from: before, want, now, outlined: boxes.length, fnBefore, fnAfter: document.querySelector('.sprev .pfn')?.textContent ?? null };
  };
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    await toCalls('.seqv');
    report.metro = await clickCall('metro');
    report.metroCard = { tag: document.querySelector('.sprev .ibx.full .tg')?.textContent ?? null, sections: [...document.querySelectorAll('.sprev .ibx.full .sec h6')].map((e) => e.textContent), link: !!document.querySelector('svg.slink path') };
    report.metroCollisions = auditSequence();
    check((report.metroCollisions as string[]).length === 0, `text on text in the metro: ${(report.metroCollisions as string[]).slice(0, 3).join('; ')}`);
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .gcell.has').length > 0, 20000);
    await sleep(600);
    await toCalls('.gview');
    report.grid = await clickCall('grid');
    // a square with two calls or more opens in place; the card says SELECTED and lists the calls in it
    const sq = ([...document.querySelectorAll('.gview .gcell.has')] as HTMLElement[]).find((e) => e.querySelectorAll('i').length >= 2 || !!e.querySelector('.dots'));
    sq?.click();
    await sleep(800);
    report.square = { steps: [...document.querySelectorAll('.gview .gcell.pk .gstep')].map((e) => e.textContent), tag: document.querySelector('.sprev .ibx.full .tg')?.textContent ?? null, calls: document.querySelectorAll('.sprev .ibx.full .cl').length, link: !!document.querySelector('svg.slink path') };
    check((report.square as any).tag === 'SELECTED' && (report.square as any).steps.length >= 2 && (report.square as any).calls === (report.square as any).steps.length, `the opened square: ${JSON.stringify(report.square)}`);
    await api.smoke.capture('jump-grid-3-square-open');
    // the divider: drag far down, then far up
    const div = document.querySelector('.sprev .hdiv') as HTMLElement;
    const cardH = () => Math.round((document.querySelector('.sprev .ibx.full') as HTMLElement).getBoundingClientRect().height);
    const drag = async (dy: number) => {
      const r = div.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 6;
      div.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y + dy, pointerId: 1 }));
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y + dy, pointerId: 1 }));
      await sleep(400);
    };
    const paneBottom = () => Math.round((document.querySelector('.sprev') as HTMLElement).getBoundingClientRect().bottom);
    const cardBottom = () => Math.round((document.querySelector('.sprev .ibx.full') as HTMLElement).getBoundingClientRect().bottom);
    const codeH = () => Math.round(document.querySelector('.sprev .scodewrap')!.getBoundingClientRect().height);
    await drag(3000);
    const low = cardH(), codeLow = codeH();
    await api.smoke.capture('jump-grid-4-card-low');
    await drag(-3000);
    const high = cardH(), content = (document.querySelector('.sprev .ibx.full .in') as HTMLElement).scrollHeight, codeHigh = codeH();
    await api.smoke.capture('jump-grid-5-card-high');
    report.divider = { low, high, content, codeLow, codeHigh, cardBottom: cardBottom(), paneBottom: paneBottom() };
    // the card's height includes its 1 px border top and bottom (border-box): all content shows at content + 2
    check(low === 170, `dragged down, the card is ${low} px, not its 170 px minimum`);
    check(high <= content + 2, `dragged up, the card (${high} px) grows past its content (${content} px + 2 px border)`);
    check(high === content + 2 || codeHigh <= 111, `dragged up, the card (${high} px) stops short of its content (${content} px) while the code still has ${codeHigh} px`);
    check(codeHigh >= 109, `dragged up, the code preview is ${codeHigh} px, below its 110 px minimum`);
    check(cardBottom() <= paneBottom(), `dragged up, the card ends at ${cardBottom()} px, below the pane (${paneBottom()} px)`);
    check(high > low || content + 2 <= 170, 'the divider does not move');
    try { localStorage.removeItem('flow.cardH'); } catch { /* fine */ }
  } catch (e) { errors.push(`jump: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/**
 * `--scenario revisit` on samples/tinyhttp: a folder opened again shows the picture it settled on last time at once,
 * and the live build underneath ends on the same picture as a fresh trace; once a file changes, nothing is kept.
 */
async function revisitCheck(report: Record<string, unknown>) {
  const stepsOf = () => seq()?.run.rows.filter((r) => r.kind === 'step').map((r) => r.name.replace(/^.*::/, '')) ?? [];
  const settled = () => quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 2000, 180000);
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`revisit: ${what}`); };
  try {
    const home = root(), other = home.replace(/[\\/][^\\/]+$/, '/engine');
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await settled();
    await sleep(1500);   // the settled picture is written in the background
    report.first = { steps: stepsOf(), status: status() };
    const reopen = async () => {
      await openFolder(other);
      await until(() => lspState() === 'ready' && root() === other, 60000);
      await sleep(1000);
      const t0 = performance.now();
      await openFolder(home);
      await until(() => !!seq() && root() === home, 60000);
      return { ms: Math.round(performance.now() - t0), status: status(), steps: stepsOf() };
    };
    const kept = await reopen();
    report.kept = kept;
    await api.smoke.capture('revisit-1-kept');
    await settled();
    const g = graph(), run = g ? await buildRun(g.lanes[0].start) : null;
    report.live = { steps: stepsOf(), status: status(), fresh: run?.rows.filter((r) => r.kind === 'step').map((r) => r.name.replace(/^.*::/, '')) };
    check(/as last time/.test(kept.status), `the folder opened again without its last picture (${kept.status})`);
    check(kept.steps.join() === (report.first as any).steps.join(), 'the kept picture differs from the one last shown');
    check(!/checking/.test(status()), 'the kept picture was never confirmed');
    check(stepsOf().join() === (report.live as any).fresh?.join(), 'after the live build, the page differs from a fresh trace');
    // a file touched since (same text, new time): the picture is not kept, the live build draws it
    const file = `${home}/src/server.cpp`;
    await api.fs.write(file, (await api.fs.read(file)) as string);
    const touched = await reopen();
    report.touched = touched;
    check(!/as last time/.test(touched.status), 'a picture was kept for a folder whose files changed');
    await settled();
  } catch (e) { errors.push(`revisit: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario programs` on samples/programs: the list of programs, which starts which, and the code they share. */
async function programsCheck(report: Record<string, unknown>) {
  try {
    report.lsp = await until(() => lspState() === 'ready', 60000);
    setPage('flow');
    await until(() => document.querySelectorAll('.progs .pr').length > 1, 30000);
    report.entries = entries().map((e) => `${e.kind}:${e.label}`);
    const btn = [...document.querySelectorAll('.progs ~ * .chip, .ph .chip')].find((c) => c.textContent === 'how they connect') as HTMLElement | undefined;
    btn?.click();
    report.connected = await until(() => !!document.querySelector('.plinks') && !/tracing/.test(document.querySelector('.plinks')?.textContent ?? ''), 60000);
    report.links = [...document.querySelectorAll('.plinks .pl')].map((e) => e.textContent);
    await api.smoke.capture('programs-connect');
    (document.querySelector('.progs .pr.top') as HTMLElement).click();
    report.flowAfter = await until(() => (seq()?.run.rows.length ?? 0) > 1, 30000);
    // from a program's flow, the other programs are one click away: the back link and a chip per program
    const back = document.querySelector('.backp') as HTMLElement | null, br = back?.getBoundingClientRect();
    report.switcher = { back: !!back && !!br && br.width > 0 && br.right <= innerWidth, chips: [...document.querySelectorAll('.lanes .chip')].map((c) => c.textContent) };
    await api.smoke.capture('programs-flow');
    await sleep(2500);
    report.later = { list: programs(), back: !!document.querySelector('.backp'), lane: lane() };
    await api.smoke.capture('programs-flow-later');
    // the same in the grid, and in a narrow window: the way back must stay visible
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .gcell').length > 0, 15000);
    // every control of the header wholly visible: not cut off by the pane edge, not under another pane
    const shown = (e: Element) => { const r = e.getBoundingClientRect(), pane = e.closest('.pane')!.getBoundingClientRect(); return r.width > 0 && r.left >= pane.left - 1 && r.right <= pane.right + 1 && r.bottom <= pane.bottom && [[r.left + 2, r.top + r.height / 2], [r.right - 2, r.top + r.height / 2]].every(([x, y]) => e.contains(document.elementFromPoint(x, y))); };
    const vis = () => { const ctl = [...document.querySelectorAll('.ph.wrap .backp, .ph.wrap .lanes .chip, .ph.wrap > .chip, .ph.wrap .mgchips .chip')]; return ctl.length > 0 && ctl.every(shown) ? true : ctl.filter((e) => !shown(e)).map((e) => e.textContent); };
    report.gridBack = vis();
    await api.smoke.capture('programs-grid');
    await api.smoke.resize(900, 700); await sleep(600);
    report.narrowBack = vis();
    await api.smoke.capture('programs-grid-narrow');
  } catch (e) { errors.push(`programs: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}
