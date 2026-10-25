import { onMount, onCleanup, Show, createSignal } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { cardExtensions } from '../lib/cm';
import { definitionAt } from '../lib/lsp';
import { openFile } from '../lib/store';
import type { Card as CardData } from '../lib/preview';
import { cardLoc } from '../lib/preview';

export const cardViews = new Map<string, EditorView>();
/** The last cursor move inside any card: which card, and where. Drives the highlight in the next column. */
export const [cardCursor, setCardCursor] = createSignal<{ id: string; head: number } | null>(null);

function mountCode(host: HTMLElement, text: string, firstLine: number, file: string, startLine: number, onFocus: () => void, id: string) {
  return new EditorView({
    parent: host,
    state: EditorState.create({
      doc: text,
      extensions: [
        cardExtensions(firstLine),
        EditorView.updateListener.of((u) => { if (u.selectionSet) setCardCursor({ id, head: u.state.selection.main.head }); }),
        EditorView.domEventHandlers({
          mousedown(e, v) {
            onFocus();
            if (!(e.metaKey || e.ctrlKey)) return false;
            const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos == null) return false;
            e.preventDefault();
            const l = v.state.doc.lineAt(pos);
            definitionAt(file, { line: startLine + l.number - 1, character: pos - l.from })
              .then((loc) => { if (loc) openFile(loc.file, { line: loc.line, character: loc.character }); });
            return true;
          },
          focus() { onFocus(); return false; },
        }),
      ],
    }),
  });
}

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
        <Show when={props.card.std}><span class="chip">std</span></Show>
        <span class="loc">{props.card.std ? props.card.file.split('/').slice(-2).join('/') : cardLoc(props.card)}</span>
      </div>
      <div ref={host} />
      <Show when={props.card.std}>
        <div class="std-act">
          <button onClick={openSrc}>open ›</button>
          <span style={{ color: '#3f453f' }}>{props.card.declOnly ? 'declaration only — the body is compiled into the library' : 'standard library · read-only'}</span>
        </div>
      </Show>
    </div>
  );
}
