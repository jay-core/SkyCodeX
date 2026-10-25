import { GEAR } from './Header';
import { menuOpen, setMenuOpen } from './AppMenu';
import { terminalOpen, setTerminalOpen, setSettingsOpen, settings } from '../lib/store';
import { api } from '../lib/api';
import { compilerOpen, setCompilerOpen } from './CompilerWindow';

/** The bottom-left app bar, below a faint separator: options, settings, terminal, compiler and preview. */
export default function AppBar() {
  const previewOn = () => !!settings()['preview.enabled'];
  return (
    <>
      <div class="appsep" />
      <div class="appbar">
        <button class="barbtn" classList={{ on: menuOpen() }} title="Options" onMouseDown={(e) => e.stopPropagation()} onClick={() => setMenuOpen(!menuOpen())}>options</button>
        <button class="gear" title="Settings (⌘/Ctrl ,)" onClick={() => setSettingsOpen(true)}>{GEAR}</button>
        <button class="barbtn" classList={{ on: terminalOpen() }} title="Show or hide the terminal (⌃`)" onClick={() => setTerminalOpen(!terminalOpen())}>{terminalOpen() ? 'hide terminal' : 'terminal'}</button>
        <button class="barbtn" classList={{ on: compilerOpen() }} title="Language engine, compiler toolchains and language packs" onClick={() => setCompilerOpen(!compilerOpen())}>compiler</button>
        <button class="barbtn" classList={{ on: previewOn() }} title="Show or hide the preview panes (⌘/Ctrl ⇧ E)" onClick={() => api.settings.set('preview.enabled', !previewOn())}>{previewOn() ? 'hide preview' : 'preview'}</button>
      </div>
    </>
  );
}
