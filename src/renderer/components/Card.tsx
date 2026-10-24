import { onMount, onCleanup, Show, createSignal } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { cardExtensions } from '../lib/cm';
import { definitionAt, withBody } from '../lib/lsp';
import { api, uriToFile } from '../lib/api';
import { openFile } from '../lib/store';
import type { Card as CardData } from '../lib/preview';
import { cardLoc } from '../lib/preview';

export const cardViews = new Map<string, EditorView>();

function mountCode(host: HTMLElement, text: string, firstLine: number, file: string, startLine: number, onFocus: () => void) {
  return new EditorView({
    parent: host,
    state: EditorState.create({
      doc: text,
      extensions: [
        cardExtensions(firstLine),
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

export default function Card(props: { card: CardData; id: string; color: string; focus: boolean; num?: string; onFocus: () => void; onScroll?: () => void }) {
  let host!: HTMLDivElement;
  let stdHost!: HTMLDivElement;
  let stdView: EditorView | undefined;
  const [stdOpen, setStdOpen] = createSignal(false);
  const [stdNote, setStdNote] = createSignal('');
  const showStd = async () => {
    if (stdOpen()) { setStdOpen(false); stdView?.destroy(); stdView = undefined; return; }
    const it = await withBody(props.card.item);
    const file = uriToFile(it.uri);
    const lines = ((await api.fs.read(file).catch(() => '')) as string).split('\n');
    const a = it.range.start.line, b = Math.min(it.range.end.line, a + 400);
    if (b <= a) setStdNote('only a declaration is visible here — the body is compiled into the library');
    stdView = mountCode(stdHost, lines.slice(a, b + 1).join('\n'), a + 1, file, a, props.onFocus);
    setStdOpen(true);
  };
  const openStd = () => openFile(uriToFile(props.card.item.uri), props.card.item.selectionRange.start);
  let view: EditorView | undefined;
  onMount(() => {
    if (props.card.std) return;
    view = mountCode(host, props.card.text, props.card.startLine + 1, props.card.file, props.card.startLine, props.onFocus);
    cardViews.set(props.id, view);
  });
  onCleanup(() => { cardViews.delete(props.id); view?.destroy(); stdView?.destroy(); });

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
        <div class="std-act">
          <button onClick={showStd}>{stdOpen() ? 'hide source' : 'show source'}</button>
          <button onClick={openStd}>open ›</button>
          <span style={{ color: '#3f453f' }}>standard library · read-only</span>
        </div>
        <Show when={stdNote()}><div class="std-row" style={{ color: '#4f564f' }}>{stdNote()}</div></Show>
        <div ref={stdHost} />
      </Show>
    </div>
  );
}
