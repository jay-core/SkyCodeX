# SkyCodeX — flow view design

The decisions made so far for SkyCodeX's primary function: a bird's-eye view of how any codebase runs, with the compiler's own index behind it. This is the reference for implementation; `docs/ARCHITECTURE.md` keeps the earlier history. Working prototypes are in `src/concepts/flow/` (see the last section); images are in `docs/concepts/flow-sequence/`.

## 1. What SkyCodeX is

- **One job:** reading and understanding how code runs, in codebases of any size (up to VxWorks-class systems). Writing and saving code stay; the editor extras are gone (removed after 1.0: memory view, run with checks and profiler, terminal, templates, C++ reference, to-do list, spell-check, code style, problem reports, translations, help and tour).
- **Exact, not guessed:** the compiler's view (clangd: syntax tree + index) is the source of every call, loop, condition and sentence shown. Headers open with ⌘/Ctrl-click, standard ones included.
- **Offline:** nothing is sent anywhere. Language packs are the only optional download.
- **Folder tab** beside flow, so the folder's files are reachable before any file is open (built).
- **Visual language:** the current one stays the base — charcoal, borderless, Metro-style type (Selawik, ArX F1), the current boxes, preview cards and colours. New views follow it.
- **Name:** SkyCodeX (renamed from Lithograph; 1.0.0 was released under the old name).

## 2. The analyser

Built and checked in the prototype (tinyhttp and thorvg).

