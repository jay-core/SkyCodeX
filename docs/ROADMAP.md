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
| 2026-10-30 | **Target for results:** match what the standards define and what industry expects of reliable analysis. Every check has a written spec and test cases with known answers. |

## SkyFlowX (confirmed, not started)

The full specification is in [SKYFLOWX-TASK.md](SKYFLOWX-TASK.md); ideas we discover together are recorded in [discoveryAndConnection.md](discoveryAndConnection.md).

**Shape:**
- One Rust program, `skyflowx`, built on **clang** (libclang) for parsing.
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

## Later

- **Remaining analyses** (FLOW-DESIGN §8b):
  - watch a variable
  - a value's journey
  - pairs that don't close
  - configurations
  - values settled per call
  - errors only
  - what a change does
- **Facts cached on disk.** Done 2026-11-01, with the kept picture.
- **Windows and Linux:** a real run on each system, then the first SkyCodeX release (ask before any release build).
- **A large C++ project tested** (thorvg- or LLVM-sized).
- **README:** still describes the 1.0 downloads; update it with the first SkyCodeX release.
- **SkyCodeX 1.5:** Rust, Ada and other languages.
