import { For, onMount, onCleanup, createSignal, createEffect, on } from 'solid-js';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { api } from '../lib/api';
import { root, settings, terminalOpen } from '../lib/store';

interface Session { id: number; name: string; term: XTerm; fit: FitAddon; el: HTMLDivElement }
let nextId = 1;

const THEME = {
  background: '#131413', foreground: '#9ea39b', cursor: '#6f8f8f', cursorAccent: '#131413', selectionBackground: 'rgba(115,150,150,.32)',
  black: '#1d2321', red: '#b8766b', green: '#7f9e82', yellow: '#ab9070', blue: '#739696', magenta: '#a8929e', cyan: '#7f9e82', white: '#9ea39b',
  brightBlack: '#5f665f', brightRed: '#c9877c', brightGreen: '#93b296', brightYellow: '#c0a581', brightBlue: '#8aadad', brightMagenta: '#bba5b1', brightCyan: '#93b296', brightWhite: '#c3c8c0',
};

export default function TerminalPane() {
  let host!: HTMLDivElement;
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [active, setActive] = createSignal(0);
  const ro = new ResizeObserver(() => fitAll());
  const offData = api.pty.onData((id, d) => sessions().find((s) => s.id === id)?.term.write(d));
  const offExit = api.pty.onExit((id) => sessions().find((s) => s.id === id)?.term.write('\r\n\x1b[90m[process exited — press any key to restart]\x1b[0m'));

  function fitAll() {
    for (const s of sessions()) {
      if (s.el.style.display === 'none') continue;
      try { s.fit.fit(); api.pty.resize(s.id, s.term.cols, s.term.rows); } catch { /* not visible yet */ }
    }
  }

  async function add() {
    const id = nextId++;
    const el = document.createElement('div');
    el.style.height = '100%';
    host.appendChild(el);
    const term = new XTerm({ fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--mono'), fontSize: settings()['terminal.font_size'] ?? 12.5, lineHeight: 1.25, theme: THEME, cursorBlink: false, allowProposedApi: false, scrollback: 10000 });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    let exited = false;
    term.onData((d) => { if (exited) { exited = false; restart(); return; } api.pty.write(id, d); });
    const s: Session = { id, name: 'shell', term, fit, el };
    setSessions([...sessions(), s]);
    setActive(id);
    show(id);
    fit.fit();
    const restart = async () => {
      const r = (await api.pty.spawn(id, root() || '', term.cols, term.rows)) as { ok: boolean; message?: string; shell?: string };
      if (!r.ok) term.write(`\x1b[31m${r.message}\x1b[0m\r\n`);
      else setSessions(sessions().map((x) => (x.id === id ? { ...x, name: (r.shell ?? 'shell').split(/[\\/]/).pop()!.replace(/\.exe$/, '') } : x)));
    };
    api.pty.onExit((pid) => { if (pid === id) exited = true; });
    await restart();
  }

  function show(id: number) {
    setActive(id);
    for (const s of sessions()) s.el.style.display = s.id === id ? 'block' : 'none';
    queueMicrotask(fitAll);
    sessions().find((s) => s.id === id)?.term.focus();
  }

  onMount(() => { ro.observe(host); add(); });
  onCleanup(() => { ro.disconnect(); offData(); offExit(); for (const s of sessions()) { api.pty.kill(s.id); s.term.dispose(); } });
  // every terminal moves to the folder that is open in the editor
  const cdCommand = (shell: string, dir: string) =>
    /powershell|pwsh/i.test(shell) ? `Set-Location -LiteralPath '${dir.replace(/'/g, "''")}'\r`
      : /^cmd/i.test(shell) ? `cd /d "${dir}"\r`
      : ` cd '${dir.replace(/'/g, `'\\''`)}'\r`;
  createEffect(on(root, (r) => { if (r) for (const s of sessions()) api.pty.write(s.id, cdCommand(s.name, r)); }, { defer: true }));
  createEffect(on(terminalOpen, (o) => { if (o) queueMicrotask(fitAll); }, { defer: true }));
  createEffect(on(() => settings()['terminal.font_size'], (fs) => { for (const s of sessions()) s.term.options.fontSize = fs; fitAll(); }, { defer: true }));

  return (
    <div class="term" style={{ height: '100%' }}>
      <div class="tt">
        <For each={sessions()}>{(s) => <button classList={{ on: active() === s.id }} onClick={() => show(s.id)}>{s.name}</button>}</For>
        <button onClick={add} title="New terminal">+</button>
      </div>
      <div class="xt" ref={host} />
    </div>
  );
}
