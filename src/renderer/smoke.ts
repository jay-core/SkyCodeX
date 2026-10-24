// Scripted run used to verify a build end to end (`npm run smoke`): drives the real UI and captures screenshots.
import { api } from './lib/api';
import { root, openFile, getMainView, setPage, setSettingsOpen } from './lib/store';
import { levels, focusCard, refreshForCursor, unresolvedCard } from './lib/preview';
import { lspState } from './lib/lsp';
import { quickOpen, palette, setPalette, applyWorkspaceEdit } from './lib/actions';
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

    setPage('memory');
    await until(() => !!document.querySelector('.mem select option'), 8000);
    (document.querySelector('.ph .chip.on') as HTMLButtonElement)?.click();
    await until(() => !!document.querySelector('.mrow'), 10000);
    await sleep(500);
    report.memoryRows = document.querySelectorAll('.mrow').length;
    await api.smoke.capture('8-memory');
    setPage('editor');
    await sleep(400);
  } catch (e) {
    errors.push(`smoke: ${e}`);
  }
  for (const f of files.list) if (f.dirty) await api.buffers.drop(f.path);   // leave no unsaved smoke edits behind
  report.errors = errors;
  await api.smoke.done(report);
}
