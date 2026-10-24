// Scripted run used to verify a build end to end (`npm run smoke`): drives the real UI and captures screenshots.
import { api } from './lib/api';
import { root, openFile, getMainView, setPage, setSettingsOpen, openFolder } from './lib/store';
import { levels, focusCard, refreshForCursor, unresolvedCard } from './lib/preview';
import { lspState } from './lib/lsp';
import { quickOpen, palette, setPalette, applyWorkspaceEdit, COMMANDS } from './lib/actions';
import { setMenuOpen } from './components/AppMenu';
import { files, states } from './lib/store';
import { offsetToPos } from './lib/cm';

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms: number, tick?: () => void) {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) { tick?.(); await sleep(250); }
  return cond();
}

export async function runSmoke() {
  const report: Record<string, unknown> = {};
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
    report.indexEntries = [...document.querySelectorAll('.cindex .ix .nm')].map((e) => e.textContent);
    report.indexLit = document.querySelector('.cindex .ix.lit .nm')?.textContent ?? null;
    report.connectors = document.querySelectorAll('svg.links path').length;
    await api.smoke.capture('1b-cursor-on-call');

    const idx = levels()[0]?.cards.findIndex((c) => /parse_headers/.test(c.name)) ?? -1;
    if (idx >= 0) {
      await focusCard(0, idx);
      await until(() => !!levels()[1] && !levels()[1].cards.some(unresolvedCard) && levels()[1].cards.length > 0, 20000);
      await sleep(700);
      report.level2 = levels()[1]?.cards.map((c) => c.name);
      await api.smoke.capture('2-level-two');
    }
    (document.querySelector('.shiftbar button:last-child') as HTMLButtonElement)?.click();
    await sleep(1300);
    report.afterShift = levels().length;
    await api.smoke.capture('3-shifted');
    (document.querySelector('.shiftbar button:first-child') as HTMLButtonElement)?.click();
    await sleep(1100);

    // quick open and rename (the rename is never saved)
    await quickOpen(); await sleep(400);
    report.quickOpenItems = palette()?.items?.length ?? 0;
    await api.smoke.capture('3b-quick-open');
    setPalette(null);
    const kaAt = v.state.doc.toString().indexOf('keep_alive(headers)') + 2;
    const edit = await api.lsp.request('textDocument/rename', { textDocument: { uri: 'file://' + encodeURI(file) }, position: offsetToPos(v.state.doc, kaAt), newName: 'wants_keep_alive' }) as any;
    report.renameFiles = await applyWorkspaceEdit(edit);
    report.renameApplied = [...states.entries()].filter(([, st]) => st.doc.toString().includes('wants_keep_alive')).map(([f]) => f.split('/').pop());
    setSettingsOpen(true);
    await sleep(1200);
    await api.smoke.capture('4-settings');
    setSettingsOpen(false);
    await sleep(300);

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
    (stdCard?.querySelector('.std-act button') as HTMLButtonElement | undefined)?.click();
    await sleep(1200);
    report.stdSourceShown = !!stdCard?.querySelector('.cm-editor') || !!stdCard?.querySelector('.std-row');
    await api.smoke.capture('9a-std-source');
    await api.settings.set('preview.include_std', false);
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
