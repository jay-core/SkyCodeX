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
import { setFlowView, changed, seq, entries, lane, entryStart, runStatus, programs, settlingNow, status, graph, trail, setting, comparing, stepMove } from './lib/flowstore';
import { pal } from './lib/lines';
import { fileToUri } from './lib/api';
import { fixesIn } from './lib/repair';
import { applyEdit, isCast } from '../shared/repair';
import { undo, undoDepth } from '@codemirror/commands';
import { probeCheck } from './probe';
import { stepLinks } from '../shared/gridlinks';
import { lines as seqLines } from './lib/seqtext';
import { rounded as roundedPath } from './lib/paths';

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function frames(run: () => unknown, ms: number) {
  const d: number[] = [];
  let last = performance.now(), on = true;
  const tick = (t: number) => { d.push(t - last); last = t; if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await run(); await sleep(ms); on = false;
  const f = d.slice(1);
  return { frames: f.length, worstMs: +Math.max(...f).toFixed(1), dropped: f.filter((x) => x > 25).length, avgMs: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1) };
}
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
async function quiet(cond: () => boolean, hold: number, ms: number) {
  const end = Date.now() + ms;
  let since = cond() ? Date.now() : 0;
  while (Date.now() < end) {
    if (!cond()) since = 0; else if (!since) since = Date.now(); else if (Date.now() - since >= hold) return true;
    await sleep(100);
  }
  return false;
}

