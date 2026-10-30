import { For, Show, createSignal, createResource, onMount, onCleanup } from 'solid-js';
import { api } from '../lib/api';
import { root, flash } from '../lib/store';
import { startLsp } from '../lib/lsp';
import { afterPaint } from '../lib/motion';

export const [compilerOpen, setCompilerOpen] = createSignal(false);

type Kind = 'toolchain' | 'clangd' | 'rust' | 'rust-analyzer' | 'python' | 'pyright' | 'go';
interface Pack { id: string; kind: Kind; name: string; version: string; bytes: number; source: string; clangd: string | null; clang: string | null; note?: string }
interface Info {
  setting: string; active: string | null; activeVersion: string | null;
  inbuilt: { path: string; version: string | null } | null; system: { path: string; version: string | null } | null;
  packs: Pack[]; packsDir: string; packsNote: string | null; toolchainSetting: string; toolchain: string | null;
  headers: { ok: boolean; detail: string }; installing: string | null;
  readAs: { want: 'clang' | 'gcc' | 'msvc'; now: string; note: string; gcc: { path: string; version: string } | null; msvc: { path: string; version: string } | null };
  kinds: Record<Kind, { title: string; language: string; what: string }>;
}
// the other languages: each row installs one kind of pack
const MORE: { language: string; kinds: Kind[] }[] = [
  { language: 'Rust', kinds: ['rust', 'rust-analyzer'] },
  { language: 'Python', kinds: ['python', 'pyright'] },
  { language: 'Go', kinds: ['go'] },
];
interface Release { kind: Kind; name: string; version: string; asset: string; size: number; source: string; id: string; format: string; sha512?: string; note?: string }
type Progress = { id: string; phase: string; done: number; total: number; note?: string };

