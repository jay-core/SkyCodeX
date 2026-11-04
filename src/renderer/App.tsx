import { Show, createSignal, onMount, onCleanup, createEffect, on } from 'solid-js';
import Header from './components/Header';
import Editor from './components/Editor';
import Preview from './components/Preview';
import FilesPane, { refreshTree } from './components/FilesPane';
import SearchPanel from './components/SearchPanel';
import { searchOpen, openSearch } from './lib/search';
import Settings from './components/Settings';
import Flow from './components/Flow';
import { api } from './lib/api';
import { settings, files, page, setPage, settingsOpen, setSettingsOpen, toast, info, setInfo, applySettings, restoreSession, openFolder, onDiskChange, saveAll, root, flash } from './lib/store';
import { invalidateText } from './lib/preview';
import { runSmoke } from './smoke';
import Palette from './components/Palette';
import { palette, quickOpen, commandPalette, goToSymbol, rename, quickFix, findReferences, newFile, openFileDialog, saveAs, closeActive } from './lib/actions';
import AppMenu from './components/AppMenu';
import AppBar from './components/AppBar';
import CompilerWindow, { compilerOpen } from './components/CompilerWindow';
import { preloadFonts } from './lib/motion';
import { watchPower } from './lib/power';

import Split from './components/Split';
import StartWindow, { startOpen, setStartOpen } from './components/StartWindow';

export default function App() {
  const [codeW, setCodeW] = createSignal(Math.round(window.innerWidth * 0.31));
  const [filesW, setFilesW] = createSignal(180);
  let body!: HTMLDivElement, overlay!: SVGSVGElement, code!: HTMLDivElement;
  let redraw = () => {};
  const previewOn = () => settings()['preview.enabled'] !== false;
  // lines belong to the preview: clear them when it is hidden
  createEffect(on(previewOn, (on) => { if (!on && overlay) overlay.innerHTML = ''; }, { defer: true }));

  onMount(async () => {
    preloadFonts();
    watchPower();
    // interface errors go to the log
    window.addEventListener('error', (e) => api.log(`${e.message} at ${e.filename}:${e.lineno}`));
    window.addEventListener('unhandledrejection', (e) => api.log(`unhandled: ${String((e.reason as Error)?.stack ?? e.reason)}`));
    const i = await api.info();
    setInfo(i as any);
    const s = (await api.settings.get()) as any;
    applySettings(s.settings, s.problems);
    api.settings.onChange((x: any) => applySettings(x.settings, x.problems));
    api.fs.onChange((paths) => { for (const p of paths) { invalidateText(p); onDiskChange(p); } refreshTree(); });
    if (s.problems.length) flash(`settings.toml: ${s.problems[0].message}${s.problems.length > 1 ? ` (+${s.problems.length - 1} more)` : ''}`, 8000);
    if ((i as any).fallbackReason) flash((i as any).fallbackReason, 12000);
    // the 'start' smoke scenario opens no folder: it shows the start window, as a first launch does
    if ((i as any).smoke && (i as any).scenario === 'start') { setStartOpen(true); return; }
    if ((i as any).smoke) { await openFolder((i as any).smoke); runSmoke(); return; }
    await restoreSession();
    if (!root()) setStartOpen(true);   // nothing to restore: the start window says what to do first
  });

  const onKey = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === ',') { e.preventDefault(); setSettingsOpen(true); }
    else if (mod && e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveAll(); }
    else if (mod && e.key.toLowerCase() === 'o' && !e.shiftKey) { e.preventDefault(); api.fs.pickFolder().then((p) => p && openFolder(p as string)); }
    else if (mod && e.key.toLowerCase() === 'o' && e.shiftKey) { e.preventDefault(); openFileDialog(); }
    else if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) { e.preventDefault(); newFile(); }
    else if (mod && e.key.toLowerCase() === 's' && e.shiftKey && !e.altKey) { e.preventDefault(); saveAs(); }
    else if (mod && e.key.toLowerCase() === 'w' && !e.shiftKey) { e.preventDefault(); closeActive(); }
    else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openSearch(); }
    else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); commandPalette(); }
    else if (mod && !e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); quickOpen(); }
    else if (mod && e.key.toLowerCase() === 't') { e.preventDefault(); goToSymbol(); }
    else if (mod && e.key === '.') { e.preventDefault(); quickFix(); }
    else if (e.key === 'F2') { e.preventDefault(); rename(); }
    else if (e.shiftKey && e.key === 'F12') { e.preventDefault(); findReferences(); }
    else if (mod && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); api.settings.set('preview.enabled', !previewOn()); }
  };
  onMount(() => window.addEventListener('keydown', onKey));
  onCleanup(() => window.removeEventListener('keydown', onKey));
  window.addEventListener('beforeunload', () => { /* unsaved buffers are already mirrored to data/state */ });

  return (
    <div class="app">
      <Header />
      <div class="body" ref={body} style={{ position: 'relative', display: page() === 'editor' ? 'flex' : 'none' }}>
        <div class="pane" style={previewOn() ? { width: `${codeW()}px`, flex: 'none' } : { flex: '1' }}>
          <div class="pane" style={{ flex: 1 }} ref={code}>
            <Show when={files.active} fallback={<div class="empty">{root() ? 'open a file from the right' : <button class="lnk" onClick={() => setStartOpen(true)}>open a folder · ⌘/Ctrl O</button>}</div>}>{null}</Show>
            <div style={{ display: files.active ? 'flex' : 'none', flex: 1, 'min-height': 0, 'flex-direction': 'column' }}><Editor onScroll={() => redraw()} onCursor={() => redraw()} /></div>
          </div>
        </div>
        <Show when={previewOn()}>
          <Split onDrag={(dx) => { setCodeW(Math.max(280, codeW() + dx)); redraw(); }} />
          <Preview overlay={() => overlay} bodyEl={() => body} codeEl={() => code} registerRedraw={(f) => (redraw = f)} />
        </Show>
        <Split onDrag={(dx) => { setFilesW(Math.max(140, filesW() - dx)); redraw(); }} />
        <div style={{ width: `${filesW()}px`, flex: 'none' }}><FilesPane /></div>
        {/* the folder-wide search covers the code and preview panes, leaving the folder column beside it */}
        <Show when={searchOpen()}><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: `${filesW() + 5}px`, 'z-index': 6 }}><SearchPanel /></div></Show>
        <svg class="links" ref={overlay} />
      </div>
      <Show when={page() === 'flow'}><div style={{ flex: 1, 'min-height': 0 }}><Flow /></div></Show>
      <AppBar />
      <Show when={settingsOpen()}><Settings /></Show>
      <Show when={palette()}><Palette /></Show>
      <AppMenu />
      <Show when={compilerOpen()}><CompilerWindow /></Show>
      <Show when={startOpen() && !root()}><StartWindow /></Show>
      <Show when={toast()}><div class="toast" role="status" aria-live="polite" style={{ position: 'fixed', right: '18px', bottom: '52px', background: 'var(--pop)', padding: '10px 14px', font: '300 13.5px/1.5 var(--ui)', color: 'var(--bright)', 'max-width': '460px', 'z-index': 40, 'box-shadow': '0 18px 40px rgba(0,0,0,.5)' }}>{toast()}</div></Show>
      <Show when={info()?.smoke}>{null}</Show>
    </div>
  );
}

export { setPage };
