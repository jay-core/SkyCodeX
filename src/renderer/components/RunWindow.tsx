import { For, Show, createSignal, onMount } from 'solid-js';
import { api, relPath } from '../lib/api';
import { root, flash, openFile, getMainView } from '../lib/store';
import { setHeat, setHeatEpoch, heat } from '../lib/profile';
import { afterPaint } from '../lib/motion';
import { t } from '../lib/i18n';

type Kind = 'memory' | 'threads' | 'undefined' | 'profile';
export const [runOpen, setRunOpen] = createSignal<Kind | null>(null);

interface Frame { fn: string; file: string; line: number; col: number }
interface Report { tool: string; title: string; detail: string; sections: { title: string; frames: Frame[] }[] }
interface Result {
  ok: boolean; stage: string; message?: string; command: string; buildLog: string; output: string; exitCode: number | null; ms: number;
  reports: Report[]; profile?: { functions: { name: string; count: number; file: string; line: number }[]; lines: Record<string, [number, number][]>; total: number };
}
const KINDS: { k: Kind; label: string; note: string }[] = [
  { k: 'memory', label: 'memory', note: 'use after free, overflows, leaks (AddressSanitizer)' },
  { k: 'threads', label: 'threads', note: 'data races and lock order (ThreadSanitizer)' },
  { k: 'undefined', label: 'undefined behaviour', note: 'overflow, bad shifts, null use (UBSan)' },
  { k: 'profile', label: 'profile', note: 'how many times each line and function ran' },
];