const mb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${Math.round(n / 1e6)} MB`);
const newer = (a: string, b: string) => { const pa = a.split(/[.\-]/).map(Number), pb = b.split(/[.\-]/).map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0); return false; };
const stored = () => { try { return JSON.parse(localStorage.getItem('litho.compiler.pos') ?? 'null') as { x: number; y: number } | null; } catch { return null; } };

/** The compiler window: which clangd runs, whose standard headers are indexed, and installing, updating or removing packs. */
export default function CompilerWindow() {
  const [info, { refetch }] = createResource(async () => (await api.compiler.info()) as Info);
  const [mini, setMini] = createSignal(false);
  const [pos, setPos] = createSignal(stored() ?? { x: Math.max(16, (window.innerWidth - 600) / 2), y: 80 });
  const [rel, setRel] = createSignal<Record<string, Release[] | string>>({});   // kind → releases, or why they couldn't be listed
  const [picking, setPicking] = createSignal(false);
  const [confirm, setConfirm] = createSignal<{ r: Release; replaces?: string } | null>(null);
  const [prog, setProg] = createSignal<Progress | null>(null);
  let el!: HTMLDivElement;

  const off = api.packs.onProgress((p) => setProg(p as Progress));
  onCleanup(off);
  onMount(() => {
    const a = el.animate([{ transform: 'translate3d(0,10px,0) scale(.985)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' });
    a.pause(); afterPaint().then(() => a.play());
  });

  // ---- moving: drag by the title bar, kept inside the window ----
  const drag = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const sx = e.clientX - pos().x, sy = e.clientY - pos().y;
    const move = (m: PointerEvent) => setPos({ x: Math.min(window.innerWidth - 120, Math.max(-el.offsetWidth + 120, m.clientX - sx)), y: Math.min(window.innerHeight - 40, Math.max(0, m.clientY - sy)) });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); try { localStorage.setItem('litho.compiler.pos', JSON.stringify(pos())); } catch { /* not kept */ } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const [pickKind, setPickKind] = createSignal<Kind | null>(null);
  const listFor = async (kind: Kind) => {
    setRel({ ...rel(), [kind]: 'looking…' });
    const r = (await api.packs.available(kind)) as { ok: boolean; list?: Release[]; message?: string };
    setRel({ ...rel(), [kind]: r.ok ? (r.list!.length ? r.list! : 'no release for this computer') : `couldn't list versions — ${r.message}. Installed packs keep working offline.` });
  };
  const releases = (kind: string) => (Array.isArray(rel()[kind]) ? (rel()[kind] as Release[]) : []);
  const latest = (kind: string) => releases(kind)[0];

  const useEngine = async (value: string) => {
    await api.settings.set('clangd.path', value);
    await refetch();
    if (root()) startLsp(root());   // the new engine takes over at once
  };
  const readAs = async (value: string) => {
    await api.settings.set('compiler.read_as', value);
    await refetch();
    if (root()) startLsp(root());   // clangd reads the project again as that compiler
  };
  const install = async (r: Release, replaces?: string) => {
    setConfirm(null); setPicking(false); setPickKind(null);
    setProg({ id: r.id, phase: 'download', done: 0, total: r.size });
    const res = (await api.packs.install(r.kind, r.version, replaces)) as { ok: boolean; message?: string };
    await refetch();
    if (!res.ok) { if (res.message !== 'cancelled') flash(`couldn't install ${r.id}: ${res.message}`, 8000); return; }
    setProg(null);
    flash(`${r.id} installed in language_packs`, 4000);
    if (r.kind === 'clangd' && (!replaces || info()?.setting !== `pack:${r.id}`)) useEngine(`pack:${r.id}`);
  };
  const remove = async (p: Pack) => {
    const res = (await api.packs.remove(p.id)) as { ok: boolean; message?: string };
    if (!res.ok) flash(res.message ?? 'not removed');
    await refetch();
    if (root() && info()?.setting === 'auto') startLsp(root());
  };

  const engineLabel = (i: Info) =>
    i.setting === 'inbuilt' || (i.setting === 'auto' && i.active === i.inbuilt?.path) ? 'inbuilt'
      : i.setting === 'system' || (i.setting === 'auto' && i.active === i.system?.path) ? 'system'
      : i.setting.startsWith('pack:') ? `language pack · ${i.setting.slice(5)}` : 'custom path';
  const busy = () => !!prog() && !['done', 'failed', 'cancelled'].includes(prog()!.phase);

  return (
    <div class="cwin" ref={el} role="dialog" aria-label="compiler" style={{ left: `${pos().x}px`, top: `${pos().y}px` }}>
      <div class="cwin-h" onPointerDown={drag}>
        <span class="t">compiler</span>
        <span class="grow" />
        <button title={mini() ? 'Expand' : 'Minimise'} onClick={() => setMini(!mini())}><svg viewBox="0 0 10 10"><path d={mini() ? 'M.5 .5h9v9h-9z' : 'M0 5.5h10'} /></svg></button>
        <button class="x" title="Close" onClick={() => setCompilerOpen(false)}><svg viewBox="0 0 10 10"><path d="M.5 .5l9 9M9.5 .5l-9 9" /></svg></button>
      </div>
      <Show when={!mini()}>
        <div class="cwin-b">
          <Show when={info()} fallback={<div class="sub">reading…</div>}>{(i) => (
            <>
              {/* ---- language engine ---- */}
              <div class="csec">language engine</div>
              <div class="cbig">clangd {i().activeVersion ?? (i().active ? '' : '— not found')}</div>
              <div class="csub">{engineLabel(i())}{i().active ? ` · ${i().active}` : ''}</div>
              <div class="copts">
                <Opt on={i().setting === 'auto'} label="automatic" note="inbuilt, else the system's" onPick={() => useEngine('auto')} />
                <Opt on={i().setting === 'inbuilt'} disabled={!i().inbuilt} label="inbuilt" note={i().inbuilt ? `clangd ${i().inbuilt!.version ?? ''} · ships with SkyCodeX` : 'this build has none (npm run fetch-clangd)'} onPick={() => useEngine('inbuilt')} />
                <Opt on={i().setting === 'system'} disabled={!i().system} label="system" note={i().system ? `clangd ${i().system!.version ?? '?'} · ${i().system!.path}` : 'none found on this machine'} onPick={() => useEngine('system')} />
                <For each={i().packs.filter((p) => p.clangd)}>{(p) => (
                  <Opt on={i().setting === `pack:${p.id}`} label={`pack · ${p.id}`} note={p.kind === 'toolchain' ? 'the clangd inside this toolchain' : 'language pack'} onPick={() => useEngine(`pack:${p.id}`)} />
                )}</For>
              </div>
              <div class="crow">
                <Show when={latest('clangd')} fallback={<button class="lnk" disabled={busy()} onClick={() => listFor('clangd')}>check for clangd updates</button>}>{(l) => {
                  const cur = i().activeVersion ?? '0';
                  const pack = i().packs.find((p) => p.kind === 'clangd');
                  return newer(l().version, cur)
                    ? <span>clangd {l().version} is available · {mb(l().size)} <button class="lnk" disabled={busy()} onClick={() => setConfirm({ r: l(), replaces: pack?.id })}>update</button></span>
                    : <span class="dim">clangd {cur} is the latest</span>;
                }}</Show>
                <Show when={typeof rel().clangd === 'string'}><span class="dim">{rel().clangd as string}</span></Show>
              </div>

              {/* ---- the compiler the code is read as ---- */}
              <div class="csec">read the code as <span class="dim">· its headers, macros and language rules; clangd analyses it either way</span></div>
              <div class="copts">
                <Opt on={i().readAs.want === 'clang'} label="clang" note="the toolchain below, else the system's" onPick={() => readAs('clang')} />
                <Opt on={i().readAs.want === 'gcc'} disabled={!i().readAs.gcc && i().readAs.want !== 'gcc'} label="gcc · g++" note={i().readAs.gcc ? `g++ ${i().readAs.gcc!.version} · ${i().readAs.gcc!.path}` : 'no GCC found on this machine (set compiler.path to a g++)'} onPick={() => readAs('gcc')} />
                <Opt on={i().readAs.want === 'msvc'} disabled={!i().readAs.msvc && i().readAs.want !== 'msvc'} label="MSVC" note={i().readAs.msvc ? `cl ${i().readAs.msvc!.version} · ${i().readAs.msvc!.path}` : 'Windows, with Visual Studio or its Build Tools (C++)'} onPick={() => readAs('msvc')} />
              </div>
              <Show when={i().readAs.note}><div class="csub bad">{i().readAs.note}</div></Show>
              <div class="csub">reading as {i().readAs.now} · a project's own compile_commands.json keeps the compilers it names</div>

              {/* ---- toolchain ---- */}
              <div class="csec">compiler toolchain <span class="dim">· its standard headers are indexed with the project</span></div>
              <Show when={i().packs.some((p) => p.kind === 'toolchain')} fallback={<div class="csub">none installed — the system's headers are used</div>}>
                <div class="copts">
                  <For each={i().packs.filter((p) => p.kind === 'toolchain')}>{(p) => (
                    <div class="cpack">
                      <button class="radio" classList={{ on: i().toolchain === p.id }} title="index its headers" onClick={async () => { await api.settings.set('compiler.toolchain', p.id); refetch(); }} />
                      <div class="grow">
                        <div>{p.name} {p.version}{i().toolchain === p.id ? <span class="tag">in use</span> : null}</div>
                        <div class="dim">{mb(p.bytes)} on disk · {p.source}</div>
                      </div>
                      <Show when={latest('toolchain') && newer(latest('toolchain')!.version, p.version)}>
                        <button class="lnk" disabled={busy()} onClick={() => setConfirm({ r: latest('toolchain')!, replaces: p.id })}>update to {latest('toolchain')!.version}</button>
                      </Show>
                      <button class="lnk warn" disabled={busy()} onClick={() => remove(p)}>remove</button>
                    </div>
                  )}</For>
                  <Opt on={i().toolchainSetting === 'none'} label="none" note="the system's headers are used" onPick={async () => { await api.settings.set('compiler.toolchain', 'none'); refetch(); }} />
                </div>
              </Show>
              <div class="crow">
                <button class="lnk" disabled={busy()} onClick={() => { setPicking(!picking()); if (!rel().toolchain || typeof rel().toolchain === 'string') listFor('toolchain'); }}>{picking() ? 'hide versions' : i().packs.some((p) => p.kind === 'toolchain') ? 'install another version' : 'install a toolchain'}</button>
                <Show when={!picking() && i().packs.some((p) => p.kind === 'toolchain') && !latest('toolchain')}><button class="lnk" onClick={() => listFor('toolchain')}>check for updates</button></Show>
              </div>
              <Show when={picking()}>
                <div class="cvers">
                  <Show when={typeof rel().toolchain === 'string'}><div class="dim">{rel().toolchain as string}</div></Show>
                  <For each={releases('toolchain').slice(0, 10)}>{(r) => (
                    <button classList={{ have: i().packs.some((p) => p.id === r.id) }} disabled={i().packs.some((p) => p.id === r.id) || busy()} onClick={() => setConfirm({ r })}>
                      <span>{r.name} {r.version}</span><span class="dim">{r.asset} · {mb(r.size)}</span>{i().packs.some((p) => p.id === r.id) ? <span class="tag">installed</span> : null}
                    </button>
                  )}</For>
                </div>
              </Show>

              {/* ---- other languages ---- */}
              <div class="csec">more languages <span class="dim">· each in its own pack, used by the editor</span></div>
              <For each={MORE}>{(g) => (
                <div class="clang">
                  <div class="cl">{g.language}</div>
                  <div class="grow">
                    <For each={g.kinds}>{(k) => {
                      const have = () => i().packs.filter((p) => p.kind === k);
                      return (
                        <div class="cpack">
                          <div class="grow">
                            <div>{i().kinds[k].title} <span class="dim">· {i().kinds[k].what}</span></div>
                            <For each={have()}>{(p) => (
                              <div class="dim">{p.version} · {mb(p.bytes)} on disk{p.note ? ` · ${p.note}` : ''}
                                <Show when={latest(k) && newer(latest(k)!.version, p.version)}> <button class="lnk" disabled={busy()} onClick={() => setConfirm({ r: latest(k)!, replaces: p.id })}>update to {latest(k)!.version}</button></Show>
                                {' '}<button class="lnk warn" disabled={busy()} onClick={() => remove(p)}>remove</button></div>
                            )}</For>
                            <Show when={typeof rel()[k] === 'string'}><div class="dim">{rel()[k] as string}</div></Show>
                          </div>
                          <button class="lnk" disabled={busy()} onClick={() => { if (pickKind() === k) setPickKind(null); else { setPickKind(k); listFor(k); } }}>{pickKind() === k ? 'hide' : have().length ? 'versions' : 'install'}</button>
                        </div>
                      );
                    }}</For>
                  </div>
                </div>
              )}</For>
              <Show when={pickKind()}>{(k) => (
                <div class="cvers">
                  <For each={releases(k()).slice(0, 8)}>{(r) => (
                    <button classList={{ have: i().packs.some((p) => p.id === r.id) }} disabled={i().packs.some((p) => p.id === r.id) || busy()} onClick={() => setConfirm({ r })}>
                      <span>{i().kinds[k()].title} {r.version}</span><span class="dim">{r.asset} · {r.size ? mb(r.size) : 'size unknown'}</span>{i().packs.some((p) => p.id === r.id) ? <span class="tag">installed</span> : null}
                    </button>
                  )}</For>
                </div>
              )}</Show>

              {/* ---- confirm a download ---- */}
              <Show when={confirm()}>{(c) => (
                <div class="cconfirm">
                  <div>Download <b>{c().r.asset}</b> ({c().r.size ? mb(c().r.size) : 'size not published'}) from {c().r.source}?</div>
                  <div class="dim">It goes into {i().packsDir}{c().replaces ? `, replacing ${c().replaces}` : ''} and needs about {mb(c().r.size * (c().r.format === 'zip' ? 4 : 7))} free.
                    It is checked against the {c().r.sha512 ? 'SHA-512 the npm registry' : 'SHA-256 ' + (c().r.source.startsWith('github') ? 'GitHub' : c().r.source)} publishes for it and unpacked by SkyCodeX itself — no installer runs, and nothing outside that folder or in your environment changes.{c().r.note ? ` Note: ${c().r.note}.` : ''}</div>
                  <div class="crow"><button class="barbtn" onClick={() => install(c().r, c().replaces)}>download and install</button><button class="lnk" onClick={() => setConfirm(null)}>cancel</button></div>
                </div>
              )}</Show>

              {/* ---- progress ---- */}
              <Show when={prog()}>{(p) => (
                <div class="cprog">
                  <div class="crow">
                    <span>{p().id} · {p().phase === 'download' ? `downloading ${mb(p().done)} of ${mb(p().total)}` : p().phase === 'verify' ? 'checking SHA-256' : p().phase === 'unpack' ? `unpacking · ${p().done} files` : p().phase === 'done' ? 'installed' : p().phase === 'cancelled' ? 'cancelled — nothing was left behind' : `failed — ${p().note ?? ''}`}</span>
                    <span class="grow" />
                    <Show when={busy()} fallback={<button class="lnk" onClick={() => setProg(null)}>dismiss</button>}><button class="lnk warn" onClick={() => api.packs.cancel()}>cancel</button></Show>
                  </div>
                  <div class="bar"><i style={{ width: `${p().phase === 'download' && p().total ? (p().done / p().total) * 100 : p().phase === 'verify' || p().phase === 'unpack' || p().phase === 'done' ? 100 : 0}%` }} classList={{ pulse: p().phase === 'unpack' || p().phase === 'verify' }} /></div>
                </div>
              )}</Show>

              {/* ---- headers and the folder ---- */}
              <div class="csec">standard headers</div>
              <div class="csub" classList={{ bad: !i().headers.ok }}>{i().headers.ok ? '✓ ' : ''}{i().headers.detail}</div>
              <div class="cfoot">
                <span class="dim">language_packs · {i().packsDir}</span>
                <button class="lnk" onClick={() => api.packs.show()}>show folder</button>
              </div>
              <Show when={i().packsNote}><div class="dim">{i().packsNote}</div></Show>
            </>
          )}</Show>
        </div>
      </Show>
    </div>
  );
}

function Opt(props: { on: boolean; label: string; note: string; disabled?: boolean; onPick: () => void }) {
  return (
    <button class="copt" classList={{ on: props.on }} disabled={props.disabled} onClick={() => !props.on && props.onPick()}>
      <span class="radio" classList={{ on: props.on }} /><span class="l">{props.label}</span><span class="dim">{props.note}</span>
    </button>
  );
}