let layerReport: Record<string, string[]> | null = null;
const classPath = (el: Element) => { const parts: string[] = []; for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) parts.push(`${e.tagName.toLowerCase()}${e.classList.length ? `.${[...e.classList].sort().join('.')}` : ''}`); return parts.reverse().join('>'); };
const layersNow = () => [...document.querySelectorAll('*')].flatMap((el) => { const z = getComputedStyle(el).zIndex; return z === 'auto' ? [] : [`${classPath(el)} ${z}`]; }).sort();
async function shot(name: string) {
  if (layerReport) layerReport[name] = layersNow();
  await api.smoke.capture(name);
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
  if (info()?.scenario === 'probe') return probeCheck(report);
  if (info()?.scenario === 'arrows') return arrowsCheck(report);
  if (info()?.scenario === 'arrows-mock') return arrowsMock(report);
  if (info()?.scenario === 'overlaps') return overlapsCheck(report);
  if (info()?.scenario === 'hold') return;
  layerReport = {}; report.layers = layerReport;
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
    report.indexQuiet = await quiet(() => !indexing(), 2000, 180000);
    report.level1Resolved = await until(() => (levels()[0]?.cards.length ?? 0) > 0 && !levels()[0].cards.some(unresolvedCard), 40000);
    await sleep(900);
    report.level1 = levels()[0]?.cards.map((c) => c.name);
    await shot('1-editor-preview');
    const callAt = v.state.doc.toString().indexOf('metrics_.record(') + 10;
    v.dispatch({ selection: { anchor: callAt } });
    await sleep(900);
    report.litCard = document.querySelector('.card.lit .nm')?.textContent ?? null;
    report.dimmedCards = document.querySelectorAll('.pcol.haslit .card:not(.lit)').length;
    const boxes = () => [...document.querySelectorAll('.code .callbox')] as HTMLElement[];
    const linkPaths = () => document.querySelectorAll('svg.links path').length;
    report.callBoxes = { editor: boxes().length, sites: levels()[0]?.cards.reduce((n, c) => n + c.fromRanges.length, 0) ?? 0,
      mismatched: boxes().filter((e) => { const [li, k] = (e.dataset.call ?? '').split(':').map(Number); const c = levels()[li]?.cards[k]; const plain = !!c && /^[A-Za-z_]\w*$/.test(c.name.replace(/^.*::/, '')); return !c || e.style.getPropertyValue('--c').trim() !== pal(k) || (plain && !c.name.endsWith(e.textContent ?? '\u0000')); }).map((e) => e.textContent) };
    report.connectorsAtRest = linkPaths();
    const hoverBox = async (el: Element | undefined) => { el?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await sleep(250); };
    const rec = boxes().find((e) => e.textContent === 'record');
    await hoverBox(rec);
    report.hoverConnector = { paths: linkPaths(), color: rec?.style.getPropertyValue('--c') ?? null };
    await shot('1b-hover-call');
    await hoverBox(document.querySelector('.shiftbar') ?? undefined);
    report.connectorsAfterHover = linkPaths();
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
      await shot('2-level-two');
      const src = () => [...document.querySelectorAll(`.pcol [data-card="0:${idx}"] .callbox`)] as HTMLElement[];
      await until(() => src().length > 0, 5000);
      report.pane2Source = { boxes: src().length, sites: levels()[1]?.cards.reduce((n, c) => n + c.fromRanges.length, 0) ?? 0 };
      const split = src().find((e) => e.textContent === 'split');
      split?.click();
      await until(() => !!document.querySelector('.pcol [data-card^="1:"] .depth:not(:empty)') && !/…/.test(document.querySelector('.pcol [data-card^="1:"] .depth')?.textContent ?? '…'), 10000);
      await sleep(400);
      report.pane2Click = { lit: document.querySelector('.pcol [data-card^="1:"].lit .nm')?.textContent ?? null, depth: document.querySelector('.pcol [data-card^="1:"].lit .depth')?.textContent ?? null };
      split?.scrollIntoView({ block: 'center' });
      await sleep(200);
      await hoverBox(split);
      report.pane2Hover = linkPaths();
      await shot('2b-pane2-click');
      await hoverBox(document.querySelector('.shiftbar') ?? undefined);
      report.stuckConnector = linkPaths();
      const p1 = document.querySelectorAll('.pcol')[0] as HTMLElement;
      p1.scrollTop = p1.scrollHeight;
      await sleep(250);
      await hoverBox(split);
      report.hiddenSourceHover = { inView: (() => { const a = split!.getBoundingClientRect(), b = p1.getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; })(), paths: linkPaths() };
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
    await shot('3-shifted');
    (report.motion as any).shiftBack = await frames(() => (document.querySelector('.shiftbar button:first-child') as HTMLButtonElement)?.click(), 1100);
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
    pc0.scrollTop = 0; await sleep(50);
    const lastK = (levels()[0]?.cards.length ?? 1) - 1;
    pc0.scrollTop = (pc0.querySelector(`[data-card="0:${lastK}"]`) as HTMLElement).offsetTop > pc0.clientHeight ? 0 : pc0.scrollHeight;
    await sleep(300);
    await hoverBox(boxes().find((e) => e.dataset.call === `0:${lastK}`));
    const stub = [...document.querySelectorAll('svg.links text')].map((t) => t.textContent);
    report.offscreenHover = { card: levels()[0]?.cards[lastK]?.name, stub: stub[0] ?? null };
    await shot('3c-hover-offscreen');
    await hoverBox(document.querySelector('.shiftbar') ?? undefined);
    pc0.scrollTop = 0;

    await quickOpen(); await sleep(400);
    report.quickOpenItems = palette()?.items?.length ?? 0;
    await shot('3b-quick-open');
    setPalette(null);
    const kaAt = v.state.doc.toString().indexOf('keep_alive(headers)') + 2;
    const edit = await api.lsp.request('textDocument/rename', { textDocument: { uri: 'file://' + encodeURI(file) }, position: offsetToPos(v.state.doc, kaAt), newName: 'wants_keep_alive' }) as any;
    report.renameFiles = await applyWorkspaceEdit(edit);
    report.renameApplied = [...states.entries()].filter(([, st]) => st.doc.toString().includes('wants_keep_alive')).map(([f]) => f.split('/').pop());
    (report.motion as any).settingsOpen = await frames(() => setSettingsOpen(true), 1200);
    await shot('4-settings');
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
    await shot('4b-settings-slider');
    rng.value = '13'; rng.dispatchEvent(new Event('input', { bubbles: true })); rng.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);
    report.fontSizeRestored = settings()['font.size'];
    const famCtl = ctls.find((c) => c.querySelector('.lab')?.textContent?.startsWith('code font'))!;
    (famCtl.querySelector('.combo input') as HTMLInputElement).focus();
    await until(() => !!famCtl.querySelector('.combo-list button'), 4000);
    report.fontOptions = famCtl.querySelectorAll('.combo-list button').length;
    report.fontGroups = [...famCtl.querySelectorAll('.combo-g')].map((g) => g.textContent);
    await shot('4c-settings-fonts');
    (famCtl.querySelector('.combo input') as HTMLInputElement).blur();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const pageBtn = (n: string) => ([...document.querySelectorAll('.set .pv button')] as HTMLButtonElement[]).find((x) => x.textContent === n)!;
    await until(() => document.querySelectorAll('.set .weights button').length > 0, 3000);
    const wBtns = [...document.querySelectorAll('.set .ctl')].find((c) => c.querySelector('.lab')?.textContent?.startsWith('code weight'))!.querySelectorAll('.weights button');
    report.codeWeights = [...wBtns].map((x) => x.textContent);
    ([...wBtns].find((x) => x.firstChild?.textContent === 'light') as HTMLButtonElement).click();
    await sleep(400);
    report.editorWeight = getComputedStyle(document.querySelector('.cm-scroller')!).fontWeight;
    await shot('4g-settings-weight');
    await api.settings.set('font.weight', 400);
    pageBtn('clangd').click(); await sleep(300);
    await shot('4e-settings-clangd');
    setSettingsOpen(false);
    await sleep(300);
    (document.querySelector('.wctl') as HTMLElement).style.transition = 'none';
    (document.querySelector('.wctl') as HTMLElement).style.opacity = '1';
    await sleep(100);
    report.windowIcons = [...document.querySelectorAll('.wctl svg')].map((s) => Math.round(s.getBoundingClientRect().width));
    await shot('4d-window-controls');
    (document.querySelector('.wctl') as HTMLElement).style.opacity = '';
    (document.querySelector('.wctl') as HTMLElement).style.transition = '';

    setFlowView('grid');
    setPage('flow');
    report.flowReady = await until(() => document.querySelectorAll('.gview .gcell.has').length >= 4, 45000);
    await sleep(1200);
    report.gridHeads = { rows: [...document.querySelectorAll('.gview .grh b')].map((e) => e.textContent), cols: [...document.querySelectorAll('.gview .gch b')].map(headText) };
    report.gridSummary = document.querySelector('.gview .gtop')?.textContent;
    report.gridTotals = { rows: document.querySelectorAll('.gview .grh').length, timesCalled: document.querySelectorAll('.gtot .t').length, cols: document.querySelectorAll('.gview .gch').length, callsItMakes: document.querySelectorAll('.gmk .m').length };
    report.flowRipple = [...document.querySelectorAll('.gview .grh.chg b, .gview .gch.chg b')].map(headText);
    report.flowChanged = [...changed()].map((i) => { const r = seq()!.run.rows[i]; return `${r.name} ${r.file.split('/').pop()}:${r.start}+${r.lines}`; });
    report.gridCollisions = auditGrid();
    await shot('5-flow-grid');
    {
      const sq = [...document.querySelectorAll('.gview .gcell.has')] as HTMLElement[];
      const target = sq.find((e) => e.querySelectorAll('i').length >= 2) ?? sq[0];
      target.dispatchEvent(new MouseEvent('mouseenter'));
      await sleep(400);
      const tag = document.querySelector('.gtag')?.getBoundingClientRect();
      report.gridHover = { tag: document.querySelector('.gtag')?.textContent ?? null, tinted: document.querySelectorAll('.gview .gcell.hl').length, outlined: !!document.querySelector('.gview .gcell.hv'), pointer: getComputedStyle(target).cursor,
        coversSquares: tag ? sq.filter((e) => e !== target && overlap(e.getBoundingClientRect(), tag)).length : -1 };
      await shot('6-grid-hover');
      target.click();
      await sleep(800);
      report.gridOpen = { steps: [...document.querySelectorAll('.gview .gcell.pk .gstep')].map((e) => e.textContent), card: document.querySelector('.sprev .ibx.full .tg')?.textContent ?? null, cardHead: document.querySelector('.sprev .ibx.full .h .w')?.textContent ?? null, link: !!document.querySelector('svg.slink path') };
      await shot('7-grid-open');
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
    await api.settings.set('preview.include_std', true);
    await sleep(300);
    const v2 = getMainView()!;
    const hAt = v2.state.doc.toString().indexOf('auto handler = route(') + 6;
    v2.dispatch({ selection: { anchor: hAt } });
    await until(() => !!document.querySelector('.card .chip'), 15000, () => refreshForCursor(file, offsetToPos(v2.state.doc, hAt), true));
    const stdCard = [...document.querySelectorAll('.card')].find((c) => c.querySelector('.chip')) as HTMLElement | undefined;
    report.stdCards = document.querySelectorAll('.card .chip').length;
    report.stdSourceShown = (stdCard?.querySelectorAll('.cm-line').length ?? 0) > 1;
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
    await shot('9a-std-source');
    try { localStorage.removeItem('litho.preview.split'); } catch {  }
    await api.settings.set('preview.include_std', true);
    report.tabsBefore = document.querySelectorAll('.hdr .tab').length;
    const ask = window.confirm;
    window.confirm = () => true;
    (document.querySelector('.hdr .tab:last-child .tabx') as HTMLButtonElement | null)?.click();
    await sleep(300);
    window.confirm = ask;
    report.tabsAfter = document.querySelectorAll('.hdr .tab').length;
    setMenuOpen(true); await sleep(400);
    report.menuItems = document.querySelectorAll('.appmenu button').length;
    await shot('9b-menu');
    setMenuOpen(false);
    COMMANDS.newFile(); await sleep(300);
    palette()?.prompt?.accept('smoke_new.cpp'); setPalette(null); await sleep(900);
    report.newFileActive = files.active.split('/').pop();
    await openFile(file); await sleep(400);
    const pv = getMainView()!;
    const at0 = pv.state.doc.toString().indexOf('return res;');
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) pv.dispatch({ changes: { from: at0 + i, insert: 'x' } });
    report.msPerKeystroke = +((performance.now() - t0) / 300).toFixed(3);
    pv.dispatch({ changes: { from: at0, to: at0 + 300 } });
    const t1 = performance.now();
    for (let i = 0; i < 20; i++) await refreshForCursor(file, offsetToPos(pv.state.doc, at0 - 20 - i));
    report.msPerCursorRefresh = +((performance.now() - t1) / 20).toFixed(2);
    const before = !!document.querySelector('.pane.prev .shiftbar');
    await api.settings.set('preview.enabled', false); await sleep(500);
    report.previewHidden = before && !document.querySelector('.pane.prev .shiftbar') && document.querySelector('svg.links')?.innerHTML === '';
    await shot('9c-preview-hidden');
    await api.settings.set('preview.enabled', true); await sleep(800);
    report.previewShownAgain = !!document.querySelector('.pane.prev .shiftbar');
    const probe = `${root()}/probe/probe.cpp`;
    if (await api.fs.exists(probe)) {
      await openFile(probe); await sleep(500);
      const pvw = getMainView()!, tAt = pvw.state.doc.toString().indexOf('int target()') + 4;
      pvw.dispatch({ selection: { anchor: tAt } });
      await until(() => (levels()[0]?.cards ?? []).some((c) => c.kind !== 'call'), 20000, () => refreshForCursor(probe, offsetToPos(pvw.state.doc, tAt), true));
      await sleep(800);
      report.callLike = (levels()[0]?.cards ?? []).map((c) => `${c.kind}:${c.name}`);
      report.dividers = { cards: document.querySelectorAll('.pcol .pdiv').length };
      await shot('9d-call-like');
      await api.settings.set('preview.include_other', false);
      await until(() => !(levels()[0]?.cards ?? []).some((c) => c.kind !== 'call'), 8000);
      report.callLikeHidden = !(levels()[0]?.cards ?? []).some((c) => c.kind !== 'call');
      await api.settings.set('preview.include_other', true);
      await openFile(file);
    }
    setPage('editor'); setFiles('active', ''); await sleep(300);
    const ff = document.querySelector('.ffind input') as HTMLInputElement;
    ff.value = 'SERVER'; ff.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => document.querySelectorAll('.found .ti:not(.fdir)').length > 0, 8000);
    report.fileFilter = [...document.querySelectorAll('.found .ti:not(.fdir)')].map((e) => e.textContent);
    await shot('10a-file-filter');
    ff.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(200);
    report.fileFilterCleared = !document.querySelector('.found') && !!document.querySelector('.files .tree');
    openSearch('Keep_Alive');
    await until(() => !result.running && result.hits.length > 0, 15000); await sleep(300);
    report.contentSearch = { matches: result.matches, files: result.files, shown: document.querySelectorAll('.cres .hit').length, marked: document.querySelectorAll('.cres mark').length };
    await shot('10b-content-search');
    (document.querySelector('.cres .hit') as HTMLElement)?.click(); await sleep(600);
    report.contentSearchOpened = { closed: !document.querySelector('.csearch'), file: basename(files.active), line: getMainView()?.state.doc.lineAt(getMainView()!.state.selection.main.head).number };
    await openFile(file);
    await until(() => !!document.querySelector('.pcol .card .cm-content'), 15000);
    const cv = document.querySelector('.pcol .card .cm-content') as HTMLElement | null;
    if (cv) { cv.focus(); COMMANDS.find(); await sleep(300); }
    report.cardSearch = !!document.querySelector('.pcol .card .cm-search') && !document.querySelector('.cm-editor .cm-search:not(.pcol *)');
    await shot('10c-card-search');
    (document.querySelector('.pcol .card .cm-search input') as HTMLInputElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setPage('flow'); setFlowView('metro');
    await until(() => !!document.querySelector('.seqv .playc'), 10000);
    const pc = (n: number) => document.querySelectorAll('.playc button')[n] as HTMLButtonElement;
    const stepAt = () => document.querySelector('.seqk')?.textContent ?? '';
    const a0 = stepAt(); pc(2).click(); await sleep(400); const a1 = stepAt();
    pc(1).click(); await sleep(1200); const playingOn = pc(1).getAttribute('aria-pressed'); pc(1).click(); await sleep(200);
    pc(0).click(); await sleep(300); const restarted = pc(1).getAttribute('aria-pressed'); pc(1).click();
    setFlowView('grid'); await until(() => !!document.querySelector('.gview') && !!document.querySelector('.playc'), 10000);
    report.pngExport = { offered: [...document.querySelectorAll('.ph .chip')].some((c) => c.textContent === 'export') };
    report.playControls = { stepMoved: a0 !== a1, playing: playingOn, restartPlays: restarted, boxes: document.querySelectorAll('.playc button').length };
    await shot('10d-play-controls');
    setPage('editor');
    const sub = `${root()}/src`;
    await openFolder(sub);
    report.reopenLsp = (await until(() => lspState() === 'ready', 15000)) ? 'ready' : lspState();
    await sleep(600);
    await shot('9-reopened-folder');
  } catch (e) {
    errors.push(`smoke: ${e}`);
  }
  for (const f of files.list) if (f.dirty) await api.buffers.drop(f.path);
  report.errors = errors;
  await api.smoke.done(report);
}


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
    await shot('c1-compiler');
    document.querySelector('.body')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    document.body.click();
    await sleep(200);
    report.staysOpen = !!document.querySelector('.cwin');
    const r0 = w.getBoundingClientRect(), h = document.querySelector('.cwin-h') as HTMLElement;
    h.dispatchEvent(new PointerEvent('pointerdown', { clientX: r0.left + 60, clientY: r0.top + 15, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: r0.left + 60 - 180, clientY: r0.top + 15 + 90 }));
    window.dispatchEvent(new PointerEvent('pointerup', {}));
    await sleep(200);
    const r1 = w.getBoundingClientRect();
    report.moved = [Math.round(r1.left - r0.left), Math.round(r1.top - r0.top)];
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
    await shot('c2-compiler-versions');
    ([...document.querySelectorAll('.cwin .cconfirm .lnk')] as HTMLButtonElement[]).find((b) => b.textContent === 'cancel')?.click();
    (document.querySelector('.cwin-h button') as HTMLButtonElement).click();
    await sleep(200);
    report.minimised = !document.querySelector('.cwin-b');
    await shot('c3-compiler-minimised');
    (document.querySelector('.cwin-h button') as HTMLButtonElement).click();
    await sleep(200);
    (document.querySelector('.cwin-h button.x') as HTMLButtonElement).click();
    await sleep(200);
    report.closedByButton = !document.querySelector('.cwin');
    try { localStorage.removeItem('litho.compiler.pos'); } catch {  }
  } catch (e) {
    errors.push(`compiler demo: ${e}`);
  }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await shot('f1-arx-f1');
  } catch (e) {
    errors.push(`fonts demo: ${e}`);
  }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    const v = getMainView()!;
    const off = doc.line(use + 1).from + lines[use].indexOf('thread') + 2;
    v.dispatch({ selection: { anchor: off }, scrollIntoView: true });
    await sleep(300);
    const c = v.coordsAtPos(off)!;
    v.contentDOM.dispatchEvent(new MouseEvent('mousedown', { clientX: c.left + 2, clientY: c.top + 4, metaKey: true, bubbles: true, button: 0 }));
    await sleep(2500);
    report.afterClick = { active: files.active, cursor: cursorPos(), lines: getMainView()?.state.doc.lines, firstLine: getMainView()?.state.doc.line(1).text };
    await shot('d1-after-click');
    if (r1) {
      await openFile(r1.file, { line: r1.line, character: r1.character }); await sleep(800); report.openInclude = { active: files.active, lines: getMainView()?.state.doc.lines }; await shot('d2-include');
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

async function anyHeaderDemo(report: Record<string, unknown>) {
  try {
    const dir = root();
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

async function bootCheck(report: Record<string, unknown>) {
  layerReport = {}; report.layers = layerReport;
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
    await quiet(() => !indexing(), 2000, 180000);
    setPage('flow');
    setFlowView('metro');
    await until(() => document.querySelectorAll('.seqv .srow').length > 3 && !runStatus(), 60000);
    await quiet(() => !settlingNow() && !runStatus(), 1000, 60000);
    await sleep(800);
    report.seqRows = document.querySelectorAll('.seqv .srow').length;
    report.viewSteps = seq()?.run.rows.filter((r) => r.kind === 'step').map((r) => r.name.replace(/^.*::/, ''));
    const allRows = document.querySelectorAll('.seqv .srow:not(.sfold)').length;
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await sleep(700);
    report.seqAround = { before: allRows, after: document.querySelectorAll('.seqv .srow:not(.sfold)').length, folds: document.querySelectorAll('.seqv .sfold').length, collisions: auditSequence().slice(0, 3) };
    await shot('boot-seq-around');
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }));
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }));
    await sleep(900);
    report.seqCode = { rows: document.querySelectorAll('.seqv .sline').length, collisions: auditSequence().slice(0, 3) };
    await shot('boot-seq-all-code');
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }));
    await sleep(300);
    report.seqCollisions = [] as string[];
    const seqv = document.querySelector('.seqv') as HTMLElement;
    const press = async (key: string, shiftKey = false) => { seqv.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true })); await sleep(650); };
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'r', 'l', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'End']) {
      await press(k);
      (report.seqCollisions as string[]).push(...auditSequence().map((x) => `${k}: ${x}`));
    }
    await press('Home');
    for (let i = 0; i < 14; i++) await press('ArrowRight');
    (report.seqCollisions as string[]).push(...auditSequence());
    await shot('seq-handle');
    report.seqCodeLines = document.querySelectorAll('.scode .cm-line').length;
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
    report.gridKeptStep = !!stepName && [...document.querySelectorAll('.gview .grh.on b')].some((e) => e.textContent === stepName);
    report.gridCollisionsAfterTab = auditGrid();
    await shot('grid-kept-step');
    setFlowView('metro');
    await sleep(300);
    report.seqKeptStep = document.querySelector('.ph .seqk')?.textContent === report.seqHeader;
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(500);
    const headNamed = (n: string) => [...document.querySelectorAll('.gview .grh, .gview .gch')].find((e) => headText(e.querySelector('b')) === n) as HTMLElement | undefined;
    headNamed('main')?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await sleep(300);
    headNamed('split')?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await sleep(500);
    report.gridRoutes = document.querySelectorAll('.bxr').length;
    await shot('grid-routes');
    (document.querySelector('.gview') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setFlowView('metro');
    await sleep(300);
    const entry = rankEntries(await findEntries(root()))[0];
    report.entry = entry?.rel;
    const g = await buildFlow(root(), undefined, entry ? [await resolveEntry(entry)] : []);
    const run = await buildRun(g.lanes[0].start);
    report.runSteps = run.rows.filter((r) => r.kind === 'step').map((r) => r.name.replace(/^.*::/, ''));
    report.runIndirect = run.rows.filter((r) => r.kind === 'indirect').map((r) => `${r.via} ${r.text}`);
    report.runMissing = run.missing.length;
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
    await shot('boot');
  } catch (e) { errors.push(`boot: ${e} ${String((e as Error)?.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()).join(' ← ')}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const headText = (e: Element | null) => (e?.textContent ?? '').replace(/​/g, '');
function totalsInSight(): string[] {
  const sc = document.querySelector('.gview .gscroll') as HTMLElement | null, t = document.querySelector('.gview .gtot'), m = document.querySelector('.gview .gmk');
  if (!sc || !t || !m) return ['no grid totals'];
  const v = sc.getBoundingClientRect(), tr = t.getBoundingClientRect(), mr = m.getBoundingClientRect(), right = v.left + sc.clientWidth, bottom = v.top + sc.clientHeight - 62;
  const out: string[] = [];
  if (tr.left < v.left - 1 || tr.right > right + 1) out.push(`TIMES CALLED at ${Math.round(tr.left)}–${Math.round(tr.right)}, outside the pane's ${Math.round(v.left)}–${Math.round(right)}`);
  if (mr.top < v.top - 1 || mr.top + 34 > bottom + 1) out.push(`CALLS IT MAKES at ${Math.round(mr.top)}–${Math.round(mr.top + 34)}, outside the pane's ${Math.round(v.top)}–${Math.round(bottom)}`);
  return out;
}

export function auditGrid(): string[] {
  const view = document.querySelector('.gview .gscroll')?.getBoundingClientRect();
  if (!view) return ['no grid'];
  const opaque = (el: Element | null) => !!el && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(el).backgroundColor !== 'transparent';
  const layerOf = (e: Element) => { const c = e.closest('.gcorner'), t = e.closest('.gtot'), m = e.closest('.gmk'); return c && opaque(c) ? 5 : t && opaque(t) ? 4 : m && opaque(m) ? 3 : e.closest('.gch, .gfb') ? 2 : e.closest('.grh, .grb') ? 1 : 0; };
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

export function auditSequence(): string[] {
  const view = document.querySelector('.seqv')?.getBoundingClientRect();
  if (!view) return ['no sequence view'];
  const boxes: { r: DOMRect; t: string; owner: Element }[] = [];
  for (const owner of document.querySelectorAll('.seqv .srow, .seqv .sline, .seqv .sframe > span, .seqv .slane, .seqv .sband .sum, .seqv .sband .facts > span, .seqv .sband .ways > span')) {
    const parts = owner.classList.contains('srow') ? [...owner.children] : [owner];
    const clip = owner.classList.contains('srow') ? owner.getBoundingClientRect() : null;
    for (const p of parts) {
      let r = p.getBoundingClientRect();
      if (clip) r = new DOMRect(r.x, r.y, Math.max(0, Math.min(r.right, clip.right - 32) - r.x), r.height);
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

async function largeCheck(report: Record<string, unknown>) {
  const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
  const longTasks: { at: number; ms: number }[] = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push({ at: Math.round(e.startTime - t0), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch {  }
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
      await shot('large-1-preview');
      const t4 = performance.now();
      const call = lines.findIndex((l, i) => i > ln && /\w+\(/.test(l));
      const name = (lines[call].match(/(\w+)\(/) ?? [])[1] ?? '';
      const d = await definitionAt(want, { line: call, character: lines[call].indexOf(name) + 1 });
      steps.definition = { of: name, to: d ? relPath(root(), (d as any).file ?? (d as any).uri ?? '') : null, ms: Math.round(performance.now() - t4) };
    }
    setFlowView('grid');
    setPage('flow');
    const tp = performance.now();
    await until(() => document.querySelectorAll('.progs .pr').length > 0, 30000);
    steps.programsMs = Math.round(performance.now() - tp);
    steps.programs = { rows: document.querySelectorAll('.progs .pr').length, groups: [...document.querySelectorAll('.progs .grp b')].map((b) => b.textContent).slice(0, 10), top: document.querySelector('.progs .pr.top')?.textContent };
    await shot('large-0-programs');
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
    await shot('large-2-flow');
    const ix = await until(() => /indexing/.test(document.body.textContent ?? '') === false, 240000);
    await sleep(1000);
    await until(() => !/tracing/.test(flowStatus()), 240000);
    await sleep(1500);
    const t7 = performance.now();
    setFlowView('grid');
    await until(() => !!seq() && !runStatus() && document.querySelectorAll('.gview .gcell').length > 0, 240000);
    steps.runState = { runStatus: runStatus(), status: flowStatus(), rows: seq()?.run.rows.slice(0, 8).map((r: any) => `${r.kind} ${r.name ?? r.key ?? ''}`) };
    steps.run = { rows: seq()?.run.rows.length, steps: seq()?.run.rows.filter((r) => r.kind === 'step').length, ms: Math.round(performance.now() - t7) };
    const gridBad = auditGrid();
    steps.grid = { filesFirst: !!document.querySelector('.gview .gnote'), squares: document.querySelectorAll('.gview .gcell.has').length, rows: document.querySelectorAll('.gview .grh').length, cols: document.querySelectorAll('.gview .gch').length, collisions: gridBad.length, first: gridBad.slice(0, 2) };
    await shot('large-4-grid');
    const block = [...document.querySelectorAll('.gview .gcell.has')].sort((a, b) => (parseInt(b.textContent ?? '0') || 0) - (parseInt(a.textContent ?? '0') || 0))[0] as HTMLElement | undefined;
    if (document.querySelector('.gview .gnote')) { block?.click(); await sleep(800); }
    const sq = document.querySelector('.gview .gcell.has') as HTMLElement | null;
    sq?.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(300);
    const tr = document.querySelector('.gtag')?.getBoundingClientRect();
    steps.gridOpened = { squares: document.querySelectorAll('.gview .gcell.has').length, tagInside: tr ? tr.left >= 0 && tr.top >= 0 && tr.right <= innerWidth && tr.bottom <= innerHeight : null, collisions: auditGrid().length };
    await shot('large-5-grid-block');
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
    await shot('large-6-sequence');
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
    await shot('large-2b-flow-indexed');
    setPage('editor');
    await sleep(3000);
    const t6 = performance.now(); await sleep(0); await new Promise((r) => requestAnimationFrame(r));
    steps.frameAfterIndexMs = Math.round(performance.now() - t6);
    steps.indexing = (document.querySelector('.pcol')?.textContent ?? '').match(/index[^\n]{0,60}/i)?.[0] ?? null;
    await shot('large-3-after');
    steps.settled = (await quiet(() => !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 3000, 180000)) ? at() : 'not settled';
    await sleep(2000);
  } catch (e) { errors.push(`large: ${e}`); }
  report.totalMs = at();
  report.busy = { all: busy(0, Infinity), worst: [...longTasks].sort((a, b) => b.ms - a.ms).slice(0, 5) };
  report.errors = errors;
  await api.smoke.done(report);
}

async function colorsCheck(report: Record<string, unknown>) {
  try {
    await until(() => lspState() === 'ready', 60000);
    const src = (await api.fs.sources(root()) as string[]).find((f) => /server\.cpp$/.test(f));
    if (src) { await openFile(src); const v = getMainView()!; const at = v.state.doc.toString().indexOf('auto handler = route(') + 6; v.dispatch({ selection: { anchor: at } }); }
    await until(() => document.querySelectorAll('.code .callbox').length > 3, 60000);
    await sleep(800);
    await shot('colors-1-outlines');
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
    await shot('colors-2-settings');
    const kwCss = () => getComputedStyle(document.documentElement).getPropertyValue('--kw').trim();
    const before = kwCss(), snapshot = { ...settings() };
    const ctl = [...document.querySelectorAll('.set .ctl')].find((c) => c.querySelector('.lab')?.textContent?.startsWith('keyword'));
    const hue = ctl?.querySelector('.cslide input[type=range]') as HTMLInputElement | undefined;
    if (hue) { hue.value = String((Number(hue.value) + 150) % 360); hue.dispatchEvent(new Event('input', { bubbles: true })); }
    await sleep(300);
    const file = (await api.fs.read(info()!.settingsFile).catch(() => '')) as string;
    report.livePreview = { before, during: kwCss(), written: /^\s*keyword\s*=/m.test(file) };
    await shot('colors-3-dragging');
    applySettings(snapshot, problems());
    await sleep(200);
    report.restored = kwCss() === before;
    setSettingsOpen(false);
  } catch (e) { errors.push(`colors: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await shot('folder-tab');
  } catch (e) { errors.push(`folder: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

async function engineCheck(report: Record<string, unknown>) {
  try {
    report.lsp = await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await until(() => document.querySelectorAll('.progs .pr').length > 0, 30000);
    report.entries = entries().map((e) => `${e.kind}:${e.label}`);
    (document.querySelector('.progs .pr.top') as HTMLElement).click();
    await until(() => (seq()?.run.rows ?? []).some((r) => /Square::area|^area$/.test(r.name) && r.file.endsWith('engine.cpp') && r.kind === 'step') && (seq()?.run.rows.length ?? 0) > 6, 90000, () => {});
    await until(() => !runStatus(), 30000);
    const run = seq()!.run;
    report.rows = run.rows.map((r) => `${'  '.repeat(r.depth)}${r.kind === 'step' ? r.n : r.kind}${r.thread ? '(t)' : ''} ${r.kind === 'indirect' ? `${r.text} ⇢ ${(r.could ?? []).join(',')}` : r.name}`);
    report.virtualFrames = run.frames.filter((f) => f.kind === 'virtual').map((f) => f.text);
    await shot('engine-1-main');
    (document.querySelector('.backp') as HTMLElement).click(); await sleep(400);
    const isr = [...document.querySelectorAll('.progs .pr')].find((b) => /USART1_IRQHandler/.test(b.textContent ?? '')) as HTMLElement | undefined;
    isr?.click();
    await until(() => (seq()?.run.rows[0]?.name ?? '').includes('USART1') && !runStatus(), 30000);
    report.isrRows = seq()?.run.rows.map((r) => `${r.kind === 'step' ? r.n : r.kind} ${r.kind === 'indirect' ? `${r.text} ⇢ ${(r.could ?? []).join(',')}` : r.name}`);
    await shot('engine-2-isr');
  } catch (e) { errors.push(`engine: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await shot('watch-1-running');
    check((report.watch as string[]).join(' | ') === 'start: ▲ sets running_ · ▽ reads running_ | run: → running_ passed on as running · ▽ reads running | stop: ▲ sets running_', `watching running_ shows ${(report.watch as string[]).join(' | ')}`);
    key('Escape');
    await sleep(300);
    check(!document.querySelector('.seqv .srow.fw, .seqv .srow.fq'), 'Esc does not show the whole run again');
    const it = seq()!.items.findIndex((i) => seq()!.run.rows[i].kind === 'step' && /handle$/.test(seq()!.run.rows[i].name));
    (document.querySelectorAll('.seqv .srow')[0] as HTMLElement).click();
    await sleep(200);
    for (let k = 0; k < 40 && (trail().at(-1)?.at ?? -1) !== it; k++) { key('ArrowRight'); await sleep(60); }
    key('v');
    report.journeyOptions = [...document.querySelectorAll('.spickl button')].map((b) => b.textContent);
    await choose('req.raw');
    report.journey = lit();
    await shot('watch-2-journey');
    check((report.journey as string[]).join(' | ') === 'parse_headers: → req.raw passed on as raw · a copy · ▽ reads raw | split: → raw passed on as s · a copy · ▽ reads s', `following req.raw shows ${(report.journey as string[]).join(' | ')}`);
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    report.journeyGrid = [...document.querySelectorAll('.gview .grh.fw')].map((r) => `${r.querySelector('b')?.textContent}: ${r.querySelector('.gw')?.textContent}`);
    const fwNames = [...new Set([...document.querySelectorAll('.gview .grh.fw b, .gview .gch.fw b')].map(headText))].sort();
    await shot('watch-3-grid');
    check(fwNames.join() === 'parse_headers,split', `the grid lights ${fwNames.join(', ')}`);
    check(auditGrid().length === 0, `text on text in the grid: ${auditGrid().slice(0, 3).join('; ')}`);
    check(totalsInSight().length === 0, `the grid's totals: ${totalsInSight().join('; ')}`);
  } catch (e) { errors.push(`watch: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await shot('values-1-sequence');
    check((report.said as string[]).includes('not in this call · clear is true here — passed by draw(true)'), `draw's else does not say why: ${(report.said as string[]).slice(0, 3).join(' | ')}`);
    check((report.faded as number) >= (report.said as string[]).length && (report.said as string[]).length > 0, 'no row fades');
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    report.gridDim = [...document.querySelectorAll('.gview .grh.dim b')].map((e) => e.textContent);
    await shot('values-2-grid');
    check((report.gridDim as string[]).includes('inner'), `inner, called only where it cannot happen, is not faded in the grid: ${(report.gridDim as string[]).join(', ')}`);
    check(auditGrid().length === 0, `text on text in the grid: ${auditGrid().slice(0, 3).join('; ')}`);
    check(totalsInSight().length === 0, `the grid's totals: ${totalsInSight().join('; ')}`);
  } catch (e) { errors.push(`values: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

async function configsCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`configs: ${what}`); };
  const ghosts = () => [...document.querySelectorAll('.seqv .sline .gh')].map((g) => `${g.textContent} | ${g.nextElementSibling?.textContent ?? ''}`);
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
    await shot('configs-1-as-built');
    check(click('.setc .chip'), 'no settings chip');
    await until(() => document.querySelectorAll('.setm .mr').length > 0, 10000);
    report.macros = [...document.querySelectorAll('.setm .mr .k')].map((k) => k.textContent);
    check((report.macros as string[]).join(',') === 'BOARD,DEBUG,NO_CHECKS', `the menu lists ${(report.macros as string[]).join(',')}`);
    await shot('configs-2-menu');
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
    (document.querySelectorAll('.seqv .srow')[0] as HTMLElement).click();
    await sleep(200);
    (document.querySelector('.seqv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await sleep(700);
    report.only = only();
    await shot('configs-3-debug-board2');
    check((report.only as string[]).join(' | ') === 'start: only with DEBUG · BOARD=2: log_line, init_board_b', `only with the setting: ${(report.only as string[]).join(' | ')}`);
    check((report.withSetting as string[])[0] === 'init_board_a | only as built', `as built's own call is not a ghost in place: ${(report.withSetting as string[]).join(' ; ')}`);
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
      const back = fixes.some((s) => applyEdit(bad, s.edit).replace(/\s+/g, '') === good.replace(/\s+/g, ''));
      if (back) original++;
      for (const s of fixes) check(!isCast(s.edit.insert), `${name}: a cast was offered: ${s.edit.insert}`);
      rows.push({ name, errors: r.errors, fixes: fixes.map((s) => `${s.src} → ${JSON.stringify(s.edit.insert)}`), original: back, tries: r.tries, ms: Date.now() - t0, ...(back ? {} : { base: r.base, tried: r.tried }) });
    }
    report.coverage = { breaks: BREAKS.length, broken, fixed, original, rate: broken ? +(fixed / broken).toFixed(2) : 0 };
    report.breaks = rows;
    check(broken > 0 && fixed / broken >= 0.75, `coverage: ${JSON.stringify(report.coverage)}`);

    const file = `${root()}/broken.cpp`;
    report.direct = await api.repair.check(file, fileToUri(file), (await api.fs.read(file)) as string, true);
    await openFile(file);
    const v = () => getMainView()!;
    const shown = () => [...document.querySelectorAll('.code .rs')].map((r) => `${r.querySelector('.ed')?.textContent} | ${r.querySelector('.src')?.textContent}`);
    const rowOf = (re: RegExp) => [...document.querySelectorAll('.code .rs')].find((r) => re.test(r.querySelector('.src')?.textContent ?? '')) as HTMLElement | undefined;
    const note = () => document.querySelector('.hdr .rnote')?.textContent ?? '';
    const STRING = 'struct Request { std::string path; int size; }; | clang · did you mean std::string';
    const t0 = Date.now();
    report.shown = await until(() => fixesIn(v().state).length >= 2, 120000);
    report.firstMs = Date.now() - t0;
    await sleep(600);
    report.rows = shown();
    report.note = note();
    check(JSON.stringify(report.rows) === JSON.stringify([STRING, 'if (validate(r) && check_size(r)) { | closes the ( opened at column 6']), `fixes shown: ${JSON.stringify(report.rows)}`);
    check(report.note === '2 errors · 2 fixes found, each checked with clangd', `status note: ${report.note}`);
    await shot('repair-1-fixes');

    rowOf(/closes the/)?.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(300);
    report.tip = document.querySelector('.rtip')?.textContent;
    check(report.tip === "The ( opened at column 6 is never closed. A ) here closes it. With it, this error is gone. clangd then reads the code it had skipped, and finds 1 more problem there, not made by this fix: use of undeclared identifier 'rout' (line 16).", `hover: ${report.tip}`);
    const tb = document.querySelector('.rtip')?.getBoundingClientRect();
    const textBox = (el: Element) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const over = (a: DOMRect, b: DOMRect) => a.width > 0 && b.width > 0 && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    report.tipCovers = tb ? [...document.querySelectorAll('.code .cm-line, .code .rs .ed, .code .rs .src, .code .why0')].filter((el) => over(tb, textBox(el))).map((el) => el.textContent) : ['no tip'];
    check(!(report.tipCovers as string[]).length, `the reason covers: ${JSON.stringify(report.tipCovers)}`);
    await shot('repair-2-reason');
    rowOf(/closes the/)?.dispatchEvent(new MouseEvent('mouseleave'));

    const before = v().state.doc.toString();
    rowOf(/closes the/)?.querySelector('.ok')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(300);
    report.applied = v().state.doc.toString() === before.replace('check_size(r) {', 'check_size(r)) {');
    check(report.applied as boolean, `✓ changed: ${v().state.doc.line(15).text}`);
    check(!!document.querySelector('.code .applied'), 'no "applied" note on the line');
    report.afterYes = shown();
    await shot('repair-3-applied');

    report.rechecked = await until(() => shown().length === 2 && !!rowOf(/did you mean route/), 60000);
    report.afterCheck = shown();
    report.noteAfterCheck = note();
    check(JSON.stringify(report.afterCheck) === JSON.stringify([STRING, 'routroute(r); | clang · did you mean route']) && report.noteAfterCheck === '2 errors · 2 fixes found, each checked with clangd',
      `after the next check: ${JSON.stringify(report.afterCheck)} (${note()})`);

    rowOf(/did you mean route/)?.querySelector('.no')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(300);
    report.afterNo = shown();
    check(JSON.stringify(report.afterNo) === JSON.stringify([STRING]) && note() === '2 errors · 1 fix found, each checked with clangd', `after ✗: ${JSON.stringify(report.afterNo)} (${note()})`);
    check(v().state.doc.toString() === before.replace('check_size(r) {', 'check_size(r)) {'), '✗ changed the code');
    v().dispatch({ changes: { from: v().state.doc.length, insert: '\n' } });
    report.checkedAgain = await until(() => /checking/.test(note()), 5000) && await until(() => !/checking/.test(note()), 60000);
    await sleep(300);
    report.afterNoCheck = shown();
    check(!!report.checkedAgain && JSON.stringify(report.afterNoCheck) === JSON.stringify([STRING]), `✗ came back: ${JSON.stringify(report.afterNoCheck)} (${note()})`);

    report.undoDepth = undoDepth(v().state);
    while (undoDepth(v().state) > 0) undo(v());
    await sleep(300);
    check(v().state.doc.toString() === before, 'undo did not give back the code');
  } catch (e) { errors.push(`repair: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await shot('change-1-compared');
    check(report.csum === report.summary, 'the summary line is not shown');
    check(JSON.stringify(report.marks) === JSON.stringify({ start: ['◆ changed · 1 line   ~ in a macro'], handle: ['◆ changed · 2 lines', 'added: validate'], check_size: ['? validate(r) &&   added'], route: ['? if (validate(r) && check_size(r))   now inside if (validate(r) && check_size(r))'], 'end of the run': ['main returns'] }), `rows say ${JSON.stringify(report.marks)}`);
    check((report.gone as string[]).join(' ; ') === 'log_request | removed · in the last commit', `removed calls: ${(report.gone as string[]).join(' ; ')}`);
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    report.grid = { added: [...document.querySelectorAll('.gview .grh.cadd b')].map((n) => n.textContent).sort(), changed: [...document.querySelectorAll('.gview .grh.cchg b')].map((n) => n.textContent).sort() };
    const validateIsStep = seq()!.items.some((row) => /(^|::)validate$/.test(seq()!.run.rows[row].name));
    const validateRow = [...document.querySelectorAll('.gview .grh b')].some((b) => b.textContent === 'validate');
    report.validate = { step: validateIsStep, gridRow: validateRow };
    await shot('change-2-grid');
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

async function findingsCheck(report: Record<string, unknown>) {
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('metro');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 120000);
    (document.querySelector('.sfnd .chip') as HTMLElement | null)?.click();
    await sleep(400);
    report.findings = [...document.querySelectorAll('.sfndl button')].map((b) => b.textContent);
    const run = seq()!.run;
    report.program = entries()[lane()]?.rel;
    report.steps = run.rows.filter((r) => r.kind === 'step').length;
    report.waysOut = run.rows.flatMap((r) => (r.kind === 'step' ? (run.exits?.[r.key] ?? []).filter((x) => x.early).map((x) => `${relPath(root(), r.file)}:${x.line + 1} ${r.name}: ${x.kind}${x.callee ? ` ${x.callee}` : ''} | ${x.text} | ${x.when.join(' / ')}`) : []));
    report.pairs = Object.entries(run.pairs ?? {}).flatMap(([k, us]) => us.map((u) => `${run.rows.find((r) => r.key === k)?.name}: ${u.what} ${u.name} line ${u.opened.line + 1} → ${u.exit.kind} ${u.exit.line + 1} | ${u.path.join(' / ')}`));
    const box = document.querySelector('.sfndl')?.getBoundingClientRect();
    if (box && (box.left < 0 || box.right > innerWidth)) errors.push(`findings: the list runs off the window (${Math.round(box.left)}–${Math.round(box.right)} of ${innerWidth})`);
    await shot(`findings-${basename(root())}`);
  } catch (e) { errors.push(`findings: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await shot('exits-1-ways-out');
    check(lit.some((l) => /^main: if \(setjmp\(restart\)\) → return 9 · 54 · \+1 more$/.test(l)), 'main does not show its two early ways out');
    check(lit.some((l) => /^parse: if \(!s\) → return -1 · 17 · \+3 more$/.test(l)), 'parse does not show its four early ways out');
    check(lit.some((l) => /^command: switch \(cmd\) · case 0 → return 0 · 30 · \+3 more$/.test(l)), 'command does not show its ways out');
    check(lit.some((l) => /^die: std::exit\(3\)/.test(l) || /^die: exit — never returns/.test(l)), 'die does not show exit');
    check(!lit.some((l) => /return v|return n|return rc|twice/.test(l)), 'a normal end is shown as a way out');
    sv.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    await sleep(300);
    check(!document.querySelector('.seqv .srow.wq, .seqv .srow.wx'), 'E again does not show the whole run');
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .grh').length > 0, 20000);
    await sleep(800);
    (document.querySelector('.gview') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'E', bubbles: true }));
    await sleep(500);
    report.grid = [...new Set([...document.querySelectorAll('.gview .grh.lv b, .gview .gch.lv b')].map(headText))].sort();
    await shot('exits-2-grid');
    check((report.grid as string[]).join() === 'command,die,halt,main,open_all,parse', `the grid lights ${(report.grid as string[]).join(', ')}`);
    const metroLit = [...new Set(lit.map((l) => l.slice(0, l.indexOf(': '))))];
    check(metroLit.every((n) => (report.grid as string[]).includes(n)), `the metro lights ${metroLit.join(', ')} but the grid lights ${(report.grid as string[]).join(', ')}`);
    check(auditGrid().length === 0, `text on text in the grid: ${auditGrid().slice(0, 3).join('; ')}`);
  } catch (e) { errors.push(`exits: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

async function jumpCheck(report: Record<string, unknown>) {
  const check = (ok: boolean, what: string) => { if (!ok) errors.push(`jump: ${what}`); };
  const stepNow = () => Number(document.querySelector('.sprev .pstep b')?.textContent ?? 0);
  const press = (sel: string, key: string) => (document.querySelector(sel) as HTMLElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
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
    const find = () => document.querySelector(`.sprev .scode .cbx[data-step="${item}"]`) as HTMLElement | null;
    { const t0 = find(), sc = t0?.closest('.cm-scroller') as HTMLElement | null;
      if (t0 && sc) { const a = t0.getBoundingClientRect(), b = sc.getBoundingClientRect(); if (a.top < b.top || a.bottom > b.bottom) sc.scrollTop += a.top - b.top - b.height / 2; } }
    await sleep(300);
    const r0 = find()?.getBoundingClientRect();
    const ring = document.createElement('div');
    if (r0) { Object.assign(ring.style, { position: 'fixed', left: `${r0.left - 4}px`, top: `${r0.top - 4}px`, width: `${r0.width + 8}px`, height: `${r0.height + 8}px`, border: '2px solid #e0904f', pointerEvents: 'none', zIndex: '99' }); document.body.appendChild(ring); }
    await shot(`jump-${name}-1-before`);
    ring.remove();
    const target = find();
    if (!target) { check(false, `${name}: the call ${call} (step ${want}) left the code preview before the click`); return null; }
    const r = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 2, clientY: r.top + r.height / 2 }));
    await sleep(900);
    const now = stepNow();
    await shot(`jump-${name}-2-after`);
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
    const sq = ([...document.querySelectorAll('.gview .gcell.has')] as HTMLElement[]).find((e) => e.querySelectorAll('i').length >= 2 || !!e.querySelector('.dots'));
    sq?.click();
    await sleep(800);
    report.square = { steps: [...document.querySelectorAll('.gview .gcell.pk .gstep')].map((e) => e.textContent), tag: document.querySelector('.sprev .ibx.full .tg')?.textContent ?? null, calls: document.querySelectorAll('.sprev .ibx.full .cl').length, link: !!document.querySelector('svg.slink path') };
    check((report.square as any).tag === 'SELECTED' && (report.square as any).steps.length >= 2 && (report.square as any).calls === (report.square as any).steps.length, `the opened square: ${JSON.stringify(report.square)}`);
    await shot('jump-grid-3-square-open');
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
    await shot('jump-grid-4-card-low');
    await drag(-3000);
    const high = cardH(), content = (document.querySelector('.sprev .ibx.full .in') as HTMLElement).scrollHeight, codeHigh = codeH();
    await shot('jump-grid-5-card-high');
    report.divider = { low, high, content, codeLow, codeHigh, cardBottom: cardBottom(), paneBottom: paneBottom() };
    check(low === 170, `dragged down, the card is ${low} px, not its 170 px minimum`);
    check(high <= content + 2, `dragged up, the card (${high} px) grows past its content (${content} px + 2 px border)`);
    check(high === content + 2 || codeHigh <= 111, `dragged up, the card (${high} px) stops short of its content (${content} px) while the code still has ${codeHigh} px`);
    check(codeHigh >= 109, `dragged up, the code preview is ${codeHigh} px, below its 110 px minimum`);
    check(cardBottom() <= paneBottom(), `dragged up, the card ends at ${cardBottom()} px, below the pane (${paneBottom()} px)`);
    check(high > low || content + 2 <= 170, 'the divider does not move');
    try { localStorage.removeItem('flow.cardH'); } catch {  }
    press('.gview', 'Escape'); await sleep(300);
    const toStep = async (view: string, name: string) => {
      press(view, 'Home'); await sleep(300);
      for (let k = 0; k < 60 && !(document.querySelector('.sprev .pfn')?.textContent ?? '').includes(name); k++) { press(view, 'ArrowRight'); await sleep(200); }
      await sleep(800);
    };
    await toStep('.gview', 'parse_headers');
    const on = document.querySelector('.gview .gcell.on') as HTMLElement | null;
    const labels = [...document.querySelectorAll('.gview .glab')].map((e) => e.textContent ?? '');
    report.gridLinks = { step: stepNow(), lines: document.querySelectorAll('.gview .glinks .ln').length, labels, filled: on ? getComputedStyle(on).backgroundColor : null, card: [...document.querySelectorAll('.sprev .ibx.full .sec h6')].map((e) => e.textContent) };
    check(document.querySelectorAll('.gview .glinks .ln').length >= 4, `grid arrows at parse_headers: ${document.querySelectorAll('.gview .glinks .ln').length} lines`);
    check(labels.includes('◆ if (headers.empty()) · :26') && labels.some((t) => t.includes('reads headers')) && labels.includes('req.raw · a view'), `grid arrow labels at parse_headers: ${labels.join(' | ')}`);
    check(on != null && getComputedStyle(on).backgroundColor === 'rgb(227, 214, 173)', 'the current square is not filled gold');
    await shot('jump-grid-6-links');
    setFlowView('metro');
    await until(() => !!document.querySelector('.seqv .sjn'), 10000);
    await sleep(800);
    const jn = ([...document.querySelectorAll('.seqv .sjn')] as HTMLElement[]).find((e) => /headers\.empty/.test(e.textContent ?? ''));
    jn?.click();
    await sleep(800);
    report.junction = {
      rows: [...document.querySelectorAll('.seqv .sjn')].map((e) => e.textContent), picked: document.querySelector('.seqv .sjn.on')?.textContent ?? null,
      tag: document.querySelector('.sprev .ibx.full .tg')?.textContent ?? null, sections: [...document.querySelectorAll('.sprev .ibx.full .sec h6')].map((e) => e.textContent),
      head: document.querySelector('.sprev .pfn')?.textContent ?? null, header: document.querySelector('.seqk')?.textContent ?? null,
    };
    check(/headers\.empty/.test((report.junction as any).picked ?? '') && (report.junction as any).tag === 'JUNCTION', `the junction if (headers.empty()) did not open: ${JSON.stringify(report.junction)}`);
    await shot('jump-metro-3-junction');
    report.junctionCollisions = auditSequence();
    check((report.junctionCollisions as string[]).length === 0, `text on text with a junction open: ${(report.junctionCollisions as string[]).slice(0, 3).join('; ')}`);
    const buttons = [...document.querySelectorAll('.sprev .ibx.full .jbtns .chip')] as HTMLElement[];
    buttons.find((b) => /next junction/.test(b.textContent ?? ''))?.click();
    await sleep(1000);
    report.junctionNext = { buttons: buttons.map((b) => b.textContent), picked: document.querySelector('.seqv .sjn.on')?.textContent ?? null, tag: document.querySelector('.sprev .ibx.full .tg')?.textContent ?? null };
    check(!!(report.junctionNext as any).picked && (report.junctionNext as any).picked !== (report.junction as any).picked && (report.junctionNext as any).tag === 'JUNCTION', `next junction: ${JSON.stringify(report.junctionNext)}`);
    await shot('jump-metro-4-next-junction');
    press('.seqv', 'Escape'); await sleep(400);
    report.junctionCleared = !document.querySelector('.seqv .sjn.on') && (document.querySelector('.sprev .ibx.full .tg')?.textContent ?? '').startsWith('STEP');
    check(report.junctionCleared === true, 'Esc does not return from the junction to the step');
  } catch (e) { errors.push(`jump: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await sleep(1500);
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
    await shot('revisit-1-kept');
    await settled();
    const g = graph(), run = g ? await buildRun(g.lanes[0].start) : null;
    report.live = { steps: stepsOf(), status: status(), fresh: run?.rows.filter((r) => r.kind === 'step').map((r) => r.name.replace(/^.*::/, '')) };
    check(/as last time/.test(kept.status), `the folder opened again without its last picture (${kept.status})`);
    check(kept.steps.join() === (report.first as any).steps.join(), 'the kept picture differs from the one last shown');
    check(!/checking/.test(status()), 'the kept picture was never confirmed');
    check(stepsOf().join() === (report.live as any).fresh?.join(), 'after the live build, the page differs from a fresh trace');
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

async function arrowsCheck(report: Record<string, unknown>) {
  const TOL = 3, CAP = 200;
  const nextFrames = (n: number) => new Promise<void>((r) => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('grid');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 600000);
    const s = seq()!;
    report.program = entries()[lane()]?.rel;
    report.steps = s.items.length;
    if (!document.querySelector('.gview .gcell')) { report.mode = 'files × files'; errors.push('arrows: the grid shows files × files, so no arrows are drawn'); }
    const far: string[] = [], off: string[] = [];
    let arrows = 0, worstFar = 0, worstOff = 0;
    const N = Math.min(s.items.length, CAP);
    for (let it = 0; it < N; it++) {
      stepMove({ jump: it });
      await nextFrames(3);
      const svg = document.querySelector('.gview svg.glinks') as SVGSVGElement | null;
      if (!svg) continue;
      const o = svg.getBoundingClientRect();
      const boxes = [...document.querySelectorAll('.gview .gcell.has i, .gview .gcell.has .dots, .gview .gcell.pk .gstep')].map((e) => e.getBoundingClientRect());
      for (const p of [...svg.querySelectorAll('path.ln')] as SVGPathElement[]) {
        const len = p.getTotalLength(), e = p.getPointAtLength(len), q = p.getPointAtLength(Math.max(0, len - 3));
        const x = o.left + e.x, y = o.top + e.y, across = Math.abs(e.x - q.x) >= Math.abs(e.y - q.y);
        let best = Infinity, mid = Infinity;
        for (const b of boxes) {
          const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom), d = Math.hypot(dx, dy);
          if (d < best) { best = d; mid = across ? Math.abs(y - (b.top + b.height / 2)) : Math.abs(x - (b.left + b.width / 2)); }
        }
        arrows++;
        worstFar = Math.max(worstFar, best); worstOff = Math.max(worstOff, mid);
        if (best > TOL) far.push(`step ${it + 1}: a ${p.classList[1]} arrow ends ${Math.round(best)} px from the nearest numbered box`);
        if (mid > TOL) off.push(`step ${it + 1}: a ${p.classList[1]} arrow ends ${Math.round(mid)} px off its box's middle`);
      }
    }
    stepMove({ jump: 0 });
    await nextFrames(3);
    const mainCalls = s.run.rows.filter((r) => r.caller === s.items[0]).length;
    const mainArrows = document.querySelectorAll('.gview svg.glinks path.ln').length;
    report.arrows = { stepsWalked: N, arrows, endsAwayFromBox: far.length, endsOffMiddle: off.length, worstAwayPx: Math.round(worstFar), worstOffMiddlePx: Math.round(worstOff), firstAway: far.slice(0, 5), firstOff: off.slice(0, 5) };
    report.entry = { calls: mainCalls, arrows: mainArrows };
    await shot('arrows-step-1');
    if (N > 1) { stepMove({ jump: 1 }); await nextFrames(3); await shot('arrows-step-2'); }
    if (far.length) errors.push(`arrows: ${far.length} of ${arrows} arrows end more than ${TOL} px from a numbered box (worst ${Math.round(worstFar)} px)`);
    if (off.length) errors.push(`arrows: ${off.length} of ${arrows} arrows end more than ${TOL} px off their box's middle (worst ${Math.round(worstOff)} px)`);
    if (mainCalls && !mainArrows) errors.push(`arrows: the first step makes ${mainCalls} calls and the grid draws no arrow for them`);
  } catch (e) { errors.push(`arrows: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

type Pt = { x: number; y: number };
function cornersOf(d: string): Pt[] {
  const t = d.match(/[MLQ]|-?\d+(?:\.\d+)?/g) ?? [], out: Pt[] = [];
  let lastL: Pt | null = null;
  for (let k = 0; k < t.length;) {
    const c = t[k++];
    if (c === 'M') { out.push({ x: +t[k], y: +t[k + 1] }); k += 2; }
    else if (c === 'L') { lastL = { x: +t[k], y: +t[k + 1] }; k += 2; }
    else if (c === 'Q') { out.push({ x: +t[k], y: +t[k + 1] }); k += 4; lastL = null; }
  }
  if (lastL) out.push(lastL);
  return out;
}

async function arrowsMock(report: Record<string, unknown>) {
  const nextFrames = (n: number) => new Promise<void>((r) => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
  const NS = 'http://www.w3.org/2000/svg';
  const shots: string[] = [];
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('grid');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 600000);
    const s = seq()!, R = s.run.rows;
    const gsz = document.querySelector('.gview .gsz') as HTMLElement;
    const chipsOf = (cell: Element) => [...cell.querySelectorAll('i')] as HTMLElement[];
    const local = (r: DOMRect) => { const o = gsz.getBoundingClientRect(); return { left: r.left - o.left, right: r.right - o.left, top: r.top - o.top, bottom: r.bottom - o.top }; };
    const draw = (paths: { d: string; kind: string }[]) => {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'glinks mock');
      svg.setAttribute('width', String(gsz.scrollWidth)); svg.setAttribute('height', String(gsz.scrollHeight));
      for (const p of paths) { const e = document.createElementNS(NS, 'path'); e.setAttribute('class', `ln ${p.kind}`); e.setAttribute('d', p.d); e.setAttribute('marker-end', `url(#glk-${p.kind})`); e.setAttribute('style', 'stroke-width:1'); svg.appendChild(e); }
      gsz.appendChild(svg);
      return svg;
    };
    const markers = () => {
      if (document.getElementById('glk-call')) return null;
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      svg.innerHTML = '<defs><marker id="glk-call" markerUnits="userSpaceOnUse" viewBox="0 0 5 4" refX="5" refY="2" markerWidth="5" markerHeight="4" orient="auto"><path d="M0 0 L5 2 L0 4 z" fill="#b9beb6" /></marker></defs>';
      gsz.appendChild(svg);
      return svg;
    };
    for (const it of [0, 4, 9, 22].filter((k) => k < s.items.length)) {
      stepMove({ jump: it });
      await nextFrames(4);
      await shot(`mock-step${it + 1}-before`);
      const old = document.querySelector('.gview svg.glinks:not(.mock)') as SVGSVGElement | null;
      const made: { d: string; kind: string }[] = [];
      const extra = markers();
      if (old) {
        const targets = new Set(stepLinks(s, it, (f) => seqLines(f)).links.map((l) => String(l.to + 1)));
        for (const p of [...old.querySelectorAll('path.ln')] as SVGPathElement[]) {
          const C = cornersOf(p.getAttribute('d') ?? ''), kind = p.classList[1];
          if (C.length < 2) continue;
          const end = C[C.length - 1], o = gsz.getBoundingClientRect();
          const cells = [...document.querySelectorAll('.gview .gcell.has')] as HTMLElement[];
          const near = cells.map((c) => ({ c, r: local(c.getBoundingClientRect()) })).map((x) => ({ ...x, d: Math.hypot(Math.max(x.r.left - end.x, 0, end.x - x.r.right), Math.max(x.r.top - end.y, 0, end.y - x.r.bottom)) })).sort((a, b) => a.d - b.d)[0];
          const chip = near && (chipsOf(near.c).find((e) => targets.has(e.textContent ?? '')) ?? chipsOf(near.c)[0]);
          if (!chip) { made.push({ d: p.getAttribute('d')!, kind }); continue; }
          const b = local(chip.getBoundingClientRect()), mx = (b.left + b.right) / 2, my = (b.top + b.bottom) / 2;
          const prev = C[C.length - 2], across = Math.abs(end.x - prev.x) >= Math.abs(end.y - prev.y);
          const N = C.map((q) => ({ ...q }));
          if (across) { N[N.length - 1] = { x: end.x > prev.x ? b.left - 1.5 : b.right + 1.5, y: my }; N[N.length - 2].y = my; }
          else { N[N.length - 1] = { x: mx, y: end.y > prev.y ? b.top - 1.5 : b.bottom + 1.5 }; N[N.length - 2].x = mx; }
          made.push({ d: roundedPath(N), kind });
          void o;
        }
        old.style.visibility = 'hidden';
      } else if (R[s.items[it]].caller == null) {
        const head = ([...document.querySelectorAll('.gview .gch')] as HTMLElement[]).find((h) => (h.querySelector('b')?.textContent ?? '').replace(/​/g, '') === R[s.items[it]].name.replace(/^.*::/, ''));
        const calls = s.items.map((row, k) => ({ row, k })).filter((x) => R[x.row].caller === s.items[it]).map((x) => String(x.k + 1));
        const chips = ([...document.querySelectorAll('.gview .gcell.has i')] as HTMLElement[]).filter((e) => calls.includes(e.textContent ?? ''));
        if (head && chips.length) {
          const h = local(head.getBoundingClientRect()), tops = chips.map((e) => local(e.getBoundingClientRect())).sort((a, b) => a.top - b.top);
          const x = Math.round(Math.min(...tops.map((b) => b.left)) - 7);
          for (const b of tops) { const my = (b.top + b.bottom) / 2; made.push({ d: roundedPath([{ x, y: h.bottom + 1 }, { x, y: my }, { x: b.left - 1.5, y: my }]), kind: 'call' }); }
          report.entryArrows = chips.length;
        }
      }
      const svg = draw(made);
      await nextFrames(3);
      await shot(`mock-step${it + 1}-after`);
      shots.push(`step ${it + 1}: ${made.length} arrows redrawn`);
      svg.remove(); extra?.remove();
      if (old) old.style.visibility = '';
    }
    report.shots = shots;
  } catch (e) { errors.push(`arrows-mock: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

async function overlapsCheck(report: Record<string, unknown>) {
  const nextFrames = (n: number) => new Promise<void>((r) => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
  const inside = (r: DOMRect, x: number, y: number) => x > r.left + 0.5 && x < r.right - 0.5 && y > r.top + 0.5 && y < r.bottom - 0.5;
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const samples = (p: SVGPathElement) => { const o = (p.ownerSVGElement as SVGSVGElement).getBoundingClientRect(), L = p.getTotalLength(), out: Pt[] = []; for (let d = 0; d <= L; d += 2) { const q = p.getPointAtLength(d); out.push({ x: o.left + q.x, y: o.top + q.y }); } return out; };
  const tally: Record<string, { count: number; steps: Set<number>; first: string[] }> = {};
  const note = (kind: string, it: number, what: string) => { const t = tally[kind] ?? (tally[kind] = { count: 0, steps: new Set(), first: [] }); t.count++; t.steps.add(it + 1); t.first.push(`step ${it + 1}: ${what}`); };
  const loops = new Set<string>();
  const moving = () => document.getAnimations().some((a) => {
    if (a.playState !== 'running') return false;
    if (a.effect?.getComputedTiming().endTime !== Infinity) return true;
    loops.add(`${(a as CSSAnimation).animationName ?? a.constructor.name} on ${((a.effect as KeyframeEffect)?.target as Element | null)?.className ?? '?'}`);
    return false;
  });
  const words = (e: Element) => (e.textContent ?? '').replace(/​/g, '').trim().slice(0, 24);
  try {
    await until(() => lspState() === 'ready', 60000);
    setFlowView('grid');
    setPage('flow');
    await quiet(() => !!seq() && !settlingNow() && !runStatus() && !indexing() && !/…/.test(status()), 1500, 600000);
    const s = seq()!, N = Math.min(s.items.length, 200);
    for (const view of ['grid', 'metro'] as const) {
      setFlowView(view);
      await nextFrames(6);
      for (let it = 0; it < N; it++) {
        stepMove({ jump: it });
        await nextFrames(3);
        if (!(await until(() => !moving(), 5000))) note('still moving after 5 s', it, view);
        await nextFrames(2);
        const pane = (document.querySelector(view === 'grid' ? '.gview .gscroll' : '.seqv') as HTMLElement).getBoundingClientRect();
        const visible = (r: DOMRect) => r.width > 0 && r.bottom > pane.top && r.top < pane.bottom && r.right > pane.left && r.left < pane.right;
        const text = view === 'grid'
          ? ([...document.querySelectorAll('.gview .gcell.has i, .gview .gcell.has .dots, .gview .glab, .gview .grh b, .gview .gch b, .gview .gtot .t, .gview .gmk .m')] as HTMLElement[])
          : ([...document.querySelectorAll('.seqv .srow > *, .seqv .sline, .seqv .sjn, .seqv .sband .sum')] as HTMLElement[]);
        const boxes = text.map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => visible(x.r) && words(x.e));
        if (view === 'grid') {
          const own = new Set([...document.querySelectorAll('.gview .gcell.on i, .gview .gcell.on .dots')]);
          for (const p of [...document.querySelectorAll('.gview svg.glinks path.ln')] as SVGPathElement[]) {
            const pts = samples(p), end = pts[pts.length - 1], seen = new Set<Element>();
            for (const q of pts) for (const b of boxes) {
              if (seen.has(b.e) || own.has(b.e) || !inside(b.r, q.x, q.y)) continue;
              const nearEnd = Math.hypot(Math.max(b.r.left - end.x, 0, end.x - b.r.right), Math.max(b.r.top - end.y, 0, end.y - b.r.bottom)) < 4;
              if (nearEnd && !b.e.classList.contains('glab')) continue;
              seen.add(b.e); note('an arrow runs over text', it, `${p.classList[1]} arrow over "${words(b.e)}"`);
            }
          }
          const keyColours = new Set(([...document.querySelectorAll('.gview .gkey .ka')] as HTMLElement[]).map((e) => getComputedStyle(e).color));
          const unexplained = new Set(([...document.querySelectorAll('.gview svg.glinks path.ln')] as SVGPathElement[]).map((p) => `${p.classList[1]} ${getComputedStyle(p).stroke}`).filter((k) => !keyColours.has(k.slice(k.indexOf(' ') + 1))));
          for (const k of unexplained) note('an arrow colour the key does not explain', it, k);
          if (it === 18) await shot('overlaps-grid-step19');
          const labs = boxes.filter((b) => b.e.classList.contains('glab'));
          const squares = ([...document.querySelectorAll('.gview .gcell.has')] as HTMLElement[]).map((e) => e.getBoundingClientRect()).filter(visible);
          for (const l of labs) {
            if (squares.some((q) => hit(l.r, q))) note('an arrow label covers a square', it, `"${words(l.e)}"`);
            for (const m of labs) if (m !== l && m.r.left <= l.r.left && hit(l.r, m.r)) note('two arrow labels overlap', it, `"${words(l.e)}" and "${words(m.e)}"`);
            for (const b of boxes) if (!b.e.classList.contains('glab') && hit(l.r, b.r) && !b.e.closest('.gcell')) note('an arrow label covers a name or total', it, `"${words(l.e)}" over "${words(b.e)}"`);
          }
        } else {
          for (const x of auditSequence()) note('text on text in the metro', it, x);
        }
        for (const p of [...document.querySelectorAll('svg.slink path')] as SVGPathElement[]) {
          const seen = new Set<Element>();
          for (const q of samples(p)) for (const b of boxes) if (!seen.has(b.e) && inside(b.r, q.x, q.y) && !b.e.closest('.on, .sel')) { seen.add(b.e); note(`the dotted link to the card runs over text (${view})`, it, `over "${words(b.e)}"`); }
        }
      }
    }
    report.steps = N;
    report.overlaps = Object.fromEntries(Object.entries(tally).map(([k, t]) => [k, { count: t.count, steps: t.steps.size, all: t.first }]));
    report.loopingAnimations = [...loops];
  } catch (e) { errors.push(`overlaps: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

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
    await shot('programs-connect');
    (document.querySelector('.progs .pr.top') as HTMLElement).click();
    report.flowAfter = await until(() => (seq()?.run.rows.length ?? 0) > 1, 30000);
    const back = document.querySelector('.backp') as HTMLElement | null, br = back?.getBoundingClientRect();
    report.switcher = { back: !!back && !!br && br.width > 0 && br.right <= innerWidth, chips: [...document.querySelectorAll('.lanes .chip')].map((c) => c.textContent) };
    await shot('programs-flow');
    await sleep(2500);
    report.later = { list: programs(), back: !!document.querySelector('.backp'), lane: lane() };
    await shot('programs-flow-later');
    setFlowView('grid');
    await until(() => document.querySelectorAll('.gview .gcell').length > 0, 15000);
    const shown = (e: Element) => { const r = e.getBoundingClientRect(), pane = e.closest('.pane')!.getBoundingClientRect(); return r.width > 0 && r.left >= pane.left - 1 && r.right <= pane.right + 1 && r.bottom <= pane.bottom && [[r.left + 2, r.top + r.height / 2], [r.right - 2, r.top + r.height / 2]].every(([x, y]) => e.contains(document.elementFromPoint(x, y))); };
    const vis = () => { const ctl = [...document.querySelectorAll('.ph.wrap .backp, .ph.wrap .lanes .chip, .ph.wrap > .chip, .ph.wrap .mgchips .chip')]; return ctl.length > 0 && ctl.every(shown) ? true : ctl.filter((e) => !shown(e)).map((e) => e.textContent); };
    report.gridBack = vis();
    await shot('programs-grid');
    await api.smoke.resize(900, 700); await sleep(600);
    report.narrowBack = vis();
    await shot('programs-grid-narrow');
  } catch (e) { errors.push(`programs: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}
