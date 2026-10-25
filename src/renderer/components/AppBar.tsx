import { GEAR } from './Header';
import { menuOpen, setMenuOpen } from './AppMenu';
import { setSettingsOpen, settings } from '../lib/store';
import { api } from '../lib/api';
import { compilerOpen, setCompilerOpen } from './CompilerWindow';
import { t } from '../lib/i18n';

/** The bottom-left app bar, below a faint separator: options, settings, compiler and preview. */
export default function AppBar() {
  const previewOn = () => !!settings()['preview.enabled'];
  return (
    <>
      <div class="appsep" />
      <div class="appbar" role="toolbar">
        <button class="barbtn" classList={{ on: menuOpen() }} title={t('Options')} onMouseDown={(e) => e.stopPropagation()} onClick={() => setMenuOpen(!menuOpen())}>{t('options')}</button>
        <button class="gear" title={t('Settings (⌘/Ctrl ,)')} aria-label={t('settings')} onClick={() => setSettingsOpen(true)}>{GEAR}</button>
        <button class="barbtn" classList={{ on: compilerOpen() }} title={t('Language engine, compiler toolchains and language packs')} onClick={() => setCompilerOpen(!compilerOpen())}>{t('compiler')}</button>
        <button class="barbtn" classList={{ on: previewOn() }} title={t('Show or hide the preview panes (⌘/Ctrl ⇧ E)')} onClick={() => api.settings.set('preview.enabled', !previewOn())}>{previewOn() ? t('hide preview') : t('preview')}</button>
      </div>
    </>
  );
}