/** Run with checks / profile: builds the open folder apart from the project, runs it once, and links what it finds to the source. */
export default function RunWindow() {
  const [kind, setKind] = createSignal<Kind>(runOpen() ?? 'memory');
  const [args, setArgs] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [res, setRes] = createSignal<Result | null>(null);
  const [showOut, setShowOut] = createSignal(false);
  const [flags, setFlags] = createSignal('');
  const [pos, setPos] = createSignal({ x: Math.max(16, window.innerWidth / 2 - 330), y: 70 });
  let el!: HTMLDivElement;
  onMount(() => {
    const a = el.animate([{ transform: 'translate3d(0,10px,0) scale(.985)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' });
    a.pause(); afterPaint().then(() => a.play());
    loadFlags(kind());
  });
  const loadFlags = async (k: Kind) => setFlags((await api.checks.flags(k)) as string);
  const pick = (k: Kind) => { setKind(k); setRes(null); loadFlags(k); };

  const run = async () => {
    if (!root()) { flash(t('open a folder first')); return; }
    setBusy(true); setRes(null); setShowOut(false);
    const words = args().match(/"[^"]*"|'[^']*'|\S+/g)?.map((w) => w.replace(/^(["'])(.*)\1$/, '$2')) ?? [];
    const r = (await api.checks.run(root(), kind(), words)) as Result;
    setBusy(false); setRes(r);
    if (r.profile) {
      const max = Math.max(1, ...Object.values(r.profile.lines).flat().map(([, c]) => c));
      setHeat({ lines: r.profile.lines, max }); setHeatEpoch((n) => n + 1);
      getMainView()?.dispatch({});
    }
  };
  const go = (f: Frame) => openFile(f.file, { line: Math.max(0, f.line - 1), character: Math.max(0, f.col - 1) });
  const mine = (f: Frame) => !!root() && f.file.startsWith(root());
  const drag = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const sx = e.clientX - pos().x, sy = e.clientY - pos().y;
    const move = (m: PointerEvent) => setPos({ x: Math.min(window.innerWidth - 120, Math.max(-el.offsetWidth + 120, m.clientX - sx)), y: Math.min(window.innerHeight - 40, Math.max(0, m.clientY - sy)) });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  return (
    <div class="cwin runwin" ref={el} role="dialog" aria-label={t('run with checks')} data-help="checks" style={{ left: `${pos().x}px`, top: `${pos().y}px` }}>
      <div class="cwin-h" onPointerDown={drag}>
        <span class="t">{kind() === 'profile' ? t('profile') : t('run with checks')}</span><span class="grow" />
        <button class="x" title={t('Close')} aria-label={t('Close')} onClick={() => setRunOpen(null)}><svg viewBox="0 0 10 10"><path d="M.5 .5l9 9M9.5 .5l-9 9" /></svg></button>
      </div>
      <div class="cwin-b">
        <div class="copts">
          <For each={KINDS}>{(x) => (
            <button class="copt" classList={{ on: kind() === x.k }} onClick={() => pick(x.k)}><span class="radio" classList={{ on: kind() === x.k }} /><span class="l">{t(x.label)}</span><span class="dim">{t(x.note)}</span></button>
          )}</For>
        </div>
        <div class="crow" style={{ 'margin-top': '10px' }}>
          <input class="runargs" type="text" placeholder={t('arguments for the program (optional)')} value={args()} onInput={(e) => setArgs(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && !busy() && run()} spellcheck={false} aria-label={t('arguments for the program')} />
          <button class="barbtn on" disabled={busy() || !root()} onClick={run}>{busy() ? t('building and running…') : t('build and run')}</button>
        </div>
        <div class="dim" style={{ 'margin-top': '6px' }}>{t('Built in Lithograph\'s own folder, never in your project, with')} <code>{flags()}</code>{t('. For your own build, add the same flags.')}</div>

        <Show when={res()}>{(r) => (
          <div class="runres">
            <div class="csub" classList={{ bad: !r().ok }}>
              {r().message ?? (r().stage === 'done' ? (r().exitCode === null ? t('ran in {s} s · stopped by a check or a signal', { s: (r().ms / 1000).toFixed(1) }) : t('ran in {s} s · exit code {c}', { s: (r().ms / 1000).toFixed(1), c: String(r().exitCode) })) : '')}
            </div>
            <Show when={!r().ok && r().buildLog}><pre class="runlog">{r().buildLog.slice(-4000)}</pre></Show>

            <Show when={kind() !== 'profile' && r().stage === 'done'}>
              <div class="csec">{r().reports.length ? t('{n} problems found', { n: r().reports.length }) : t('no problems found in this run')}</div>
              <For each={r().reports}>{(rep) => (
                <div class="runrep">
                  <div class="tt">{rep.title}</div>
                  <div class="dim">{rep.tool} · {rep.detail}</div>
                  <For each={rep.sections}>{(s) => (
                    <div class="runsec">
                      <Show when={s.title}><div class="st">{s.title}</div></Show>
                      <For each={s.frames.slice(0, 8)}>{(f) => (
                        <button class="frame" classList={{ mine: mine(f) }} disabled={!mine(f)} onClick={() => go(f)}>
                          <span class="fn">{f.fn || '—'}</span><span class="at">{relPath(root(), f.file)}:{f.line}</span>
                        </button>
                      )}</For>
                    </div>
                  )}</For>
                </div>
              )}</For>
            </Show>

            <Show when={r().profile}>{(p) => (
              <>
                <div class="csec">{t('functions by calls')} <span class="dim">· {t('counts, not time; lines are shaded in the editor')}</span></div>
                <For each={p().functions.slice(0, 30)}>{(f) => (
                  <button class="frame mine prof" onClick={() => openFile(f.file, { line: f.line, character: 0 })}>
                    <span class="bar"><i style={{ width: `${(Math.log1p(f.count) / Math.log1p(p().functions[0]?.count || 1)) * 100}%` }} /></span>
                    <span class="fn">{f.name}</span><span class="at">{f.count.toLocaleString()}×</span>
                  </button>
                )}</For>
                <Show when={heat()}><button class="lnk" onClick={() => { setHeat(null); setHeatEpoch((n) => n + 1); getMainView()?.dispatch({}); }}>{t('clear the shading')}</button></Show>
              </>
            )}</Show>

            <Show when={r().output}>
              <button class="lnk" onClick={() => setShowOut(!showOut())}>{showOut() ? t('hide the program\'s output') : t('show the program\'s output')}</button>
              <Show when={showOut()}><pre class="runlog">{r().output.slice(-20000)}</pre></Show>
            </Show>
          </div>
        )}</Show>
      </div>
    </div>
  );
}
