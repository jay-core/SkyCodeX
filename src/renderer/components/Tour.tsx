import { Show, createSignal, onMount, onCleanup, createEffect, on } from 'solid-js';
import { t } from '../lib/i18n';

interface Step { target?: string; title: string; text: string }
const mac = navigator.platform.startsWith('Mac');
const STEPS: Step[] = [
  { title: 'welcome to Lithograph', text: 'A short look around: seven stops, about a minute. Press → or Enter to go on, Esc to stop at any time.' },
  { target: '[data-tour=tabs]', title: 'open files', text: 'Open files appear here as tabs. Once a folder is open, flow and memory sit at the start of this row.' },
  { target: '[data-tour=code]', title: 'your code', text: 'The editor checks your code as you type. Hover over a name to see what it is; {mod}-click it to go to its definition.' },
  { target: '[data-tour=preview]', title: 'preview panes', text: 'Put the cursor in a function: everything it calls appears here as cards, joined to the calls by coloured lines.' },
  { target: '[data-tour=files]', title: 'files', text: 'The files of the open folder. {mod} P finds one by name.' },
  { target: '[data-tour=appbar]', title: 'the bottom bar', text: 'Options, settings, the terminal, the compiler window, and the switch for the preview panes.' },
  { target: '[data-tour=help]', title: 'help', text: 'Press F1 anywhere for help about what is under the pointer, or click help here.' },
];

const [step, setStep] = createSignal(-1);
export const startTour = () => setStep(0);
export const tourDone = () => { try { return localStorage.getItem('tour.done') === '1'; } catch { return true; } };
const finish = () => { setStep(-1); try { localStorage.setItem('tour.done', '1'); } catch { /* shown again next time */ } };

/** A spotlight that walks through the main parts of the window, once on first run and again from help. */
export default function Tour() {
  const [box, setBox] = createSignal<DOMRect | null>(null);
  const measure = () => {
    const s = STEPS[step()];
    const el = s?.target ? document.querySelector(s.target) : null;
    const r = el?.getBoundingClientRect();
    setBox(r && r.width > 4 && r.height > 4 ? r : null);
  };
  createEffect(on(step, () => { if (step() >= 0) measure(); }));
  const key = (e: KeyboardEvent) => {
    if (step() < 0) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setStep(Math.max(0, step() - 1)); }
  };
  const next = () => (step() + 1 >= STEPS.length ? finish() : setStep(step() + 1));
  onMount(() => { window.addEventListener('keydown', key, true); window.addEventListener('resize', measure); });
  onCleanup(() => { window.removeEventListener('keydown', key, true); window.removeEventListener('resize', measure); });

  // the note sits beside the lit area, wherever there is room
  const notePos = () => {
    const r = box(), W = window.innerWidth, H = window.innerHeight, w = 340;
    if (!r) return { left: `${(W - w) / 2}px`, top: `${H / 2 - 90}px` };
    const left = r.right + 18 + w < W ? r.right + 18 : r.left - 18 - w > 0 ? r.left - 18 - w : Math.min(W - w - 16, Math.max(16, r.left));
    const top = r.right + 18 + w < W || r.left - 18 - w > 0 ? Math.min(H - 200, Math.max(16, r.top + 10)) : r.bottom + 14 + 180 < H ? r.bottom + 14 : Math.max(16, r.top - 194);
    return { left: `${left}px`, top: `${top}px` };
  };
  const fill = (s: string) => s.replace(/\{mod\}/g, mac ? '⌘' : 'Ctrl');
  return (
    <Show when={step() >= 0}>
      <div class="tour" role="dialog" aria-modal="true" aria-label={t('tour')} onMouseDown={(e) => e.stopPropagation()}>
        <div class="tour-spot" style={box() ? { left: `${box()!.left - 6}px`, top: `${box()!.top - 6}px`, width: `${box()!.width + 12}px`, height: `${box()!.height + 12}px` } : { left: '50%', top: '50%', width: '0px', height: '0px' }} />
        <div class="tour-note" style={notePos()} aria-live="polite">
          <div class="sub">{step() + 1} / {STEPS.length}</div>
          <div class="tt">{t(STEPS[step()].title)}</div>
          <p>{fill(t(STEPS[step()].text))}</p>
          <div class="tour-b">
            <button class="chip" onClick={finish}>{t('skip')}</button><span class="grow" />
            <Show when={step() > 0}><button class="barbtn" onClick={() => setStep(step() - 1)}>{t('back')}</button></Show>
            <button class="barbtn on" autofocus onClick={next}>{step() + 1 >= STEPS.length ? t('done') : t('next')}</button>
          </div>
        </div>
      </div>
    </Show>
  );
}
