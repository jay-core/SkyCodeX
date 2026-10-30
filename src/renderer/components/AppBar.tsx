import { GEAR } from './Header';
import { menuOpen, setMenuOpen } from './AppMenu';
import { setSettingsOpen, settings } from '../lib/store';
import { api } from '../lib/api';
import { compilerOpen, setCompilerOpen } from './CompilerWindow';
import { t } from '../lib/i18n';
import { refreshAll, refreshing } from '../lib/refresh';

/** The app bar, below a faint separator: options, settings, compiler and preview on the left; refresh on the right. */
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
        <span style={{ flex: 1 }} />
        <button class="barbtn refresh" classList={{ on: refreshing() }} disabled={refreshing()} title={t('Read every file again and rebuild the previews and the flow')} onClick={() => refreshAll()}>{refreshing() ? t('refreshing…') : t('refresh')}</button>
      </div>
    </>
  );
}
