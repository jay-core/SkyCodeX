import { Show, onMount, onCleanup } from 'solid-js';
import { refPage, setRefPage, openReference } from '../lib/extras';
import { afterPaint } from '../lib/motion';
import { t } from '../lib/i18n';

/** A cppreference.com page from the installed pack, beside the code. The page runs no scripts and reaches no network. */
export default function Reference() {
  let el!: HTMLDivElement;
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement).closest('.cm-editor')) setRefPage(null); };
  onMount(() => {
    window.addEventListener('keydown', key);
    const a = el.animate([{ transform: 'translate3d(24px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' });
    a.pause(); afterPaint().then(() => a.play());
  });
  onCleanup(() => window.removeEventListener('keydown', key));
  return (
    <aside class="help refsheet" ref={el} aria-label={t('C++ reference')} data-help="editor">
      <div class="help-h">
        <span class="app-title">{t('C++ REFERENCE')}</span><span class="grow" />
        <button class="chip" onClick={() => openReference()}>{t('search')}</button>
        <button class="x" title={t('Close (Esc)')} aria-label={t('close the reference')} onClick={() => setRefPage(null)}><svg viewBox="0 0 10 10"><path d="M.5 .5l9 9M9.5 .5l-9 9" /></svg></button>
      </div>
      <Show when={refPage()}>{(p) => (
        <>
          <div class="ref-name">{p().name}</div>
          {/* sandbox with no permissions: no scripts, no forms, no top navigation */}
          <iframe class="ref-frame" sandbox="" src={`litho-ref://pages/${p().path.split('/').map(encodeURIComponent).join('/')}`} title={p().name} />
          <div class="ref-foot">cppreference.com · CC-BY-SA 3.0 and GFDL</div>
        </>
      )}</Show>
    </aside>
  );
}
