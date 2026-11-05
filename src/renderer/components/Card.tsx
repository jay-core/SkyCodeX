import { onMount, onCleanup, Show, createSignal } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { cardExtensions } from '../lib/cm';
import { gotoDefinition } from '../lib/goto';
import { openFile } from '../lib/store';
import type { Card as CardData } from '../lib/preview';
import { cardLoc, depths } from '../lib/preview';
import { t } from '../lib/i18n';

export const cardViews = new Map<string, EditorView>();
/** The last cursor move inside any card: which card, and where. Drives the highlight in the next column. */
export const [cardCursor, setCardCursor] = createSignal<{ id: string; head: number } | null>(null);

function mountCode(host: HTMLElement, text: string, firstLine: number, file: string, startLine: number, onFocus: () => void, id: string) {
  return new EditorView({
    parent: host,
    state: EditorState.create({
      doc: text,
      extensions: [
        cardExtensions(firstLine), gotoDefinition({ file: () => file, base: () => startLine }),
        EditorView.updateListener.of((u) => { if (u.selectionSet) setCardCursor({ id, head: u.state.selection.main.head }); }),
        EditorView.domEventHandlers({
          mousedown() { onFocus(); return false; },
          focus() { onFocus(); return false; },
        }),
      ],
    }),
  });
}

const KIND_CHIP: Record<string, string> = { macro: 'macro', assert: 'compile-time', lambda: 'lambda', indirect: 'indirect' };
const KIND_NOTE: Record<string, string> = {
  macro: 'macro · replaced by its text before compiling', assert: 'checked by the compiler, never runs',
  lambda: 'lambda · defined here, called like a function', indirect: 'called through a pointer or std::function · the target is known only at run time',
};

export default function Card(props: { card: CardData; id: string; color: string; focus: boolean; lit?: boolean; num?: string; onFocus: () => void; onScroll?: () => void }) {
  let host!: HTMLDivElement;
  let view: EditorView | undefined;
  const openSrc = () => openFile(props.card.file, props.card.item.selectionRange.start);
  onMount(() => {
    view = mountCode(host, props.card.text, props.card.startLine + 1, props.card.file, props.card.startLine, props.onFocus, props.id);
    cardViews.set(props.id, view);
    // long lines pan sideways (trackpad, shift + wheel); the connectors follow
    if (props.onScroll) view.scrollDOM.addEventListener('scroll', props.onScroll, { passive: true });
  });
  onCleanup(() => { cardViews.delete(props.id); view?.destroy(); });

  return (
    <div class="card" classList={{ focus: props.focus, std: props.card.std, lit: !!props.lit }} data-card={props.id} style={{ '--c': props.color }}>
      <div class="card-h">
        <span class="sw" style={{ background: props.color }} />
        <Show when={props.num}><span class="num">{props.num}</span></Show>
        <span class="nm">{props.card.name}</span>
        <Show when={props.card.kind !== 'call'} fallback={<Show when={props.card.std}><span class="chip">{t('std')}</span></Show>}><span class="chip kind">{t(KIND_CHIP[props.card.kind])}</span></Show>
        <Show when={depths()[props.card.key]} keyed>{(v) => {
          if (v === 'busy') return <span class="depth" title={t('measuring how deep its calls go')}>…</span>;
          const tip = v.depth ? `the deepest chain of project calls below ${props.card.name}: ${v.depth} level${v.depth > 1 ? 's' : ''}, ${v.fns} function${v.fns > 1 ? 's' : ''} in all (each counted once, in call order)${v.capped ? ` · stopped at 4000 functions, so at least this deep` : ''}` : `${props.card.name} calls nothing in the project`;
          return (
            <span class="depth" title={tip} aria-label={tip}>
              <span class="gauge">{Array.from({ length: Math.min(v.depth, 8) }, (_, i) => <i style={{ opacity: String(1 - i * 0.09) }} />)}</span>
              {v.depth ? `${v.depth}${v.capped ? '+' : ''} deep` : 'leaf'}
            </span>
          );
        }}</Show>
        <span class="loc">{props.card.std ? props.card.file.split('/').slice(-2).join('/') : cardLoc(props.card)}</span>
      </div>
      <div ref={host} />
      <Show when={props.card.std || props.card.kind !== 'call'}>
        <div class="std-act">
          <button onClick={openSrc}>{t('open ›')}</button>
          <span style={{ color: '#3f453f' }}>{props.card.kind !== 'call' ? t(KIND_NOTE[props.card.kind]) + (props.card.std ? t(' · library') : '')
            : props.card.declOnly ? 'declaration only — the body is compiled into the library' : 'standard library · read-only'}</span>
        </div>
      </Show>
    </div>
  );
}
