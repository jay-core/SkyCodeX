import { For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { COMMANDS } from '../lib/actions';

export const [menuOpen, setMenuOpen] = createSignal(false);

const mod = navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl+';
const shift = navigator.platform.startsWith('Mac') ? '⇧' : 'Shift+';
const ITEMS: ([string, string, string] | null)[] = [
  ['new file', 'newFile', `${mod}N`],
  ['open file', 'openFile', `${shift}${mod}O`],
  ['open folder', 'openFolder', `${mod}O`],
  null,
  ['save', 'save', `${mod}S`],
  ['save as', 'saveAs', `${shift}${mod}S`],
  ['save all', 'saveAll', navigator.platform.startsWith('Mac') ? '⌥⌘S' : 'Ctrl+Alt+S'],
  ['close file', 'closeFile', `${mod}W`],
  null,
  ['quick open', 'quickOpen', `${mod}P`],
  ['go to symbol', 'goToSymbol', `${mod}T`],
  ['command palette', 'commandPalette', `${shift}${mod}P`],
  null,
  ['settings', 'settings', `${mod},`],
];

/** The bottom app bar's ··· menu (Windows Phone style); on macOS the same commands are also in the menu bar. */
export default function AppMenu() {
  const close = () => setMenuOpen(false);
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  onMount(() => { window.addEventListener('mousedown', close); window.addEventListener('keydown', key); });
  onCleanup(() => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', key); });
  return (
    <Show when={menuOpen()}>
      <MenuPanel close={close} />
    </Show>
  );
}

function MenuPanel(props: { close: () => void }) {
  let el!: HTMLDivElement;
  // animate once the panel is attached; an animation started on a detached node never runs
  onMount(() => requestAnimationFrame(() => el.animate([{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.16,1,0.3,1)' })));
  return (
    <div class="appmenu" ref={el} onMouseDown={(e) => e.stopPropagation()}>
      <For each={ITEMS}>{(it) => it ? <button onClick={() => { props.close(); COMMANDS[it[1]]?.(); }}>{it[0]}<span>{it[2]}</span></button> : <hr />}</For>
    </div>
  );
}
