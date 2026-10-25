import { For, Show, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import { HELP, searchHelp, parseHelp, inline, HelpTopic } from '../lib/help';
import { afterPaint } from '../lib/motion';
import { t } from '../lib/i18n';
import { startTour } from './Tour';

export const [helpTopic, setHelpTopic] = createSignal<string | null>(null);
export const openHelp = (id = 'start') => setHelpTopic(HELP.some((h) => h.id === id) ? id : 'start');

function Inline(props: { text: string }) {
  return <For each={inline(props.text)}>{(p) => p.k === 'code' ? <code>{p.s}</code> : p.k === 'b' ? <b>{p.s}</b> : <>{p.s}</>}</For>;
}

/** Help pages in a sheet on the right; the window stays usable beside it. */
export default function Help() {
  const [q, setQ] = createSignal('');
  let el!: HTMLDivElement, search!: HTMLInputElement, body!: HTMLDivElement;
  const list = createMemo(() => searchHelp(q()));
  const topic = (): HelpTopic => HELP.find((h) => h.id === helpTopic()) ?? HELP[0];
  const go = (id: string) => { setHelpTopic(id); body?.scrollTo({ top: 0 }); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement).closest('.cm-editor')) { e.stopPropagation(); setHelpTopic(null); } };
  onMount(() => {
    window.addEventListener('keydown', key);
    const a = el.animate([{ transform: 'translate3d(24px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' });
    a.pause(); afterPaint().then(() => a.play());
  });
  onCleanup(() => window.removeEventListener('keydown', key));
  return (
    <aside class="help" ref={el} role="complementary" aria-label={t('help')} data-help="start">
      <div class="help-h">
        <span class="app-title">{t('LITHOGRAPH HELP')}</span><span class="grow" />
        <button class="x" title={t('Close (Esc)')} aria-label={t('close help')} onClick={() => setHelpTopic(null)}><svg viewBox="0 0 10 10"><path d="M.5 .5l9 9M9.5 .5l-9 9" /></svg></button>
      </div>
      <input ref={search} class="help-q" type="search" placeholder={t('search help')} aria-label={t('search help')} value={q()} spellcheck={false}
        onInput={(e) => setQ(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter' && list()[0]) go(list()[0].id); }} />
      <nav class="help-nav" aria-label={t('help topics')}>
        <For each={list()}>{(h) => <button classList={{ on: h.id === topic().id }} aria-current={h.id === topic().id ? 'page' : undefined} onClick={() => go(h.id)}>{t(h.title)}</button>}</For>
        <Show when={!list().length}><span class="sub">{t('nothing matches')}</span></Show>
      </nav>
      <div class="help-body" ref={body} tabindex="0">
        <h1>{t(topic().title)}</h1>
        <For each={parseHelp(topic().body)}>{(b) =>
          b.k === 'h' ? <h2>{b.text}</h2>
            : b.k === 'li' ? <div class="li"><Inline text={b.text} /></div>
            : b.k === 'row' ? <div class="row"><span><Inline text={b.a} /></span><span><Inline text={b.b} /></span></div>
            : <p><Inline text={b.text} /></p>
        }</For>
        <Show when={topic().id === 'start'}><button class="barbtn" style={{ 'margin-top': '18px' }} onClick={() => { setHelpTopic(null); startTour(); }}>{t('take the tour')}</button></Show>
      </div>
    </aside>
  );
}
