# SkyCodeX roadmap — confirmed decisions

The agreed plan, kept in one place. Each item says what was decided and why; work starts only when asked
("SkyCodeX execute!" for the editor, "Skyflow execute!" for SkyFlowX). Design detail lives in [FLOW-DESIGN.md](FLOW-DESIGN.md).

## Decided

| Date | Decision |
|---|---|
| 2026-10-30 | Rust and Ada flow support move to **SkyCodeX 1.5**, with other languages. 1.x stays C/C++. |
| 2026-10-30 | Stay on **Electron**; no native rewrite and no Tauri for now. Revisit only if memory (~300 MB) or start-up (~1 s) becomes a real complaint. |
| 2026-10-30 | Old releases removed (Lithograph 1.0.0 and its `v1.0.0` tag). The next release is the first SkyCodeX one. |
| 2026-10-30 | **App icon chosen:** the folded-band S (source `assets/icon/skycodex-colour.pdf`), used darkened and monochrome (`assets/icon/skycodex-mono.png`, 1024 px). It replaces `skycodex.svg` and all generated sizes on "SkyCodeX execute!". |
| 2026-10-30 | Repository recreated as **jay-core/SkyCodeX** (private): same branches, commits and settings, with Jatin Aggarwal as the only author and no AI attribution anywhere, now and in future. |
| 2026-10-30 | **SkyFlowX**, our own static and dynamic analyser (an analogue of LDRA's components, built from published methods and standards). See [SkyFlowX](#skyflowx-confirmed-not-started). |
| 2026-10-30 | MISRA and DO-178C come from the user's licensed copies: used to implement the rules exactly, never copied into the repo, never quoted in the app. |
| 2026-10-31 | **Machine-checked proofs:** SkyFlowX's core theorems (monoid potential, integral leak repair, Helly fold, interrupt theorems, projection lemma, confinement, checker validity) are mechanised in Lean 4 + Mathlib, offline, as tool-qualification evidence. Starts with "Skyflow execute!". See discoveryAndConnection.md D4.11. |
| 2026-10-31 | **Fully offline:** SkyFlowX and SkyCodeX analysis, proofs, coverage, repair suggestions and reports run with no network. SMT solver and rule tables are bundled. Licensed standards are read locally. AI-generated suggestions are optional, off by default, and offline only with a local model. |
| 2026-11-01 | **Order of work:** on "SkyCodeX execute!", SkyCodeX is finished completely first, through the final optimisation step below, before any further SkyFlowX discussion. Then SkyFlowX resumes with a long discussion of interacting fixes (discoveryAndConnection.md D3.11). |
| 2026-11-02 | **Dropped:** drawing on a canvas (speed item 1) and the single animation clock (animation item 1). Measured unnecessary: 95% of frames under 17.6 ms on ThreadX with and without a GPU. |
| 2026-11-02 | **What a change does, colours:** what was removed or replaced shows faded, in red; what was added or is the replacement shows in green at normal opacity. |
| 2026-11-02 | **Order to the release:** Configurations, What a change does, the error repair engine and the README first; then the optimisation phase (after the user's points); then the large codebases (LLVM, RTEMS); then the final sweep, removal of every test codebase, and the final commit. **Benchmarks:** ThreadX is the first benchmark: measured just before optimisation and again after, with the same steps (cold and kept, GPU on and off, median of 3), to show the gains. LLVM and RTEMS come after, to show what optimisation and the design still miss at a much larger size, improved over time. |
| 2026-11-02 | **Error repair engine (first release):** for C/C++ errors (syntax, type errors, undeclared names), small edits near the error are tried and kept only if clangd shows the error gone and no new one anywhere. Each suggestion has its own ✓ / ✗ box and is applied only on ✓; hovering shows why it is suggested there. Fully offline. One edit per suggestion (a bracket pair, a name with its `std::`, or an `#include` line counts as one); casts are never suggested, as they hide bugs rather than fix them. Coverage is measured on a sample of real error kinds; two edits become an opt-in only if too many are missed. |
| 2026-11-02 | **Error repair engine, built:** a clangd of its own (no index) reads the file with each candidate; the window's clangd and the editor's text are never touched. Clang's own fix-its come first, then our own (missing or stray bracket, `;`, `std::`, `#include`, `*` / `&`). Of one error's fixes, only those that clear the most errors are kept, so `cout` becomes `std::cout`, not clang's guess `count`. A syntax fix may reveal errors clang skipped while recovering, on later lines; they are named in the reason, and the next check offers their own fixes. **Measured coverage** (samples/repair, 20 one-edit breaks, 18 of which make an error): 18 of 18 get a confirmed fix, 17 give back the code exactly; no cast ever offered. Two edits stay off: nothing missed needed them. |
| 2026-11-03 | **SkyCodeX keeps its current design.** The IRSA SDR design language (Helvetica Neue, spaced micro capitals, hairline lists, the selection band, dark and light modes) was previewed on SkyCodeX at its own text sizes and not taken: the existing look is good enough. The IRSA SDR HMI lives in its own folder, `~/Desktop/IRSA-SDR-HMI`, not in this repo. |
| 2026-11-03 | **Unified SkyFlowX** (discoveryAndConnection.md U). C and C++ only. **Common core on every OS, the first target:** clang plus SkyFlowX, with MISRA C/C++, CERT/CWE, AUTOSAR C++14, JSF AV and ARINC 653 checks built in, and results shown natively and interactively in SkyCodeX's own look. **Add-on on Linux and macOS, later:** Frama-C installed by the user and called as a separate program; Frama-Clang for C++ only where it measures well. No WSL route on Windows; a check that needs the add-on shows *can't tell* there, never a pass. Frama-C's published methods may be rebuilt clean-room; its code, tests and text are never copied. **Time:** the common core's first slice takes about two weeks after SkyCodeX is finished; the full suite takes months. **Reuse (U.10):** open-source checks are taken where they exist. clang diagnostics, clang-tidy, the Clang Static Analyzer, LLVM coverage and the sanitizers are built in, with their notices in the third-party notices file. GPL tools such as cppcheck are run only as separate programs the user installs. SkyFlowX links clang's C++ libraries, not only libclang. A reused check counts toward a rule only after that rule's known-answer tests pass. |
| 2026-11-04 | **SkyFlowX tab** (discoveryAndConnection.md U.11, mock-ups approved). A separate tab at the far right of the tab row, its label in a thin bordered box. **States in the box:** *not started* (`SkyFlowX` + **Init**); *running* (`covered / total` files, like clangd's indexing count, with a thin progress line); *ready* (`SkyFlowX 3 · 12` = proven · possible); *stale* (counts dimmed, **Init** back); *stopped* ("engine stopped" + **Retry**). **While the engine works** the tab row brightens and dims, about every 1.6 s; with reduced motion it stays bright. **Starts only on Init**, never by itself; edits make results stale until the next Init. **Results** are kept only in SkyCodeX's data folder, never in the project. **Repair suggestions**, while the repair engine runs, appear in the open file to the right of the error line, joined to it by a thin connector: the message, the fixed line with the edit highlighted, the second-clangd confirmation, ✓ Apply and ✗. |
| 2026-11-04 | **SkyFlowX inventory** (Concept 1.1, discoveryAndConnection.md U.12). On Init, every source, header, language, program and library is listed, with no file cap. **Vendor, generated and test code** is analysed so calls into it are understood, but its findings are hidden by default under a "not yours" group. **Orphan headers** (included by no source) are analysed alone with the project's settings, and their findings are marked "not included by any source". **Headers used by both C and C++** are analysed in each language, and findings are tagged *in C*, *in C++* or *both*. Every skipped or unreadable file is listed with its reason (P7). |
| 2026-11-04 | **SkyFlowX toolchain and results** (discoveryAndConnection.md U.13, U.14). **Static analysis never builds:** clang reads each file in memory with its compile command; dynamic analysis is a separate step that builds SkyFlowX's own instrumented copy in the data folder. **Toolchain, chosen by the user, never inferred:** toggle buttons per compiler family (several allowed); what the project's files name is shown only as information; the user picks the installed copy (or a download) and confirms; a command output that contradicts the choice stops and is shown. Queries carry the project's flags, one per flag set. A permission window lists every exact read-only command, then shows their live output in a terminal panel; permission is remembered per project and per compiler hash. **Downloads:** open-licence toolchains only (LLVM, Arm GNU, xPack, llvm-mingw), checksum-verified, one folder per pack with a manifest; licensed compilers are detected only. **Results:** standards shown as verdicts with met / deviated / violated / not-checked breakdowns, never a lone %; DO-178C as objectives with evidence, never claimed by the tool alone; coverage split by reason (proven unreachable, missing test, can't tell); every segment clickable down to the line; project map, Fix first, filters, MC/DC cards in the code. Beyond LDRA, not limited to it. |
| 2026-11-04 | **SkyFlowX compile commands, engine life, on/off** (discoveryAndConnection.md U.15). Commands from the project's database first, then build tools without building, IDE project files, a watched build, guessed. Running project tools: one yes per project. Guessed commands: macro- and type-size-dependent rules *can't tell*. A file built twice: analysed per context. The engine closes after each run. **On/off switch per project:** off stops everything at once and keeps every finished result in the data folder; on resumes, keeping only results whose file, command, toolchain and rules are unchanged. The switch is an **ON | OFF** segmented control at the end of a larger SkyFlowX button (38 px); OFF also shows as a dashed border and dimmed label, never colour alone. |
| 2026-11-05 | **Flow views renamed: metro and grid** (replacing sequence and boxes), the code scan and the build plan: [FLOW-VIEWS-PLAN.md](FLOW-VIEWS-PLAN.md), mock-ups in [mockups/flow](mockups/flow). Metro: the metro line plus four-column rows (call as written, where the result goes, notes from the analyses), chapters named by the real loop, the current step opened into a card. Grid as recorded below. Fixes first (preview stability and races, clangd restart, safe parsing, atomic writes, go-to-definition everywhere), then the views; zero unexpected behaviour. Not built yet. |
| 2026-11-05 | **SkyCodeX flow and preview UX, and fixes** (approved designs; build on "SkyCodeX execute!"). **Steps vs functions:** steps only count up (1, 2, 3 …); the shuffling number is the function number, shown as ƒN; repeats show "↻ … again" and the call count ("2nd call"). **Sequence:** consecutive steps from one file grouped in a file card; the step card's "called from" / "calls" show function and file:line and are clickable (go to that step and its code); an arrow from the card to the next step, its hover naming it. **Code preview (both views):** STEP N of M and ƒN name · Kth call shown separately; "from ƒ… caller · file line" with the calling line, a connector into the callee's whole definition; the body walked line by line at the play speed (run lines bright, current gold, not yet run dim, so dead code shows); ⌘/Ctrl-click works there. **Play controls:** ⏮ goes to the start paused; ▶ plays from where you are; 0.25× added. **Run bars:** distinct colours (green first call, blue called again, purple via a pointer, outlined pale gold now, shaded band in a loop, orange dot edited, gold line note; taller = deeper), − / + zoom, scroll, click to go. **Boxes:** functions listed in each file box with their steps at any zoom; click a box for its steps in run order; connectors leave and enter function rows at right angles, calls from one function share a lane; no number circles on lines (the rows carry the steps; the walked line carries one moving badge; hover a line for its steps); the code preview pane as in the sequence view; selecting a function links its row, by a fine dotted gold line, straight to a details panel at the bottom of the right pane (every call to it in this run, with the calling line; no tag in between); **⌥-click** peeks a definition inline under the line (the other editor extras shown were not taken); **boxes as a call grid** (approved 2026-11-05): called functions as rows and calling functions as columns, both grouped under file bands, names horizontal, each square holding that call's steps (done dim, now gold, ↻ again), same-file calls tinted in the file's colour, "called ×N" bars per row and "N calls" per column, a crosshair on the current call linked by a dotted gold line to its details (calling lines, files, enclosing loop), sort by file / run order / most called, files × files first on large projects; the view follows the probe continuously inside a follow zone, then settles on the whole box. **⌘/Ctrl-hover:** one distinct underline with a "where it leads" tag in every window (editor, preview panes, flow code preview); nothing underlined when there is nowhere to go; a failed click always says why (preprocessor off, unknown name, body in a library, still indexing). **Preview card headers** sized from the preview size. **Font picker:** a list on focus, each font in its own face, a monospaced filter. **Fixes:** the preview losing its selection while clangd settles (retries and index ends rebuilt and reset it, on every OS): rebuild in place keeping level, focus and pins, and stop retrying bodies confirmed to be in a library; the flow tab's ⌘/Ctrl-click to be traced and fixed; ⌘/Ctrl-click reliability checked by a run that clicks every resolvable name in every window; the interface checked at several typefaces and sizes. |
| 2026-11-05 | **SkyFlowX Standards view and compliance tendency engine** (discoveryAndConnection.md U.16, D3.7; mock-ups kept). Results tabs: Summary, Along the run, Assurance, Standards, Map, each with Print and Export PDF report (the PDF format decided later). **Standards → Rules:** the standard as a wall of rule tiles in its own sections (met, violated with a count, deviated, not checked, nothing to check here), each section showing how much of the code it looks at, an unmistakable selection highlight, a card for the selected rule. **Standards → In the code:** green ✓ highlights where rules hold, red ✕ where they break with the reason inline, path lines marked, every highlight selectable; an adjustable right pane gives the why and the **compliance tendency engine**: ranked ways to comply with result, edit, whether allowed, whether checked, the flow change and what changes elsewhere; Preview the change, then Apply ✓. |
| 2026-11-04 | **SkyCodeX 1.1.0** (built and released). **Start window:** in the middle of the app when no folder is open: up to five recent folders (1–5, ✕ removes, missing ones marked "not found"), Open a folder, Open a file, Continue without a folder; kept in data/state/recent.json. **Flow tab:** the code pane is resizable by a divider and keeps its width; hovering a step bar lights it and shows its step, file and line, depth and loop; 0.25× play speed. **Preview:** ‹ back and next › in one thin box (Alt ← / Alt →), « source goes home. **Fix:** a selected step was reset to the start each time the flow rebuilt while clangd was still indexing (seen repeatedly on Windows on a first open); the step is now found again in the rebuilt run. |
| 2026-11-04 | **SkyFlowX button, tabs and results page** (discoveryAndConnection.md U.11, U.14; approved on the real app). **Button:** 42 px, its own mark, `SkyFlow` + gold **X**, warm tint, accent border, soft halo, a divider from the tabs; Init / counts, then ON \| OFF; lit with a gold rule under the row when its tab is open; still visible when OFF. **Other tabs:** thin 1 px boxes, 42 px, the open one brighter, for balance; only SkyFlowX is gold. **Results page:** one reading order: context and filters with List \| Map, the answer sentence with Fix first, one legend, standards as aligned rows that open in place, Fix first, coverage and DO-178C on the same column grid. |
| 2026-11-02 | **In the first release:** Configurations and What a change does ship in the first SkyCodeX release, not after it. |
| 2026-11-02 | **Commits:** the work so far was committed on 2026-11-02 (7290b6a). The last commit comes after the optimisation phase is complete. |
| 2026-10-30 | **Target for results:** match what the standards define and what industry expects of reliable analysis. Every check has a written spec and test cases with known answers. |

## SkyFlowX (confirmed, not started)

The full specification is in [SKYFLOWX-TASK.md](SKYFLOWX-TASK.md); ideas we discover together are recorded in [discoveryAndConnection.md](discoveryAndConnection.md).

**Shape:**
- One Rust program, `skyflowx`, built on **clang**: its C++ libraries through a small C++ layer, for parsing, the CFG, dataflow, clang-tidy, the Static Analyzer and coverage (discoveryAndConnection.md U.10).
- It runs beside the editor like clangd does, over JSON-RPC on stdio, and ships inside the app with one binary per platform.
- The run-time library for embedded targets is **plain C**.

**Relation to the current engine:**
- **Stays in TypeScript:** views, layout, animation, steps, programs and searches.
- **Stays clangd:** go to definition, hover and completion.
- **Flow building:** stays for now and may move to Rust later (speed item 2).
- **Facts and findings:** move to SkyFlowX.
- **Switching:** both run side by side, and the smoke projects compare their findings (tinyhttp, engine, programs, ThreadX). Each piece switches over only when it matches or beats the old one; the old code is removed after that.
- **Fallback:** if `skyflowx` is missing or crashes, the editor carries on with the current engine and shows a quiet note.

| # | Part | Based on | Certainty |
|---|---|---|---|
| 1 | C/C++ front end (clang) | C11/C17, C++17/20, compiler extensions | Exact, given correct build flags |
| 2 | Rule checks: MISRA C/C++, CERT, CWE, AUTOSAR C++14, JSF AV | The standards | Exact for decidable rules; reported as proven, possible or can't tell for undecidable ones |
| 3 | Metrics: cyclomatic, essential, knots, Halstead, nesting, size | McCabe, Halstead, Woodward | Exact |
| 4 | Control-flow and call graphs | Compiler theory | Exact for direct calls; indirect calls are listed as candidates |
| 5 | Data-flow anomalies (DU/UR/DD), globals across functions | Fosdick and Osterweil | Exact on the program's paths |
| 6 | Information flow (inputs → outputs) | SPARK-style dependencies | Exact in its conservative form |
| 7 | Null, bounds, overflow, division (abstract interpretation) | Cousot | Undecidable: proven, possible or can't tell |
| 8 | Cross-reference | clangd index | Exact |
| 9 | Coverage: statement, decision, MC/DC, LCSAJ | DO-178C, ISO 26262, Woodward and Hennell | Exact measurement |
| 10 | Target run-time library (C) | — | Exact |
| 11 | Unit-test harness: drivers and stubs, host and target | — | Exact |
| 12 | Test-input generation (symbolic, z3) | — | Best effort; can't promise every branch |
| 13 | Requirements traceability: ReqIF/CSV import, matrices | DO-178C, ISO 26262, IEC 61508, EN 50128, IEC 62304 | Exact |
| 14 | Visuals: findings on the flow, coverage as light, a value's journey, metric rings, compliance board | Our visual language | Mock-ups first |
| 15 | Qualification kit (DO-330) | DO-330 | Evidence we can produce; acceptance is decided per project by the certification authority |

**Order:**
1. **First release:** parts 1–5, 8 and 14.
2. **Then:** parts 9–11.
3. **Then:** 6, 7, 12 and 13.
4. **With certification work:** 15.

**Automotive (ISO 26262) qualification kit**, if the user has ISO 26262 Part 8 (clause 11):
- **Tool classification:** tool impact and detection, giving TCL1–3, prefilled for typical uses.
- **Qualification plan and report.**
- **Validation suite:** known-answer tests for every rule, metric and coverage type, runnable on the customer's machine and compiler.
- **Tool manual:** configuration and known limits per check.
- **Development-process evidence.**

Qualification methods (ISO 26262-8, Table 4):
- **1b, process evaluation, and 1c, tool validation:** both targeted.
- **1a, confidence from use:** comes later, with field history.
- **1d, developed to a safety standard:** only if needed.
- **External certificate** (e.g. TÜV SÜD): optional.

**Process from the first line of SkyFlowX code** (needed for 1b; much harder to add later):
- a written spec per rule, metric and check, each with tests that trace back to it
- recorded reviews
- CI on every change
- versioned releases with release notes and validation results

**Proof:**
- the NIST Juliet suite
- the MISRA example suite
- coverage checked against gcov and llvm-cov
- the smoke projects
- every rule and metric tested against hand-worked answers

## Next: speed (confirmed)

Goal: everyday use (open, step, zoom, search) within about 1.2–2× of a native app, often indistinguishable.

1. **Draw on a canvas, not page elements.** Boxes and sequence drawn from one scene description by two renderers:
   - **Canvas 2D: the baseline.** It runs on the CPU, so it works on machines without a GPU.
   - **WebGL: used only on real hardware.** Detected at start-up; never Chromium's software WebGL (SwiftShader), which is slower than Canvas 2D on CPU-only machines.
   - **The same picture either way.**
2. **Background workers.** Parsing, layout, analysis (findings, facts) and searches run off the window's thread, so it never waits. **Layout done 2026-11-01** (ELK in a worker, identical layouts checked); searches already run in the main process.
4. **Reuse clangd's index between visits.** A project opened before shows its flow in a second or two instead of waiting for indexing again. **Done 2026-11-01:** the last settled picture is kept and shown at once while the live build confirms it (FLOW-DESIGN §10b); ThreadX 0.3–0.5 s.

(3, native/WebAssembly pieces for hot loops (tree-sitter, a compiled layout engine, a ripgrep-style scanner), is only
added where measurements show a bottleneck.)

## Next: smooth, jitter-free animation (confirmed)

Target: a steady 60 fps (120 Hz where the display has it) with no visible jitter, with or without a GPU.

1. **One animation clock:** `requestAnimationFrame` drives play, scroll-follow, the return arc and the Tab glide. Positions come from elapsed time, so a late frame catches up instead of stuttering. This replaces today's mix of timers, CSS transitions and the Web Animations API.
2. **Nothing heavy mid-animation:** positions are computed before a move starts, text sizes are cached, and heavy work runs in the workers above.
3. **Text drawn once, then moved:** labels are pre-rendered (a glyph cache), so moving text doesn't shimmer; at rest it snaps to whole pixels.
4. **No garbage-collection stalls:** objects are reused inside the animation loop.
5. **Scroll-follow yields to the user:** any scroll or drag cancels an automatic move at once.
6. **Adaptive detail under load:** on a long frame, extras (shadows, faint lines, minimap) are dropped while moving and restored at rest.
7. **Smaller fixes:**
   - no background timer throttling during play
   - fonts loaded before the first frame
   - reduced-motion and battery-saver modes kept

**Checks:** smoke runs record frame times for play, zoom, stepping and the Tab glide, and fail when the slowest 5% exceed 16.7 ms. Every run is checked twice: normally, and with the GPU switched off.

## Final step before the first SkyCodeX release (confirmed 2026-11-01)

After everything else is complete for the initial release: a deep, line-by-line optimisation of the whole
application for the highest reachable speed, keeping **every feature and its working procedure exactly as they are**.
Behaviour must stay 100% identical to the unoptimised SkyCodeX, checked by the full test suite, every smoke scenario
and before/after comparisons of their reports.

**Before it starts (2026-11-01):** ask the user first; they will give important points for this phase, and work begins only after that.

**ThreadX benchmark, before (2026-11-03).** The `large` scenario on Eclipse ThreadX, GPU on and off, each 3 times cold (no index, no kept picture) then kept (the cold run's index and picture); medians of 3. The "after" run uses the same script.

| Measure | GPU on, cold | GPU on, kept | GPU off, cold | GPU off, kept |
|---|---|---|---|---|
| first picture (flow) | 13.3 s | 0.83 s | 12.2 s | 0.57 s |
| full run once clangd has indexed | 159 s | 31.9 s | 285 s | 33.4 s |
| programs list | 3.5 s | 0.50 s | 3.3 s | 0.50 s |
| preview cards | 0.52 s | 0.75 s | 0.50 s | 0.76 s |
| sequence step, median / slowest | 29 / 33 ms | 28 / 107 ms | 30 / 77 ms | 36 / 128 ms |
| frames p95: sequence step · play | 17.7 · 17.7 ms | 17.7 · 17.7 ms | 34.1 · 32.6 ms | 100 · 33.6 ms |
| frames p95: boxes play · zoom all · Tab glide | 17.6 · 17.6 · 17.5 ms | 17.7 · 17.7 · 17.6 ms | 17.6 · 17.6 · 17.6 ms | 17.7 · 33.5 · 17.7 ms |
| whole scenario | 218 s | 71 s | 301 s | 73 s |

Cold runs vary most (whole scenario 174–374 s with the GPU, 179–712 s without): almost all of it is clangd's background index, which runs at low priority.

**Optimisation applied (2026-11-03),** found by `/basis:optimize` from the basis record of SkyCodeX, both in `src/shared/flowrun.ts` and both giving exactly the same results:
1. `Analyser.deepest` (with `within`, `before` and `off`, 26.2% of the traced time) compares each syntax-tree node's range as numbers worked out once per node, in the same order and with the same tests; it falls back to the old comparison if a position can't be keyed exactly.
2. A file's line starts are worked out once and reused by every function of that file, not once per function.

Checked: typecheck clean; 228 tests pass; the old and new engine give byte-identical output on all 92 recorded functions of 10 flow fixtures. Not taken: narrowing the `ParmVarDecl` search in `flowfacts.effects` (12.7%), which changes which nodes are searched and so needs a proof first.

**ThreadX benchmark, after (2026-11-03).** Same script and steps as "before"; medians of 3, all 12 runs passed.

| Measure | GPU on, cold | GPU on, kept | GPU off, cold | GPU off, kept |
|---|---|---|---|---|
| first picture (flow) | 5.4 s | 0.53 s | 6.0 s | 0.53 s |
| full run once clangd has indexed | 84 s | 64.4 s ⚠ | 128 s | 34.1 s |
| programs list | 1.5 s | 0.50 s | 1.6 s | 0.50 s |
| preview cards | 0.50 s | 0.50 s | 0.50 s | 0.50 s |
| sequence step, median / slowest | 29 / 69 ms | 29 / 57 ms | 29 / 60 ms | 29 / 62 ms |
| frames p95: sequence step · play | 17.6 · 17.6 ms | 17.6 · 17.5 ms | 17.6 · 17.6 ms | 17.7 · 17.6 ms |
| frames p95: boxes play · zoom all · Tab glide | 17.6 · 17.6 · 17.6 ms | 17.5 · 17.6 · 17.5 ms | 17.6 · 17.6 · 17.5 ms | 0 ⚠ · 17.6 · 17.7 ms |
| whole scenario | 125 s | 76 s | 169 s | 71 s |

Gains: the cold first picture is 2.0–2.4× faster (13.3 → 5.4 s, 12.2 → 6.0 s), the programs list 2.1–2.3× faster, the full cold run 1.9–2.2× faster, and without a GPU every animation now holds 17.6–17.7 ms (sequence step was 34.1 and 100 ms).

**Recorded as is, not yet explained (⚠):**
- GPU on, kept, full run once indexed: 31.9 → 64.4 s (runs 64.4, 80.9, 49.7 s; before 31.6–32.6 s). Possibly the faster cold run ends before clangd has finished writing its index, so the kept run indexes more; GPU off, kept is unchanged (33.4 → 34.1 s). Not proven.
- GPU off, kept, boxes play: two of three runs measured no frames (n = 0; the third 17.6 ms). The smoke scenario still passed; whether the animation ran unmeasured or didn't run is not known.

**Larger codebases, one cold run each (2026-11-03),** after the optimisation, `large` scenario, no errors:

| Measure | LLVM (`llvm/` + `clang/`, 2.2 GB) | RTEMS (276 MB) |
|---|---|---|
| sources listed | 20,000 (the list's cap) in 278 ms | 8,962 in 103 ms |
| programs list | 8.2 s, 4 programs | 5.3 s, 11 programs |
| first picture | 2.0 s (1 function) | 10.0 s (311 functions, 71 files) |
| full run once indexed | 32.5 s | 206 s |
| preview cards | 0.25 s | **timed out (90 s)** |
| frames p95 · slowest | 17.4–17.7 · 17.7 ms | 17.5–17.7 · **650–667 ms** (sequence play, Tab glide, boxes play) |

What the design still misses at this size (to improve over time):
1. **LLVM:** only the first 20,000 source files are listed, so programs are looked for only there; the 4 found are test inputs, and the picture drawn is one function. Real LLVM tools (`clang`, `opt`, `llc`) are never offered.
2. **RTEMS:** the preview cards for `bsps/aarch64/a53/console/console.c` did not arrive within 90 s.
3. **RTEMS:** one frame of 650–667 ms in three animations (the 95th percentile stays at 17.7 ms).

## Later

- **Remaining analyses** (FLOW-DESIGN §8b):
  - watch a variable (done 2026-11-01)
  - a value's journey (done 2026-11-01)
  - pairs that don't close (done 2026-11-01)
  - configurations (done 2026-11-02: if constexpr ghosts; other build folders or macros read by a hidden window with its own clangd; samples/configs, src/tests/configs.test.ts, smoke `configs`)
  - values settled per call (done 2026-11-02: samples/values, src/tests/values.test.ts, smoke `values`)
  - errors only (done 2026-11-01, as ways out)
  - what a change does (done 2026-11-02: the files on disk or a commit against an older commit, read-only from git; samples/change, src/tests/change.test.ts, smoke `change`)
- **Facts cached on disk.** Done 2026-11-01, with the kept picture.
- **Windows and Linux:** a real run on each system, then the first SkyCodeX release (ask before any release build).
- **A large C++ project tested** (thorvg- or LLVM-sized).
- **README:** updated 2026-11-03 for every current feature (the analyses, configurations, what a change does, checked fixes) and the SkyCodeX file names; the version and sizes go in with the first SkyCodeX release.
- **SkyCodeX 1.5:** Rust, Ada and other languages.
- **Claude in SkyCodeX (considered 2026-11-05, for later):** opt-in, off by default, the one exception to the offline rule. Preferred shape: SkyCodeX runs a local MCP server so Claude Code can ask it for flows, findings and checked fixes (short exact answers instead of reading many files), with Claude Code optionally hosted in a panel. Separate from the editor, never calls in the background, sends only exact pieces, shows a request's size first.
