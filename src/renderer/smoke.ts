// Scripted run used to verify a build end to end (`npm run smoke`): drives the real UI and captures screenshots.
import { api } from './lib/api';
import { root, openFile, getMainView, setPage, setSettingsOpen, openFolder, settings, page, cursorPos, info } from './lib/store';
import { locateSymbol } from './lib/memloc';
import { relPath } from './lib/api';
import { installedFonts } from './lib/fonts';
import { levels, focusCard, refreshForCursor, unresolvedCard } from './lib/preview';
import { lspState } from './lib/lsp';
import { quickOpen, palette, setPalette, applyWorkspaceEdit, COMMANDS } from './lib/actions';
import { setMenuOpen } from './components/AppMenu';
import { cardViews } from './components/Card';
import { files, states } from './lib/store';
import { offsetToPos } from './lib/cm';
import { toast } from './lib/store';
import { setLanguage } from './lib/i18n';
import { setHelpTopic } from './components/Help';
import { startTour } from './components/Tour';
import { setStyleOpen } from './components/StyleWindow';
import { setRunOpen } from './components/RunWindow';
import { definitionAt } from './lib/lsp';
import { langOf } from './lib/langs';
import { openReference, todoList } from './lib/extras';

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
  if (info()?.scenario === 'memory') return memoryDemo(report);
  if (info()?.scenario === 'compiler') return compilerDemo(report);
  if (info()?.scenario === 'fonts') return fontsDemo(report);
  if (info()?.scenario === 'extras') return extrasDemo(report);
  if (info()?.scenario === 'defs') return defsDemo(report);
  if (info()?.scenario === 'anyheader') return anyHeaderDemo(report);
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
    const ixs = [...document.querySelectorAll('.cindex .ix')] as HTMLElement[];
    report.indexSquares = ixs.length;
    report.indexLit = levels()[0]?.cards[ixs.findIndex((e) => e.classList.contains('lit'))]?.name ?? null;
    report.dimmedCards = document.querySelectorAll('.pcol.haslit .card:not(.lit)').length;
    report.hotLinks = [...document.querySelectorAll('svg.links path')].filter((p) => p.getAttribute('stroke-width') === '2').length;
    ixs[1]?.dispatchEvent(new MouseEvent('mouseenter'));
    await sleep(250);
    report.indexTip = document.querySelector('.ixtip')?.textContent ?? null;
    await api.smoke.capture('1c-index-tip');
    ixs[1]?.dispatchEvent(new MouseEvent('mouseleave'));
    report.connectors = document.querySelectorAll('svg.links path').length;
    await api.smoke.capture('1b-cursor-on-call');

    const idx = levels()[0]?.cards.findIndex((c) => /parse_headers/.test(c.name)) ?? -1;
    if (idx >= 0) {
      await focusCard(0, idx);
      await until(() => !!levels()[1] && !levels()[1].cards.some(unresolvedCard) && levels()[1].cards.length > 0, 20000);
      await sleep(700);
      report.level2 = levels()[1]?.cards.map((c) => c.name);
      await api.smoke.capture('2-level-two');
      // a cursor on a call inside the pane-1 card lights its card in pane 2; scrolling keeps both highlights
      const cv = cardViews.get(`0:${idx}`)!;
      const callIn = cv.state.doc.toString().indexOf('split(') + 2;
      cv.dispatch({ selection: { anchor: callIn } });
      await sleep(600);
      report.pane2Lit = document.querySelector('.pcol [data-card^="1:"].lit .nm')?.textContent ?? null;
      const c1 = document.querySelectorAll('.pcol')[1] as HTMLElement;
      c1.scrollTop += 200; (document.querySelectorAll('.pcol')[0] as HTMLElement).scrollTop += 150;
      await sleep(400);
      report.litAfterScroll = { pane1: document.querySelector('.pcol [data-card^="0:"].lit .nm')?.textContent ?? null, pane2: document.querySelector('.pcol [data-card^="1:"].lit .nm')?.textContent ?? null, index: levels()[0]?.cards[[...document.querySelectorAll('.cindex .ix')].findIndex((e) => e.classList.contains('lit'))]?.name ?? null };
      await api.smoke.capture('2b-pane2-lit');
      // the thin column between the panes: one square per pane-2 card; a click holds that card lit
      const idx2 = document.querySelectorAll('.cindex')[1];
      report.thin2 = { squares: idx2?.querySelectorAll('.ix').length ?? 0, pane2Cards: levels()[1]?.cards.length ?? 0 };
      const sq2 = idx2?.querySelectorAll('.ix')[2] as HTMLElement | undefined;
      sq2?.click(); await sleep(700);
      report.thin2Pin = { clicked: levels()[1]?.cards[2]?.name, lit: document.querySelector('.pcol [data-card^="1:"].lit .nm')?.textContent ?? null };
      document.querySelector('.pane.prev .shiftbar')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      c1.scrollTop = 0; (document.querySelectorAll('.pcol')[0] as HTMLElement).scrollTop = 0;
    }
    report.motion = {} as Record<string, unknown>;
    (report.motion as any).shift = await frames(() => (document.querySelector('.shiftbar button:last-child') as HTMLButtonElement)?.click(), 1300);
    report.afterShift = levels().length;
    await api.smoke.capture('3-shifted');
    (report.motion as any).shiftBack = await frames(() => (document.querySelector('.shiftbar button:first-child') as HTMLButtonElement)?.click(), 1100);
    // clicking a square glides its card into view; a lit card scrolled away stays connected
    const pc0 = document.querySelector('.pcol') as HTMLElement;
    pc0.scrollTop = pc0.scrollHeight;
    await sleep(300);
    const sq0 = document.querySelector('.cindex .ix') as HTMLElement;
    (report.motion as any).squareScroll = await frames(() => sq0.click(), 900);
    const sqh = pc0.querySelector('[data-card="0:0"] .card-h')!.getBoundingClientRect(), pcr = pc0.getBoundingClientRect();
    report.squareClickReveals = sqh.top >= pcr.top - 1 && sqh.bottom <= pcr.bottom;
    // the clicked square's card stays lit until a click elsewhere
    await sleep(400);
    const pinnedLit = () => ({ card: document.querySelector('.pcol [data-card^="0:"].lit .nm')?.textContent ?? null, square: [...document.querySelectorAll('.cindex .ix')].findIndex((e) => e.classList.contains('lit')) });
    const held = pinnedLit();
    pc0.scrollTop += 120; await sleep(300);
    const afterScroll = pinnedLit();
    document.querySelector('.pane.prev .shiftbar')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(300);
    report.squarePin = { held, afterScroll, afterClickElsewhere: pinnedLit(), cursorCard: levels()[0]?.cards.findIndex((c) => c.name === 'record') };
    v.dispatch({ selection: { anchor: callAt } });   // "record" lit again
    await sleep(500);
    pc0.scrollTop = 0; await sleep(50); pc0.scrollTop = pc0.scrollHeight; await sleep(50);
    const litEl = pc0.querySelector('.card.lit') as HTMLElement;
    pc0.scrollTop = litEl.offsetTop > pc0.clientHeight ? 0 : pc0.scrollHeight;
    await sleep(400);
    const stub = [...document.querySelectorAll('svg.links text')].map((t) => t.textContent);
    report.offLitConnected = { litOff: document.querySelector('.cindex .ix.lit.off') !== null, hotPaths: [...document.querySelectorAll('svg.links path')].filter((p) => p.getAttribute('stroke-width') === '2').length, stub: stub.find((t) => t === 'record') ?? null };
    await api.smoke.capture('3c-lit-offscreen');
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
    const rowH = () => (document.querySelector('.xterm-rows > div') as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
    const h0 = rowH();
    await api.settings.set('terminal.line_height', 1.8); await sleep(400);
    report.terminalRowHeight = [+h0.toFixed(1), +rowH().toFixed(1)];
    await api.settings.set('terminal.line_height', 1.25);
    pageBtn('clangd').click(); await sleep(300);
    await api.smoke.capture('4e-settings-clangd');
    pageBtn('terminal').click(); await sleep(300);
    (document.querySelector('.set .combo input') as HTMLInputElement).focus();
    await until(() => document.querySelectorAll('.set .combo-list button').length > 1, 4000);
    report.shellOptions = [...document.querySelectorAll('.set .combo-list button')].map((x) => x.textContent);
    await api.smoke.capture('4f-settings-shell');
    (document.querySelector('.set .combo input') as HTMLInputElement).blur();
    setSettingsOpen(false);
    await sleep(300);
    (document.querySelector('.wctl') as HTMLElement).style.transition = 'none';
    (document.querySelector('.wctl') as HTMLElement).style.opacity = '1';
    await sleep(100);
    report.windowIcons = [...document.querySelectorAll('.wctl svg')].map((s) => Math.round(s.getBoundingClientRect().width));
    await api.smoke.capture('4d-window-controls');
    (document.querySelector('.wctl') as HTMLElement).style.opacity = '';
    (document.querySelector('.wctl') as HTMLElement).style.transition = '';

    setPage('flow');
    report.flowReady = await until(() => document.querySelectorAll('.fbox').length >= 4 && ![...document.querySelectorAll('.fbox:not(.dead) .t')].some((e) => /\.(h|hpp)$/.test(e.textContent ?? '')), 45000);
    await sleep(1200);
    report.flowBoxes = [...document.querySelectorAll('.fbox .t')].map((e) => e.textContent);
    report.flowLabels = [...document.querySelectorAll('.flab')].map((e) => e.textContent);
    await api.smoke.capture('5-flow');
    const server = [...document.querySelectorAll('.fbox')].find((e) => /src\/server\.cpp$/.test(e.querySelector('.t')?.textContent ?? '')) as HTMLElement | undefined;
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
    setPage('memory');
    await until(() => !!document.querySelector('.mem select option'), 8000);
    (document.querySelector('.ph .chip.on') as HTMLButtonElement)?.click();
    await until(() => !!document.querySelector('.mrow'), 10000);
    await sleep(500);
    report.memoryRows = document.querySelectorAll('.mrow').length;
    report.memoryNames = [...document.querySelectorAll('.mrow.go .n')].slice(0, 6).map((e) => e.textContent);
    // hover a symbol: its definition shows; click: it opens there
    const mrow = [...document.querySelectorAll('.mrow.go')].find((e) => /Server|Metrics|main|Router|config/i.test(e.textContent ?? '')) as HTMLElement | undefined;
    mrow?.dispatchEvent(new MouseEvent('mouseenter'));
    await until(() => !/finding/.test(document.querySelector('.memtip')?.textContent ?? 'finding'), 6000);
    report.memoryTip = document.querySelector('.memtip')?.textContent ?? null;
    { const t = document.querySelector('.memtip') as HTMLElement | null; const r = t?.getBoundingClientRect(); report.memoryTipBox = r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), getComputedStyle(t!).opacity] : null; }
    await api.smoke.capture('8b-memory-tip');
    mrow?.click();
    await until(() => page() === 'editor', 4000);
    await sleep(300);
    report.memoryOpened = page() === 'editor' ? `${files.active.split('/').pop()}:${cursorPos().line}` : null;
    await openFile(file);   // back to the file the rest of the run works in
    setPage('memory'); await sleep(300);
    await api.smoke.capture('8-memory');
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
    (document.querySelector('.hdr .tab:last-child .tabx') as HTMLButtonElement | null)?.click();
    await sleep(300);
    report.tabsAfter = document.querySelectorAll('.hdr .tab').length;
    setMenuOpen(true); await sleep(400);
    report.menuItems = document.querySelectorAll('.appmenu button').length;
    await api.smoke.capture('9b-menu');
    setMenuOpen(false);
    COMMANDS.newFile(); await sleep(300);
    palette()?.prompt?.accept('smoke_new.cpp'); await sleep(900);
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
    const before = !!document.querySelector('.pane.prev .cindex');
    await api.settings.set('preview.enabled', false); await sleep(500);
    report.previewHidden = before && !document.querySelector('.cindex') && document.querySelector('svg.links')?.innerHTML === '';
    await api.smoke.capture('9c-preview-hidden');
    await api.settings.set('preview.enabled', true); await sleep(800);
    report.previewShownAgain = !!document.querySelector('.cindex');
    // call-like things after the functions: macros, static_assert, lambdas, calls through pointers
    const probe = `${root()}/probe/probe.cpp`;
    if (await api.fs.exists(probe)) {
      await openFile(probe); await sleep(500);
      const pvw = getMainView()!, tAt = pvw.state.doc.toString().indexOf('int target()') + 4;
      pvw.dispatch({ selection: { anchor: tAt } });
      await until(() => (levels()[0]?.cards ?? []).some((c) => c.kind !== 'call'), 20000, () => refreshForCursor(probe, offsetToPos(pvw.state.doc, tAt), true));
      await sleep(800);
      report.callLike = (levels()[0]?.cards ?? []).map((c) => `${c.kind}:${c.name}`);
      report.dividers = { squares: document.querySelectorAll('.cindex .ixdiv').length, cards: document.querySelectorAll('.pcol .pdiv').length };
      await api.smoke.capture('9d-call-like');
      await api.settings.set('preview.include_other', false);
      await until(() => !(levels()[0]?.cards ?? []).some((c) => c.kind !== 'call'), 8000);
      report.callLikeHidden = !(levels()[0]?.cards ?? []).some((c) => c.kind !== 'call');
      await api.settings.set('preview.include_other', true);
      await openFile(file);
    }
    // switching folders: clangd must come back up and the terminal must follow
    const sub = `${root()}/src`;
    await openFolder(sub);
    report.reopenLsp = (await until(() => lspState() === 'ready', 15000)) ? 'ready' : lspState();
    await sleep(600);
    await api.pty.write(1, 'pwd\r');
    await sleep(800);
    await api.smoke.capture('9-reopened-folder');
  } catch (e) {
    errors.push(`smoke: ${e}`);
  }
  for (const f of files.list) if (f.dirty) await api.buffers.drop(f.path);   // leave no unsaved smoke edits behind
  report.errors = errors;
  await api.smoke.done(report);
}

