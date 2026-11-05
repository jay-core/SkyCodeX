# Flow views (grid and metro), the approved UX changes, and the reliability fixes: the plan

Decided 2026-11-05. **Not implemented yet**: building starts on "SkyCodeX execute!". Mock-ups in [mockups/flow](mockups/flow).

## 1. What is decided, exactly as approved

### The two flow views are renamed
`sequence` becomes **metro**, `boxes` becomes **grid**. Tab still switches between them and keeps the step. The old names are removed from the interface, settings, smoke scenarios and docs (a setting saved with the old name is read as the new one).

### Metro ([metro.png](mockups/flow/metro.png))
- **Left: the metro line.** Each file is a line colour (legend above); each step is a station; one lane further right per call level. Ridden stations solid, later ones faded, a call again is a dashed ring, the current station gold with a halo. The line scrolls with the rows (scrollbar on the left edge, "▲ steps 1–6 above", "▼ steps 20–30 below", Home goes to the start).
- **Rows, four columns** under small headings: step and ƒ number (↻ on a call again) · *who calls → the call as written* (real arguments; the loop or condition around it quoted as written) · *result goes to* (`→ headers`, `→ each line`; an ignored result in orange, "Response unused") · *notes* as chips (pure; writes a global; reads shared state; result thrown away; ⇢ new thread; next: empty → return 400; then called through a pointer; the author's comment, quoted).
- **Chapters** named by the real loop as written (`while (running_ && socket_.accept(req))`), with a summary: steps, functions, files, calls through a pointer, results thrown away, "you are here".
- **The current step opens into a card** (gold edge): passes in · gets back · inside (the loop) · inside the function (its loops) · then (where the run goes next) · findings.
- **Integrity rule:** every word comes from clangd (calls, types), the parser (loops, conditions, comments) or SkyCodeX's existing analyses (value journey, shared state, results thrown away, exits). Nothing is paraphrased or guessed; what cannot be resolved says so ("calls through a pointer, target not known"). Rows are built only for what is on screen (plus a margin); repeated loop passes fold ("passes 2–200 repeat this"); chapters fold on very long runs. Same code, same text, offline.

### Grid ([grid.png](mockups/flow/grid.png))
- Called functions as **rows**, calling functions as **columns**, both grouped under coloured **file bands**, names horizontal (ƒ number above the name).
- Each square holds that call's **steps** (done dim, current gold, ↻ again); a call inside one file is tinted in the file's colour; empty squares show a faint dot.
- Each row ends with a **"called ×N"** bar; each column shows **"N calls"** it makes.
- A **crosshair** follows the current call; sort **by file / run order / most called**; large projects show **files × files** first, a click opens a block's functions.

### Shared by both views
- **Details box** at the bottom of the right pane, linked from the selection by a fine **dotted gold line** ([details-link.png](mockups/flow/details-link.png)): for metro, the step's facts and where each came from; for grid, the call's calling lines, files and enclosing loop.
- **Code preview** ([code-preview.png](mockups/flow/code-preview.png), the right pane): **STEP N of M** (only counts up) and **ƒN name · Kth call** shown separately; "from ƒ… caller · file line" with the calling line, a connector into the callee's whole definition; the body walked line by line at the play speed (run lines bright, current gold, not yet run dim, so dead code shows); ⌘/Ctrl-click works there.
- **Play controls:** ⏮ goes to the start **paused**; ▶ plays from where you are; speeds 0.25× to 3×.
- **Run bars** ([run-bars.png](mockups/flow/run-bars.png)): green first call · blue called again · purple via a pointer · outlined pale gold now · shaded band in a loop · orange dot edited · gold line a note · taller = deeper; − / + zoom, scroll, click to go.
- **Following the probe:** continuous, inside a follow zone; never in jumps; settles on the whole target.

### Editor (all windows)
- **⌘/Ctrl-hover** ([hover-fonts-controls.png](mockups/flow/hover-fonts-controls.png)): one distinct underline with a "where it leads" tag in the editor, preview panes 1 and 2, the flow's code preview and route cards; nothing underlined when there is nowhere to go; a failed click always says why.
- **⌥-click** peeks a definition inline under the line.
- **Preview card headers** sized from the preview size; **font picker** listed on focus, each font in its own face, a monospaced filter.

## 2. Code scan (2026-11-05): what can break or behave unexpectedly, and the fix

Ranked by how much a user can feel it.

| # | Where | What happens | Fix |
|---|---|---|---|
| 1 | `renderer/lib/preview.ts` `scheduleRetry`, `focusCard` | While clangd settles, a retry clears the focused card (`focus: -1`) and rebuilds: **the preview deselects every 1.5 s for up to 30 s** (the Linux and Windows reports; every OS). One shared `retryTimer` also lets one retry cancel another. | Rebuild **in place**: keep level, each pane's focus and pins; replace a card only when its text changed. One timer per key. Stop retrying a card once clangd confirms its body is in a library. |
| 2 | `preview.ts` `generation` | `refreshForCursor` and `focusCard` share one counter: **a card click during a cursor refresh is silently dropped**, and a refresh during a click is dropped too. | Separate counters per level (cursor → level 0, click → level n); a newer request cancels only older requests for the same level. |
| 3 | `main/lsp.ts` exit, `renderer/lib/lsp.ts:46` | If clangd crashes, the state becomes "failed · clangd stopped" and **every feature stops until the user refreshes**. | Restart automatically once (then with back-off), reopen the open files, keep the message visible; after two crashes in a minute, stop and say why. |
| 4 | `main/main.ts:288`, `main/lsp.ts:138` | A malformed or half-written `compile_commands.json` throws inside the IPC handler: Configurations and "what a change does" **fail with no message**. | Parse inside try; name the file and the problem in the message. |
| 5 | `main/lsp.ts:127, 148`, `main/main.ts:291`, `main/packs.ts:179` | Generated compile commands and the pack manifest are written in place: **a crash mid-write leaves a half file** that clangd or the pack list then reads. | Use the existing `atomicWrite` everywhere a file is read back later (exports chosen by the user too, `fs:writeBase64`). |
| 6 | `Card.tsx`, `SeqCode.tsx` | ⌘/Ctrl-click works in preview cards but **no underline appears**; the flow preview's click is reported not to work; **a failed click does nothing, silently**. | One shared "go to definition" extension for every code view (hover underline + tag, click, ⌥-click peek, reason on failure); a smoke run that clicks every resolvable name in every window. |
| 7 | `styles.css:134` `.card-h` | Fixed 24 px header: **titles clip** when the preview size is raised. | Height and font from `--preview-scale`. |
| 8 | `PlayControls.tsx` restart | ⟲ goes to the start **and plays**. | ⏮ goes to the start paused. |
| 9 | Settings font field | The list appears **only after typing**. | Show the list on focus (installed fonts, each in its own face). |
| 10 | Flow follow (FlowBoxes, Sequence) | The view follows the probe **in jumps**. | Continuous follow inside a zone (both views share one follower). |
| 11 | Typeface change | Not yet checked that **no layout breaks** with other fonts and sizes. | Extend the `fonts` smoke run: several typefaces × sizes × interface scales; every screen captured and checked for clipping and overlap. |

Checked and fine: saving is atomic and unsaved edits are mirrored (`fs:write`, buffers); damaged buffers are skipped; event listeners are removed or die with their elements; no stray intervals; the four empty catches are deliberate (font preloading, waiting on a build).

## 3. How it is built without breaking anything

**Rule: zero unexpected behaviour.** Every change either keeps what a user sees today, or changes it exactly as approved above. Nothing else moves.

1. **Fixes first, then features.** Section 2's fixes land first, each with a test that fails before and passes after. Only then the views.
2. **One engine, two views.** Metro and grid read the same run (`flowseq`) the current views read; no new tracing. The run's step numbers, ƒ numbers and call counts are computed once in `shared/` and tested, so both views and the code preview always agree.
3. **Facts layer, tested.** The metro's sentences, results and notes come from one pure function in `shared/` (input: the run and the parsed code; output: rows). It has known-answer tests on `samples/tinyhttp` and the other samples, and a property test: every name, number and quoted piece of code in a row must exist in the source at the stated place.
4. **Scale budget.** Rows built for the visible window only; grid squares for visible blocks only; 60 fps scrolling and stepping on ThreadX (3,400 files) is a gate, measured by the existing `large` smoke run.
5. **Renames done once, everywhere.** `sequence`/`boxes` become `metro`/`grid` in code, settings (old values still read), smoke scenarios and docs in one change; a test checks no old name is left in the interface.
6. **Every screen checked in the real app.** New smoke scenarios `metro`, `grid`, `details`, `goto` (⌘/Ctrl-click everywhere), `preview-stable` (selection survives 30 s of clangd settling), `typefaces`; screenshots compared with the approved mock-ups.
7. **All three systems.** Unit tests and smoke runs on macOS locally; Windows and Linux through the release workflow's boot check before any release.
8. **Nothing written into projects.** As today: data folder only.

**Order:** 1 preview stability and races (#1, #2) · 2 clangd restart, safe parsing and atomic writes (#3–#5) · 3 go-to-definition everywhere (#6) · 4 small fixes (#7–#9) · 5 shared run numbers and facts layer · 6 metro · 7 grid · 8 details box, code preview, run bars, follow · 9 typefaces check and the full smoke set · 10 release.
