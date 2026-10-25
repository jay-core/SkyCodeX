import { For, Show, createSignal, createEffect, on, onMount, onCleanup } from 'solid-js';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { api } from '../lib/api';
import { root, flash, openFile } from '../lib/store';
import { cardExtensions } from '../lib/cm';
import { applyEdits } from '../lib/extras';
import { STYLE_OPTS, parseStyle, writeStyle } from '../lib/tools';
import { afterPaint } from '../lib/motion';
import { t } from '../lib/i18n';

export const [styleOpen, setStyleOpen] = createSignal(false);


const SAMPLE = `#include <vector>
#include <algorithm>
#include "widget.h"
namespace app { namespace detail {
class Counter {
public:
    explicit Counter(int start) : value_(start) {}
    int get() const { return value_; }
    void add(int* by, std::vector<int> const& more) {
        if (by) value_ += *by;
        for (int m : more) { switch (m) { case 0: break; default: value_ += m; } }
    }
private:
    int value_;
};
int total(const std::vector<int>& xs) { return std::accumulate(xs.begin(), xs.end(), 0) + std::count_if(xs.begin(), xs.end(), [](int x){ return x > 10; }); }
} }
`;


/** The code style window: choose clang-format options and see a sample re-formatted by the language engine before saving. */
export default function StyleWindow() {
  const [vals, setVals] = createSignal<Record<string, string>>({ BasedOnStyle: 'LLVM' });
  const [msg, setMsg] = createSignal('');
  const [pos, setPos] = createSignal({ x: Math.max(16, window.innerWidth / 2 - 470), y: 70 });
  let lines: string[] = [], el!: HTMLDivElement, host!: HTMLDivElement, view: EditorView | undefined, existed = false;
  const file = () => `${root()}/.clang-format`;

  onMount(async () => {
    const a = el.animate([{ transform: 'translate3d(0,10px,0) scale(.985)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' });
    a.pause(); afterPaint().then(() => a.play());
    view = new EditorView({ parent: host, state: EditorState.create({ doc: SAMPLE, extensions: cardExtensions(1) }) });
    if (root() && (await api.fs.exists(file()))) {
      existed = true;
      const p = parseStyle((await api.fs.read(file())) as string);
      lines = p.lines;
      setVals(Object.keys(p.values).length ? p.values : { BasedOnStyle: 'LLVM' });
    }
  });
  onCleanup(() => view?.destroy());

  let timer: number | undefined;
  createEffect(on(vals, (v) => {
    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const style = writeStyle(lines.length ? lines : [], v);
      const r = (await api.format.preview(style, SAMPLE)) as { ok: boolean; edits?: any[]; message?: string };
      if (!r.ok) { setMsg(r.message ?? t('could not preview')); return; }
      setMsg('');
      const out = applyEdits(SAMPLE, r.edits ?? []);
      view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: out } });
    }, 180);
  }));

  const set = (k: string, v: string | undefined) => { const n = { ...vals() }; if (v === undefined || v === '') delete n[k]; else n[k] = v; setVals(n); };
  const save = async () => {
    if (!root()) { flash(t('open a folder first')); return; }
    await api.fs.write(file(), writeStyle(lines, vals()));
    flash(existed ? t('.clang-format updated') : t('.clang-format created in the project folder'), 4000);
    existed = true;
  };
  const drag = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const sx = e.clientX - pos().x, sy = e.clientY - pos().y;
    const move = (m: PointerEvent) => setPos({ x: Math.min(window.innerWidth - 120, Math.max(-el.offsetWidth + 120, m.clientX - sx)), y: Math.min(window.innerHeight - 40, Math.max(0, m.clientY - sy)) });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  return (
    <div class="cwin stylewin" ref={el} role="dialog" aria-label={t('code style')} data-help="editor" style={{ left: `${pos().x}px`, top: `${pos().y}px` }}>
      <div class="cwin-h" onPointerDown={drag}>
        <span class="t">{t('code style')} <span class="dim">· .clang-format</span></span><span class="grow" />
        <button class="x" title={t('Close')} aria-label={t('Close')} onClick={() => setStyleOpen(false)}><svg viewBox="0 0 10 10"><path d="M.5 .5l9 9M9.5 .5l-9 9" /></svg></button>
      </div>
      <div class="style-b">
        <div class="style-opts">
          <For each={STYLE_OPTS}>{(o) => (
            <div class="sopt">
              <div class="l">{t(o.label)}<Show when={vals()[o.key] !== undefined && o.key !== 'BasedOnStyle'}><button class="rst" onClick={() => set(o.key, undefined)}>{t('from base')}</button></Show></div>
              <Show when={o.values} fallback={
                <Show when={o.bool} fallback={<input class="num" type="number" min={o.min} max={o.max} value={vals()[o.key] ?? ''} placeholder={t('base')} onChange={(e) => set(o.key, e.currentTarget.value)} aria-label={t(o.label)} />}>
                  <div class="choices"><For each={['true', 'false']}>{(x) => <button classList={{ on: vals()[o.key] === x }} onClick={() => set(o.key, x)}>{x}</button>}</For></div>
                </Show>
              }>
                <div class="choices"><For each={o.values}>{(x) => <button classList={{ on: vals()[o.key] === x }} onClick={() => set(o.key, x)}>{x}</button>}</For></div>
              </Show>
            </div>
          )}</For>
        </div>
        <div class="style-prev">
          <div class="sub">{msg() || t('a sample, formatted by the language engine with these choices')}</div>
          <div class="style-code" ref={host} />
          <div class="crow">
            <button class="barbtn" onClick={save} disabled={!root()}>{t('save to the project')}</button>
            <Show when={root()}><button class="lnk" onClick={async () => { await save(); openFile(file()); }}>{t('save and open the file')}</button></Show>
          </div>
        </div>
      </div>
    </div>
  );
}
