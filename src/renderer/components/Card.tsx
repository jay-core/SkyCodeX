import { onMount, onCleanup, Show } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { cardExtensions } from '../lib/cm';
import { definitionAt } from '../lib/lsp';
import { openFile } from '../lib/store';
import type { Card as CardData } from '../lib/preview';
import { cardLoc } from '../lib/preview';

export const cardViews = new Map<string, EditorView>();

export default function Card(props: { card: CardData; id: string; color: string; focus: boolean; num?: string; onFocus: () => void; onScroll?: () => void }) {
  let host!: HTMLDivElement;
  let view: EditorView | undefined;
  onMount(() => {
    if (props.card.std) return;
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: props.card.text,
        extensions: [
          cardExtensions(props.card.startLine + 1),
          EditorView.domEventHandlers({
            mousedown(e, v) {
              props.onFocus();
              if (!(e.metaKey || e.ctrlKey)) return false;
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
              if (pos == null) return false;
              e.preventDefault();
              const l = v.state.doc.lineAt(pos);
              definitionAt(props.card.file, { line: props.card.startLine + l.number - 1, character: pos - l.from })
                .then((loc) => { if (loc) openFile(loc.file, { line: loc.line, character: loc.character }); });
              return true;
            },
            focus() { props.onFocus(); return false; },
          }),
        ],
      }),
    });
    cardViews.set(props.id, view);
  });
  onCleanup(() => { cardViews.delete(props.id); view?.destroy(); });

  return (
    <div class="card" classList={{ focus: props.focus }} data-card={props.id} onMouseDown={() => props.card.std && props.onFocus()}>
      <div class="card-h">
        <span class="sw" style={{ background: props.color }} />
        <Show when={props.num}><span class="num">{props.num}</span></Show>
        <span class="nm">{props.card.name}</span>
        <Show when={props.card.std}><span class="chip">std · summary</span></Show>
        <span class="loc">{props.card.std ? props.card.file.split('/').slice(-2).join('/') : cardLoc(props.card)}</span>
      </div>
      <Show when={props.card.std} fallback={<div ref={host} />}>
        <div class="std-row" style={{ 'font-family': 'var(--mono)', color: 'var(--bright)' }}>{props.card.text}</div>
        <div class="std-row">from the standard library or a system header</div>
      </Show>
    </div>
  );
}
