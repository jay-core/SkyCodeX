// Scripted run used to verify a build end to end (`npm run smoke`): drives the real UI and captures screenshots.
import { api } from './lib/api';
import { root, openFile, getMainView, setPage, setSettingsOpen, openFolder, settings, cursorPos, info, applySettings, problems } from './lib/store';
import { relPath, basename } from './lib/api';
import { openSearch, result } from './lib/search';
import { installedFonts } from './lib/fonts';
import { levels, focusCard, refreshForCursor, unresolvedCard } from './lib/preview';
import { lspState } from './lib/lsp';
import { quickOpen, palette, setPalette, applyWorkspaceEdit, COMMANDS } from './lib/actions';
import { setMenuOpen } from './components/AppMenu';
import { files, states, setFiles } from './lib/store';
import { offsetToPos } from './lib/cm';
import { definitionAt } from './lib/lsp';
import { langOf } from './lib/langs';
import { buildFlow, buildRun, findEntries, resolveEntry } from './lib/flow';
import { rankEntries } from '../shared/entries';
import { setFlowView, changed, seq, entries, lane, entryStart, runStatus } from './lib/flowstore';
import { pal } from './lib/lines';

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
async function until(cond: () => boolean, ms: number, tick?: () => void) {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) { tick?.(); await sleep(250); }
  return cond();
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
    report.level1Resolved = await until(() => !!levels()[0] && !levels()[0].cards.some(unresolvedCard), 40000);
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

    setFlowView('boxes');
    setPage('flow');
    report.flowReady = await until(() => document.querySelectorAll('.fbox').length >= 4 && ![...document.querySelectorAll('.fbox:not(.dead) .t')].some((e) => /\.(h|hpp)$/.test(e.textContent ?? '')), 45000);
    await sleep(1200);
    report.flowBoxes = [...document.querySelectorAll('.fbox .t')].map((e) => e.textContent);
    report.flowLabels = [...document.querySelectorAll('.flab')].map((e) => e.textContent);
    // the rename above is unsaved: the change ripple marks the renamed function's row
    report.flowRipple = [...document.querySelectorAll('.fbox .fr.chg .nm')].map((e) => e.textContent);
    report.flowChanged = [...changed()].map((i) => { const r = seq()!.run.rows[i]; return `${r.name} ${r.file.split('/').pop()}:${r.start}+${r.lines}`; });
    await api.smoke.capture('5-flow');
    const server = [...document.querySelectorAll('.fbox')].find((e) => /src\/server\.cpp$/.test(e.querySelector('.t')?.getAttribute('title') ?? '')) as HTMLElement | undefined;
    if (server) {
      server.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      await sleep(500);
      report.hoverList = [...document.querySelectorAll('.hpop div')].map((e) => e.textContent);
      await api.smoke.capture('6-flow-hover');
      server.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
      server.click();
      await sleep(1200);
      await api.smoke.capture('7-flow-select');
    }

    // unreached boxes hover and open too
    const dead = document.querySelector('.fbox.dead') as HTMLElement | null;
    report.flowStatus = document.querySelector('.flow')?.parentElement?.querySelector('.ph span')?.textContent;
    report.startMarkers = [...document.querySelectorAll('.fbox .start')].map((e) => e.textContent);
    if (dead) {
      dead.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      await sleep(400);
      report.deadHover = [...document.querySelectorAll('.hpop div')].map((e) => e.textContent);
      dead.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
      dead.click();
      await sleep(1200);
      report.deadSelectCards = document.querySelectorAll('.pane.prev .card').length;
      await api.smoke.capture('7b-flow-unreached');
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
    setPage('flow'); setFlowView('sequence');
    await until(() => !!document.querySelector('.seqv .playc'), 10000);
    const pc = (n: number) => document.querySelectorAll('.playc button')[n] as HTMLButtonElement;
    const stepAt = () => document.querySelector('.seqk')?.textContent ?? '';
    const a0 = stepAt(); pc(2).click(); await sleep(400); const a1 = stepAt();
    pc(1).click(); await sleep(1200); const playingOn = pc(1).getAttribute('aria-pressed'); pc(1).click(); await sleep(200);
    pc(0).click(); await sleep(300); const restarted = pc(1).getAttribute('aria-pressed'); pc(1).click();
    setFlowView('boxes'); await until(() => !!document.querySelector('.bxv') && !!document.querySelector('.playc'), 10000);
    // the diagram as a PNG: a real image of the whole diagram, at twice its size
    const ex = [...document.querySelectorAll('.bxv ~ * .chip, .ph .chip')].find((c) => c.textContent === 'export') as HTMLElement | undefined;
    ex?.click(); await sleep(200);
    const png = palette()?.items?.find((i) => i.label === 'PNG image');
    setPalette(null);
    if (png) { await png.run(); await sleep(800); }
    let pngFile = '';
    for (const lv of ['functions', 'files', 'folders']) { const f = `${info()!.dataDir}/logs/smoke-${basename(root())}-${lv}.png`; if (await api.fs.exists(f)) pngFile = f; }
    const bytes = pngFile ? ((await api.fs.read(pngFile)) as string).length : 0;
    report.pngExport = { offered: !!png, file: basename(pngFile), bytes, png: pngFile ? ((await api.fs.read(pngFile)) as string).slice(1, 4) === 'PNG' : false };
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
    setPage('flow');
    setFlowView('sequence');
    await until(() => document.querySelectorAll('.seqv .srow').length > 3, 60000);
    await sleep(800);
    report.seqRows = document.querySelectorAll('.seqv .srow').length;
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
    await until(() => document.querySelectorAll('.fbox').length > 0, 60000);
    await sleep(600);
    report.flowBoxes = document.querySelectorAll('.fbox').length;
    // the boxes view: the same step selected; numbers on every line, never over each other or a box, at every zoom
    report.boxKeptStep = !!stepName && document.querySelector('.fbox .fr.sel .nm')?.textContent === stepName;
    report.boxCollisions = [] as string[];
    const chipOf = (t: string) => [...document.querySelectorAll('.bxctl .chip')].find((c) => c.textContent === t) as HTMLElement;
    for (const z of ['fit width', 'fit all', '100%', '150%', '−', '−', '−', '−', '−', '−']) {
      chipOf(z).click();
      await sleep(700);
      (report.boxCollisions as string[]).push(...auditBoxes().map((x) => `${z} ${document.querySelector('.bxctl .ro')?.textContent}: ${x}`));
    }
    report.boxLevels = document.querySelector('.bxctl .lvl')?.textContent;
    await api.smoke.capture('boxes-folders');
    chipOf('100%').click();
    await sleep(700);
    await api.smoke.capture('boxes-100');
    setFlowView('sequence');
    await sleep(300);
    report.seqKeptStep = document.querySelector('.ph .seqk')?.textContent === report.seqHeader;
    setFlowView('boxes');
    await until(() => document.querySelectorAll('.fbox .fr').length > 0, 20000);
    await sleep(500);
    // every route between main and split: two
    const rowNamed = (n: string) => [...document.querySelectorAll('.fbox .fr')].find((e) => e.querySelector('.nm')?.textContent === n) as HTMLElement | undefined;
    rowNamed('main')?.click();
    await sleep(300);
    rowNamed('split')?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await sleep(500);
    report.boxRoutes = document.querySelectorAll('.bxr').length;
    await api.smoke.capture('boxes-routes');
    (document.querySelector('.flow.bxv') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setFlowView('sequence');
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
    setFlowView('sequence');
    await until(() => document.querySelectorAll('.seqv .srow').length > 3, 30000);
    report.refresh = { button: !!btn, finished: done, ms: Math.round(performance.now() - t0r), toast: document.querySelector('.toast')?.textContent ?? null, seqRows: document.querySelectorAll('.seqv .srow').length };
    setPage('editor');
    await sleep(500);
    await api.smoke.capture('boot');
  } catch (e) { errors.push(`boot: ${e} ${String((e as Error)?.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()).join(' ← ')}`); }
  report.errors = errors;
  await api.smoke.done(report);
}