/** `--scenario memory`: analyse the folder's program, hover symbols of every kind, click through to the source. */
async function memoryDemo(report: Record<string, unknown>) {
  try {
    await until(() => lspState() === 'ready', 20000);
    // workspace symbols need the background index: wait until a cross-file symbol resolves
    report.indexReady = await until(() => !!document.body.dataset.idx, 30000, () => { locateSymbol('Sensors::history_', 'bss').then((l) => { if (l) document.body.dataset.idx = '1'; }); });
    setPage('memory');
    await until(() => !!document.querySelector('.mem select option') || !!document.querySelector('.ph select option'), 8000);
    (document.querySelector('.ph .chip.on') as HTMLButtonElement)?.click();
    await until(() => !!document.querySelector('.mrow.go'), 10000);
    await sleep(400);
    const rowsNow = () => [...document.querySelectorAll('.mrow.go')] as HTMLElement[];
    report.ramRows = rowsNow().map((r) => `${r.querySelector('.n')?.textContent} ${r.querySelector('.s')?.textContent}`);
    const hover = async (name: string, shot?: string) => {
      const row = rowsNow().find((r) => r.querySelector('.n')?.textContent === name);
      if (!row) return `${name}: no row`;
      row.scrollIntoView({ block: 'nearest' }); await sleep(100);
      row.dispatchEvent(new MouseEvent('mouseenter'));
      await until(() => !/finding/.test(document.querySelector('.memtip')?.textContent ?? 'finding'), 8000);
      await sleep(250);
      const t = document.querySelector('.memtip');
      const out = t ? [...t.children].map((c) => c.textContent).join(' | ') : 'no tooltip';
      if (shot) await api.smoke.capture(shot);
      row.dispatchEvent(new MouseEvent('mouseleave'));
      return out;
    };
    const click = async (name: string, shot: string) => {
      const row = rowsNow().find((r) => r.querySelector('.n')?.textContent === name);
      row?.click();
      await until(() => page() === 'editor', 5000);
      await sleep(700);
      const v = getMainView()!, head = v.state.selection.main.head, line = v.state.doc.lineAt(head);
      const res = `${relPath(root(), files.active)}:${line.number} col ${head - line.from + 1} → ${line.text.trim()}`;
      await api.smoke.capture(shot);
      setPage('memory'); await sleep(400);
      return res;
    };
    const tips: Record<string, string> = {};
    for (const [n, shot] of [['g_frame_buffer', 'm1-hover-bss'], ['Sensors::history_', ''], ['Logger::ring', ''], ['next_id()::issued', 'm2-hover-static-local'], ['dsp::window', ''], ['g_calibration', 'm3-hover-data']] as const) tips[n] = await hover(n, shot || undefined);
    report.ramTips = tips;
    report.clickHistory = await click('Sensors::history_', 'm4-click-history');
    report.clickLocal = await click('next_id()::issued', 'm5-click-static-local');
    // storage: constants and functions
    ([...document.querySelectorAll('.mem .chip')] as HTMLButtonElement[]).find((b) => b.textContent === 'storage')?.click();
    await sleep(400);
    report.storageRows = rowsNow().slice(0, 12).map((r) => `${r.querySelector('.n')?.textContent} ${r.querySelector('.s')?.textContent}`);
    const st: Record<string, string> = {};
    for (const [n, shot] of [['kGainTable', 'm6-hover-rodata'], ['Logger::write(char const*)', 'm7-hover-function'], ['Sensors::average() const', '']] as const) st[n] = await hover(n, shot || undefined);
    report.storageTips = st;
    report.clickFunction = await click('Logger::write(char const*)', 'm8-click-function');
    // stack rows open their line too
    const sRow = ([...document.querySelectorAll('.mrow.go')] as HTMLElement[]).find((r) => r.querySelector('.n')?.textContent?.startsWith('Sensors::sample'));
    sRow?.dispatchEvent(new MouseEvent('mouseenter'));
    await until(() => !/finding/.test(document.querySelector('.memtip')?.textContent ?? 'finding'), 4000);
    report.stackTip = [...(document.querySelector('.memtip')?.children ?? [])].map((c) => c.textContent).join(' | ');
    await api.smoke.capture('m9-hover-stack');
  } catch (e) {
    errors.push(`memory demo: ${e}`);
  }
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
async function extrasDemo(report: Record<string, unknown>) {
  const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
  try {
    await until(() => lspState() === 'ready', 20000);
    const src = (await api.fs.sources(root()) as string[]).find((f) => /server\.cpp$/.test(f))!;
    await openFile(src);
    await sleep(800);
    // ---- spelling: a misspelt word in a comment, none in code ----
    const v = getMainView()!;
    v.dispatch({ changes: { from: 0, insert: '// the quick brwon fox jumps over teh lazy dog\nint smokeIdentifierWithoutSpaces = 0;\n' } });
    await until(() => document.querySelectorAll('.cm-misspelt').length >= 2, 4000);
    report.misspelt = [...document.querySelectorAll('.cm-misspelt')].map((e) => e.textContent);
    await api.smoke.capture('x1-spelling');
    v.dispatch({ changes: { from: 0, to: v.state.doc.line(3).from, insert: '' } });
    // ---- help: F1 over the preview opens its page ----
    const pr = q('.pane.prev')!.getBoundingClientRect();
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: pr.left + 40, clientY: pr.top + 80 }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
    await until(() => !!q('.help h1'), 3000);
    report.helpForPreview = q('.help h1')?.textContent;
    (q('.help-q') as HTMLInputElement).value = 'pin box';
    q('.help-q')!.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await sleep(150);
    report.helpSearch = [...document.querySelectorAll('.help-nav button')].map((b) => b.textContent);
    await api.smoke.capture('x2-help');
    setHelpTopic(null);
    // ---- the tour ----
    startTour();
    await sleep(500);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await sleep(600);
    report.tourStep = q('.tour-note .tt')?.textContent;
    report.tourSpot = (() => { const r = q('.tour-spot')!.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })();
    await api.smoke.capture('x3-tour');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(200);
    report.tourClosed = !q('.tour');
    // ---- translations (interface only; settings.toml is not touched) ----
    for (const l of ['hi', 'ja', 'de']) {
      setLanguage(l);
      await sleep(150);
      (report.translated ??= {} as any)[l] = [...document.querySelectorAll('.appbar .barbtn')].map((b) => b.textContent).join(' | ');
      if (l === 'hi') await api.smoke.capture('x4-hindi');
    }
    setLanguage('auto');
    // ---- code style: a sample re-formatted by clangd with the chosen options ----
    setStyleOpen(true);
    await sleep(1500);
    const before = q('.style-code .cm-content')?.textContent ?? '';
    ([...document.querySelectorAll('.sopt')].find((o) => /braces/.test(o.textContent ?? ''))?.querySelectorAll('button') as any)?.[3]?.click();   // Allman
    ([...document.querySelectorAll('.sopt')].find((o) => /pointer/.test(o.textContent ?? ''))?.querySelectorAll('button') as any)?.[0]?.click();   // Left
    await sleep(1500);
    const after = q('.style-code .cm-content')?.textContent ?? '';
    report.style = { changed: before !== after, sample: [...document.querySelectorAll('.style-code .cm-line')].slice(4, 9).map((l) => l.textContent), note: q('.style-prev .sub')?.textContent };
    await api.smoke.capture('x5-code-style');
    setStyleOpen(false);
    // ---- to-do list and the reference without its pack ----
    await todoList();
    await sleep(500);
    report.todo = palette()?.placeholder;
    setPalette(null);
    await openReference('std::vector');
    await sleep(200);
    report.referenceWithoutPack = toast();
    // ---- flow: drag a box to pin it, group by folder ----
    setPage('flow');
    await until(() => document.querySelectorAll('.fbox').length > 1, 30000);
    await sleep(1500);
    const box = q('.fbox')!, b0 = box.getBoundingClientRect(), canvas = q('.flow')!;
    box.dispatchEvent(new PointerEvent('pointerdown', { clientX: b0.left + 20, clientY: b0.top + 20, bubbles: true, pointerId: 1, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: b0.left + 120, clientY: b0.top + 160, bubbles: true, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: b0.left + 120, clientY: b0.top + 160, bubbles: true, pointerId: 1 }));
    await sleep(300);
    report.pinned = document.querySelectorAll('.fbox.pinned').length;
    const labels = [...document.querySelectorAll('.flab')].map((l) => l.getBoundingClientRect());
    const boxes = [...document.querySelectorAll('.fbox')].map((b) => b.getBoundingClientRect());
    report.labelsOnBoxes = labels.filter((l) => boxes.some((b) => l.left < b.right && l.right > b.left && l.top < b.bottom && l.bottom > b.top)).length;
    report.labels = labels.length;
    ([...document.querySelectorAll('.flow ~ *, .ph .chip')] as HTMLButtonElement[]).find((b) => b.textContent === 'group by folder')?.click();
    await sleep(1200);
    report.folderFrames = [...document.querySelectorAll('.fgroup span')].map((s) => s.textContent);
    await api.smoke.capture('x6-flow-pinned-grouped');
    ([...document.querySelectorAll('.ph .chip')] as HTMLButtonElement[]).find((b) => b.textContent === 'group by folder')?.click();
    ([...document.querySelectorAll('.ph .chip')] as HTMLButtonElement[]).find((b) => b.textContent === 'unpin all')?.click();
    await sleep(800);
    report.unpinned = document.querySelectorAll('.fbox.pinned').length === 0;
    setPage('editor');
    // ---- run with checks and profile on a new project from a template, beside the smoke folder ----
    const parent = root().replace(/[\\/][^\\/]+$/, '');
    const made = (await api.templates.create(parent, `smoke-proj-${Date.now()}`, 'cpp-console')) as any;
    report.template = made.ok;
    await api.fs.write(made.open, '#include <cstdio>\nint twice(int x) { return x * 2; }\nint main() {\n  int s = 0;\n  for (int i = 0; i < 500; i++) s += twice(i);\n  int* p = new int(s);\n  delete p;\n  std::printf("%d\\n", *p);\n}\n');
    await openFolder(made.dir);
    await openFile(made.open);
    setRunOpen('memory');
    await sleep(400);
    ([...document.querySelectorAll('.runwin .barbtn')] as HTMLButtonElement[])[0].click();
    await until(() => !!q('.runwin .runres'), 90000);
    report.checks = { status: q('.runwin .runres .csub')?.textContent, problems: [...document.querySelectorAll('.runrep .tt')].map((e) => e.textContent), firstFrame: q('.runrep .frame.mine')?.textContent };
    await api.smoke.capture('x7-run-with-checks');
    (q('.runrep .frame.mine') as HTMLButtonElement | null)?.click();
    await sleep(500);
    report.jumpedTo = cursorPos();
    ([...document.querySelectorAll('.runwin .copt')] as HTMLButtonElement[])[3].click();   // profile
    await sleep(200);
    ([...document.querySelectorAll('.runwin .barbtn')] as HTMLButtonElement[])[0].click();
    await until(() => !!q('.runwin .runres'), 90000);
    await sleep(800);
    report.profile = { status: q('.runwin .runres .csub')?.textContent, top: [...document.querySelectorAll('.runwin .frame.prof')].slice(0, 3).map((e) => e.textContent), gutter: [...document.querySelectorAll('.cm-heat-gutter .cm-gutterElement')].map((e) => e.textContent).filter(Boolean).slice(0, 8) };
    await api.smoke.capture('x8-profile');
    setRunOpen(null);
    // ---- problem report: written to the logs folder and opened ----
    COMMANDS.report();
    await until(() => /problem-report/.test(files.active), 5000);
    report.problemReport = { opened: files.active.split(/[\\/]/).pop(), redacted: !(states.get(files.active)?.doc.toString() ?? '').includes('/Users/') };
  } catch (e) {
    errors.push(`extras demo: ${e}`);
  }
  report.errors = errors;
  await api.smoke.done(report);
}

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