| Fact | Source | Cost |
|---|---|---|
| calls, in order, with exact callees | `callHierarchy/outgoingCalls` (clangd's index — no file needs to be open) | < 1 ms per function |
| loops, conditions, returns, every statement | `textDocument/ast` (clangd's syntax tree, macros expanded) | 7–12 ms per function |
| full function ranges | `textDocument/documentSymbol` | first parse of a file 0.3–0.5 s, then cached |
| where each call sits | `fromRanges` of outgoing calls | — |

- **Folders without `compile_commands.json`** get one written into SkyCodeX's state folder (never the project): every source file, every folder holding headers as an include path; a toolchain pack's compiler and headers when installed (`--query-driver`). Already in the app (`src/main/lsp.ts`).
- **Crawl in parallel:** many requests in flight (24 in the current flow engine); numbering happens afterwards, in memory. Cache the graph and per-function facts on disk, keyed by file content, so reopening is instant and edits recompute only what changed.
- **Only what is shown:** on large codebases, functions are analysed when they scroll into view or are stepped into; the rest is fetched in the background.
- **Built:** `src/shared/flowrun.ts` (pure; `analyseFunction` per function, `walkRun` for the numbered run), wired in `src/renderer/lib/flow.ts` (`buildRun(laneStart)`: syntax trees fetched file by file, cached by the file's text). Tests: `src/tests/flowrun.test.ts` on clangd output recorded by `src/tests/fixtures/record-flow.mjs` (tinyhttp end to end, and `fixtures/rules/rules.cpp` — one function per rule), every expectation worked out by hand; the boot check runs it through the app's own clangd.
- **Evaluation order (built, tested):**
  - arguments before the call; the object before a member call; a `for`'s init once, then condition, body, increment on every pass; `do … while` body then condition;
  - the right side of an assignment before the left (C++17);
  - `&&`, `||`, `?:` make the right side / the arms conditional; `if` and `switch` arms (chained `case` labels, fall-through marked), `try` always starts and `catch` is conditional;
  - after an early `return` / `continue` / `break` / `throw` in one arm, the rest of the block is a **guard** ("runs only when that exit was not taken"); after an unconditional exit, nothing runs;
  - two arguments that both call project functions are marked **unsequenced** — the language leaves their order to the compiler; the view must not present one order as fact;
  - a static local's initializer runs **once**; a lambda's body runs **when called**, or on a **thread** when the lambda (or a function) is handed to `std::thread`, `pthread_create`, `xTaskCreate`, `taskSpawn` and the like;
  - indirect calls are kept and labelled: through a **pointer**, a **member pointer**, a **std::function**; **dependent** inside templates; **unresolved** where the compiler gave up (a missing include or define — never guessed);
  - the syntax tree overrides the index: clangd's index names `operator*` on `float * float` (thorvg's `atan2`: 64 such places); a call the tree shows as a built-in operator is **dropped** and counted;
  - calls inside a macro (thorvg's `PAINT_METHOD`) are placed at the statement that holds the macro, marked approximate — clangd gives no finer position.
- **Checked on thorvg** (from `Canvas::draw`): 54 steps, 55 references, 0 analyser errors, 12 calls placed by statement (all inside dispatch macros), 3 unresolved (from the generated build settings), 64 false calls dropped; syntax trees ~55 ms each on first parse, the walk under 1 ms.
- **Rules learned in the probe (must stay):**
  - a range-for's range is read once, before the loop — only its body repeats;
  - an `if`'s condition always runs — only its branches are conditional; the decision sits after the calls inside the condition;
  - a function used as a value (`return not_found;`) is not a call — a call is a name followed by its arguments, confirmed against the syntax tree;
  - calls through `std::function`, function pointers and virtual methods are shown as indirect (`⇢ through a pointer`, `⇢ 3 overrides`), never dropped;
  - a dispatch macro (thorvg's `PAINT_METHOD`) that can reach several targets shows all of them;
  - one-line helpers and operators fold into their caller's line (`uses trim, split +3`);
  - a call already shown is a reference, not a repeat (`→ split 12`).
- **Entry points:** every `main` (found in the parse tree, so `void main()` inside a string is not one); for a library without `main`, its public API (`inc/`, `include/` headers). Later: threads and RTOS tasks (`std::thread`, `pthread_create`, `xTaskCreate`, `taskSpawn`), interrupt handlers (`intConnect`, `*_IRQHandler`, vector tables), VxWorks start-up (`usrRoot`, `usrAppInit`), callbacks in tables.

## 3. Views

- **Sequence (the user's preferred view, the default):** time runs down, one row per step. Columns are files on small projects and call depth on large ones (one column right per call; the file as a small tag). A bar in a column means that function is still running, so later steps visibly start from it — this is what makes returns understandable. Loops are dashed frames around exactly the rows that repeat; conditions are notes on the row they guard (`? renderFlag & Transform`) on large projects, frames on small ones. Threads start with a dashed arrow.
- **Boxes:** the box-and-arrow view (files, functions inside them when zoomed in) for *where* code lives and how files depend on each other. One key apart from the sequence (Tab); the choice is remembered, and both views share the selected step. Full spec in §3b.
- **Considered and dropped:** a sector map (folders and files as regions around the start, contour rings for call distance, values as threads). Two views are enough: sequence and boxes. The data-flow facts it would have shown (a value renamed as it is passed on, `req.raw → raw → s`) belong in the fact engine and the variable watch instead.
- **Programs:** when a project has several `main`s, a top view with one box per program, a "shared code" box (files used by more than one program, with how many each uses) and arrows where one program starts another (`system`, `exec…`, `CreateProcess`, … whose string names another program). Click a program for its own flow. Build-target names come from CMake and Meson files (`src/main/targets.ts`).

## 3b. The boxes view

Mock-ups: `docs/concepts/flow-boxes/` (tinyhttp and thorvg, real data). Prototype: `src/concepts/flow/boxgen.mjs`.

**Built (2026-10-30)** — `src/renderer/components/FlowBoxes.tsx`, model and layout in `src/shared/flowboxes.ts` (pure, tested on the real tinyhttp run in `src/tests/flowboxes.test.ts`):

- **From the run:** the same run the sequence walks. Files that run are boxes; the functions that run are rows in step order, with the loops each owns under it. Every call between files is a straight (ELK orthogonal) line from the caller's row to the callee's row. Calls inside one file get no line. Thread starts are dashed.
- **Numbers on every line, readable at every zoom:** a label carries the step numbers of the calls the line stands for (`15`, `→12 ×2`, four then `+n`) and keeps about 11 px on screen however far out you zoom. A label always sits on a straight stretch of its own line, right-aligned before the arrowhead, never inside a box. Lines ending at the same row share one label (`22 · →22`). When room runs out, a label shortens to its first and last numbers and a count (`6…22 ·4`; the full list is its tooltip). Tested at every zoom from 30% to 250%: no label over a label or a box, every label on its line; the boot smoke check audits the same on screen.
- **Scale and scroll:** fit all · fit width · 100% · 150% · − / + (⌥ + / ⌥ −, ⌥ 0, ⌥/⌘/ctrl-wheel or pinch around the pointer), plain wheel and trackpad scroll, drag empty space to pan, a minimap when the diagram is larger than the view. The choice is remembered; the first time, fit width if the functions stay readable there, else 100%. Zooming keeps the spot under the pointer in the same file's box.
- **Semantic zoom:** functions from 70% (rows ≥ 9 px), files from 40%, folders below (down to 30%). Zoomed out, a box's words keep their size on screen (`--inv`), and boxes and the gaps between columns are sized for the words and numbers at the smallest zoom their level shows. Files level: `N functions run · used by M files`; folders level: one box per folder, one line per pair of folders. Clicking a box selects its first step; double-click zooms in on it.
- **One selected step with the sequence** (Tab keeps it): the row is amber, its call chain warm, the line into it amber; the loop line around it says `pass n`. The same keys move (→ ← ⇧→ ↑ R L ⇧← ] [ Home End), Enter opens the code, and the view follows the step with a Metro-style scroll (fast start, long settle) only when it would leave a comfortable frame. The preview pane is the sequence's (`StepPreview`).
- **Every route between two functions:** shift-click a second function (either direction). The routes' rows and lines light (flowing dashes), everything else steps back; the preview pane lists each route, how often it is taken and the loops and early exits it passes (`past if (headers.empty()) → return`). 1–9 shows one route, Enter or "walk it" sends a marker along it lighting each function as it arrives, Esc clears.
- **Play (Space):** a marker moves along the lines from step to step — up the lines it came in on for a return, down for a call — dim on the lines, the row lighting as it arrives, the view scrolling ahead when the next step is out of sight. A loop whose count is known goes round exactly that many times; one whose count is known only at run time goes round once and says so. + / − change the speed.
- **Focus (F):** a function and two calls around it; the rest fades. **How often (H, or the chip):** each row shaded by the loops around it (`once`, `×4`, `2 loops`). **Follow a line:** click it to select the other end. **Export:** the diagram as drawn, as an SVG picture.

**Two zoom levels, one graph.** Layout is ELK layered, left to right, orthogonal lines (as in the app today). The start file is on the left with `start ▸`.

- **Files** (zoomed out): one box per file — name, folder in small type, `N functions · M run`, `↻ k` when it has loops, `used by N files` when several files call it.
- **Functions** (zoomed in, ⌥ + / ⌥ −): the same boxes grow and list their functions **in execution order**, each row with its step number. Under a row that owns a loop: a teal line `↻ 9–22 · while (running_ && …)` (with `×4` when the count is known). A row's repeat calls show on its right, small (`→ trim 13`). Functions in the file that never run are listed last, dimmed, with the reason (`not_found · used through a pointer`, `cgi_main · nothing calls it`).
- **Lines between rows:** zoomed in, every function row is an ELK port (in on the left, out on the right, at the row's height), so each call line runs from the caller's row to the callee's row and ELK routes it around every box. Calls inside one box get no line — the numbers already show the order. Thread starts are dashed (violet-grey).

**Large projects.**

- **Folders:** files sit inside dashed folder frames (`SRC/RENDERER`), laid out as one graph (ELK `INCLUDE_CHILDREN`), so lines cross folders cleanly.
- **Shared utilities:** a file called from 3 or more other files (`tvgMath.h`, `tvgArray.h`) gets no lines at all. Its box says `used by N files`, and hovering a caller lights the step numbers inside it. This keeps hubs from turning the graph into a web.
- **Unreached files:** files the flow never reaches are not boxes in the graph. A shelf under it says `+653 files not reached from this start · listed in the folder tab, greyed`. A reached file with no running function (`legacy/cgi.cpp`) sits on that shelf as a dashed box: `not reached from main`.
- **No wrapping:** the graph is never wrapped into rows. Tried, and it sends lines around the whole graph. Wide graphs scale down to fit width, and zooming in follows the selection.

**Hover (files level).**

- The lines of the hovered box turn amber; the others fade.
- **Numbers on the lines, always** (decided 2026-10-29): every line carries the step numbers of the calls it stands for (`15`, `→12 ×2`; four, then `+N`), at every zoom (kept at a readable size when zoomed out). The label sits just before the arrowhead, right-aligned, so it never enters the box; lines that end at the same row share one label (`22 · →22`). Hovering or selecting lights the numbers on its lines and steps the rest back. The app's current boxes view does this now; the rework keeps it.
- The hovered file's functions show in a small list beside the box, placed below, right, above or left — wherever it covers no other box — or not drawn at all. The preview pane always lists them with `file:line`.

**Stepping in boxes** (same walk, keys and state as the sequence; Tab switches and keeps the step).

- **Rows:** the selected row is amber with a 3 px bar; back and next rows are tinted with `← back` / `next →`; the last 4 steps are an ember trail (fading amber numbers). Boxes on the current call chain get a warmer border.
- **Lines:** the line into the current step is amber. Lines on the call chain are dim amber, the rest are grey.
- **Returns:** when the next step is not called from here, the route back is drawn **along the lines it came in on** (dashed amber, already routed around boxes), and the caller's row says `↩ returns here`. It is never a free curve across the graph.
- **Loops:** inside a loop, the loop line lights teal and says `· pass 2`; another pass runs a teal sweep across the box.
- **Header:** step `14 / 23`, only the innermost loop's pass (`pass 2 · while (!s.empty()… · in 2 more loops`), then the last three names of the call chain.
- **Race:** a hairline red crack on the box's right edge joins the two rows, with `counters_ · two threads, no common lock`.
- **Preview pane:** the step's code with the next call's line highlighted, then the graded facts (`called from`, `calls`, then engine facts; risk in red).
- **Spine:** the 3 px spine on the right edge is the same as in the sequence.

**A tagged row keeps one note:** when a row shows `← back` / `next →` / `↩ returns here`, its small `→ uses` note is hidden, so the row never runs past the box edge.

**Audit:** the §5b collision audit covers this view too. It checks text against text, and **any line through text**. 0 collisions across all 23 tinyhttp walk states and the thorvg files view.

## 3c. Ideas for both views (proposed, not built)

Demo: `docs/concepts/flow-ux/flow-ux-ideas.mp4` (1:51), played in the real app on the real tinyhttp run: `src/concepts/flow/ux/` (`data.ts` writes the run from the recorded clangd fixture, `ux.ts` draws each idea over the live sequence view, `record-ux.cjs` records it).

- **Sequence:** 1 quieter structure (only the current chain keeps its bars) · 2 return route (dashed, back through the caller's bar) · 3 code in the box (the lines around the call) · 4 peek (hover a row for its code) · 5 breadcrumbs (the whole chain, clickable) · 6 chapters on the spine (from main's own calls and loops) · 7 fold a big call into one row with a mini spine · 8 search and paths (find a function, pick a path from main, → follows it) · 9 compare (with what-if) · 10 readable dimming (.55) · 11 share a walk (link, walkthrough export) · 12 tour (plays, waits at loops and decisions) · 13 motion (glide in, arc out).
- **Boxes:** 1 built from the run (rows in run order, lines row to row) · 2 one selected step shared with the sequence · 3 semantic zoom (functions → files → folders, each level readable) · 4 every route between two functions (routes light, the rest steps back; the list says what each route passes through; → walks it) · 5 focus (two levels around a function) · 6 how often (shade from the loops around a row) · 7 entry points left, helpers right · 8 folder frames and a minimap · 9 follow a line · 10 export · and **fit width / fit all / 100% / 150% / any scale, with scrollbars and a minimap** when larger than the view.
- **New:** what-if (flip a condition: what it skips folds away) · depth skyline (the run as a profile of call depth, drag to scrub) · jump letters · what you've read · margin notes (travel with the link) · change ripple (where an edited function runs, and the chains that reach it) · loupe (read a small diagram at full size).

## 4. Rows and boxes (sequence)

- **Selected step:** a full box on rows of its own, across the canvas, pushing the rows below down — nothing can be covered. It holds: the summary (the function's own comment, else its signature), badges, and facts (called from, calls as clickable numbered chips, what is inside, how often it runs).
- **Back and next:** partial boxes — one line: number, name, `file:line`, `← back` / `next →`.
- **Everything else:** lines (number, name, folded helpers). Steps off the current path dim.
- **Pinned steps:** stay as boxes (summary + badges).
- **The function the selection belongs to:** its bar lights; its rows get a faint outline.
- **Returns:** when the next step is not called from the current one, a dashed line shows where control goes first (`back in handle`).
- **End of the run:** a final marker (`end of the run · main returns`), counter `23 / 23 · end`.

- **Built (step 2):** `src/shared/flowseq.ts` (pure: rows shown, every move, layout, the box's facts; tests in `src/tests/flowseq.test.ts`), `components/Sequence.tsx` (the view, drawing only the rows near the viewport so any run size stays fast), `components/SeqCode.tsx` (the step's code with the line leading to the next step marked), `lib/flowstore.ts` (graph, run, walk and view shared by both views; Tab keeps the step). Files as columns when they fit (≤ 8, ≥ 150 px each), call depth otherwise. Folding: a helper of ≤ 3 lines that calls nothing folds into its caller's row only when it runs there unconditionally — a helper inside a loop or an `if` keeps its row, so no condition is hidden. A function's extent comes from its syntax tree (call items can carry the first line only). The boot check walks the view with real key presses and audits every state for text on text (0), and checks the views keep the step.
- **Not built yet:** P pin, F fold, / find, ⌥ → / ⌥ ← decisions, C / D / A detail levels (step 3), chapters on the spine, risk pixels (with the analyses, step 6), ↓ into an indirect call's candidates (with the engine gaps, step 7).

## 5. Detail levels (per function or everywhere)

| Level | Shows | → moves to |
|---|---|---|
| **C · calls** (default, bird's-eye) | calls only | next call |
| **D · decisions** | calls + `if`, `else`, `switch`, `return`, `break`, `continue`, `throw`, loop headers | next call or decision |
| **A · all code** | the code between calls too, dim monospaced rows in the function's column, indented by nesting | next statement |

- Set per function (open just `handle` to every line) or everywhere. On large codebases "all code" is built only for functions opened.
- A hidden row hands the selection to its function.
- Code rows never get boxes; the preview highlights the same line.

## 5b. Text never collides (any codebase)

Collisions come from a few sources; each has a rule, and a check enforces them.

1. **Every label has a slot of its own.** A loop's label gets a thin row reserved above the loop's first row (one per loop starting there, so nested loops stack); chapter names get their own row too. Labels never sit on rows.
2. **Rows never shift sideways.** A row wider than the room left keeps its column and fades out at the canvas edge; the full text is in the box and on hover. Nothing slides over another column.
3. **Floating labels look for space, or step aside.** A label like the race crack's tries places near its line; if every one would cover text, it is left out — its fact is always in the box too.
4. **Overlays sit under the open box**, which owns its rows; lines and their labels pass beneath it, never across it.
5. **Never say the same thing twice.** When a loop's own header row is shown (decisions or all-code level), its frame label steps aside and only the pass counter remains.
6. **The box is as tall as what it says** (summary plus one line per fact), so facts are never cut off.
7. **The check:** every piece of text is a box; any two that intersect are a collision. It runs on every layout in tests (each sample codebase, every state of a walk) and in debug builds. The prototype's audit took the three views from 6, 14 and 8 collisions to 0, and every state of a 17-step walk to 0.

Colour budget and motion grammar (the "cold" look):
- **Colour:** amber is "now" only; teal is repetition (loops, passes); a thin red is risk only (races, open pairs, leaks). Files and functions get no colour; position tells them apart.
- **Ink density for grades:** proved full tone; possible 60% with a dotted underline; unknown ghost tone. No badges.
- **Ember trail:** the last four steps keep a fading warmth.
- **Lines only near the eye:** no column lines; faint guides fade in around the current row.
- **Code rows as footnotes:** smaller, lighter, line numbers hanging in the margin, decision glyphs (`?` `↩` `↻`) in the margin column.
- **Motion:** one easing; forward moves the run up; into a call the box drifts in from the left, out of one from the right; back reverses exactly; a return is a falling arc that fades; the selected box unfolds from its row; a new loop pass sends one teal sweep and the counter rolls; play keeps a strict cadence; reduced motion turns all of it into crossfades.
- **The spine:** a 3-pixel strip at the right edge shows the whole run — calls as ticks, chapters as gaps, loops in teal, risks as red pixels, the current step as an amber dot; click to jump.
- **Threads** offset by a hairline, like stacked sheets; a race is a thin red crack between them.

## 6. Stepping

- **Back is a path:** ← retraces exactly what was walked, passes included. ⇧← jumps to the same step in the previous pass.
- **Loops:** one pass by default; at the end of a loop body, next leaves the loop; another pass is one key away. Fixed counts show `pass 1 of 4` and "skip the other 3". Nested loops nest their counters (`request 1 · header line 2 · space check 1`).
- **Static truth:** every pass takes the same steps statically; the counter only counts. Where a branch depends on data, the view says so (`if …`) instead of choosing.
- **The preview pane follows:** called-from line, the function's code with the line that leads to the next step marked, the ways on (next, step over, step out, leave, another pass) and back.

## 7. Keyboard

Every action has a key; the sequence canvas takes focus when the flow page opens and keeps it while stepping. Keys work with the mouse too (click a row selects it; click a chip jumps there).

| Key | Action |
|---|---|
| → / ← | next step / back along the path walked |
| ⇧ → | step over (skip this call's insides) |
| ↑ | step out (finish this function, back in its caller) |
| ↓ | step into an indirect call's first candidate (when there are several, a list opens) |
| ⇧ ← | previous pass of the innermost loop |
| R | another pass |
| L | leave the loop (skip its other passes) |
| ⌥ → / ⌥ ← | next / previous decision (`if`, `return`, `continue` …) |
| ] / [ | next / previous sibling call in the same function |
| C / D / A | detail level of the current function: calls / decisions / all code |
| ⇧C / ⇧D / ⇧A | the same, everywhere |
| Space | play from here (one pass per loop); again to pause |
| + / − | play faster / slower |
| Enter | open the selected step's code in the editor, at its line |
| P | pin / unpin the selected step's box |
| F | fold / unfold the selected call's subtree (`+12 steps`) |
| / | find a function; Enter lists the paths from the entry points to it |
| G | go to step number |
| Home / End | start / end of the run |
| Tab | switch sequence ↔ boxes |
| Esc | stop stepping (keep the position); again to clear the selection |
| ? | the key list as a small overlay |

- Keys are listed in `settings.toml` (`[keys]`) and can be changed there.
- A caption shows briefly after each move (`⇧ → step over · skipped 12 steps inside update`), so the effect of a key is never a mystery. It can be turned off.
- Focus rings and screen-reader labels follow the selection (each row announces number, name, file and its state: selected, back, next).

## 8. The fact engine (offline, exact)

The sentences on boxes, code rows and the preview pane come from a deterministic fact engine, not a language model. It is offline by nature, costs milliseconds per function (it reads the syntax tree already fetched), and it is exact because every sentence restates one fact the compiler proved.

**Rules**
1. **Every sentence maps to one fact with a source range.** Hovering a sentence shows the code it comes from.
2. **Names are never rephrased:** identifiers, conditions and loop headers appear verbatim, in code style (`while (running)`, `for each element of routes`). No singularising, no guessing intent from names.
3. **Unknown stays unknown:** "count depends on data", "decided at run time (`std::function`)", "target unknown (function pointer)". Never a guess presented as fact.
4. **A comment is quoted, never summarised:** the function's own comment appears in quotes as the summary; without one, the signature.
5. **Fixed wording per fact** (a table, below), so the same fact always reads the same way.

**Facts and their wording**

| Fact | From | Wording |
|---|---|---|
| a condition | `If`/`Switch` node | `decides: if true → the indented rows · if false → past them` |
| an early exit | `Return` inside a branch | `<fn> ends here and returns to <caller> — early, only on this branch` |
| a normal return | last `Return` | `<fn> ends here and returns to <caller>` |
| skip to next pass | `Continue` | `skips to the next pass of <loop header>` |
| leave a loop | `Break` | `leaves <loop header>` |
| fixed loop count | `for (int i = A; i < B; ++i)` with literals | `runs B−A times` |
| loop over a container | `CXXForRange` | `for each element of <range expr>` |
| loop on a condition | `While`/`Do` | `while <condition>` / `until !(<condition>)` |
| how often a step runs | product of enclosing loops | `×4` · `×4 per request` · `per element of routes · per request` |
| calls | outgoing calls | `calls 3 functions: …` / `nothing in the project — a leaf` |
| callers | incoming calls | `called from 7 places` |
| recursion | a call to itself on the path | `↺ calls itself` |
| new thread | `std::thread`, `pthread_create`, `xTaskCreate`, `taskSpawn` with a function argument | `starts <fn> on a new thread` |
| locking | `lock_guard`, `unique_lock`, `scoped_lock`, `pthread_mutex_lock`, `semTake` … | `holds <mutex> from line A to line B` |
| allocation | `new`, `malloc`, `make_unique`, `make_shared` … | `allocates <type>` |
| throws | `CXXThrow`, missing `noexcept` on a path to one | `may throw <type>` |
| writes state | assignment / `++` / compound assignment to a member or global | `changes <member>` · `changes global <name>` |
| reads only | no writes, no calls with side effects | `reads only its arguments` |
| data passed on | a variable set from a call and used as another call's argument | `headers (from 11 parse_headers) goes into 15 route and 20 keep_alive` |
| indirect call | call through `std::function`, pointer, virtual | `⇢ decided at run time` · `⇢ 3 possible overrides: …` |
| code after an exit | statements after an unconditional `return` | `never runs (after the return on line N)` |

- **Library knowledge** is a curated table (C/C++ standard library, POSIX, Win32, FreeRTOS, VxWorks): which functions start threads, lock, allocate, do I/O. Exact by construction; extended per pack.
- **Cost:** facts are computed when a function's syntax tree is first read and cached with it.

**How it stays exact on any codebase**

- **Accuracy comes from the compiler, not from patterns.** clang has already resolved types, overloads, templates, macros and every call target; each fact is an exact question over that resolved structure ("is any assignment's target a member of `this` or a global?"), decidable for the code as written.
- **The precondition is the build configuration.** Wrong defines or include paths make a different `#ifdef` branch "the code": prefer the project's own `compile_commands.json`, show which configuration was analysed, and mark inactive `#if` regions.
- **Three grades on every fact:** *proved* (true on every run: `runs 4 times`, `changes metrics_.counters_`), *possible* (the complete set of options, one of which happens: `⇢ one of 3 overrides`), *unknown* (needs running: `count depends on data`). Run-time values, data-dependent counts, which branch runs and general pointer targets are undecidable statically; the engine says so instead of guessing. The guarantee: everything stated is true, nothing unproved is stated.
- **Layers, all deterministic:**
  1. language semantics from the compiler (C/C++ inbuilt; other languages' engines per pack);
  2. generic rules (control flow, data flow inside a function, side effects, calls) — the same for every codebase;
  3. library knowledge tables (standard library, POSIX, Win32, FreeRTOS, VxWorks, Qt, Boost …), versioned data;
  4. **summaries carried up the call graph:** a function's facts are its own plus its callees' summaries, attributed (`locks, via guard() → pthread_mutex_lock`); recursion settles by repeating until nothing changes. This is how unseen codebases are covered — every project function is analysed, none has to be known in advance (a VxWorks wrapper around `semTake` is "locks" by propagation);
  5. optional project rules (`.skycodex`) for conventions the code can't show (`LOG_ERR is logging only`), labelled as such.
- **Descriptions:** the exact *what the code does* line is composed from facts (`parse_headers: loops over split(raw, "\r\n"); skips lines without ':' (continue); calls trim twice per line; adds to out; returns out`). *What it is for* (intent) can't be derived deterministically: the function's own comment is quoted when there is one; an offline model's suggestion, if ever added, is labelled as a suggestion and off by default.
- **Updates:** rules and tables are data files versioned with the app, or knowledge packs (`posix`, `freertos`, `vxworks`, `qt`) checksum-verified like language packs and offline once installed. Analysis never needs the network; a new version may add coverage, never silently change how an existing fact is decided. Per-project facts are cached and recomputed incrementally (changed functions and their callers' summaries only).
- **Testing:** every rule has code samples with expected facts; an optional cross-check compares facts with LLVM's own analysis of the compiled program (loop trip counts, call graph) when the project builds.

## 8b. Analyses shown on the flow

All deterministic, from the same syntax trees, call graph, thread starts and library tables. Each has a grade (§8) and a place in both views.

| Analysis | What it finds | Grade | How it shows |
|---|---|---|---|
| **Races** | a variable written on one thread and read or written on another, with no lock in common | possible (whether they meet in time depends on the run) | a hairline red crack between the two steps, labelled `counters_ · two threads, no common lock`; a red fact in each step's box |
| **Watch a variable** | every step that sets or reads it, in order, through renames (`running_` passed as `running`) | proved | a watch lane beside the sequence: `▲ set true`, `▽ loop condition` …; the rows light along the timeline |
| **A value's journey** | a value followed across calls, renamed at each argument → parameter (`req.raw → raw → s`), written or only read, returned or discarded | proved | in the step's box and the preview pane as a list of hops; a discarded result is red |
| **Pairs that don't close** | `lock`/`unlock`, `malloc`/`free`, `open`/`close`, `new`/`delete`, `semTake`/`semGive` with a path between them that leaves | proved per path | a bracket joining the two rows; on the leaking path it stays open at the exit row: `lock taken on line 12 · not released if returns at line 15` |
| **Configurations** | steps that exist only under another `#if` / `if constexpr` configuration (Debug/Release, board targets) | proved per configuration | a configuration chip (`Release ▾`); steps of the other configuration as faint dotted ghost rows; switching morphs the flow in place |
| **Values settled per call** | a constant passed in settles a condition for that call only (`draw(true)` makes `if (clear)` true there) | proved per call | the branch that cannot happen in this call fades, with `clear is true here — passed by Canvas::draw(true)` |
| **Errors only** | every way out: early `return`, `throw`, `break`/`continue`, calls that never return (`exit`, `abort`, task delete), `longjmp`, `goto` cleanup | proved | one key dims the happy path and lights every exit with what triggers it (`? headers.empty() → return 400`) |
| **What a change does** | two commits' flows compared: steps added, removed, loops or conditions changed | proved (restates structure) | added steps glow green, removed leave a red ghost, changed get a marker; a summary line (`+ 2 steps in handle · route now inside a new if`) |
| **Chapters** | the run split at the entry point, top-level loops and returns (`Startup 1–8 · Request loop 9–22 · Shutdown 23`), named after the functions they cover, verbatim | restates structure | a table of contents in the margin and gaps in the spine; keys jump between chapters |

**Real findings to keep as test cases** (both found in `samples/tinyhttp` without running it):
1. `Metrics::counters_` (a plain `std::map`, no lock) is written by `record` on the request thread and read by `flush` on the flusher thread — a race.
2. `handle`'s early `return Response{400, "bad request"}` goes back to `start`, which discards the result (`handle(req);`, line 17) — the 400 response is never sent.

## 9. Large codebases

- **Levels, never everything at once:** programs/tasks → subsystems (folders, libraries) → files → functions; each level about 30–60 shapes.
- **Detail around the selection:** the selected step, its callers back to the entry point and a couple of levels of callees in full; the rest folds into its folder or subsystem box, arrows combined.
- **Nested numbers** as an option: `8 handle` → `8.1 parse_headers` → `8.1.2 trim`; numbering restarts under a function opened as the root.
- **Folding:** a call's subtree folds into one row (`+40 steps`); helpers fold into their caller's line; std/OS/third-party hidden unless asked for.
- **Getting there:** find a function (`/`) to see the paths from the entry points to it.
- **Drawing:** only what is on screen; very large views drawn on the GPU rather than as page elements.

## 10. Languages

- **Two tiers:** a fast syntactic pass gives a picture within seconds for any language with a tree-sitter grammar (calls matched by name, marked "probable"); exact facts replace it as each language's engine (clangd, rust-analyzer, gopls, Pyright, SCIP indexers) completes. Kept on disk.
- C and C++ are inbuilt; other languages' engines come from language packs on first use (the Rust, Python and Go packs are kept for this).
- No single method gives exact flow for every language; the per-language engines are what make it exact.
- **C/C++ as gcc or MSVC reads it** (`compiler.read_as`): clangd analyses the code in every case, so the run, the sequence and the boxes are built the same way; what changes is the compiler clangd is told the code is built with. For **gcc**, the generated compile database names the real g++ (Apple's `g++` is clang and is skipped) and clangd asks it for its system headers, predefined macros and target (`--query-driver`). For **MSVC**, the commands are `cl.exe` commands in cl's own flag style (`/I`, `/D`, `/std:`, `/imsvc` for the VC and Windows SDK headers, found with vswhere or a developer prompt), which puts clang into its MSVC-compatible mode (`_MSC_VER`, Microsoft extensions). A project's own `compile_commands.json` keeps the compilers it names; installed gcc-style ones among them are queried the same way (never a program inside the project). Code that only gcc or MSVC accepts shows as unresolved, never guessed. Code: `src/main/compilers.ts`; tests: `src/tests/compilers.test.ts` (on this Mac with fake toolchains, plus a real clangd check that a cl.exe command defines `_MSC_VER` and not `__GNUC__`).

## 11. Open items

- Rightmost column crowding when code rows are shown everywhere: horizontal scroll for that column, or wrapped code rows.
- Boxes view, still to do: the Tab transition (rows gliding into their boxes), PNG export, the loupe, the shared-utility rule for very large projects (a file called from many others drawn without lines).
- Virtual-call overrides in the flow engine (`src/renderer/lib/flow.ts`): written, not yet reaching overrides (class-base map + `workspace/symbol`).
- Programs view (several `main`s) not yet built in the app; data side (lanes, shared files, starts-another-program) is in `flow.ts`.

## 12. Prototypes (src/concepts/flow)

| File | What it is |
|---|---|
| `lsp.mjs` | minimal clangd LSP client |
| `mkdb.mjs` | compile database for a folder without one (as the app does) |
| `flowtree.mjs` | the analyser: calls + loops + conditions from clangd, numbered in execution order, folded; writes JSON (`OUT=…`, `FOLD=1`) |
| `stmts.mjs` | every statement per function from the syntax tree (for the detail levels) |
| `seqgen.mjs` | static cascading sequence from the JSON (file or depth columns) |
| `trav3.mjs` | the stepping prototype: focus boxes, detail levels, back along the path, previous pass, captions |
| `boxgen.mjs` | the boxes view: files / functions zoom, rows as ELK ports, return route, folders, shared utilities, hover, audit (`boxes-tinyhttp.json`, `boxes-thorvg.json`) |
| `record.cjs`, `encode.swift` | record a prototype run to frames and encode an MP4 with macOS's AVFoundation |
| `mock/` | the page shell and styles the prototypes use (on top of the app's `styles.css`) |

Example (tinyhttp):

```
node src/concepts/flow/flowtree.mjs samples/tinyhttp samples/tinyhttp samples/tinyhttp/src/main.cpp main 8   # with OUT=tiny.json
node src/concepts/flow/stmts.mjs tiny.json samples/tinyhttp samples/tinyhttp
node src/concepts/flow/trav3.mjs tiny.json samples/tinyhttp out.html "tinyhttp · handle" 9 "level:handle:all,next,over,next"
node src/concepts/flow/boxgen.mjs tiny.json samples/tinyhttp boxes.html src/concepts/flow/boxes-tinyhttp.json
```