/** Numbers on the boxes view's lines that cover each other or a box, as drawn now (screen rectangles). */
function auditBoxes(): string[] {
  const out: string[] = [];
  const labs = [...document.querySelectorAll('.flab')].map((e) => ({ r: e.getBoundingClientRect(), t: e.textContent ?? '' }));
  const boxes = [...document.querySelectorAll('.fbox')].map((e) => ({ r: e.getBoundingClientRect(), t: e.querySelector('.t')?.textContent ?? '' }));
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) if (hit(labs[i].r, labs[j].r)) out.push(`"${labs[i].t}" over "${labs[j].t}"`);
    for (const b of boxes) if (hit(labs[i].r, b.r)) out.push(`"${labs[i].t}" over box ${b.t}`);
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
    setFlowView('boxes');
    setPage('flow');
    // a project with many mains opens on the list of them: the most likely one is picked, then back and again
    await until(() => document.querySelectorAll('.progs .pr').length > 0, 30000);
    steps.programs = { rows: document.querySelectorAll('.progs .pr').length, groups: [...document.querySelectorAll('.progs .grp b')].map((b) => b.textContent).slice(0, 10), top: document.querySelector('.progs .pr.top')?.textContent };
    await api.smoke.capture('large-0-programs');
    (document.querySelector('.progs .pr.top') as HTMLElement).click();
    const t5 = performance.now();
    const flowStatus = () => document.querySelector('.flow')?.parentElement?.querySelector('.ph span')?.textContent ?? '';
    const fl = await until(() => document.querySelectorAll('.fbox:not(.dead)').length > 0 && !/tracing/.test(flowStatus()), 240000);
    steps.entry = { count: entries().length, chosen: entries()[lane()]?.rel, name: entries()[lane()]?.name, start: entryStart() };
    steps.flow = { status: flowStatus(), live: document.querySelectorAll('.fbox:not(.dead)').length, dead: document.querySelectorAll('.fbox.dead').length, arrows: document.querySelectorAll('.flab').length, ms: fl ? Math.round(performance.now() - t5) : 'timed out' };
    await sleep(1500);
    await api.smoke.capture('large-2-flow');
    // when clangd finishes indexing the flow rebuilds with the whole call graph
    const ix = await until(() => /indexing/.test(document.body.textContent ?? '') === false, 240000);
    await sleep(1000);
    await until(() => !/tracing/.test(flowStatus()), 240000);
    await sleep(1500);
    // the run of the first entry point, then the boxes view drawn from it: how long, how big, and readable at every zoom
    const t7 = performance.now();
    await until(() => !!seq() && !runStatus() && document.querySelectorAll('.fbox .fr, .fbox .t').length > 0, 240000);
    steps.runState = { runStatus: runStatus(), status: flowStatus(), rows: seq()?.run.rows.slice(0, 8).map((r: any) => `${r.kind} ${r.name ?? r.key ?? ''}`) };
    steps.run = { rows: seq()?.run.rows.length, steps: seq()?.run.rows.filter((r) => r.kind === 'step').length, files: document.querySelectorAll('.fbox').length, ms: Math.round(performance.now() - t7) };
    const chipOf = (t: string) => [...document.querySelectorAll('.bxctl .chip')].find((c) => c.textContent === t) as HTMLElement | undefined;
    const zooms: Record<string, unknown>[] = [];
    for (const z of ['fit width', 'fit all', '100%', '150%', '−', '−', '−', '−', '−', '−']) {
      const tz = performance.now();
      chipOf(z)?.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const frameMs = Math.round(performance.now() - tz);
      await sleep(600);
      const bad = auditBoxes();
      zooms.push({ z, at: document.querySelector('.bxctl .ro')?.textContent, level: (document.querySelector('.bxctl .lvl')?.textContent ?? '').split(' ·')[0], boxes: document.querySelectorAll('.fbox').length, labels: document.querySelectorAll('.flab').length, frameMs, collisions: bad.length, first: bad.slice(0, 2) });
    }
    steps.boxZooms = zooms;
    // zoomed out, hovering a box lists its functions at screen size, wholly inside the window
    const big = [...document.querySelectorAll('.fbox')].sort((a, b) => (parseInt(b.querySelector('.s')?.textContent ?? '0') || 0) - (parseInt(a.querySelector('.s')?.textContent ?? '0') || 0))[0] as HTMLElement | undefined;
    big?.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(300);
    const hp = document.querySelector('.hpop') as HTMLElement | null, hr = hp?.getBoundingClientRect();
    steps.hoverList = hp && hr ? { rows: hp.children.length, inside: hr.left >= 0 && hr.top >= 0 && hr.right <= innerWidth && hr.bottom <= innerHeight, clipped: [...hp.querySelectorAll('div')].filter((d) => d.scrollWidth > d.clientWidth + 1).length } : null;
    await api.smoke.capture('large-4b-hover-list');
    big?.dispatchEvent(new MouseEvent('mouseleave'));
    await api.smoke.capture('large-4-boxes-zoomed-out');
    chipOf('100%')?.click();
    await sleep(800);
    await api.smoke.capture('large-5-boxes-100');
    // the sequence on the same run: each step answers within a frame or two, and no text lands on other text
    setFlowView('sequence');
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
    setFlowView('boxes');
    const t8 = performance.now();
    let back = false;
    for (let f = 0; f < 1800 && !(back = document.querySelectorAll('.fbox:not(.dead)').length > 0); f++) await new Promise((r) => requestAnimationFrame(r));
    steps.boxesBack = back ? Math.round(performance.now() - t8) : 'timed out';
    await sleep(800);
    (document.querySelector('.backp') as HTMLElement)?.click(); await sleep(400);
    const backList = document.querySelectorAll('.progs .pr').length;
    (document.querySelector('.progs .pr.top') as HTMLElement)?.click();
    steps.programsBack = { list: backList, again: await until(() => document.querySelectorAll('.fbox:not(.dead)').length > 0, 15000) };
    steps.flowMs = (document.querySelector(".flow") as any)?.dataset?.ms;
    steps.flowIndexed = { indexed: ix, ms: Math.round(performance.now() - t5), status: flowStatus(), live: document.querySelectorAll('.fbox:not(.dead)').length, visible: [...document.querySelectorAll('.fbox:not(.dead)')].filter((e) => +getComputedStyle(e).opacity > 0.9).length };
    await api.smoke.capture('large-2b-flow-indexed');
    setPage('editor');
    await sleep(3000);   // let indexing run, then see whether the window still answers
    const t6 = performance.now(); await sleep(0); await new Promise((r) => requestAnimationFrame(r));
    steps.frameAfterIndexMs = Math.round(performance.now() - t6);
    steps.indexing = (document.querySelector('.pcol')?.textContent ?? '').match(/index[^\n]{0,60}/i)?.[0] ?? null;
    await api.smoke.capture('large-3-after');
  } catch (e) { errors.push(`large: ${e}`); }
  report.totalMs = at();
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
    setFlowView('sequence');
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
  } catch (e) { errors.push(`programs: ${e}`); }
  report.errors = errors;
  await api.smoke.done(report);
}
