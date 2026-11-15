# SkyCodeX UI: every fixed value, placement pattern and missing case, line by line

Re-counted 2026-11-13 for review with the user; open points closed the same day. Replaces the counts of
UI-GENERALIZATION.md §4. Nothing in the code has changed.

## 1. Scope and method

- **Files:** every shipped source file, 90: `src/renderer` (except `smoke.ts` and `probe.ts`, which run only with `--smoke`),
  `src/shared`, `src/main`, `src/preload`. `FlowBoxes.tsx` and `lib/flowlayout.ts` are scanned; nothing imports them. Out of
  scope: `src/concepts` (prototypes, not built, imported by no shipped file), `src/build`, `src/tests`.
- **Numbered scan:** every line holding a number (in TypeScript other than 0, 1 and 2 without a unit; in the stylesheet any
  number other than 0) or a cut, a two-digit comparison, a timer, `nowrap`/`overflow: hidden`, a layer, a window size:
  1573 lines in 78 files. Every TypeScript line was read and judged by hand; every stylesheet line was read and
  judged by written rules, then corrected by hand where §1 below says.
- **Class B (no numbers):** every place shipped code reads a size or position was listed (`getBoundingClientRect`, `offset*`,
  `client*`, `scroll*`, `measureText`, `getTotalLength`, `rectOf`, `rect(`, `ResizeObserver`): 71 places in 16 files, each read.
  All measure what they place against or only track the pointer, except the grid arrows: they take the square
  (`rect`, GridView.tsx:65) as the box the reader sees, which gives 4 faults at GridView.tsx:69, 71, 77 and 79.
- **Class G (no numbers):** the kinds the model defines (steps: `step`, `ref`, `indirect`, `value`; links: `in`, `out`, `call`;
  recursion, threads, the entry step) were checked in the grid, the metro and the step card, and every placement fallback
  in the grid was read. The metro (`k-ref`, `k-indirect`, `k-value`, and threads by the note "⇢ on a new thread",
  Sequence.tsx:1081; the dashed thread arrows never draw, §3b) and the step card
  (`StepPreview.tsx:38–124`) handle every kind. The grid and the dotted link have the 11 cases below, and
  `flowseq.ts:463` assumes indents of 4 spaces: 12 there.
- **Class G in the other views:** 28 files (3,227 lines) that draw the preview columns, the editor panes, the windows and
  menus, and the metro's code pane were scanned for every drawing decision (`<Show>`, `fallback`, `<Switch>`, every list
  that can be empty, every choice in the markup, every early "draw nothing"): 298 lines in 25 files, each read; the other 3
  files (`AppBar`, `Split`, `PlayControls`) make no such choice. For each: is something drawn when empty, busy, failed,
  and for each kind, and does a fallback land somewhere wrong? Every kind those views draw was checked against its
  drawing: card kinds 5 of 5, setting types 6 of 6, install phases 6 of 6, diagnostic levels 4 of 4 (hints are drawn
  as information), entry kinds 2 of 2, program links 2 of 2, junction kinds 2 of 2: all drawn. 11 cases have no drawing
  or a wrong one: 23 in all with the grid's. A later reading of the flow's empty states (`flowstore.ts:49–96`) found
  that a project with no programs is drawn (its status line names the public API traced), and found one more case:
  the flow is never built while clangd is not ready (`flowstore.ts:50`): 24 in all. The build starts again by itself
  once clangd is ready: `Flow.tsx:13` rebuilds whenever clangd's state changes.
- **Overlays open together:** every rule with a layer number (53 in the stylesheet, 4 inline) was listed with its
  position; the app-level overlays (Settings, palette, app menu, language-engine window, start window, search, toast) are
  siblings under `.app`, so their layer numbers compare directly: Settings 20 < palette 30 < start window 32 < app menu
  35 = language-engine window 35 < toast 40, magnifier 60. Every Esc handler (22) and every window-wide key or click
  listener (10, on 8 lines) was read, with what opens each overlay. The global shortcuts (`App.tsx:55–71`) work whatever is open, so
  any two can be open together. 7 overlay faults (code O, below). Not judged by reading: how two open overlays look. One choice has two identical branches (`Preview.tsx:258`), harmless.
- **Fixed sizes judged one by one:** the 155 stylesheet rules with a fixed width or height were each judged. 10 give a fixed
  size to content that can grow (D); the rest size a control, an icon, a hairline, or set a bound (S). In TypeScript, 8
  lines first marked D were corrected: they size one line of fixed-size text, or a start size the user can drag, or a
  box that scrolls.
- **Cuts judged one by one:** each cut was checked for a way to the full text: a hover title on the element (read in the
  component), an expand or open action, scrolling, typing to narrow, a setting, or the same text in the card. Three
  levels: E+ reachable, E± counted but not reachable, E- silent. One cut (`.glide`, a moving copy of a row during a
  jump) holds no information and was moved to OK.
- **Fixed positions and unbounded text judged one by one:** of the stylesheet's positioned rules with a fixed offset,
  13 assume another element's size (C: the 36 px pane header, the 56 px app header, the 40 px play bar, the 62 px run
  bars, the grid's heading bands); the rest are small gaps from their own anchor (S). Of the one-line texts with no clip
  of their own, 4 scroll (`.gtop`, `.gkey`, `.skyk`, `.sfrom`) and 3 wrap or are clipped by their children (`.hov`,
  `.sline`), so they are OK; the numbers in a grid square are clipped by the square, so they are a silent cut (E-).
- **Unused styles:** every rule of the stylesheet (892 lines) was checked for a shipped use, not only the numbered lines.
  Class names built at run time count as used only for the values the code sets (`t-` tones, `g-` grades, `k-` kinds,
  `e1`–`e4`). 73 lines are unused: 62 numbered, 11 found by this check.
- **Separate faults:** a fault is one value or behaviour in one place. Lines that are one behaviour (a declaration and
  its use, one timer over two lines) count once; a line holding several named values counts each (GridView.tsx:17
  holds four fixed sizes and a threshold). In the stylesheet each fixed position declaration counts as one.

## 2. Counts

| Code | Meaning | Faults | Lines | grid | metro | card and preview | editor, windows, menus | stylesheet | shared logic | main process |
|---|---|---|---|---|---|---|---|---|---|---|
| A | Text size estimated from a character count | 5 | 5 | 3 | 1 | 1 | 0 | 0 | 0 | 0 |
| B | A container's geometry used for its content | 4 | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| C | A fixed offset that assumes the size of something else | 50 | 49 | 14 | 7 | 7 | 6 | 15 | 0 | 0 |
| D | A fixed size for content that can grow (names, line or function numbers, counts) | 17 | 14 | 3 | 0 | 1 | 0 | 10 | 0 | 0 |
| E+ | A cut whose full text or list can be reached (hover, opening, scrolling, typing, a setting) | 49 | 53 | 5 | 13 | 6 | 5 | 21 | 3 | 0 |
| E± | A cut that counts what it hides ("+N more") but cannot show it | 7 | 10 | 0 | 4 | 1 | 5 | 0 | 0 | 0 |
| E- | A silent cut: what is hidden is neither counted nor reachable | 69 | 72 | 3 | 8 | 6 | 9 | 37 | 3 | 6 |
| F | A count or size threshold that switches what is drawn | 9 | 16 | 10 | 4 | 0 | 1 | 1 | 0 | 0 |
| G | A case with no drawing, or a wrong one | 76 | 84 | 17 | 10 | 11 | 24 | 1 | 15 | 6 |
| O | An overlay that breaks its rule: it does not close with Esc, closes more than itself, or opens out of sight | 11 | 11 | 1 | 3 | 0 | 7 | 0 | 0 | 0 |
| H | Information that disappears on a timer | 19 | 23 | 3 | 7 | 0 | 13 | 0 | 0 | 0 |
| W | One-line text with no bound of its own: it runs past its box, over its neighbours or into a parent's cut | 24 | 24 | 0 | 0 | 0 | 0 | 24 | 0 | 0 |
| LIMIT | A size limit outside the drawing that drops data on large codebases | 24 | 27 | 2 | 0 | 2 | 5 | 0 | 5 | 13 |
| V | Work or memory that grows with the whole run or project, not with what is on screen | 23 | 25 | 3 | 11 | 4 | 5 | 0 | 1 | 1 |
| U | A placement or visibility that may confuse (judged with the user in the walk, not counted as a fault) | 3 items | 4 | 0 | 0 | 0 | 1 | 3 | 0 | 0 |
| S | A raw spacing or type size, not from a scale | – | 505 | 24 | 41 | 11 | 11 | 418 | 0 | 0 |
| Z | A raw layer number | – | 51 | 0 | 0 | 1 | 3 | 47 | 0 | 0 |
| DEAD | Not reached by the shipped app | – | 217 | 0 | 9 | 0 | 95 | 73 | 40 | 0 |
| OK | A drawn value that is not a placement fault | – | 373 | 22 | 49 | 30 | 96 | 164 | 10 | 2 |
| OUT | Not about what is drawn | – | 293 | 3 | 21 | 12 | 74 | 0 | 54 | 129 |
| TEST | Used only by the test scenarios | – | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |

**387 separate faults**, after the full read of 2026-11-14 ([UI-READING.md](UI-READING.md)): 299 before, 98 found, 11
withdrawn (9 lines on paths no shipped code reaches, now DEAD; `junctions.ts:27`, now OK; and an E- first written for
`styles.css:806`, withdrawn in the grid review: `.grh span` has no clip, so the ƒ number is not cut but runs over the
name once it is wider than 30 px, which the D on that line already covers), and 1 more from a split
(`preview.ts:129` is now its own E-, apart from the E± at `Preview.tsx:282`). The count of distinct lines with a fault
(308 before) was not recounted. Lines with only hygiene items: 442 (not recounted). Unused lines in the numbered scan: 217.
No action: 660. The per-area columns of the new rows follow the areas of UI-READING.md.

**Fixed (2026-11-14, first grid correction):** A `GridView.tsx:177` (arrow label width now measured from its font,
`lib/measure.ts`), A `GridView.tsx:240` (hover tag width measured the same way), G `GridView.tsx:179` (a label must lie
inside the squares' area, clear of headings, names, totals and call counts, and clear of every arrow, placed after all
arrows are routed; with no free place it takes the least-covered one). Checked by the `overlaps` scenario on
tinyhttp, 30 steps: labels over a name or total 10 → 0, arrows over text 28 → 18, the dotted link over text 62 → 58,
labels over squares and over labels 0 → 0; typecheck, 31 test files, the default and boot scenarios unchanged.
3 of the 387 faults fixed; 384 open.

**Fixed (2026-11-14, second grid correction):** G `styles.css:840` (the three arrow colours are now one definition each,
`--grid-in`, `--grid-out`, `--grid-call`, used by the arrows, their heads, their labels and the key, and explained on a
second key line, "arrows from the current step", in sight at every width that shows the key). Checked by the
`overlaps` scenario: arrow colours the key does not explain 25 → 0, arrow-key marks out of sight 90 → 0; arrows over
text 18 → 18; the dotted link over text 58 → 59 (6 crossings gone, 6 new, net +1: the key line moves the grid down, and
the link is one curve whatever lies between, fault `StepPreview.tsx:137`). Committed work up to the first correction
and the colour definitions: commit 95720ff. 4 of 387 fixed; 383 open.

**Fixed (2026-11-14, class B, X1 as approved 2026-11-13):** B `GridView.tsx:69`, `:71`, `:77`, `:79`: every grid
arrow now starts and ends on the numbered box of its step (or its dot, or the opened square's step row), at the
box's middle, measured from the drawn page; where a sideways approach would cross another box in the same square,
the arrow comes in from above or below through the square's free strip. Checked by the `rules` scenario on the 23
generated programs: an arrow ends away from its box or off its middle 36 → 0, every other check unchanged; the
`overlaps` scenario on tinyhttp: arrows over text 18 → 18, the dotted link 59 → 59; typecheck, 31 test files. One
run of files-11 hit the 5-minute limit; three runs alone passed in 7–9 s with counts identical to before (the random
hang already in the log since 2026-11-13). 8 of 389 fixed; 381 open.
Correction, found during class C: the `rules` scenario had not been run on tinyhttp for class B. Run there, it found 2
arrows (steps 12 and 20) whose vertical approach into a box was shorter than the arrowhead, so the head pointed the
wrong way. Fixed with class C: a vertical approach keeps a straight end at least one arrowhead long (`TIP`, the same
constant the arrowhead markers use). tinyhttp: an arrow ends off its box's middle 2 → 0.

**Fixed (2026-11-14, class C, the grid):** the 14 grid rows of §3 C, `styles.css:479` (`.gview .scap`), and the 4 grid
rows of §3b C (`GridView.tsx:108`, `:304`, `styles.css:858`, `:862`), plus one more found while fixing:
`.gscroll { padding-bottom: 62px }`, the run bars' height again. Arrow lanes are spaced by the square's size and the
number of arrows that share it, never more than 3 px apart; detours are a quarter of the square's width and a third
of its height, never more than 10 and 8 px; the headings, bands, axis labels, totals and call counts take their places
from one layout source (`HEAD_NAMES`, `ROW_NAMES`, `BAND_*`, `NAME_GAP`, `TOT_GAP`, `FOOT_H`) shared with the PNG export;
the run bars' height is measured, and the caption, the scroll padding and the visible height follow it; a square is
scrolled into view between the measured frozen headings; the totals column and the call-count row reach the bottom of
the view instead of casting fixed 60 and 90 px shadows; the hover tag may use any place inside the view. Checks added
to the `rules` scenario: an arrow runs between rows, an arrow runs between columns, the current square is under a
frozen heading, an axis label overlaps a heading (a heading hidden under a frozen corner does not count), and a
screenshot of each step with a fault. Before → after, 23 programs and tinyhttp: arrows between rows or columns 2 → 0,
arrows over text 18 → 17, the hover tag over a square 94 → 93 and 3 → 2, every other check unchanged; the current
square under a frozen heading and an axis label over a heading 0 → 0 (these show only at other fonts and window
sizes, which P5.R.4's conditions cover and which are not run yet). One run of repeat-mixed hit the 5-minute limit and
one tinyhttp run found the metro "still moving" twice; run again (3 and 2 times), neither repeated. 28 of 390 fixed;
362 open.

**Fixed (2026-11-14, classes D and E, the grid):** D: the fixed `SIDE`, `HEAD`, `TOT`, `FOOT`, `OPEN_W`, `LINE_H`
(`GridView.tsx:17`), the column width held to 44–92 px (`:124`) and the row height to 19–28 px (`:125`), `.gch`,
`.grh` and `.grh span` sizes, `.grh b { max-width: 150px }` and `.gtot { width: 74px }`; E+: the file bands
(`styles.css:797`, `:804`), column names (`:800`) and row names (`:806`, `:807`); E-: the arrow label cut at 64
characters (`GridView.tsx:176`), the exported PNG's names cut by an estimate (`:335`), the square's numbers that
could overflow it (`styles.css:820`), the opened square's code lines (`:845`), "(…)" for a call's arguments
(`gridlinks.ts:44`), a condition cut at its line's end with no mark (`gridlinks.ts:60`, §3b) and the followed value's
words missing from the row's title (`styles.css:807`, §3b): 20 faults. Every size now comes from measured content
within a bound: the row-name column from the widest ƒ number and name (at most 40% of the view), the column names'
lines from their widths (at most 4), each column from its numbers and its file name, each row from its numbers, the
totals and call counts from their text, the opened square from its longest line (at most 60% of the view, plus the
scrollbar when it scrolls); past a bound the text is cut with the full text on hover and the element marked
`data-bound`. The rows' file names are now a heading above each file's rows, never cut while there is room. Checks
added to the `rules` scenario: a name cut although it could grow, a square's numbers overflowing it, an opened
square's line cut although it could grow, an arrow label cut with no full text; the rule-3 border checks now count
only runs along a border narrower than 8 px (a gap between two files' rows holds a heading and is open space).
Before → after, 23 programs and tinyhttp: names cut 1,967 → 0 and 120 → 0, arrow labels cut 3 → 0 and 5 → 0, opened
lines cut 5 → 0, the dotted link over text 59 → 45, a label over a name or total 6 → 5. Worse, each traced: the file
headings make the grids taller, so tinyhttp no longer fits the 900 px test window; its last rows scroll under the
pinned call-count row, and 5 more arrow crossings and 3 arrow labels lie under that row's numbers (hidden by it,
§1 "frozen structure covers content scrolled under it"); files-60 has more squares off screen (27 → 59, class F/V).
New fault, phase 3: in a grid taller than the view, an arrow label can be placed under the pinned call-count row and
cannot be read until the grid is scrolled. Kept as they are, by verdict: the five E+ summaries whose full list is
one step away (`GridView.tsx:142` most called, top 3, all in the "most called" order; `:238` the hover tag's steps,
all in the opened square; `:320` and `:485` routes 1–9 by key, all by click; `:426` dots for 4 or more calls, with
the count, all in the opened square); they meet rule 4. 48 of 391 fixed; 5 kept by verdict; 338 open.

**Fixed (2026-11-14, classes F and V, the grid):** F: the switch to a files × files view above 1,800 cells
(`GridView.tsx:17`, `BIG`) and the view itself (`:496`, `:499`, `:501`–`:504`, `:507`, `:510`), with its drill-down
state, "← all files" chip and style; V: `Math.max(...)` over every row and column (`:134`, `:135`, and the same
pattern added in classes D and E), now loops; every square built whether in view or not (`:411`, X9), now only the
squares within one screen around the view, the window moving with the scroll; the column widths for unbuilt squares
come from the font's measured widths, so nothing shifts while scrolling. 12 faults. Found and fixed during the class:
`lib/paths.ts` `rounded()` dropped a real corner when a route held the same point twice, leaving a slanted end (1
new fault); and an arrow reaching a box from below its square could end with its head the wrong way (a class B
case): every arrow end now finishes with a straight piece one arrowhead long pointing into its box, checked again
after both ends are placed. Checks: the `rules` scenario now opens the current program when the flow starts on the
programs list, waits for the view to settle before judging arrows, counts arrow ends beyond the built squares as
"not checked", and judges an arrow at the smallest box it touches (a dot rather than the row of dots); a fault
records its box and path. ThreadX (a real RTOS codebase, 549 steps, 65 × 65 functions) added to the runs. Before →
after: a different view at this size 549 → 0, squares built beyond one screen 608 → 0, arrows away from or off
their box 0 → 0 on all 549 ThreadX steps, every check on the 23 programs and tinyhttp unchanged. ThreadX's grid is
drawn and checked for the first time, which shows faults of other classes: arrow labels over names (9), the hover
tag over squares (9), arrows without a hover (296, rule 8). (Corrected during class G: the 656 "axis label over a
heading" first counted here were column names hidden under the frozen corner, not visible overlaps; with the check
narrowed to what is visible they are 0 before and after, and no new fault was added.) One run of recursion-direct
and two of ThreadX hit the 5-minute limit; each ran again within it. 61 of 392 fixed; 5 kept by verdict; 326 open.

**Fixed (2026-11-14, class G, the grid):** `GridView.tsx:172` the entry step now has its arrows, from its column
down to each call it makes (X5, as the mock-up of 2026-11-13); `:187` a link between two steps in one square is drawn
as a small arc; `:189` every link has its own arrow (V22); `:191` with no free route, an arrow crosses as few squares
as it can (a cost per crossing, not a straight line through them); `:195` the "calls" label is placed by the current
square, or by the squares it calls when there is no room; `:250` the hover tag stays in view and avoids squares and
labels, falling back to the least-covered place; `:290` shift-click on a call through a pointer or a value says why
there is no route; `:406` a function passed as a value is marked `&`; `gridmodel.ts:20` (§3 and §3b) a call back into
a running function is marked ⟲ on its square and row, a call on a new thread ⇢; `gridmodel.ts:28` a call in a loop is
marked ↻N and times called counts every pass ("+" when a loop's count is not known); repeated calls are counted ×N
in their square; folded calls are marked +N with their names and lines on hover (the user's decisions of
2026-11-14); `:92` the key says colours separate neighbouring files and each file is named; `:161` when a step's links
cannot be worked out, the key line says so and why; `:449` every arrow has a hover saying what it is (rule 8);
`:471` the grid's run bars show edited steps and notes (the notes and edited steps moved to `lib/runmarks.ts`, shared
with the metro); `gridmodel.ts:13` and `gridlinks.ts:130` names that read the same are shown in full, and with their
file when even that is the same; `gridlinks.ts:115` `for`, `case`, `?:`, `&&` and `||` count as decisions on a value;
`flowstore.ts:50` when clangd has failed the grid says so instead of "building…". 19 faults. Checks added to the
`rules` scenario: every link of the step has an arrow, a call back into a running function, a call in a loop, a call on
a new thread, repeated calls and folded calls are marked, a function passed as a value is marked, no two names read
the same; the axis-label check now counts an overlap only where the heading is visible. Before → after, 23 programs,
tinyhttp and ThreadX: entry steps without arrows 25 → 0, links without an arrow 74 → 0, arrows without a hover 377 →
0, unmarked loops 23,179 → 0, recursion 14 → 0, threads 3,868 → 0, repeats 6,786 → 0, folded calls 30 → 0, values
1,169 → 0, names that read the same 1,098 → 0, the hover tag over a square 105 → 14, arrows over text on tinyhttp 22 →
18. Worse, each traced: more arrows and labels are drawn now (every link, the entry step), and in the smallest grids
a label sometimes finds no free place: a label over a square 0 → 3 (calls-20, names-10, recursion-direct), a label
over a name 0 → 3 on tinyhttp, the hover tag over a square +1 on names-120, names-300 and ThreadX; arrow ends beyond
the built squares rise with the number of arrows (not checked). Open, intermittent: on ThreadX the current square was
left partly under the row names at step 547 in 2 of 3 runs (the scroll into view, not yet traced; the check now
records the positions). Not changed, pending the user's word: the "most called" order still sorts by calls, while
times called now counts loop passes; changing it changes the test `gridmodel.test.ts` "sorts by most called". 80 of
392 fixed; 5 kept by verdict; 307 open.

**Fixed (2026-11-14, the grid's phase 3, overlaps and overlays):** H `GridView.tsx:255–256` the caption no longer
disappears after 2.6 s: it stays until the next key, click or step; O `GridView.tsx:315` Esc closes one thing at a
time (the opened square, then the route, the followed value, focus); W `styles.css:668` the caption wraps within the
view, `:783` the step heading is cut with its full text on hover, `:857` the hover tag is sized to the view and
wraps: 5 faults. Also: the layer order follows §1 (the opened square above the arrow labels, arrows above the opened
square); a square is scrolled into view from its computed place, so a square not yet built is reached (the current
square under a frozen heading, 6 → 0 on ThreadX); the arrow colours changed at the user's request to three light,
contrasting colours, lines 0.5 px. Checks: the hover tag is judged by §1 (it must not hide its own square or leave the
view), a frozen heading must not cover content that is not scrolled under it, a caption must stay, one-line text must
not run past its box; overlaps count only where the text is visible. Before → after (all 23 programs, tinyhttp,
ThreadX 549 of 549 steps): captions on a timer 25 → 0, the hover tag outside the view 14 → 0, the current square
under a frozen heading 6 → 0, labels over a name or total 23 → 20; tinyhttp's arrows over text 15 → 18 and the dotted
link 40 → 42, all at step 17, where the fixed scroll now brings the square into view: the arrows there pass under
the pinned call-count row (the check does not yet tell that apart), the dotted link crosses for real (its redesign
waits for the user's choice). Open: the dotted link (42), labels in the smallest grids, one frozen heading over
content in `kinds`. 85 of 392 fixed; 5 kept by verdict; 302 open.

**Fixed (2026-11-14, the dotted link to the card, the user's choice from the mock-up):** `StepPreview.tsx:137` in the
grid the link now starts at the end of the current row, past the totals, so it never runs over the grid. tinyhttp: the
dotted link over text 42 → 0. The overlaps check was corrected twice: text counts as visible only where it, or what
is inside it, is on top (an element clipped into the scrollbar's strip was counted before), and an arrow counts as
crossing text only where the arrow is drawn above it (arrows passing under the pinned call-count row were counted
before); with it, tinyhttp's arrows over text are 1 (a call arrow over box 12 at step 13). The `rules` scenario's
waits were cut to what the app needs (one frame per check of the scroll, one for the hover tag): every count on
tinyhttp and ThreadX unchanged, ThreadX's 549 steps in 164 s instead of 241 s. 86 of 392 fixed; 5 kept by verdict;
301 open.

**Fixed (2026-11-15, the metro, classes A and C):** the metro's 106 rows were listed (65 in `Sequence.tsx`,
`flowseq.ts`, `metrofacts.ts`, `flowcore.ts`, `junctions.ts`; 41 metro rules in `styles.css`), and the `rules` scenario
now walks the metro too (TEST-SUITE P5.R.4). A `Sequence.tsx:979` the chapters popover is placed by its measured height
(inside the view at 3 window sizes × 3 pointer heights). C `Sequence.tsx:219` the view height subtracts the run bars'
measured height; `styles.css:479` the metro's caption sits above the measured run bars (`--sky-h`), 12 px from the
bottom when they are hidden; `styles.css:640` the run bars and `styles.css:466` the legend end at the spine's width
(`--spine`); `styles.css:508` the setting menu hangs from its chip (`100% + 11px`, the same 26 px as before);
`Sequence.tsx:377` the return route's half row and half bar come from `ROW` and the bar's own width;
`Sequence.tsx:1150` the run-bars tip is kept inside by its measured width; `Sequence.tsx:968` the peek's 560 px comes
from its stylesheet (its 220 px offset is still open). Measured in the app on tinyhttp: every offset the same as before
where the space is the same. Rules on 23 programs and tinyhttp before → after: every count unchanged. Still open in C,
for the user's decision with a mock-up (they set the metro's own spacing): `Sequence.tsx:270` code rows indented
22 + 12 per level, `styles.css:471` the column heads 24 px down, `flowseq.ts:196` the track lanes 14 + 16 per level,
`flowseq.ts:197` the text 26 px after the deepest lane, and the peek's 220 px (so `Sequence.tsx:968` stays open).
94 of 392 fixed; 5 kept by verdict; 293 open.

**Review with the user:** the grid's 84 faults (GridView.tsx 53, gridmodel.ts 2, gridlinks.ts 5, the grid's stylesheet
rules 24) were accepted on 2026-11-14. Found later the same day on the new generated programs, in §3b G: recursion
not marked (`gridmodel.ts:20`) and a call in a loop counted once (`gridmodel.ts:28`): 389 faults, the grid's 86; the
tables of §2 are not yet recounted. Still to review: the metro, the card and preview, the editor, windows and menus,
the rest of the stylesheet, the shared logic and the main process.

## 3. Faults, by code

### A. Text size estimated from a character count (5 faults, 5 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/components/GridView.tsx:177` | S | 5.6 12 15 | const r = rect(near), w = Math.round(text.length * 5.6 + 12), h = 15, my = r.y + (r.h - h) / 2; |
| `renderer/components/GridView.tsx:240` | S | 6.3 18 20 | const w = Math.round(text.length * 6.3 + 18), a = rectOf(i, j), hh = 20; |
| `renderer/components/GridView.tsx:335` | E- | 6 4 7.5 4 18 | cols().forEach((cc, i) => { g.fillStyle = col().get(cc.file)!; g.fillRect(SIDE + G.x.at[i], HEAD - 6, G.x.w[i… |
| `renderer/components/Sequence.tsx:979` |  | 8 20 40 24 10 | <div class="schap" style={{ top: '${Math.max(8, Math.min(chapPop()! - 20, height() - 40 - chaps().length * 24… |
| `renderer/lib/lines.ts:43` |  | 6.4 26 | const w = Math.round(label.length * 6.4) + 26; |

### B. A container's geometry used for its content (4 faults, 4 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/components/GridView.tsx:69` |  |  | vertical neighbours: the arrow leaves and arrives at the square's edge, not at the numbered box inside it |
| `renderer/components/GridView.tsx:71` |  |  | horizontal neighbours: the same, at the square's top and bottom edges |
| `renderer/components/GridView.tsx:77` |  |  | longer routes: the arrow starts at the square's edge, not at the numbered box |
| `renderer/components/GridView.tsx:79` |  |  | longer routes: the arrow ends at the square's edge, up to 23 px short of the numbered box (X1) |

### C. A fixed offset that assumes the size of something else (45 faults, 44 lines here; with §3b: 50 faults, 49 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/App.tsx:93` | Z | 5 6 | <Show when={searchOpen()}><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: '${filesW() … |
| `renderer/App.tsx:103` | Z S | 18px 52px 10px 14px 300 13.5px 1.5 460px 40 18px 40px .5 | <Show when={toast()}><div class="toast" role="status" aria-live="polite" style={{ position: 'fixed', right: '… |
| `renderer/components/CompilerWindow.tsx:33` |  | 16 600 80 | const [pos, setPos] = createSignal(stored() ?? { x: Math.max(16, (window.innerWidth - 600) / 2), y: 80 }); |
| `renderer/components/FilesPane.tsx:26` |  | 12 13 | <div class="ti" classList={{ on: files.active === e.path }} style={{ 'padding-left': '${12 + props.depth * 13… |
| `renderer/components/FilesPane.tsx:79` |  | 25px | <div class="ti" classList={{ on: flat()[sel()] === f }} style={{ 'padding-left': '25px' }} onMouseEnter={() =… |
| `renderer/components/GridView.tsx:69` |  | 10 | if (s.x === 0) { const x0 = Math.max(A.x + A.w, B.x + B.w) + 1, ox = x0 + 10; return rounded([{ x: A.x + A.w … |
| `renderer/components/GridView.tsx:70` |  | 8 | const y0 = Math.max(A.y + A.h, B.y + B.h) + 1, oy = y0 + 8; |
| `renderer/components/GridView.tsx:183` |  | 3 3 3 3 1.5 1.5 | const shift = (kind: string) => { const n = count[kind]++; return kind === 'in' ? -3 - 3 * n : kind === 'call… |
| `renderer/components/GridView.tsx:250` |  | 40 24 | const ok = tries.find((t) => t.x >= SIDE - 40 && t.y >= HEAD - 24 && !filled.some((f) => overlaps(t, f))) ?? … |
| `renderer/components/GridView.tsx:336` |  | 36 46 14 | rows().forEach((rr, j) => { g.fillStyle = col().get(rr.file)!; g.fillRect(36, HEAD + G.y.at[j], 2, G.y.w[j] -… |
| `renderer/components/GridView.tsx:337` |  | 4 20 6 | cols().forEach((cc, i) => { g.fillStyle = '#9ea39b'; g.fillText(String(cc.count), SIDE + G.x.at[i] + 4, HEAD … |
| `renderer/components/GridView.tsx:391` |  | 92 40 | <div class="gax" style={{ left: '${SIDE - 92}px', top: '${HEAD - 40}px' }}>caller →</div> |
| `renderer/components/GridView.tsx:392` |  | 40px 16 | <div class="gax" style={{ left: '40px', top: '${HEAD - 16}px' }}>called ↓</div> |
| `renderer/components/GridView.tsx:397` |  | 30 | <div class="gch" classList={{ on: curCell().startsWith('${c.key}>'), pk: pick()?.c === c.key, lv: waysOut() &… |
| `renderer/components/GridView.tsx:405` |  | 40 | <div class="grh" classList={{ on: curCell().endsWith('>${r.key}'), pk: pick()?.r === r.key, lv: waysOut() && … |
| `renderer/components/GridView.tsx:456` |  | 4 6px 30 | <div class="gtothd" style={{ top: '${st()}px', height: '${HEAD - 4}px' }}><div class="gax w2" style={{ left: … |
| `renderer/components/GridView.tsx:460` |  | 80px 18px | <div class="gax" style={{ left: '80px', top: '18px' }}>calls it makes →</div> |
| `renderer/components/Preview.tsx:122` |  | 4 44 | const edge: 0 \| -1 \| 1 = !hr ? 1 : hr.bottom < cr.top + 4 ? -1 : hr.top > cr.bottom - 44 ? 1 : 0; |
| `renderer/components/Preview.tsx:124` |  | 22 10 50 | const to = edge \|\| !sw ? { x: cr.left - br.left + 22, y: edge < 0 ? cr.top - br.top + 10 : cr.bottom - br.top… |
| `renderer/components/Preview.tsx:141` |  | 40 | const clipW = ar.right - br.left, clipH = ar.bottom - br.top - 40; |
| `renderer/components/Preview.tsx:249` |  | 120 40 | if (top < col.scrollTop \|\| top + Math.min(el.offsetHeight, 120) > col.scrollTop + col.clientHeight - 40) col.… |
| `renderer/components/Preview.tsx:289` |  | 36px 40px | <div class="empty" style={{ position: 'absolute', left: '${w1()}px', right: 0, top: '36px', bottom: '40px' }}… |
| `renderer/components/Preview.tsx:292` |  | 36px 40px | <div class="empty" style={{ position: 'absolute', inset: '36px 0 40px 0' }}> |
| `renderer/components/Sequence.tsx:270` |  | 22 12 | out.push({ x: l.jn ? g.x[it] : g.x[b.owner] + 22 + l.depth * 12, top: y, it, n: l.n, text: l.text, jn: l.jn }… |
| `renderer/components/Sequence.tsx:377` |  | 11.5 11.5 1.5 1.5 | const y1 = g.y[from] + 11.5, y2 = g.y[to] + 11.5, xa = g.barX[ci] + 1.5, xb = g.barX[bi] + 1.5; |
| `renderer/components/Sequence.tsx:968` |  | 220 560 4 | <div class="speek" classList={{ up: peek()!.up }} style={{ left: '${Math.min(geom()!.x[peek()!.it] + 220, wid… |
| `renderer/components/Sequence.tsx:1150` |  | 110 110 0.5 | left: Math.max(110, Math.min(box.clientWidth - 110, wrap.offsetLeft + (i + 0.5) * bw - wrap.scrollLeft)), |
| `renderer/components/StepPreview.tsx:136` |  | 22 0.55 | const x1 = a.right, y1 = a.top + a.height / 2, x2 = b.left, y2 = b.top + 22, m = x1 + (x2 - x1) * 0.55; |
| `renderer/lib/repair.ts:44` |  | 24 8 40 | tip.style.left = '${beside ? r.right + 24 : Math.max(8, row.getBoundingClientRect().left + 40)}px'; |
| `renderer/styles.css:129` |  | 36px | .pcol { position: absolute; top: 36px; bottom: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: none… |
| `renderer/styles.css:196` |  | 56px | .page { position: absolute; inset: 56px 0 0 0; background: var(--bg); display: flex; flex-direction: column; } |
| `renderer/styles.css:217` | W S | 25px 50% 1px 7px 300 12.5px | .slide .bubble { position: absolute; top: 25px; transform: translateX(-50%); padding: 1px 7px; background: va… |
| `renderer/styles.css:326` | Z S | 40px 6px 5 | .psplit { position: absolute; top: 0; bottom: 40px; width: 6px; cursor: col-resize; z-index: 5; } |
| `renderer/styles.css:348` | S | 50% 64px 50% 640px 90vw 24px 60px .6 | .pal { position: absolute; left: 50%; top: 64px; transform: translateX(-50%); width: min(640px, 90vw); backgr… |
| `renderer/styles.css:359` | Z S | 14px 48px 18px 44px .6 6px 35 240px | .appmenu { position: fixed; left: 14px; bottom: 48px; background: var(--pop); box-shadow: 0 18px 44px rgba(0,… |
| `renderer/styles.css:466` | Z E+ S | 30px 4 44px 5px 16px 1px 300 11px | .mlegend { position: absolute; left: 0; top: 0; right: 30px; z-index: 4; height: 44px; padding: 5px 16px 0; b… |
| `renderer/styles.css:471` | S | 24px 16px 600 9.5px .07em | .mhead { position: absolute; top: 24px; height: 16px; display: flex; align-items: baseline; font: 600 9.5px v… |
| `renderer/styles.css:479` |  | 74px | .seqv .scap, .gview .scap { bottom: 74px; } |
| `renderer/styles.css:508` | Z D S | 26px 30 380px 60vh 1px 8px 8px 12px 10px 300 12.5px | .setm { position: absolute; top: 26px; left: 0; z-index: 30; width: 380px; max-height: 60vh; overflow: auto; … |
| `renderer/styles.css:640` | Z S | 16px 62px 3px 22px 4px 1px 9 | .ssky { position: absolute; left: 0; right: 16px; bottom: 0; height: 62px; padding: 3px 22px 4px; background:… |
| `renderer/styles.css:798` | S D | 30px 48px 4px | .gch { position: absolute; top: 30px; height: 48px; display: flex; flex-direction: column; justify-content: f… |
| `renderer/styles.css:805` | S D | 40px 190px 6px | .grh { position: absolute; left: 40px; width: 190px; display: flex; align-items: center; gap: 6px; } |
| `shared/flowseq.ts:196` |  | 14 10 16 10 4 | const metroX = (d: number) => 14 + Math.min(d, 10) * 16 + Math.max(0, d - 10) * 4; |
| `shared/flowseq.ts:197` |  | 26 | const textX = metroX(maxD) + 26; |

### D. A fixed size for content that can grow (names, line or function numbers, counts) (17 faults, 14 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/components/GridView.tsx:17` | F S | 236 84 76 46 4 270 23 1800 62 | const SIDE = 236, HEAD = 84, TOT = 76, FOOT = 46, GAP = 4, OPEN_W = 270, LINE_H = 23, BIG = 1800, SKY = 62; |
| `renderer/components/GridView.tsx:124` |  | 44 92 12 92 | const cw = Math.max(44, Math.min(92, nc ? Math.floor((vw() - SIDE - TOT - 12 - breaks(cs) * GAP - (pc >= 0 ? … |
| `renderer/components/GridView.tsx:125` |  | 19 28 28 | const rh = Math.max(19, Math.min(28, nr ? Math.floor((vh() - HEAD - FOOT - breaks(rs) * GAP - openH) / nr) : … |
| `renderer/components/Magnifier.tsx:4` |  | 420 260 | const LW = 420, LH = 260; |
| `renderer/styles.css:56` | W S | 36px 10px 14px 300 15px | .ph { height: 36px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 14px; font: 300 15p… |
| `renderer/styles.css:477` | E+ S | 50px 23px 23px 400 11px 23px | .seqv.metro .srow .fno { flex: none; width: 50px; height: 23px; line-height: 23px; overflow: hidden; white-sp… |
| `renderer/styles.css:508` | Z C S | 26px 30 380px 60vh 1px 8px 8px 12px 10px 300 12.5px | .setm { position: absolute; top: 26px; left: 0; z-index: 30; width: 380px; max-height: 60vh; overflow: auto; … |
| `renderer/styles.css:613` | S | 34px 12px | .scall .ln, .speek .ln { width: 34px; flex: none; text-align: right; padding-right: 12px; color: #3a3f3a; } |
| `renderer/styles.css:721` | S | 46px | .cres .hit .ln { width: 46px; text-align: right; color: var(--faint); flex: none; } |
| `renderer/styles.css:798` | C S | 30px 48px 4px | .gch { position: absolute; top: 30px; height: 48px; display: flex; flex-direction: column; justify-content: f… |
| `renderer/styles.css:805` | C S | 40px 190px 6px | .grh { position: absolute; left: 40px; width: 190px; display: flex; align-items: center; gap: 6px; } |
| `renderer/styles.css:806` | E+ S | 30px 400 10px 500 12.5px | .grh span { width: 30px; flex: none; font: 400 10px var(--mono); color: #5f665f; } .grh b { font: 500 12.5px … |
| `renderer/styles.css:807` | E+ S | 150px 1 1 300 10.5px | .grh b { flex: 0 0 auto; max-width: 150px; } .grh .gw { flex: 1 1 auto; font: 300 10.5px var(--ui); font-styl… |
| `renderer/styles.css:858` | Z S | 74px 9 60px | .gtot { position: absolute; width: 74px; background: var(--bg); z-index: 9; box-shadow: 0 60px 0 0 var(--bg);… |

### E+. A cut whose full text or list can be reached (hover, opening, scrolling, typing, a setting) (47 faults, 51 lines here; with §3b: 49 faults, 53 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/components/Card.tsx:64` |  | 8 0.09 | <span class="gauge">{Array.from({ length: Math.min(v.depth, 8) }, (_, i) => <i style={{ opacity: String(1 - i… |
| `renderer/components/GridView.tsx:142` |  | 3 | const most = [...m.rows].filter((r) => r.count > 1).sort((a, b) => b.count - a.count \|\| a.first - b.first).sl… |
| `renderer/components/GridView.tsx:238` |  | 6 4 | const steps = v.length > 6 ? '${v.slice(0, 4).map((it) => it + 1).join(' · ')} · … · ${v[v.length - 1] + 1} (… |
| `renderer/components/GridView.tsx:320` |  | 9 | if (route() && /^[1-9]$/.test(key)) { const r = route()!, i = Number(key) - 1; if (i < r.list.length) setRout… |
| `renderer/components/GridView.tsx:426` | F | 4 8 | <Show when={l().length < 4} fallback={<span class="dots"><For each={l().slice(0, 8)}>{(it) => <b classList={{… |
| `renderer/components/GridView.tsx:485` |  | 9 | <div class="ways pv"><span><b>1–{Math.min(9, r().list.length)}</b> one route</span><span><b>Esc</b> clear</sp… |
| `renderer/components/Palette.tsx:18` |  | 80 | .filter((x) => x.s !== null).sort((a, b) => b.s! - a.s!).slice(0, 80).map((x) => x.it); |
| `renderer/components/Programs.tsx:9` |  | 3 | const FIRST = 3; |
| `renderer/components/Programs.tsx:22` |  |  | return [...g].map(([k, list]) => ({ k, list, shown: qq \|\| open().has(k) ? list : list.slice(0, FIRST) })); |
| `renderer/components/Sequence.tsx:416` |  | 9 | return [...by.values()].slice(0, 9).map((e) => ({ ...e, steps: e.steps.join(' · ') })); |
| `renderer/components/Sequence.tsx:637` |  | 8 9 | const n = Math.max(1, Math.min(fn.lines \|\| 8, 9)); |
| `renderer/components/Sequence.tsx:660` |  | 6 | if (crumbsAll() \|\| c.length <= 6) return c; |
| `renderer/components/Sequence.tsx:661` |  | 4 | return [c[0], { name: '…', it: -1 }, ...c.slice(-4)]; |
| `renderer/components/Sequence.tsx:821` |  | 3 | const n = Math.min(3, rowOf(it).could!.length); |
| `renderer/components/Sequence.tsx:906` |  | 40 14 3 | <span class="mini">{Array.from({ length: Math.min(40, S()!.lastItem[it] - it) }, (_, k) => <i style={{ height… |
| `renderer/components/Sequence.tsx:926` |  | 8 | const ran = () => { const out: { n: string; name: string }[] = []; for (let i = w.skip[0]; i <= w.skip[1] && … |
| `renderer/components/Sequence.tsx:930` |  | 8 8 | <div class="col"><div class="h">as it runs</div><For each={ran()}>{(r) => <div><span class="n">{r.n}</span>{r… |
| `renderer/components/Sequence.tsx:971` |  |  | <Show when={peekCode()!.more}><div class="more">…</div></Show> |
| `renderer/components/Sequence.tsx:992` |  | 12 | const shown = () => p().options.filter((o) => o.label.toLowerCase().includes(pick()!.q.toLowerCase())).slice(… |
| `renderer/components/Sequence.tsx:1045` |  | 9 | if (/^[1-9]$/.test(e.key) && Number(e.key) <= f().routes.length) followPath(f().routes[Number(e.key) - 1], Nu… |
| `renderer/lib/actions.ts:118` |  | 60 | return res.slice(0, 60).map((s) => ({ label: '${s.containerName ? s.containerName + '::' : ''}${s.name}', det… |
| `renderer/lib/lsp.ts:158` |  | 200 | options: items.slice(0, 200).map((it) => { |
| `renderer/lib/preview.ts:69` |  | 400 | const a = bodiless ? def.selectionRange.start.line : def.range.start.line, b = bodiless ? a : Math.min(def.ra… |
| `renderer/lib/preview.ts:115` |  | 8 13 | out.push(await mk('assert', 'static_assert', file, l0, Math.min(l1, l0 + 8), { start: posAt(text, a.from), en… |
| `renderer/lib/preview.ts:136` |  | 30 | while (/\\\s*$/.test(lines[b] ?? '') && b - def.line < 30) b++; |
| `renderer/lib/preview.ts:152` |  | 40 | if (lam) { const l = lam as { from: number; to: number }; const a = lineOf(dtext, l.from); return mk('lambda'… |
| `renderer/lib/preview.ts:156` |  | 5 | return mk('indirect', name, def.file, a, Math.min(lineOf(dtext, decl.to), a + 5), range, at); |
| `renderer/styles.css:166` | S | 400 12px 2px | .st-rc .p { font: 400 12px var(--mono); color: var(--dim); margin-top: 2px; overflow: hidden; text-overflow: … |
| `renderer/styles.css:450` | S | 300 15px 7px 1 | .seqpath { font: 300 15px var(--ui); color: #9aa094; overflow: hidden; white-space: nowrap; display: flex; al… |
| `renderer/styles.css:451` |  | 1 1.6em | .seqpath .crumb { font: inherit; color: #9aa094; padding: 0; margin: 0; white-space: nowrap; flex: 0 1 auto; … |
| `renderer/styles.css:466` | Z C S | 30px 4 44px 5px 16px 1px 300 11px | .mlegend { position: absolute; left: 0; top: 0; right: 30px; z-index: 4; height: 44px; padding: 5px 16px 0; b… |
| `renderer/styles.css:477` | D S | 50px 23px 23px 400 11px 23px | .seqv.metro .srow .fno { flex: none; width: 50px; height: 23px; line-height: 23px; overflow: hidden; white-sp… |
| `renderer/styles.css:491` | S | 400 10.5px 1px 5px 16px 220px | .mchip { font: 400 10.5px var(--ui); color: #8b9189; border: 1px solid #3a3f3a; padding: 0 5px; line-height: … |
| `renderer/styles.css:502` | S | 300 11.5px | .srow .sx { font: 300 11.5px var(--ui); color: var(--err); white-space: nowrap; overflow: hidden; text-overfl… |
| `renderer/styles.css:523` | S | 8px 300 12px 420px | .setc .csum { margin-left: 8px; font: 300 12px var(--ui); color: var(--bright); max-width: 420px; overflow: h… |
| `renderer/styles.css:530` | S | 300 11px | .srow .sd { font: 300 11px var(--ui); color: #7a8a8a; white-space: nowrap; overflow: hidden; text-overflow: e… |
| `renderer/styles.css:564` | S | 23px 8px 6px 300 11.5px 23px 2px .42s .16 1 .3 1 .42s .16 1 .3 1 | .sjn { position: absolute; height: 23px; display: flex; align-items: baseline; gap: 8px; padding-left: 6px; f… |
| `renderer/styles.css:568` |  |  | .sjn .w { overflow: hidden; text-overflow: ellipsis; min-width: 0; } |
| `renderer/styles.css:659` | S | 40% 10px 300 12px 2px | .srow .snote { margin-left: auto; max-width: 40%; overflow: hidden; text-overflow: ellipsis; padding: 0 10px;… |
| `renderer/styles.css:664` | S | 300 12.5px | .seqchg { font: 300 12.5px var(--ui); color: #79c9ae; white-space: nowrap; overflow: hidden; text-overflow: e… |
| `renderer/styles.css:737` | S | 12.5px | .progs .pr .p { font-size: 12.5px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; } |
| `renderer/styles.css:765` | S | 12px 400 12.5px 1px 1px 8px | .sprev .pfn { margin-left: 12px; font: 400 12.5px var(--mono); color: #e3d6ad; border: 1px solid #ad9b6f; pad… |
| `renderer/styles.css:774` | S | 400 12.5px | .ibx .w { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: 400 12.5px var(--mono); color… |
| `renderer/styles.css:797` | S | 8px 16px 2px 400 11px 2px 70% | .gfb { position: absolute; top: 8px; height: 16px; padding-left: 2px; font: 400 11px var(--ui); color: var(--… |
| `renderer/styles.css:800` | S | 500 11.5px 1.2 2 | .gch b { font: 500 11.5px/1.2 var(--mono); color: #9ea39b; overflow-wrap: anywhere; display: -webkit-box; -we… |
| `renderer/styles.css:804` | S | 180deg 400 10.5px 100% | .grb span { writing-mode: vertical-rl; transform: rotate(180deg); font: 400 10.5px var(--ui); color: var(--c)… |
| `renderer/styles.css:806` | D S | 30px 400 10px 500 12.5px | .grh span { width: 30px; flex: none; font: 400 10px var(--mono); color: #5f665f; } .grh b { font: 500 12.5px … |
| `renderer/styles.css:807` | D S | 150px 1 1 300 10.5px | .grh b { flex: 0 0 auto; max-width: 150px; } .grh .gw { flex: 1 1 auto; font: 300 10.5px var(--ui); font-styl… |
| `shared/search.ts:22` |  | 80 | const l = lines[i].replace(/\r$/, ''), from = Math.max(0, m.index - 80); |
| `shared/search.ts:23` |  | 240 | out.push({ file, line: i, col: m.index, len: m[0].length, text: (from ? '…' : '') + l.slice(from, from + 240)… |
| `shared/settings-schema.ts:58` |  | 12 100 | { key: 'preview.max_cards', type: 'number', default: 12, min: 1, max: 100, doc: 'per level; the rest fold int… |

### E±. A cut that counts what it hides ("+N more") but cannot show it (7 faults, 10 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/components/FilesPane.tsx:59` |  | 500 | return (all() ?? []).filter((f) => matchesIn(relTo(f), q, 1).length).slice(0, 500); |
| `renderer/components/FilesPane.tsx:74` |  | 500 | <div class="fcount">{all.loading ? t('listing files…') : '${hits().length}${hits().length === 500 ? '+' : ''}… |
| `renderer/components/Preview.tsx:282` |  | 4 4 | <Show when={lv().more.length}><div class="more">+{lv().more.length} more · {lv().more.slice(0, 4).join(', ')}… |
| `renderer/components/Programs.tsx:85` |  | 12 12 | <Show when={l().shared.length > 12}><div class="pl sub">+{l().shared.length - 12} more</div></Show> |
| `renderer/components/SearchPanel.tsx:8` |  | 3000 | const SHOWN = 3000; |
| `renderer/components/SearchPanel.tsx:16` |  |  | result.hits.slice(0, SHOWN).forEach((h, i) => g.set(h.file, [...(g.get(h.file) ?? []), i])); |
| `renderer/components/Sequence.tsx:299` |  | 3 3 3 6 6 | return 'edited, not saved: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' +${names.length - 3}' : ''} … |
| `shared/flowseq.ts:391` |  | 6 6 6 | if (r.kind === 'indirect' && r.could?.length) out.push({ head: 'could be', text: '${r.could.slice(0, 6).join(… |
| `shared/flowseq.ts:439` |  | 40 | const MAX_BLOCK = 40; |
| `shared/flowseq.ts:466` |  |  | const shown = rows.length > MAX_BLOCK ? [...rows.slice(0, MAX_BLOCK - 1), { n: -1, text: '… ${rows.length - M… |

### E-. A silent cut: what is hidden is neither counted nor reachable (63 faults, 66 lines here; with §3b: 69 faults, 72 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `main/compilers.ts:115` |  | 24 | if (out.length >= 24) break; |
| `main/main.ts:171` |  | 5 | ipcMain.handle('recent:get', () => readRecent().slice(0, 5).map((r) => ({ ...r, found: fs.existsSync(r.path) … |
| `main/main.ts:172` |  | 5 | ipcMain.handle('recent:add', (_e, p: string) => atomicWrite(RECENT, JSON.stringify([{ path: p, at: Date.now()… |
| `main/main.ts:234` |  | 40 | const out = await gitOut(root, ['log', '-n', '40', '--format=%H%x1f%h%x1f%s%x1f%cr']); |
| `main/main.ts:407` |  | 12 | const errors = base.filter((d) => (d.severity ?? 1) === 1).slice(0, 12), starts = lineStarts(text); |
| `main/main.ts:422` |  | 3 | out.push(...ok.filter((s) => s.cleared === best).slice(0, 3)); |
| `renderer/components/Card.tsx:69` |  |  | <span class="loc">{props.card.std ? props.card.file.split('/').slice(-2).join('/') : cardLoc(props.card)}</sp… |
| `renderer/components/CompilerWindow.tsx:167` |  | 10 | <For each={releases('toolchain').slice(0, 10)}>{(r) => ( |
| `renderer/components/CompilerWindow.tsx:202` |  | 8 | <For each={releases(k()).slice(0, 8)}>{(r) => ( |
| `renderer/components/GridView.tsx:176` |  | 64 63 | const text = full.length > 64 ? '${full.slice(0, 63)}…' : full; |
| `renderer/components/GridView.tsx:335` | A | 6 4 7.5 4 18 | cols().forEach((cc, i) => { g.fillStyle = col().get(cc.file)!; g.fillRect(SIDE + G.x.at[i], HEAD - 6, G.x.w[i… |
| `renderer/components/Preview.tsx:266` | S | 22px 18px | <span style={{ width: '${c === 0 ? w1() : w2()}px', flex: 'none', 'padding-left': '22px', overflow: 'hidden',… |
| `renderer/components/Programs.tsx:26` |  | 20 | const CONNECT_MAX = 20; |
| `renderer/components/Programs.tsx:30` |  |  | const list = entries().map((e, i) => ({ e, i })).filter(({ e }) => e.kind !== 'interrupt' && (!qq \|\| matchesI… |
| `renderer/components/Programs.tsx:84` |  | 12 4 4 | <For each={l().shared.slice(0, 12)}>{(x) => <div class="pl"><span class="f">{basename(x.file)}</span><span cl… |
| `renderer/components/Sequence.tsx:482` |  | 40 | const t = encodeWalk(entryKey(), trail(), 40, notesByItem()); |
| `renderer/components/Sequence.tsx:651` |  | 34 33 | const loop = f ? 'pass ${c.passes[inner] ?? 1}${f.count != null ? ' of ${f.count}' : ''} · ${f.text.length > … |
| `renderer/components/StartWindow.tsx:36` |  | 5 | const r = n >= 1 && n <= 5 ? recent()[n - 1] : e.key === 'Enter' && document.activeElement === document.body … |
| `renderer/lib/flow.ts:480` |  | 12 | r.could = t.map(([n, files]) => ({ n, far: +!files.some((f) => f.startsWith(dir)) })).sort((a, b) => a.far - … |
| `renderer/lib/goto.ts:95` |  | 40 | for (let i = loc.line; i < lines.length && i < loc.line + 40; i++) { |
| `renderer/lib/preview.ts:129` |  |  | return out.sort((a, b) => first(a) - first(b)).slice(0, max); |
| `renderer/styles.css:37` | S | 24px 300 27px .01em | .pivot { display: flex; align-items: baseline; gap: 24px; font: 300 27px var(--ui); letter-spacing: -.01em; w… |
| `renderer/styles.css:110` | S | .5px | .rs .ed { font: var(--code-weight) calc(var(--code-size) - .5px) var(--mono); color: #7b8279; white-space: pr… |
| `renderer/styles.css:135` | S | .9 7px 7px 10px 24px 1.3 10.5px | .card-h { --hk: calc(var(--preview-scale) / .9); display: flex; align-items: center; gap: 7px; padding: calc(… |
| `renderer/styles.css:137` |  |  | .card-h .nm { color: #727971; overflow: hidden; text-overflow: ellipsis; } |
| `renderer/styles.css:203` | S | 30px 4px 26px | .set .pv { display: flex; gap: 30px; margin: 4px 0 26px; white-space: nowrap; overflow: hidden; } |
| `renderer/styles.css:222` | S | 100% 4px 12px 15px 28px | .combo-list button { display: block; width: 100%; text-align: left; padding: 4px 12px; font-size: 15px; color… |
| `renderer/styles.css:308` | S | 12.5px 400 12px 5px | .bxr .t { font: 12.5px var(--mono); color: #c9cdc5; white-space: nowrap; overflow: hidden; text-overflow: ell… |
| `renderer/styles.css:342` | S | 10px 8px 300 11px | .pdiv { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; font: 300 11px var(--ui); color: #3f4… |
| `renderer/styles.css:345` |  |  | .pdiv span { overflow: hidden; text-overflow: ellipsis; } |
| `renderer/styles.css:353` |  |  | .pal-it .l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } |
| `renderer/styles.css:394` |  |  | .cwin .copt .dim { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } |
| `renderer/styles.css:418` |  | 1 | .cwin .cfoot .dim { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } |
| `renderer/styles.css:449` | S | 300 13px | .seqloop { font: 300 13px var(--ui); color: #7fb0b0; white-space: nowrap; overflow: hidden; text-overflow: el… |
| `renderer/styles.css:455` | S | 300 13px | .seqpth { font: 300 13px var(--ui); color: var(--accent); white-space: nowrap; overflow: hidden; text-overflo… |
| `renderer/styles.css:460` | S | 8px 23px 23px 12px | .srow { position: absolute; display: flex; align-items: baseline; gap: 8px; height: 23px; line-height: 23px; … |
| `renderer/styles.css:472` |  |  | .mhead > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } |
| `renderer/styles.css:480` | S | 1 1 6px | .seqv.metro .srow .mmain { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; display: fle… |
| `renderer/styles.css:481` |  |  | .seqv.metro .srow .mmain .nm, .seqv.metro .srow .mmain .who { overflow: hidden; text-overflow: ellipsis; min-… |
| `renderer/styles.css:484` | S | 1 62% 5px | .seqv.metro .srow .mcall { flex: 0 1 auto; max-width: 62%; color: #c9cec6; background: #1e201e; padding: 0 5p… |
| `renderer/styles.css:485` | S | 100 300 11.5px | .seqv.metro .srow .min { flex: 0 100 auto; font: 300 11.5px var(--ui); color: var(--dim); white-space: nowrap… |
| `renderer/styles.css:487` | S | 96px 16% 150px 10px 400 11.5px | .seqv.metro .srow .mres { flex: 0 0 clamp(96px, 16%, 150px); padding-left: 10px; font: 400 11.5px var(--mono)… |
| `renderer/styles.css:513` | S | 12px | .setm .mr .k { font: 12px var(--mono); color: var(--bright); overflow: hidden; text-overflow: ellipsis; } |
| `renderer/styles.css:521` |  | 1 | .setm .mr .mi { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } |
| `renderer/styles.css:531` | S | 300 11.5px | .srow .sw { font: 300 11.5px var(--ui); color: var(--info); white-space: nowrap; overflow: hidden; text-overf… |
| `renderer/styles.css:582` | S | 8px 300 11px 15px | .sframe > span { position: absolute; left: 8px; font: 300 11px/15px var(--ui); color: #3f5a5a; white-space: n… |
| `renderer/styles.css:612` |  |  | .scall > div:not(.from) { display: flex; white-space: pre; overflow: hidden; } |
| `renderer/styles.css:618` | S | 12px 1.6 46px 12px | .speek .l { display: flex; white-space: pre; overflow: hidden; font: 12px/1.6 var(--mono); color: #9ea39b; } … |
| `renderer/styles.css:621` | S | 12px 3px 16px 300 12.5px | .schap button { display: flex; gap: 12px; align-items: baseline; padding: 3px 16px; font: 300 12.5px var(--ui… |
| `renderer/styles.css:629` | S | 12px 100% 5px 16px 12.5px | .sfind .opt { display: flex; gap: 12px; align-items: baseline; width: 100%; padding: 5px 16px; text-align: le… |
| `renderer/styles.css:710` |  |  | .mk { overflow: hidden; text-overflow: ellipsis; white-space: pre; } |
| `renderer/styles.css:715` |  | 55% | .csearch .sum { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; } |
| `renderer/styles.css:736` | S | 12px 100% 27px 10px 300 14px | .progs .pr { display: flex; gap: 12px; align-items: baseline; width: 100%; height: 27px; padding: 0 10px; tex… |
| `renderer/styles.css:746` |  |  | .sline .tx { overflow: hidden; text-overflow: ellipsis; min-width: 0; } |
| `renderer/styles.css:820` | S | 500 11px 1px 3px 14px | .gcell i { display: inline-flex; align-items: baseline; white-space: nowrap; font: 500 11px var(--mono); font… |
| `renderer/styles.css:845` | S | 1 400 11px | .gstep code { flex: 1; min-width: 0; font: 400 11px var(--mono); color: #c9cec6; white-space: nowrap; overflo… |
| `renderer/styles.css:890` | S | 1 4 400 11px | .ibx .cl code { grid-column: 1 / 4; font: 400 11px var(--mono); color: #c9cec6; white-space: pre; overflow: h… |
| `shared/flowcore.ts:9` |  | 34 | const squash = (s: string, max = 34) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > max ? t.… |
| `shared/flowcore.ts:23` |  | 26 | return '×n · ${squash(range, 26)}'; |
| `shared/flowrun.ts:443` |  |  | const firstLine = (s: string) => { const l = s.split('\n')[0].trim(); return l.length < s.trim().length ? l +… |
| `shared/flowseq.ts:288` |  | 40 | export function encodeWalk(entry: string, trail: StepState[], keep = 40, notes: Record<number, string> = {}):… |
| `shared/gridlinks.ts:44` |  |  | if (resultName(s, j, lines).name === v) return { kind: 'result', row: j, text: '${v} = ${nameOf(s, j)}(…)' }; |
| `shared/metrofacts.ts:87` |  |  | if (r.kind === 'indirect') notes.push({ text: r.could?.length ? 'through ${r.via ?? 'a pointer'} · could be $… |
| `shared/metrofacts.ts:95` |  |  | for (const g of fx.globalWrites.slice(0, 2)) notes.push({ text: 'writes ${g}', tone: 'warn' }); |
| `shared/repair.ts:203` |  | 8 | return out.slice(0, 8); |
| `shared/search.ts:14` |  | 200 | export function hitsIn(file: string, text: string, q: string, max = 200): Hit[] { |

### F. A count or size threshold that switches what is drawn (9 faults, 16 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/components/Flow.tsx:51` |  | 6 | <Show when={entries().length > 1 && entries().length <= 6 && !listing()}> |
| `renderer/components/GridView.tsx:17` | D S | 236 84 76 46 4 270 23 1800 62 | const SIDE = 236, HEAD = 84, TOT = 76, FOOT = 46, GAP = 4, OPEN_W = 270, LINE_H = 23, BIG = 1800, SKY = 62; |
| `renderer/components/GridView.tsx:426` | E+ | 4 8 | <Show when={l().length < 4} fallback={<span class="dots"><For each={l().slice(0, 8)}>{(it) => <b classList={{… |
| `renderer/components/GridView.tsx:496` |  |  | for (const [k, v] of props.model.cells) { const i = k.indexOf('>'); const key = '${rf.get(k.slice(i + 1))}\|${… |
| `renderer/components/GridView.tsx:499` |  | 96 28 | const W = 96, H = 28; |
| `renderer/components/GridView.tsx:501` |  | 40 40 | <div class="gsz" style={{ width: '${SIDE + files().length * W + 40}px', height: '${HEAD + files().length * H … |
| `renderer/components/GridView.tsx:502` |  | 0px 40 4 | <div class="gstrip top" style={{ left: '0px', top: '${props.st}px', width: '${SIDE + files().length * W + 40}… |
| `renderer/components/GridView.tsx:503` |  | 0px 4 40 | <div class="gstrip side" style={{ left: '${props.sl}px', top: '0px', width: '${SIDE - 4}px', height: '${HEAD … |
| `renderer/components/GridView.tsx:504` |  | 4 4 | <div class="gcorner" style={{ left: '${props.sl}px', top: '${props.st}px', width: '${SIDE - 4}px', height: '$… |
| `renderer/components/GridView.tsx:507` |  | 30 | <For each={files()}>{(f, i) => <div class="gch" title={f} style={{ top: '${props.st + 30}px', left: '${SIDE +… |
| `renderer/components/GridView.tsx:510` |  | 40 | <div class="grh" title={rf} style={{ left: '${props.sl + 40}px', top: '${HEAD + j() * H}px', height: '${H - 2… |
| `renderer/components/Sequence.tsx:28` |  | 400 | const AROUND_AT = 400; |
| `renderer/components/Sequence.tsx:759` |  | 150 | <Show when={aroundOn() \|\| N() > 150}><button class="chip" classList={{ on: aroundOn() }} aria-pressed={around… |
| `renderer/components/Sequence.tsx:816` |  | 8 | <For each={visFrames().filter((f) => { const sp = S()!.span.get(f)!; return sp[1] > sp[0] && sp[1] - sp[0] < … |
| `renderer/styles.css:190` |  | 760px 1fr | @media (max-width: 760px) { .st-cols { grid-template-columns: 1fr; } .st-foot .r { display: none; } } |
| `shared/flowseq.ts:12` |  | 3 | export const FOLD_LINES = 3; |

### G. A case with no drawing, or a wrong one (24 faults, 24 lines here; with §3b: 76 faults, 84 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/lib/flowstore.ts:50` |  |  | the flow is built only once clangd is ready: while it starts, and after it has failed, the grid and the metro say "building…" (GridView.tsx:385, Sequence.tsx:777); what starts the build again after a restart was not traced |
| `renderer/components/CompareChip.tsx:25` |  |  | while git history loads, the compare menu lists no commits and says nothing |
| `renderer/components/CompareChip.tsx:34` |  |  | a repository with no commits gives an empty list with no message |
| `renderer/components/FilesPane.tsx:22` |  |  | an empty folder, or one still being listed, shows nothing under its open arrow |
| `renderer/components/GridView.tsx:172` |  |  | the entry step has no square, so it gets no arrows at all (X5) |
| `renderer/components/GridView.tsx:179` |  |  | label places are tested against squares and other labels only, not arrows, headings, names or totals; if none… |
| `renderer/components/GridView.tsx:187` |  |  | a link between two steps in the same square is not drawn |
| `renderer/components/GridView.tsx:189` |  |  | several links of one kind between the same two squares are drawn as one arrow (V22) |
| `renderer/components/GridView.tsx:191` |  |  | when no free route exists, the fallback route runs straight through other squares and their numbers |
| `renderer/components/GridView.tsx:195` |  |  | one "calls" label for all the step's calls, placed at the first call's square whatever the others |
| `renderer/components/GridView.tsx:250` |  |  | the hover tag is tested against squares only; if no place is free the first is used anyway |
| `renderer/components/GridView.tsx:290` |  |  | shift-click for a route works only on function rows; on indirect and value rows it does nothing and says noth… |
| `renderer/components/GridView.tsx:406` |  |  | value rows carry no mark (indirect rows show →): a function passed as a value reads as a function call |
| `renderer/components/Preview.tsx:293` |  |  | with a folder open and clangd still starting, the preview says "open a folder to start" |
| `renderer/components/Programs.tsx:31` |  |  | with 0 or 1 program listed, "how they connect" says "how 1 programs connect — they start none of each other" |
| `renderer/components/SettingChip.tsx:45` |  |  | while the build-setting options load, the menu shows only "as built", with no sign that more is coming |
| `renderer/components/SettingChip.tsx:54` |  |  | with no compile_commands.json, the settings that could change are left out without a word why |
| `renderer/components/StepPreview.tsx:137` |  |  | the dotted link to the card is one curve whatever lies between the step and the card (the 62 crossings the ga… |
| `renderer/lib/preview.ts:204` |  |  | while clangd cannot yet answer for the function, the first column says "no calls in this function"; after 30 … |
| `renderer/lib/preview.ts:243` |  |  | the same for every deeper column: a card whose calls are not resolved yet opens a column that says "no calls" |
| `renderer/lib/repair.ts:161` |  |  | when the check for fixes fails, "checking fixes…" disappears and nothing says it failed or why |
| `renderer/lib/search.ts:21` |  |  | if a search fails, the result never ends: the panel keeps "N so far…" and no error is shown |
| `shared/flowseq.ts:463` |  | 4 | rows.push({ n, text: t, depth: Math.max(0, Math.round((raw.search(/\S/) - Math.max(0, base)) / 4)) }); |
| `shared/gridmodel.ts:20` |  |  | a call back into a running function and a call on a new thread are cells like any other: the grid draws neith… |

### O. An overlay that breaks its rule: it does not close with Esc, closes more than itself, or opens out of sight (7 faults, 7 lines here; with §3b: 11 faults, 11 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/App.tsx:57` |  |  | with the start window up (no folder open), ⌘/Ctrl , opens Settings (z 20, styles.css:201) underneath it (z 32, styles.css:152), out of sight |
| `renderer/components/CompareChip.tsx:29` |  |  | the compare menu closes with Esc only while focus is inside it; after opening it focus stays on the chip, and no click outside closes it |
| `renderer/components/CompilerWindow.tsx:104` |  |  | the language-engine window has no Esc: only its × closes it |
| `renderer/components/Palette.tsx:27` |  |  | Esc in the palette is not stopped: it reaches the window and also closes Settings, the app menu and the start window when they are open |
| `renderer/components/Sequence.tsx:549` |  |  | one Esc in the metro closes every popover at once and also stops play and drops the followed value, instead of closing the top one |
| `renderer/components/SettingChip.tsx:48` |  |  | the build-settings menu: the same as the compare menu |
| `renderer/lib/actions.ts:196` |  |  | with the start window up, ⌘/Ctrl ⇧ P opens the command palette (z 30) underneath it (z 32), out of sight, with the keys going to it |

### H. Information that disappears on a timer (18 faults, 22 lines here; with §3b: 19 faults, 23 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/App.tsx:47` |  | 8000 | if (s.problems.length) flash('settings.toml: ${s.problems[0].message}${s.problems.length > 1 ? ' (+${s.proble… |
| `renderer/App.tsx:48` |  | 12000 | if ((i as any).fallbackReason) flash((i as any).fallbackReason, 12000); |
| `renderer/components/CompilerWindow.tsx:80` |  | 8000 | if (!res.ok) { if (res.message !== 'cancelled') flash('couldn't install ${r.id}: ${res.message}', 8000); retu… |
| `renderer/components/CompilerWindow.tsx:82` |  | 4000 | flash('${r.id} installed in language_packs', 4000); |
| `renderer/components/FilesPane.tsx:117` |  | 6000 | const terminal = async () => { const why = (await api.shell.terminal(folderNow())) as string \| null; if (why)… |
| `renderer/components/Flow.tsx:18` |  | 5000 | if (await api.lsp.stale()) { flash('compile_commands.json changed: clangd reads the project again', 5000); aw… |
| `renderer/components/GridView.tsx:255` |  |  | let capTimer: ReturnType<typeof setTimeout> \| undefined; |
| `renderer/components/GridView.tsx:256` |  | 2600 | const say = (key: string, what: string, why = '') => { setCaption({ key, what, why }); clearTimeout(capTimer)… |
| `renderer/components/GridView.tsx:339` |  | 3000 | flash('saved ${basename(file)} · ${c.width} × ${c.height}', 3000); |
| `renderer/components/Sequence.tsx:322` |  |  | let capTimer: ReturnType<typeof setTimeout> \| undefined; |
| `renderer/components/Sequence.tsx:323` |  | 2600 | function say(c: { key: string; what: string; why: string }, ms = 2600) { |
| `renderer/components/Sequence.tsx:326` |  |  | if (ms) capTimer = setTimeout(() => setCaption(null), ms); |
| `renderer/components/Sequence.tsx:382` |  | 1700 | setTimeout(() => { if (ret()?.key === key) setRet(null); }, 1700); |
| `renderer/components/Sequence.tsx:483` |  | 4000 | try { await navigator.clipboard.writeText(t); flash('link to this walk copied · paste it into G (go to) to re… |
| `renderer/components/Sequence.tsx:484` |  | 8000 | catch { flash('couldn't copy: ${t}', 8000); } |
| `renderer/components/Sequence.tsx:499` |  | 3000 | flash('saved ${basename(file)}', 3000); |
| `renderer/lib/actions.ts:33` |  | 5000 | if (byFile.size) flash('changed ${byFile.size} file${byFile.size > 1 ? 's' : ''} — review, then save (⌘/Ctrl … |
| `renderer/lib/goto.ts:137` |  | 7000 | if (!loc) { flash(await whyNoDefinition(src.file(), w.line, w.character, w.name), 7000); return; } |
| `renderer/lib/store.ts:59` |  | 3200 | export function flash(msg: string, ms = 3200) { |
| `renderer/lib/store.ts:61` |  |  | window.setTimeout(() => { if (toast() === msg) setToast(null); }, ms); |
| `renderer/lib/store.ts:147` |  | 6000 | try { await api.fs.write(path, text); } catch (e) { flash('couldn't save ${basename(path)}: ${e}', 6000); ret… |
| `renderer/lib/store.ts:189` |  | 7000 | flash('${basename(path)} changed on disk while you have unsaved edits. Saving will overwrite the disk version… |

### W. One-line text with no bound of its own: it runs past its box, over its neighbours or into a parent's cut (24 faults, 24 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `renderer/styles.css:42` | S | 300 15px 12px | .crumb { font: 300 15px var(--ui); color: #7d6f50; margin-left: -12px; white-space: nowrap; } |
| `renderer/styles.css:43` | S | 112px 12px 300 11.5px 18px | .hdr .status { margin-left: auto; margin-right: 112px; align-self: flex-start; margin-top: 12px; font: 300 11… |
| `renderer/styles.css:56` | D S | 36px 10px 14px 300 15px | .ph { height: 36px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 14px; font: 300 15p… |
| `renderer/styles.css:68` | S | 6px 23px 12px | .ti { display: flex; align-items: center; gap: 6px; height: 23px; padding-right: 12px; color: #777e76; white-… |
| `renderer/styles.css:113` | S | 300 11px 6px | .rs .src { font: 300 11px var(--ui); color: var(--faint); margin-left: 6px; white-space: nowrap; } |
| `renderer/styles.css:167` | S | 300 12px | .st-rc .w { margin-left: auto; font: 300 12px var(--ui); color: var(--dim); white-space: nowrap; } |
| `renderer/styles.css:180` | S | 400 11.5px | .st-big .kb { margin-left: auto; font: 400 11.5px var(--mono); color: var(--dim); white-space: nowrap; } |
| `renderer/styles.css:215` | S | 300 12px | .numrow .unit { font: 300 12px var(--ui); color: #4f564f; white-space: nowrap; } |
| `renderer/styles.css:217` | C S | 25px 50% 1px 7px 300 12.5px | .slide .bubble { position: absolute; top: 25px; transform: translateX(-50%); padding: 1px 7px; background: va… |
| `renderer/styles.css:354` | S | 300 12px | .pal-it .d { margin-left: auto; font: 300 12px var(--ui); color: var(--dim); white-space: nowrap; } |
| `renderer/styles.css:365` |  |  | .std-act button { color: var(--link); white-space: nowrap; flex: none; } |
| `renderer/styles.css:457` | S | 5px 16px 300 12.5px 173 155 111 .12 | .smenu button { padding: 5px 16px; font: 300 12.5px var(--ui); color: #c9cdc5; text-align: left; white-space:… |
| `renderer/styles.css:635` | S | 4px 16px 300 12.5px 173 155 111 .12 | .swmenu button { padding: 4px 16px; font: 300 12.5px var(--ui); color: #c9cdc5; text-align: left; white-space… |
| `renderer/styles.css:651` | Z S | 100% 6px 50% 12px 32px .55 7px 12px 8px 10 .12s | .sskytip { position: absolute; bottom: calc(100% + 6px); transform: translateX(-50%); background: var(--pop);… |
| `renderer/styles.css:665` | S | 22px 1px 300 11px | .seqread { position: absolute; right: 22px; top: 1px; font: 300 11px var(--ui); color: #5f8f7a; white-space: … |
| `renderer/styles.css:668` | Z S | 50% 18px 50% 7px 15px 300 13.5px 20 10px | .scap { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); background: #1f201f; paddin… |
| `renderer/styles.css:763` | S | 300 13px | .sprev .pstep { font: 300 13px var(--ui); color: var(--dim); white-space: nowrap; } |
| `renderer/styles.css:773` | S | 600 11px .05em 2px 8px | .ibx .tg { white-space: nowrap; font: 600 11px var(--ui); letter-spacing: .05em; color: #171817; background: … |
| `renderer/styles.css:775` | S | 300 11.5px | .ibx .s { margin-left: auto; font: 300 11.5px var(--ui); color: var(--dim); white-space: nowrap; } |
| `renderer/styles.css:783` | S | 300 17px | .ghd { font: 300 17px var(--ui); color: var(--bright); white-space: nowrap; } |
| `renderer/styles.css:802` | S | 600 10px .07em | .gax { position: absolute; font: 600 10px var(--ui); letter-spacing: .07em; text-transform: uppercase; color:… |
| `renderer/styles.css:841` | Z S | 4 15px 5px 400 10.5px 15px 2px | .glab { position: absolute; z-index: 4; height: 15px; padding: 0 5px; font: 400 10.5px/15px var(--ui); white-… |
| `renderer/styles.css:857` | Z S | 11 20px 8px 400 11.5px | .gtag { position: absolute; z-index: 11; height: 20px; padding: 0 8px; display: flex; align-items: center; fo… |
| `renderer/styles.css:866` | S | 20px 4px 300 12px | .gnote { position: absolute; left: 20px; top: 4px; font: 300 12px var(--ui); color: var(--dim); white-space: … |

### LIMIT. A size limit outside the drawing that drops data on large codebases (20 faults, 23 lines here; with §3b: 24 faults, 27 lines)

| Line | Also | Values | Text |
|---|---|---|---|
| `main/compilers.ts:103` |  | 5000 | for (const e of entries.slice(0, 5000)) { |
| `main/files.ts:56` |  | 20000 | export function listSources(root: string, cap = 20000): string[] { |
| `main/files.ts:62` |  | 50000 | export function listFiles(root: string, cap = 50000, keep: (p: string) => boolean = () => true): string[] { |
| `main/files.ts:75` |  | 20000 | export async function listSourcesAsync(root: string, cap = 20000): Promise<string[]> { |
| `main/lsp.ts:69` |  | 20000 | const MAX_SOURCES = 20000; |
| `main/lsp.ts:74` |  | 12 | for (let depth = 0; level.length && depth < 12 && sources.length < MAX_SOURCES; depth++) { |
| `main/lsp.ts:99` |  | 400 | : [root, ...headerDirs.filter((d) => d !== root)].slice(0, 400).map((d) => '-I${d}'); |
| `main/search.ts:5` |  | 4 1024 1024 20000 | const MAX_BYTES = 4 * 1024 * 1024, MAX_HITS = 20000; |
| `main/search.ts:29` |  | 50000 | return { id, files, matches, searched, capped: matches >= MAX_HITS \|\| all.length >= 50000, ms: Date.now() - t… |
| `main/targets.ts:12` |  | 8 | for (let depth = 0; level.length && depth < 8; depth++) { |
| `renderer/components/Card.tsx:61` |  | 4000 | const tip = v.depth ? 'the deepest chain of project calls below ${props.card.name}: ${v.depth} level${v.depth… |
| `renderer/components/GridView.tsx:331` |  | 20 10 16000 16000 | const G = geo(), W = SIDE + G.x.size + TOT + 20, H = HEAD + G.y.size + FOOT + 10, sc = Math.min(2, 16000 / W,… |
| `renderer/components/SearchPanel.tsx:32` |  | 1000 20 000 | return '${n} · ${result.searched.toLocaleString()} files searched in ${(result.ms / 1000).toFixed(1)} s${resu… |
| `renderer/lib/flow.ts:42` |  | 24 20000 | const CONCURRENCY = 24, LIMIT = 20000; |
| `renderer/lib/flow.ts:80` |  | 2000 | const MAX_API = 2000; |
| `renderer/lib/flow.ts:91` |  | 6 12 | if ((s.kind === 6 \|\| s.kind === 12) && !/^(~\|operator\b)/.test(s.name) && decls.length < MAX_API) decls.push(… |
| `renderer/lib/flow.ts:309` |  | 400 | if (!node \|\| depth > 400) return null; |
| `renderer/lib/preview.ts:290` |  | 4000 | const DEPTH_CAP = 4000; |
| `shared/flowpairs.ts:108` |  | 16 | for (let i = 0; i < 16 && frontier.length; i++) { |
| `shared/flowrun.ts:615` |  | 400 | export const MAX_RUN_DEPTH = 400; |
| `shared/repair.ts:84` |  | 400 | for (let i = 0; i < lines.length && i < 400; off += lines[i].length + 1, i++) { |
| `shared/repair.ts:116` |  | 4000 | const from = Math.max(0, off - 4000), stack: number[] = []; |
| `shared/search.ts:5` |  | 1000 | export function matchesIn(text: string, q: string, max = 1000): [number, number][] { |

Merged into one fault each (one behaviour over several lines): E- `main/main.ts:171` + `main/main.ts:172` + `renderer/components/StartWindow.tsx:36`; E+ `renderer/components/Programs.tsx:9` + `renderer/components/Programs.tsx:22`; E- `renderer/components/Programs.tsx:26` + `renderer/components/Programs.tsx:30`; E± `renderer/components/FilesPane.tsx:59` + `renderer/components/FilesPane.tsx:74`; E± `renderer/components/SearchPanel.tsx:8` + `renderer/components/SearchPanel.tsx:16`; LIMIT `renderer/components/SearchPanel.tsx:32` + `main/search.ts:29`; H `renderer/components/GridView.tsx:255` + `renderer/components/GridView.tsx:256`; H `renderer/components/Sequence.tsx:322` + `renderer/components/Sequence.tsx:323` + `renderer/components/Sequence.tsx:326`; H `renderer/lib/store.ts:59` + `renderer/lib/store.ts:61`; E+ `renderer/components/GridView.tsx:320` + `renderer/components/GridView.tsx:485`; E- `renderer/components/Sequence.tsx:482` + `shared/flowseq.ts:288`; E+ `renderer/components/Sequence.tsx:926` + `renderer/components/Sequence.tsx:930`; E+ `renderer/components/Sequence.tsx:660` + `renderer/components/Sequence.tsx:661`; E± `shared/flowseq.ts:439` + `shared/flowseq.ts:466`; LIMIT `renderer/components/Card.tsx:61` + `renderer/lib/preview.ts:290`; LIMIT `renderer/lib/flow.ts:80` + `renderer/lib/flow.ts:91`; LIMIT `main/files.ts:56` + `main/files.ts:75`; F `renderer/components/GridView.tsx:496` + `renderer/components/GridView.tsx:499` + `renderer/components/GridView.tsx:501` + `renderer/components/GridView.tsx:502` + `renderer/components/GridView.tsx:503` + `renderer/components/GridView.tsx:504` + `renderer/components/GridView.tsx:507` + `renderer/components/GridView.tsx:510`.

### 3b. Found by reading every line (2026-11-14)

Every line of the 90 files was read ([UI-READING.md](UI-READING.md), 14,546 of 14,546 lines). These faults were not in the
list above. Each is from reading only; none was seen in the running app. Codes as in §2.

**V. Work or memory that grows with the whole run or project (23 faults, 25 lines)**

| Line | What |
|---|---|
| `renderer/components/GridView.tsx:134` | `Math.max(...)` over every row fails past the engine's argument limit |
| `renderer/components/GridView.tsx:135` | the same over every column |
| `renderer/components/GridView.tsx:411` | every square of every row and column is built, in view or not (X9) |
| `renderer/components/Sequence.tsx:610` | the depth spine draws every step on each redraw |
| `renderer/components/Sequence.tsx:1106` | `Math.max(...)` over every step (the argument limit) |
| `renderer/components/Sequence.tsx:1107` | the run bars draw every step on each redraw |
| `shared/flowseq.ts:195` | `Math.max(...)` over every step's depth (the argument limit) |
| `shared/flowseq.ts:217` | the layout computes every step's place each time the current step moves |
| `shared/flowseq.ts:403` | the facts of one step scan every row of the run for its calls |
| `shared/flowseq.ts:445` | the code rows walk every step whenever the detail level or folding changes |
| `shared/metrofacts.ts:111` | "pure" walks every step under the row; for the entry row, the whole run |
| `shared/metrofacts.ts:158` (+167, 175) | the step card scans every step of the run three times |
| `renderer/components/StepPreview.tsx:129` | the dotted link is redrawn on every animation frame, with two page queries each time |
| `renderer/components/StepPreview.tsx:219` | the card builds a row for every call of the function in the run |
| `renderer/components/Preview.tsx:272` | every level of cards stays built (each card an editor), only hidden |
| `renderer/components/Magnifier.tsx:14` | the lens copies the whole view it magnifies, again on every change |
| `renderer/components/FilesPane.tsx:22` | every row of every open folder is built |
| `renderer/lib/flowstore.ts:141` | the whole run is turned into JSON text to compare it, on each check |
| `renderer/lib/flowstore.ts:267` | the same, on each line-up |
| `renderer/lib/flowstore.ts:276` | the same, each time it is shown |
| `renderer/lib/seqtext.ts:29` | a file that cannot be read is read again on every look-up; its rows show no code, with no word why |
| `shared/flowalign.ts:69` | "lines changed" builds a rows × columns table: memory by the square of the function's length |
| `main/main.ts:443` | the flow's fingerprint reads the size and time of every source file each time it is checked |

**C (5 faults, 5 lines)**

| Line | What |
|---|---|
| `renderer/components/GridView.tsx:108` | the visible height subtracts the run bars by their fixed value (`SKY`) |
| `renderer/components/GridView.tsx:304` | scrolling a square into view assumes the frozen headings' sizes (`SIDE`, `TOT`, `HEAD`, `FOOT`, `SKY`) |
| `renderer/components/Sequence.tsx:219` | the view height subtracts the run bars by their fixed value (`SKY`) |
| `renderer/styles.css:858` | the totals column hides what scrolls under it with a shadow of a fixed 60 px (also D, Z, S in §3) |
| `renderer/styles.css:862` | the call-count row does the same with a fixed 90 px |

**E+ (2 faults, 2 lines)**

| Line | What |
|---|---|
| `shared/metrofacts.ts:96` | only the first lock is noted on the row; the card lists all |
| `shared/metrofacts.ts:97` | only the first exception is noted on the row; the card lists all |

**E- (6 faults, 6 lines)**

| Line | What |
|---|---|
| `shared/gridlinks.ts:60` | a condition that goes on past its line is shown cut at the line's end, with no mark |
| `shared/metrofacts.ts:29` | a call written over several lines is shown cut at the end of its first line, with no mark |
| `renderer/components/Preview.tsx:300` | the bar under the columns does not wrap; in a narrow preview its last buttons are clipped (`.prev`, styles.css:128) and cannot be reached |
| `renderer/lib/lines.ts:46` | the card name at a column's edge is drawn inside the preview's clip, so a long name is cut at the pane's edge |
| `renderer/components/FilesPane.tsx:122` | predicted from the widths, not seen: four buttons on one line in a 180 px pane that hides overflow; the last are cut off |
| `renderer/styles.css:807` | the followed value's words beside a row name (`.grh .gw`, GridView.tsx:406) are cut with an ellipsis, and the row's title (405) does not hold them; whether the same words show elsewhere was not traced |

**G (54 faults, 62 lines)**

| Line | What |
|---|---|
| `renderer/components/GridView.tsx:92` | file colours repeat after 10 files (`PAL[i % 10]`) while the key says "colour = file" |
| `renderer/components/GridView.tsx:161` | if the links of a step fail to compute, no arrow is drawn and nothing says why |
| `renderer/components/GridView.tsx:449` | arrows have no hover (rule 8 of UI-GENERALIZATION.md; the user's decision of 2026-11-13) |
| `renderer/components/GridView.tsx:471` | the grid's run bars are given no edited steps and no notes, which the metro's show |
| `shared/gridmodel.ts:13` | names shortened after the last `::`, so `A::run` and `B::run` read the same |
| `shared/gridlinks.ts:115` | only `if`, `while`, `switch` at a line's start count as decisions on a value; `for`, `?:`, `&&`/`\|\|`, `case` do not |
| `shared/gridlinks.ts:130` | the "calls" label counts callees by short name, merging `A::run` and `B::run` |
| `renderer/components/Sequence.tsx:66` | if the what-if choices fail to compute, they vanish without a word |
| `renderer/components/Sequence.tsx:95` | jump letters are two of 19, so they repeat after 361 rows in view |
| `renderer/components/Sequence.tsx:172` | if the junctions fail to compute, every junction row vanishes without a word |
| `renderer/components/Sequence.tsx:252` | names shortened after the last `::`, as in the grid |
| `renderer/components/Sequence.tsx:258` | line colours repeat after 10 files while the key says "line colour = file" |
| `renderer/components/Sequence.tsx:366` | with "reduce motion" on, the return route is not drawn at all, not just drawn still |
| `renderer/components/Sequence.tsx:1007` | a "go to" that is not a number or a walk closes with nothing said |
| `renderer/components/Sequence.tsx:1112` | value steps have their own colour in the bars, which the bars' key (1155) leaves out |
| `shared/metrofacts.ts:191` | loops in the card are counted by matching `for (`, `while (`, `do {` in the text, comments and strings included |
| `renderer/components/StepPreview.tsx:16` | the call is underlined at the first place its name occurs in the line, which can be an earlier word |
| `renderer/components/StepPreview.tsx:60` | if the step card fails to compute, it is left out without a word |
| `renderer/components/StepPreview.tsx:68` | the same for "takes" and "gives" |
| `renderer/components/StepPreview.tsx:92` | the same for the junction card |
| `renderer/components/Preview.tsx:279` | cards coloured by place from 8 colours, so cards 1 and 9 of a column share a colour, outline and connector |
| `renderer/lib/preview.ts:72` | when a file cannot be read, the card shows only the function's name or detail as its code, with nothing said |
| `renderer/lib/preview.ts:345` | "how deep" counts a function at the first path it is met on, yet the tip calls it "the deepest chain" |
| `renderer/components/CompilerWindow.tsx:31` | if reading the compiler's state fails, the resource's error is not handled |
| `renderer/components/Editor.tsx:88` | system headers open read-only; typing does nothing and says nothing |
| `renderer/components/FilesPane.tsx:20` | if listing a folder fails, the error is not handled |
| `renderer/components/Header.tsx:34` | open files are tabbed by file name only, so two files of the same name read the same |
| `renderer/components/Settings.tsx:10` | the schema's `compiler` section is on no page (`compiler.path` can be set only in settings.toml) |
| `renderer/lib/actions.ts:47` | rename does nothing and says nothing while clangd is not ready, or when the cursor is on no word |
| `renderer/lib/actions.ts:69` | fixes: the same while clangd is not ready |
| `renderer/lib/actions.ts:90` | find references: the same |
| `renderer/lib/actions.ts:109` | go to symbol: the same |
| `renderer/lib/flow.ts:460` | when clangd gives no syntax tree for a function, its body is taken as empty: the run shows it calling nothing |
| `renderer/lib/goto.ts:96` | the end of a peeked definition is found by counting `{` and `}`, those in strings and comments included |
| `renderer/lib/hlcode.ts:6` | the one-line highlighter colours `//` comments but draws `/* … */` as code |
| `renderer/lib/lsp.ts:101` | clangd's "Unable to handle compilation" is filtered out, so the one message saying why a file is not understood never shows |
| `renderer/lib/lsp.ts:232` | a function written on one line is not a function for the preview, which then says the cursor is outside any function |
| `renderer/lib/store.ts:188` | a file changed on disk while it has unsaved edits is marked (`diskChanged`), but nothing draws the mark |
| `renderer/styles.css:840` | the grid's three arrow colours (in, out, call) are explained nowhere; the key covers squares and dots only |
| `shared/flowfacts.ts:25` (+26) | locks and allocations recognised by fixed name lists; any other API's are not noted |
| `shared/flowpairs.ts:4` (to 10) | what must be closed (locks, memory, files, folders) recognised by fixed name lists; other pairs are not checked |
| `shared/flowrun.ts:52` | a failed analysis marks every call `approx`, shown as "~ in a macro" (Sequence.tsx:311, flowseq.ts:411) |
| `shared/flowrun.ts:804` (+805) | when the ways out or the open-and-close pairs fail to compute, they are left out without a word |
| `shared/flowrun.ts:725` | functions that could not be analysed are listed in `run.missing`, which nothing in the renderer reads |
| `shared/settings-schema.ts:92` | the colour setting "parameters" (`--par`) is used by no rule, so changing it changes nothing |
| `shared/settings-schema.ts:101` | the colour setting "races and other risks" feeds `--risk`, which no rule uses |
| `main/files.ts:60` | build, out, cmake-build-…, third_party, external and vendor are skipped in "find a file" and the folder search, with no word |
| `main/compilers.ts:14` | a compiler that does not answer `--version` within 5 s is passed over without a word |
| `main/langpacks.ts:40` | when the server gives no size, it is taken as 0 (used at 115 and 130); how the pack list shows it was not traced |
| `main/lsp.ts:67` | third_party, third-party and vendor are left out of the compile database SkyCodeX writes, so clangd does not understand their files |
| `main/packs.ts:40` | an installed pack whose manifest cannot be read is left out of the list without a word |
| `main/packs.ts:144` | the free-space message rounds up to whole gigabytes: a pack needing 50 MB "needs about 1 GB" |
| `shared/gridmodel.ts:20` | a call back into a function still running (`recursive`, flowrun.ts:719) is drawn as an ordinary call: neither the square nor the row says so (seen in the app 2026-11-14 on recursion-direct and recursion-mutual) |
| `shared/gridmodel.ts:28` | a call inside a loop counts once: g() in a loop of 3 shows one step and "×1" in times called (seen in the app 2026-11-14 on repeat-loop) |

**O (4 faults, 4 lines)**

| Line | What |
|---|---|
| `renderer/components/GridView.tsx:315` | after the open square, one Esc clears the followed value, the route, focus and the drill together, and stops play |
| `renderer/components/Sequence.tsx:920` | the what-if menu is placed 30 px right of its row and never fitted to the window |
| `renderer/components/Sequence.tsx:1060` | the key list (26 rows) has no height limit or scroll, so it runs past a short window |
| `renderer/components/CompilerWindow.tsx:33` | the window's place is restored from the last session and never fitted to the window as it is now (also C in §3) |

**H (1 fault, 1 line)**

| Line | What |
|---|---|
| `renderer/lib/store.ts:60` | one message at a time: a new one replaces the one on screen at once, so a message can vanish unread |

**LIMIT (4 faults, 4 lines)**

| Line | What |
|---|---|
| `shared/gridlinks.ts:86` | a value is followed back through parameters one level only (`depth < 1`); then its arrow stops without a word |
| `main/packs.ts:78` | only the newest 40 releases of clang and clangd are looked at |
| `main/langpacks.ts:95` | only rust-analyzer's last 8 releases |
| `main/langpacks.ts:108` | only Rust's last 5 releases |

**U, for the walk with the user (3 items, 4 lines; not counted as faults)**

| Line | What |
|---|---|
| `renderer/styles.css:168` | the remove button of a recent folder is transparent until the pointer is over it |
| `renderer/styles.css:356` (+357) | the close button of a file tab: the same |
| `renderer/components/Header.tsx:47` | the window's own buttons (minimise, maximise, close) are transparent until the pointer is over them (styles.css:47–48) |

**Moved within §3 by the read:** `styles.css:845` E+ → E- (its row's title holds the step number, not the code);
`styles.css:166` E- → E+ (StartWindow.tsx:51 holds the path); `actions.ts:118` and `Palette.tsx:18` E- → E+ (typing
narrows to every item); `preview.ts:129` E± → E- (macros, static_asserts, lambdas and pointer calls past the limit are
not counted in "+N more"); `goto.ts:95` LIMIT → E- (the peek stops at 40 lines with no mark).

**Withdrawn:** `junctions.ts:27` E- → OK (the 48 characters only look up the condition's line). On paths no shipped code
reaches (the only caller, Sequence.tsx:216, asks for `mode: 'metro'`), so now DEAD: C `flowseq.ts:184`, `:194`, `:202`,
`:203`, `:204`, `:206`, `:207`, `Sequence.tsx:841`; F `flowseq.ts:182`.

**Also found unused, not yet checked against their rows in §4–6:** `Sequence.tsx:715–719` and `:838–842` (cross-file
arrows, never drawn); `styles.css:586–588` (`.sarw`); `styles.css:584–585` (`.sbar`, hidden by `styles.css:464`, while
`Sequence.tsx:835–837` still builds the bars); `lines.ts:49–54` (`curveSvg`, called by nothing). `FlowBoxes.tsx:4` holds a
comment (`// @ts-expect-error …`), against the no-comments rule; reported, not changed.

**Already in §3, so not added:** `compilers.ts:103` and `lsp.ts:69`, `:74`, `:99` (LIMIT); `compilers.ts:115` (E-);
`flowseq.ts:197` (C); `search.ts:17` is the 4 MB skip of the LIMIT at `search.ts:5`, whose summary does not say how many
files it skipped.

## 4. Hygiene only: raw sizes and layers

| Line | Codes | Values | Text |
|---|---|---|---|
| `renderer/App.tsx:30` | S | 180 | const [filesW, setFilesW] = createSignal(180); |
| `renderer/components/FilesPane.tsx:127` | S | 15px | <Show when={root()} fallback={<div class="empty"><button style={{ color: 'var(--bright)', 'font-size': '15px'… |
| `renderer/components/GridView.tsx:132` | S | 8 | const totX = () => Math.min(SIDE + geo().x.size + 8, sl() + vw() - TOT); |
| `renderer/components/GridView.tsx:133` | S | 6 | const footY = () => Math.min(HEAD + geo().y.size + 6, st() + vh() - FOOT); |
| `renderer/components/GridView.tsx:178` | S | 6 6 3 3 3 3 | const tries: Rect[] = [{ x: r.x + r.w + 6, y: my, w, h }, { x: r.x - w - 6, y: my, w, h }, { x: r.x, y: r.y -… |
| `renderer/components/GridView.tsx:179` | S | 4 4 | const ok = tries.find((t) => t.x >= SIDE - 4 && t.y >= HEAD - 4 && !filled.some((f) => overlaps(t, f)) && !pl… |
| `renderer/components/GridView.tsx:227` | S | 3 3 | out.push({ x: a.x - 2, y: a.y - 2, w: b.x + b.w - a.x + 3, h: b.y + b.h - a.y + 3, c: col().get(f)! }); |
| `renderer/components/GridView.tsx:247` | S | 3 3 | { x: a.x + a.w - w, y: a.y - hh - 3, w, h: hh }, { x: a.x, y: a.y - hh - 3, w, h: hh }, |
| `renderer/components/GridView.tsx:248` | S | 3 3 | { x: a.x + a.w - w, y: a.y + a.h + 3, w, h: hh }, { x: a.x, y: a.y + a.h + 3, w, h: hh }, |
| `renderer/components/GridView.tsx:251` | S | 4 | return { text, x: Math.max(4, ok.x), y: ok.y }; |
| `renderer/components/GridView.tsx:303` | S | 40 | const a = el.getBoundingClientRect(), b = scroller.getBoundingClientRect(), m = 40; |
| `renderer/components/GridView.tsx:334` | S | 12px | g.font = '12px "ArX F1", monospace'; g.textBaseline = 'middle'; |
| `renderer/components/GridView.tsx:354` | S | 22px | <div class="ph wrap" style={{ padding: '0 22px' }}> |
| `renderer/components/GridView.tsx:387` | S | 12 8 | <div class="gsz" style={{ width: '${SIDE + geo().x.size + TOT + 12}px', height: '${HEAD + geo().y.size + FOOT… |
| `renderer/components/GridView.tsx:388` | S | 0px 8 4 | <div class="gstrip top" style={{ left: '0px', top: '${st()}px', width: '${SIDE + geo().x.size + 8}px', height… |
| `renderer/components/GridView.tsx:389` | S | 0px 4 4 | <div class="gstrip side" style={{ left: '${sl()}px', top: '0px', width: '${SIDE - 4}px', height: '${HEAD + ge… |
| `renderer/components/GridView.tsx:390` | S | 4 4 | <div class="gcorner" style={{ left: '${sl()}px', top: '${st()}px', width: '${SIDE - 4}px', height: '${HEAD - … |
| `renderer/components/GridView.tsx:396` | S | 8 | <Show when={i() === 0 \|\| cols()[i() - 1].file !== c.file}>{(() => { const last = () => { let k = i(); while (… |
| `renderer/components/GridView.tsx:404` | S | 12 | <Show when={j() === 0 \|\| rows()[j() - 1].file !== r.file}>{(() => { const last = () => { let k = j(); while (… |
| `renderer/components/GridView.tsx:443` | S | 8 8 | <svg class="glinks" width={SIDE + geo().x.size + 8} height={HEAD + geo().y.size + 8} aria-hidden="true"> |
| `renderer/components/GridView.tsx:455` | S | 0px 4 | <div class="gtot" style={{ left: '${totX()}px', top: '0px', height: '${HEAD + geo().y.size + 4}px' }}> |
| `renderer/components/GridView.tsx:459` | S | 4 40px | <div class="gcorner foot" style={{ left: '${sl()}px', top: '${footY()}px', width: '${SIDE - 4}px', height: '4… |
| `renderer/components/GridView.tsx:477` | S | 20px | <div class="ph" style={{ padding: '0 20px' }}><span style={{ color: 'var(--bright)' }}>{r().list.length} rout… |
| `renderer/components/Palette.tsx:33` | Z | 30 | <div style={{ position: 'fixed', inset: 0, 'z-index': 30 }} onMouseDown={(e) => e.target === e.currentTarget … |
| `renderer/components/Preview.tsx:30` | S | 3 | return <div class="psplit" style={{ left: '${props.left - 3}px' }} onMouseDown={down} />; |
| `renderer/components/Preview.tsx:128` | S | 6 4 | lead: Math.max(Math.min(pane.right, cr.left) - br.left - 6, r.right - br.left + 4), to, color: pal(h.k), edge… |
| `renderer/components/Preview.tsx:248` | S | 8 | const top = el.offsetTop - 8; |
| `renderer/components/Preview.tsx:255` | S | 8 | col.scrollTo({ top: el.offsetTop - 8, behavior: reduce() ? 'auto' : 'smooth' }); |
| `renderer/components/Preview.tsx:263` | Z |  | <div class="ph" style={{ position: 'absolute', left: 0, right: 0, top: 0, 'z-index': 2, padding: 0 }}> |
| `renderer/components/Preview.tsx:294` | S | 10px | <Show when={indexing()}><div class="sub" style={{ 'margin-top': '10px' }}>{indexing()}</div></Show> |
| `renderer/components/Preview.tsx:302` | S | 12.5px | <span style={{ 'font-size': '12.5px', color: '#3a3f3a' }}>{levelCount() ? 'levels ${win() + 1}–${win() + 2}' … |
| `renderer/components/Programs.tsx:66` | S | 22px | <div class="ph wrap" style={{ padding: '0 22px' }}> |
| `renderer/components/Programs.tsx:68` | S | 14px | <span class="sub" style={{ 'margin-left': '14px' }}>{status()}</span> |
| `renderer/components/Sequence.tsx:25` | S | 23 15 50 16 62 | const ROW = 23, SLOT = 15, TOP = 50, SPINE = 16, SKY = 62; |
| `renderer/components/Sequence.tsx:170` | S | 18 | const CODE_H = 18; |
| `renderer/components/Sequence.tsx:212` | S | 4 | const codeExtra = createMemo(() => new Map([...code()].map(([it, bs]) => [it, bs.reduce((n, b) => n + b.lines… |
| `renderer/components/Sequence.tsx:224` | S | 120 | return Math.max(0, Math.min(target + manual(), g.height + 120 - viewH())); |
| `renderer/components/Sequence.tsx:290` | S | 20 14 20 14 | const bypass = end >= 0 && end < s.items.length && vs.includes(end) ? 'M${x} ${y} C${x - 20} ${y + 14} ${g.ba… |
| `renderer/components/Sequence.tsx:378` | S | 6 4 | const ybot = Math.min(y2 - 6, g.y[s.lastItem[ci]] + g.h[s.lastItem[ci]] - 4); |
| `renderer/components/Sequence.tsx:379` | S | 8 8 | const x0 = g.x[from] - 8, x2 = g.x[to] - 8; |
| `renderer/components/Sequence.tsx:381` | S | 6 3.5 6 3.5 | setRet({ d, head: 'M${x2 - 6} ${y2 - 3.5} L${x2} ${y2} L${x2 - 6} ${y2 + 3.5}', key }); |
| `renderer/components/Sequence.tsx:591` | S | 26 26 | if (h && Math.abs(h + 26 - boxH()) > 1) setBoxH(h + 26); |
| `renderer/components/Sequence.tsx:600` | S | 16 | const H = Math.max(1, height() - 16), dpr = window.devicePixelRatio \|\| 1; |
| `renderer/components/Sequence.tsx:601` | S | 9 | el.width = 9 * dpr; el.height = H * dpr; |
| `renderer/components/Sequence.tsx:604` | S | 9 | x.clearRect(0, 0, 9, H); |
| `renderer/components/Sequence.tsx:605` | S | 6 3 | const n = s.items.length, yOf = (i: number) => Math.round((i / Math.max(1, n)) * (H - 6)) + 3; |
| `renderer/components/Sequence.tsx:608` | S | 3 | x.fillRect(0, yOf(ch.from) + 1, 1, Math.max(1, yOf(ch.to + 1) - yOf(ch.from) - 3)); |
| `renderer/components/Sequence.tsx:612` | S | 4 3 | x.fillRect(4, yOf(i), 3, changedItems().has(i) ? 2 : 1); |
| `renderer/components/Sequence.tsx:615` | S | 3 3 | for (const it of Object.keys(notesByItem())) x.fillRect(1, yOf(Number(it)) - 1, 3, 3); |
| `renderer/components/Sequence.tsx:618` | S | 5.5 3.5 | x.beginPath(); x.arc(5.5, yOf(Math.min(c.at, n)), 3.5, 0, Math.PI * 2); x.fill(); |
| `renderer/components/Sequence.tsx:621` | S | 3 6 | const spineAt = (clientY: number) => { const r = spineEl.getBoundingClientRect(); return Math.max(0, Math.min… |
| `renderer/components/Sequence.tsx:705` | S | 12 | const frameX = (f: number) => { const g = geom()!, [a, b] = S()!.span.get(f)!; let m = Infinity; for (let i =… |
| `renderer/components/Sequence.tsx:725` | S | 22px | <div class="ph wrap" style={{ padding: '0 22px' }}> |
| `renderer/components/Sequence.tsx:783` | S | 60 10 | <div class="mhead" style={{ left: '${geom()!.x[0] ?? 0}px', width: '${Math.max(60, width() - SPINE - (geom()!… |
| `renderer/components/Sequence.tsx:793` | S | 30 | <span style={{ top: '${(geom()!.slotY.get(f) ?? 0) - geom()!.y[sp()[0]] - 1}px', 'max-width': '${width() - SP… |
| `renderer/components/Sequence.tsx:817` | S | 3 24 6 8 | const d = () => { const g = geom()!, [a, b] = S()!.span.get(f)!, ya = g.y[a] + ROW / 2, yb = g.y[b] + ROW / 2… |
| `renderer/components/Sequence.tsx:822` | S | 7 20 7 | return <For each={Array.from({ length: n }, (_, k) => k)}>{(k) => <path class="jfork" stroke={colOf(it)} d={'… |
| `renderer/components/Sequence.tsx:828` | S | 9 6 22 6 6 26 15 2.5 | <path d={'M${m.x} ${m.y} C${m.x} ${m.y + 9} ${Math.max(6, m.x - 22)} ${m.y + 6} ${Math.max(6, m.x - 26)} ${m.… |
| `renderer/components/Sequence.tsx:829` | S | 34 15.5 10 18 15.5 | <path d={'M${Math.max(2, m.x - 34)} ${m.y + 15.5} L${Math.max(10, m.x - 18)} ${m.y + 15.5}'} stroke="#9ea39b"… |
| `renderer/components/Sequence.tsx:831` | S | 6 6 6 6 1.6 | <polygon points={'${m.x},${m.y - 6} ${m.x + 6},${m.y} ${m.x},${m.y + 6} ${m.x - 6},${m.y}'} fill={junctionPic… |
| `renderer/components/Sequence.tsx:836` | S | 4 8 | <div class="sbar" classList={{ on: chain().has(S()!.items[it]) }} style={{ left: '${geom()!.barX[it]}px', top… |
| `renderer/components/Sequence.tsx:854` | S | 60 10 | <div class="sjn" classList={{ on: junctionPick()?.id === j.id }} style={{ top: '${l.top}px', left: '${l.x}px'… |
| `renderer/components/Sequence.tsx:859` | S | 80 14 | : <div class="sline" style={{ top: '${l.top}px', left: '${l.x}px', 'max-width': '${Math.max(80, width() - SPI… |
| `renderer/components/Sequence.tsx:867` | S | 60 10 | style={{ left: '${geom()!.x[it]}px', top: '${geom()!.y[it]}px', width: '${Math.max(60, width() - SPINE - geom… |
| `renderer/components/Sequence.tsx:901` | S | 4 3 | <For each={hints()}>{(h) => <span class="shint" classList={{ dim: !!jump()?.typed && !h.k.startsWith(jump()!.… |
| `renderer/components/Sequence.tsx:903` | S | 14 60 24 | <div class="srow sfold" style={{ left: '${geom()!.x[it] + 14}px', top: '${geom()!.y[it] + geom()!.h[it] - ROW… |
| `renderer/components/Sequence.tsx:912` | S | 60 10 | <div class="srow swhat" style={{ left: '${geom()!.x[w().skip[0]]}px', top: '${geom()!.y[a()] + geom()!.h[a()]… |
| `renderer/components/Sequence.tsx:920` | S | 30 | <div class="swmenu" style={{ left: '${geom()!.x[m().it] + 30}px', top: '${geom()!.y[m().it] + ROW}px' }}> |
| `renderer/components/Sequence.tsx:929` | S | 4 14 | <div class="scmp" style={{ top: '${geom()!.y[w.skip[0] - 1] + geom()!.h[w.skip[0] - 1] - ROW - 4 - (codeExtra… |
| `renderer/components/Sequence.tsx:936` | S | 20 | <div class="srow send" classList={{ sel: atEnd(), near: nextAt() === N() }} style={{ left: '${geom()!.x[0] ??… |
| `renderer/components/Sequence.tsx:942` | S | 6 4 | <div class="sband" ref={band} style={{ top: '${geom()!.y[cur()!.at] + ROW}px', height: '${boxH() - 6}px', rig… |
| `renderer/components/Sequence.tsx:975` | S | 16 | <canvas class="sspine" ref={spineEl} style={{ height: '${height() - 16}px' }} onClick={onSpine} |
| `renderer/components/Sequence.tsx:1090` | S | 30 | const SKY_H = 30; |
| `renderer/components/Sequence.tsx:1126` | S | 30 30 | if (bx < wrap.scrollLeft + 30 \|\| bx > wrap.scrollLeft + wrap.clientWidth - 30) wrap.scrollTo({ left: bx - wra… |
| `renderer/components/Settings.tsx:123` | S | 5 10 | <Show when={drag()}><span class="bubble" style={{ left: 'calc(${pct()}% + ${5 - pct() / 10}px)' }}>{fmt(cur()… |
| `renderer/components/Settings.tsx:250` | S | 14px | <button class="chip" style={{ 'font-size': '14px' }} onClick={() => { openFile(info()!.settingsFile); close()… |
| `renderer/components/Settings.tsx:251` | S | 14px 24px | <button class="chip" style={{ 'font-size': '14px', 'margin-left': '24px' }} onClick={close}>{t('close · esc')… |
| `renderer/components/Settings.tsx:271` | S | 20px | <div class="sub si" style={{ 'margin-top': '20px' }}>Every change here is written to {info()?.settingsFile} —… |
| `renderer/components/StepPreview.tsx:163` | S | 20px | <div class="ph" style={{ padding: '0 20px' }}> |
| `renderer/lib/lines.ts:25` | S | 8 | const x1 = Math.min(Math.max(l.from.x + 2, l.textEnd + 8), l.lead), y1 = l.from.y; |
| `renderer/lib/lines.ts:44` | S | 7 14 .92 | return '<rect x="${x}" y="${y - 7}" width="${w}" height="14" fill="#151615" opacity=".92"/>' |
| `renderer/lib/lines.ts:46` | S | 17 4 11.5 300 | + '<text x="${x + 17}" y="${y + 4}" fill="${color}" font-size="11.5" font-weight="300" font-family="Selawik, … |
| `renderer/lib/lsp.ts:184` | S | 4px | if (!isCode) el.style.margin = '4px 0'; |
| `renderer/lib/repair.ts:45` | S | 8 4 | tip.style.top = '${beside ? r.top - 8 : row.getBoundingClientRect().bottom + 4}px'; |
| `renderer/styles.css:29` | S | 9px 9px | ::-webkit-scrollbar { width: 9px; height: 9px; } |
| `renderer/styles.css:35` | Z S | 56px 22px 8px 24px 5 | .hdr { height: 56px; flex: none; display: flex; align-items: flex-end; padding: 0 22px 8px; gap: 24px; -webki… |
| `renderer/styles.css:41` | S | 6px 6px 50% 8px 6px | .pivot .dirty::after { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; backg… |
| `renderer/styles.css:45` | S | 24px 24px 1px 5px | .gear { width: 24px; height: 24px; border: 1px solid #3a3f3a; display: grid; place-items: center; color: #7b8… |
| `renderer/styles.css:47` | S | 120px 34px .2s | .wctl { position: absolute; top: 0; right: 0; width: 120px; height: 34px; display: flex; justify-content: fle… |
| `renderer/styles.css:49` | S | 36px 30px 300 13px | .wctl button { width: 36px; height: 30px; color: var(--dim); font: 300 13px var(--ui); } |
| `renderer/styles.css:52` | S | 10px 10px 1 | .wctl svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1; vertical-align: mid… |
| `renderer/styles.css:58` | S | 36px 2px | .ph.wrap { height: auto; min-height: 36px; flex-wrap: wrap; row-gap: 2px; } |
| `renderer/styles.css:59` | S | 300 12.5px | .chip { font: 300 12.5px var(--ui); color: var(--faint); } |
| `renderer/styles.css:62` | Z S | 5px 4 | .split { flex: none; width: 5px; cursor: col-resize; position: relative; z-index: 4; } |
| `renderer/styles.css:64` | S | 1 300 14px 1.6 24px | .empty { flex: 1; display: grid; place-items: center; text-align: center; color: var(--ghost); font: 300 14px… |
| `renderer/styles.css:67` | S | 1 2px 12px 300 13px | .tree { overflow: auto; flex: 1; padding: 2px 0 12px; font: 300 13px var(--ui); } |
| `renderer/styles.css:71` | S | 10px 9px | .ti .ic { width: 10px; color: var(--dim); font-size: 9px; flex: none; } |
| `renderer/styles.css:72` | S | 6px 6px 50% | .ti .dot { width: 6px; height: 6px; border-radius: 50%; margin-left: auto; } |
| `renderer/styles.css:79` | S | 14px 10px 44px | .cm-lineNumbers .cm-gutterElement { padding: 0 14px 0 10px !important; min-width: 44px; } |
| `renderer/styles.css:84` | S | 18px 44px .6 300 13px 1.5 560px | .cm-tooltip { background: var(--pop) !important; border: 0 !important; box-shadow: 0 18px 44px rgba(0, 0, 0, … |
| `renderer/styles.css:85` | S | 12.5px 3px 10px | .cm-tooltip-autocomplete ul li { font-family: var(--mono); font-size: 12.5px; padding: 3px 10px !important; } |
| `renderer/styles.css:87` | S | 12px | .cm-completionDetail { color: var(--dim); margin-left: 12px; font-style: normal !important; } |
| `renderer/styles.css:89` | OK S | 8px 12px | .hov { padding: 8px 12px; white-space: pre-wrap; } |
| `renderer/styles.css:90` | OK S | 12.5px | .hov code, .hov pre { font-family: var(--mono); font-size: 12.5px; color: var(--bright); white-space: pre-wra… |
| `renderer/styles.css:91` | S | 6px 10px 2px 300 13px | .cm-diagnostic { padding: 6px 10px !important; border-left: 2px solid var(--err) !important; font: 300 13px v… |
| `renderer/styles.css:93` | S | 1px 4px | .cm-lintRange-error { background-image: none !important; text-decoration: underline wavy #9a655c 1px; text-un… |
| `renderer/styles.css:94` | S | 2px 4px | .cm-lintRange-warning { background-image: none !important; text-decoration: underline dotted var(--warn) 2px;… |
| `renderer/styles.css:97` | S | 300 13px 6px 10px | .cm-search { font: 300 13px var(--ui); padding: 6px 10px !important; } |
| `renderer/styles.css:98` | S | 1px 2px 6px | .cm-search input, .cm-search button { background: #1f201f !important; border: 1px solid #2f332f !important; c… |
| `renderer/styles.css:103` | S | 2px 3px 6px | .rp { display: flex; flex-direction: column; gap: 2px; padding: 3px 0 6px; } |
| `renderer/styles.css:104` | S | 300 11.5px 1px | .rp .why0 { font: 300 11.5px var(--ui); color: var(--faint); padding-left: 1px; } |
| `renderer/styles.css:105` | S | 8px 21px | .rs { display: flex; align-items: center; gap: 8px; min-height: 21px; } |
| `renderer/styles.css:107` | S | 15px 15px 1px 400 10px | .rs .bx { width: 15px; height: 15px; border: 1px solid #3a3f3a; display: grid; place-items: center; font: 400… |
| `renderer/styles.css:114` | Z S | 50 8px 12px 360px | .rtip { position: fixed; z-index: 50; padding: 8px 12px; max-width: 360px; pointer-events: none; } |
| `renderer/styles.css:115` | S | 300 11.5px | .cm-line .applied { color: var(--ty); font: 300 11.5px var(--ui); } |
| `renderer/styles.css:117` | S | 4px | .cmd-link { text-decoration: underline var(--kw); text-underline-offset: 4px; cursor: pointer; } |
| `renderer/styles.css:118` | S | 2px 4px 127 163 163 .10 | .gt-link { color: #e3e6df; text-decoration: underline 2px #7fa3a3; text-underline-offset: 4px; background: rg… |
| `renderer/styles.css:119` | S | 10px 7px 300 11px 1.6 1px | .gt-tag { display: inline-block; margin-left: 10px; padding: 0 7px; font: 300 11px/1.6 var(--ui); color: #171… |
| `renderer/styles.css:120` | S | 4px 8px 1px 10px 26px .45 | .gt-peek { margin: 4px 0 8px; border: 1px solid #ad9b6f; background: #141514; box-shadow: 0 10px 26px rgba(0,… |
| `renderer/styles.css:121` | S | 10px 4px 10px 400 11.5px 173 155 111 .12 1px | .gt-peek-h { display: flex; align-items: center; gap: 10px; padding: 4px 10px; font: 400 11.5px var(--mono); … |
| `renderer/styles.css:122` | S | 300 11px | .gt-peek-h .r { margin-left: auto; font: 300 11px var(--ui); color: var(--dim); } |
| `renderer/styles.css:123` | S | 13px | .gt-peek-h button { color: var(--dim); font-size: 13px; } |
| `renderer/styles.css:125` | S | 320px | .gt-peek .cm-editor { max-height: 320px; } |
| `renderer/styles.css:131` | S | 2px 10px 40px 22px 10px | .pcol-in { padding: 2px 10px 40px 22px; display: flex; flex-direction: column; gap: 10px; } |
| `renderer/styles.css:136` | S | 5px 5px 50% | .card-h .sw { width: 5px; height: 5px; border-radius: 50%; flex: none; } |
| `renderer/styles.css:139` | S | 300 10.5px 10px | .card-h .loc { margin-left: auto; color: #3f453f; font: 300 calc(10.5px * var(--hk)) var(--ui); padding-left:… |
| `renderer/styles.css:143` | S | 34px 10px 6px | .card .cm-lineNumbers .cm-gutterElement { min-width: 34px; padding: 0 10px 0 6px !important; } |
| `renderer/styles.css:144` | S | 2px 8px | .card .cm-content { padding: 2px 0 8px; } |
| `renderer/styles.css:146` | S | 300 13px 4px 2px | .more { font: 300 13px var(--ui); color: var(--dim); padding: 4px 2px; } |
| `renderer/styles.css:147` | S | 300 12.5px 1.6 4px 2px | .pnote { font: 300 12.5px/1.6 var(--ui); color: var(--faint); padding: 4px 2px; } |
| `renderer/styles.css:148` | Z | 6 .18s | .links { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 6; overflow: visible; transition… |
| `renderer/styles.css:149` | Z S | 40px 24px 22px 300 13.5px 3 | .shiftbar { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; display: flex; align-items: cente… |
| `renderer/styles.css:152` | Z | 32 10 11 10 .55 | .startv { position: fixed; inset: 0; z-index: 32; background: rgba(10, 11, 10, .55); display: grid; place-ite… |
| `renderer/styles.css:153` | S | 860px 100vw 48px 30px 80px .65 30px 34px 24px .28s .16 1 .3 1 | .startw { width: min(860px, calc(100vw - 48px)); background: var(--pop); box-shadow: 0 30px 80px rgba(0, 0, 0… |
| `renderer/styles.css:156` | S | 24px | .st-top { margin-bottom: 24px; } |
| `renderer/styles.css:157` | S | 300 30px .01em | .st-top .t { font: 300 30px var(--ui); color: var(--bright); letter-spacing: -.01em; } |
| `renderer/styles.css:158` | S | 300 13.5px 2px | .st-top .s { font: 300 13.5px var(--ui); color: var(--dim); margin-top: 2px; } |
| `renderer/styles.css:159` | S | 1fr 280px 34px | .st-cols { display: grid; grid-template-columns: 1fr 280px; gap: 34px; } |
| `renderer/styles.css:160` | S | 400 13px 10px .02em | .startw h3 { font: 400 13px var(--ui); color: var(--dim); margin: 0 0 10px; letter-spacing: .02em; } |
| `renderer/styles.css:161` | S | 300 13.5px 10px | .st-none { font: 300 13.5px var(--ui); color: var(--faint); padding: 10px 0; } |
| `renderer/styles.css:162` | S | 14px 10px 12px 12px 1px 255 255 255 .045 | .st-rc { display: flex; align-items: center; gap: 14px; padding: 10px 12px; margin: 0 -12px; border-top: 1px … |
| `renderer/styles.css:163` | S | 20px 20px 1px 400 11px | .st-rc .k { width: 20px; height: 20px; border: 1px solid #3a3f3a; display: grid; place-items: center; font: 4… |
| `renderer/styles.css:165` | S | 400 16px | .st-rc .nm { font: 400 16px var(--ui); color: var(--bright); } |
| `renderer/styles.css:168` | S | 18px 300 14px | .st-rc .x { width: 18px; font: 300 14px var(--ui); color: transparent; } |
| `renderer/styles.css:176` | S | 10px | .st-act { display: flex; flex-direction: column; gap: 10px; } |
| `renderer/styles.css:177` | S | 14px 62px 18px 1px 300 17px | .st-big { display: flex; align-items: center; gap: 14px; height: 62px; padding: 0 18px; border: 1px solid #3a… |
| `renderer/styles.css:179` | S | 300 12px 2px | .st-big .sub { display: block; font: 300 12px var(--ui); color: var(--dim); margin-top: 2px; } |
| `renderer/styles.css:185` | S | 8px 300 14px 6px 2px | .st-cont { margin-top: 8px; font: 300 14px var(--ui); color: var(--link); padding: 6px 2px; } |
| `renderer/styles.css:187` | S | 22px 12px 1px 255 255 255 .05 300 12px 18px | .st-foot { margin-top: 22px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, .05); font: 300 12p… |
| `renderer/styles.css:191` | S | 26px 1px | .shiftbar .pnav { display: flex; height: 26px; border: 1px solid #343834; } |
| `renderer/styles.css:193` | S | 13px | .shiftbar .pnav button { padding: 0 13px; color: #7b8279; } |
| `renderer/styles.css:197` | S | 300 38px 1 .02em | .big { font: 300 38px/1 var(--ui); color: var(--bright); letter-spacing: -.02em; } |
| `renderer/styles.css:198` | S | 300 15px 10px | .label { font: 300 15px var(--ui); color: #4f564f; margin: 0 0 10px; } |
| `renderer/styles.css:199` | S | 300 12.5px | .sub { font: 300 12.5px var(--ui); color: #4f564f; } |
| `renderer/styles.css:201` | Z S | 20 26px 44px | .set { position: absolute; inset: 0; background: var(--bg); z-index: 20; padding: 26px 44px; overflow: auto; } |
| `renderer/styles.css:202` | S | 600 11px .14em | .set .app-title { font: 600 11px var(--ui); letter-spacing: .14em; color: #4f564f; } |
| `renderer/styles.css:204` | S | 300 52px .02em | .set .pv button { font: 300 52px var(--ui); color: #2b2e2b; letter-spacing: -.02em; } |
| `renderer/styles.css:206` | S | 320px 1fr 10px 56px 1200px | .set .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px 56px; max… |
| `renderer/styles.css:207` | S | 20px | .ctl { margin-bottom: 20px; position: relative; } |
| `renderer/styles.css:209` | S | 10px 300 12px | .ctl .rst { margin-left: 10px; font: 300 12px var(--ui); color: #4f564f; } |
| `renderer/styles.css:211` | S | 3px 6px | .numrow { position: absolute; right: 0; top: -3px; display: flex; align-items: baseline; gap: 6px; } |
| `renderer/styles.css:212` | S | 56px 1px 1px 2px 300 15px | .ctl .numrow input.num { width: 56px; margin: 0; background: transparent; border: 0; border-bottom: 1px solid… |
| `renderer/styles.css:218` | S | 6px | .combo { position: relative; margin-top: 6px; } |
| `renderer/styles.css:219` | S | 30px | .combo input[type=text] { margin-top: 0; padding-right: 30px; } |
| `renderer/styles.css:220` | S | 10px 4px 300 15px | .combo .caret { position: absolute; right: 10px; top: 4px; color: #5f665f; cursor: pointer; font: 300 15px va… |
| `renderer/styles.css:221` | Z S | 100% 300px 5 18px 40px .5 4px | .combo-list { position: absolute; left: 0; right: 0; top: 100%; max-height: 300px; overflow-y: auto; backgrou… |
| `renderer/styles.css:225` | S | 8px 12px 3px 300 11.5px .04em | .combo-g { padding: 8px 12px 3px; font: 300 11.5px var(--ui); color: #4f564f; letter-spacing: .04em; } |
| `renderer/styles.css:226` | S | 14px 6px | .pathrow { display: flex; align-items: center; gap: 14px; margin-top: 6px; } |
| `renderer/styles.css:228` | S | 300 15px | .ctl .lab { font: 300 15px var(--ui); color: #8b9189; display: flex; } |
| `renderer/styles.css:230` | S | 300 12px | .ctl .doc { font: 300 12px var(--ui); color: #454b45; } |
| `renderer/styles.css:231` | S | 100% 6px 2px 5px 10px 300 15px | .ctl input[type=text] { width: 100%; margin-top: 6px; background: transparent; border: 2px solid #3a3f3a; pad… |
| `renderer/styles.css:233` | S | 100% 26px 4px | .ctl input[type=range] { -webkit-appearance: none; width: 100%; height: 26px; background: transparent; margin… |
| `renderer/styles.css:234` | S | 2px | .ctl input[type=range]::-webkit-slider-runnable-track { height: 2px; background: #2c2f2c; } |
| `renderer/styles.css:235` | S | 10px 22px 10px | .ctl input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 22px; backgroun… |
| `renderer/styles.css:236` | S | 52px 22px 2px | .tog { margin-left: auto; position: relative; width: 52px; height: 22px; border: 2px solid #4f564f; flex: non… |
| `renderer/styles.css:237` | S | 2px 2px 12px 22px .24s .16 1 .3 1 | .tog i { position: absolute; top: -2px; left: -2px; width: 12px; height: 22px; background: var(--bright); tra… |
| `renderer/styles.css:238` | S | 2px 2px 2px 44px .24s .16 1 .3 1 | .tog b { position: absolute; left: 2px; top: 2px; bottom: 2px; width: 44px; background: #4e6a6a; transform: s… |
| `renderer/styles.css:241` | S | 16px 6px 300 15px | .choices { display: flex; gap: 16px; margin-top: 6px; font: 300 15px var(--ui); } |
| `renderer/styles.css:244` | S | 4px | .choices.weights { flex-direction: column; align-items: stretch; gap: 0; margin-top: 4px; } |
| `renderer/styles.css:245` | S | 3px 10px 2px .15s .15s .15s | .choices.weights button { display: flex; align-items: baseline; padding: 3px 10px; text-align: left; border-l… |
| `renderer/styles.css:248` | S | 300 11.5px | .choices.weights button .w { margin-left: auto; font: 300 11.5px var(--ui); color: #4f564f; } |
| `renderer/styles.css:250` | S | 10px 14px 300 13.5px 1.5 18px 900px | .problem { background: #1f1a18; color: #c9a49c; padding: 10px 14px; font: 300 13.5px/1.5 var(--ui); margin-bo… |
| `renderer/styles.css:307` | S | 10px 20px 3px .25s .25s | .bxr { padding: 10px 20px; border-left: 3px solid transparent; cursor: pointer; transition: background .25s, … |
| `renderer/styles.css:309` | S | 300 12px 4px 2px 22px 14px 300 11.5px 22px | .bxr .w { font: 300 12px var(--ui); color: #6f766e; margin: 4px 0 2px 22px; display: flex; gap: 14px; } .bxr … |
| `renderer/styles.css:318` | S | 16px 8px | .bar { position: relative; height: 16px; background: #1d1f1d; margin-top: 8px; } |
| `renderer/styles.css:323` | S | 5px | .card .cm-scroller::-webkit-scrollbar { height: 5px; } |
| `renderer/styles.css:337` | S | 7px 7px 3px 30% | .card.lit .card-h .sw { width: 7px; height: 7px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 30%, trans… |
| `renderer/styles.css:343` | S | 18px 1px 255 255 255 .09 | .pdiv::before { content: ''; flex: 0 0 18px; height: 1px; background: rgba(255, 255, 255, .09); } |
| `renderer/styles.css:344` | S | 1 1px 255 255 255 .09 | .pdiv::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, .09); } |
| `renderer/styles.css:349` | S | 100% 14px 18px 300 20px | .pal input { width: 100%; background: transparent; border: 0; outline: none; padding: 14px 18px; font: 300 20… |
| `renderer/styles.css:350` | S | 50vh 6px | .pal-list { max-height: 50vh; overflow: auto; padding-bottom: 6px; } |
| `renderer/styles.css:351` | S | 14px 6px 18px 13px | .pal-it { display: flex; gap: 14px; padding: 6px 18px; font: 13px var(--mono); color: #8b9189; cursor: defaul… |
| `renderer/styles.css:356` | S | 300 16px 4px 16px | .tabx { font: 300 16px var(--ui) !important; color: transparent !important; margin-left: 4px; width: 16px; } |
| `renderer/styles.css:360` | S | 100% 6px 18px 300 15px | .appmenu button { display: flex; width: 100%; padding: 6px 18px; font: 300 15px var(--ui); color: #8b9189; te… |
| `renderer/styles.css:362` | S | 24px 12px | .appmenu button span { margin-left: auto; padding-left: 24px; font-size: 12px; color: var(--dim); } |
| `renderer/styles.css:363` | S | 1px 5px | .appmenu hr { border: 0; height: 1px; background: #2a2d2a; margin: 5px 0; } |
| `renderer/styles.css:364` | S | 18px 2px 12px 8px 300 12.5px | .std-act { display: flex; gap: 18px; padding: 2px 12px 8px; font: 300 12.5px var(--ui); } |
| `renderer/styles.css:367` | S | 1px 22px 10px 300 13px | .barbtn { border: 1px solid #3a3f3a; height: 22px; padding: 0 10px; font: 300 13px var(--ui); color: #8b9189;… |
| `renderer/styles.css:370` | S | 1px 8px 14px 255 255 255 .06 | .appsep { height: 1px; flex: none; margin: 8px 14px 0; background: rgba(255, 255, 255, .06); } |
| `renderer/styles.css:371` | S | 10px 8px 14px | .appbar { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 14px; } |
| `renderer/styles.css:372` | S | 22px 24px | .appbar .gear { margin-top: 0; height: 22px; width: 24px; } |
| `renderer/styles.css:374` | Z S | 35 600px 100vw 32px 24px 60px .55 1px 255 255 255 .04 | .cwin { position: fixed; z-index: 35; width: 600px; max-width: calc(100vw - 32px); background: var(--pop); bo… |
| `renderer/styles.css:375` | S | 36px 16px | .cwin-h { display: flex; align-items: center; height: 36px; padding-left: 16px; cursor: grab; user-select: no… |
| `renderer/styles.css:377` | S | 300 15px .02em | .cwin-h .t { font: 300 15px var(--ui); color: var(--bright); letter-spacing: .02em; } |
| `renderer/styles.css:379` | S | 36px 36px | .cwin-h button { width: 36px; height: 36px; color: var(--dim); display: flex; align-items: center; justify-co… |
| `renderer/styles.css:382` | S | 10px 10px 1 | .cwin-h svg { width: 10px; height: 10px; fill: none; stroke: currentColor; stroke-width: 1; overflow: visible… |
| `renderer/styles.css:383` | S | 6px 18px 16px 72vh 720px 300 13px | .cwin-b { padding: 6px 18px 16px; max-height: min(72vh, 720px); overflow-y: auto; font: 300 13px var(--ui); c… |
| `renderer/styles.css:384` | S | 16px 6px 300 12px .06em | .cwin .csec { margin: 16px 0 6px; font: 300 12px var(--ui); color: #5f665f; letter-spacing: .06em; } |
| `renderer/styles.css:385` | S | 300 26px 1.2 | .cwin .cbig { font: 300 26px var(--ui); color: var(--bright); line-height: 1.2; } |
| `renderer/styles.css:386` | S | 300 12.5px | .cwin .csub { font: 300 12.5px var(--ui); color: #6f766e; word-break: break-all; } |
| `renderer/styles.css:389` | S | 8px | .cwin .copts { margin-top: 8px; display: flex; flex-direction: column; } |
| `renderer/styles.css:390` | S | 10px 5px 6px | .cwin .copt { display: flex; align-items: baseline; gap: 10px; padding: 5px 6px; text-align: left; color: #8b… |
| `renderer/styles.css:393` | S | 76px | .cwin .copt .l { color: var(--bright); min-width: 76px; } |
| `renderer/styles.css:395` | S | 9px 9px 1.5px .15s .15s | .cwin .radio { width: 9px; height: 9px; flex: none; border: 1.5px solid #5f665f; align-self: center; transiti… |
| `renderer/styles.css:397` | S | 14px 8px | .cwin .crow { display: flex; align-items: center; gap: 14px; margin-top: 8px; flex-wrap: wrap; } |
| `renderer/styles.css:402` | S | 8px 6px 11px | .cwin .tag { margin-left: 8px; padding: 0 6px; font-size: 11px; color: #131413; background: #7f9e82; } |
| `renderer/styles.css:403` | S | 12px 6px | .cwin .cpack { display: flex; align-items: center; gap: 12px; padding: 6px; } |
| `renderer/styles.css:405` | S | 6px 240px | .cwin .cvers { margin-top: 6px; display: flex; flex-direction: column; max-height: 240px; overflow-y: auto; } |
| `renderer/styles.css:406` | S | 12px 5px 8px | .cwin .cvers button { display: flex; align-items: baseline; gap: 12px; padding: 5px 8px; text-align: left; co… |
| `renderer/styles.css:410` | S | 12px 12px 14px 2px 1.5 | .cwin .cconfirm { margin-top: 12px; padding: 12px 14px; background: #181918; border-left: 2px solid var(--acc… |
| `renderer/styles.css:411` | S | 4px | .cwin .cconfirm .dim { margin-top: 4px; color: #6f766e; } |
| `renderer/styles.css:412` | S | 12px | .cwin .cprog { margin-top: 12px; color: var(--bright); } |
| `renderer/styles.css:413` | S | 3px 6px | .cwin .cprog .bar { height: 3px; background: #2c2f2c; margin-top: 6px; position: relative; overflow: hidden; } |
| `renderer/styles.css:417` | S | 14px 16px 10px 1px 255 255 255 .06 | .cwin .cfoot { display: flex; align-items: center; gap: 14px; margin-top: 16px; padding-top: 10px; border-top… |
| `renderer/styles.css:437` | S | 34px | .barbtn, .chip, .help-nav button { min-height: 34px; } |
| `renderer/styles.css:438` | S | 10px | .split { flex-basis: 10px !important; } |
| `renderer/styles.css:440` | S | 14px 8px 1px 255 255 255 .03 | .clang { display: flex; gap: 14px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid rgba(255… |
| `renderer/styles.css:441` | S | 96px 300 15px 1px | .clang .cl { width: 96px; flex: none; font: 300 15px var(--ui); color: var(--bright); padding-top: 1px; } |
| `renderer/styles.css:443` | S | 2px | .clang .cpack { padding: 2px 0; } |
| `renderer/styles.css:448` | S | 300 15px | .seqk { font: 300 15px var(--ui); color: var(--now); font-variant-numeric: tabular-nums; } |
| `renderer/styles.css:453` | S | 4px 1px | .seqpath .crumb:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 4px; text-de… |
| `renderer/styles.css:454` | S | 13px | .seqpath .crumb.last { color: var(--bright); } .seqpath .csep { color: #5f665f; font-size: 13px; flex: none; } |
| `renderer/styles.css:456` | Z S | 100% 6px 30 16px 36px .55 6px | .shr { position: relative; } .smenu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; backg… |
| `renderer/styles.css:463` | S | 22px | .srow .n { color: #6f6650; min-width: 22px; text-align: right; font-variant-numeric: tabular-nums; flex: none… |
| `renderer/styles.css:467` | S | 16px 17px | .mlegend .mrow { display: flex; gap: 16px; height: 17px; } |
| `renderer/styles.css:468` | S | 1 1 12px 17px | .mlegend .mfiles { flex: 1 1 auto; min-width: 0; display: flex; gap: 12px; height: 17px; overflow-x: auto; ov… |
| `renderer/styles.css:470` | S | 14px 4px 2px 5px 2px | .mlegend i { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 5px; vertical… |
| `renderer/styles.css:473` | S | 82px 1 1 96px 16% 150px 10px 30% 8px | .mhead .h1 { flex: none; width: 82px; } .mhead .h2 { flex: 1 1 0; min-width: 0; } .mhead .h3 { flex: 0 0 clam… |
| `renderer/styles.css:476` | S | 26px 6px | .seqv.metro .srow .n { min-width: 26px; padding-right: 6px; } |
| `renderer/styles.css:478` | S | 1 2px 400 10px | .seqv.metro .srow .fno .rp { display: inline-block; line-height: 1; margin-right: 2px; font: 400 10px var(--u… |
| `renderer/styles.css:482` | S | 500 12px 1 34% | .seqv.metro .srow .who { font: 500 12px var(--mono); color: #9ea39b; flex: 0 1 auto; max-width: 34%; } |
| `renderer/styles.css:486` | S | 400 11px | .seqv.metro .srow .min code { font: 400 11px var(--mono); color: #7b8279; } |
| `renderer/styles.css:489` | S | 30% 8px 5px | .seqv.metro .srow .mnotes { flex: 0 0 30%; min-width: 0; padding-left: 8px; display: flex; gap: 5px; align-it… |
| `renderer/styles.css:495` | S | 300 11px | .srow .loc { font: 300 11px var(--ui); color: #586058; } |
| `renderer/styles.css:496` | S | 300 11px | .srow .nt { font: 300 11px var(--ui); color: #5a6a6a; } |
| `renderer/styles.css:497` | S | 300 11px | .srow .u { font: 300 11px var(--ui); color: #464c46; } |
| `renderer/styles.css:498` | S | 300 11px | .srow .tag { font: 300 11px var(--ui); color: #8a7f5f; } |
| `renderer/styles.css:509` | S | 11.5px 8px 4px | .setm .mh { color: var(--dim); font-size: 11.5px; margin: 8px 0 4px; } |
| `renderer/styles.css:510` | S | 100% 3px 6px 4px | .setm .mi { display: block; width: 100%; text-align: left; padding: 3px 6px; border-radius: 4px; } |
| `renderer/styles.css:511` | S | 173 155 111 .12 11.5px 6px | .setm .mi:hover, .setm .mi.on { background: rgba(173,155,111,.12); color: var(--bright); } .setm .mi .w { col… |
| `renderer/styles.css:512` | S | 10px 2px | .setm .mr { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 2px 0; } |
| `renderer/styles.css:514` | S | 4px | .setm .mr .vs { display: flex; gap: 4px; flex: none; } |
| `renderer/styles.css:515` | S | 1px 4px 6px 11.5px | .setm .mr .vs button { border: 1px solid var(--gut); border-radius: 4px; padding: 0 6px; color: var(--dim); f… |
| `renderer/styles.css:517` | S | 100% 8px 1px 4px 3px 6px 12px | .setm .mt { width: 100%; margin-top: 8px; background: var(--card); border: 1px solid var(--gut); border-radiu… |
| `renderer/styles.css:518` | S | 8px 1px 4px 2px 10px | .setm .go { margin-top: 8px; border: 1px solid var(--accent); color: var(--accent); border-radius: 4px; paddi… |
| `renderer/styles.css:520` | S | 8px | .setm .nt { margin-top: 8px; color: #b0a27a; } |
| `renderer/styles.css:522` | S | 3px | .setm .lnk { color: var(--link); text-decoration: underline dotted; text-underline-offset: 3px; } |
| `renderer/styles.css:528` | S | 12.5px 1px 4px 7px .75 | .sline .gh { font: 12.5px var(--mono); color: #6f756f; border: 1px dashed #4a504a; border-radius: 4px; paddin… |
| `renderer/styles.css:529` | S | 300 11px 9px | .sline .ghw { font: 300 11px var(--ui); color: #6a7474; margin-left: 9px; } |
| `renderer/styles.css:532` | S | 220px | .spick .sgoto { width: 220px; } |
| `renderer/styles.css:533` | S | 100% 4px 100% 12px 30px .45 4px | .spickl { position: absolute; left: 0; bottom: calc(100% + 4px); min-width: 100%; background: #1f201f; box-sh… |
| `renderer/styles.css:534` | S | 18px 5px 15px 300 13px | .spickl button { display: flex; justify-content: space-between; gap: 18px; padding: 5px 15px; text-align: lef… |
| `renderer/styles.css:544` | S | 13px | .srow.sel { color: #f0eadb; font-size: 13px; overflow: visible; -webkit-mask-image: none; mask-image: none; } |
| `renderer/styles.css:546` | S | 10px 4px 3px 15px | .srow.sel::before { content: ''; position: absolute; left: -10px; top: 4px; width: 3px; height: 15px; backgro… |
| `renderer/styles.css:563` | S | 9px 9px 2px 8px 1px | .selmk { display: inline-block; width: 9px; height: 9px; border-radius: 2px; background: #e3d6ad; margin-righ… |
| `renderer/styles.css:565` | S | 400 10px 23px | .sjn .d { flex: none; font: 400 10px/23px var(--ui); color: #e3d6ad; } |
| `renderer/styles.css:566` | S | 400 12px | .sjn .c { flex: none; font: 400 12px var(--mono); color: #e3d6ad; } |
| `renderer/styles.css:567` | S | 400 11px | .sjn code { font: 400 11px var(--mono); color: #9ea39b; } |
| `renderer/styles.css:571` | S | 12px | .mlegend .mkeys { flex: none; display: flex; gap: 12px; } |
| `renderer/styles.css:572` | S | 3px | .mlegend .mfiles::-webkit-scrollbar, .gtop::-webkit-scrollbar, .gkey::-webkit-scrollbar, .skyk::-webkit-scrol… |
| `renderer/styles.css:574` | S | 100% 16px | .schap { max-height: calc(100% - 16px); overflow-y: auto; } |
| `renderer/styles.css:576` | S | 400 4px | .mlegend .mkeys b { font-weight: 400; color: #e3d6ad; margin-right: 4px; } .mlegend .mkeys b.l { color: #6f9e… |
| `renderer/styles.css:577` | S | 8px 10px | .ibx .jbtns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; } |
| `renderer/styles.css:580` | S | 9px 300 12.5px | .srow.send .n { color: #4f564f; font-size: 9px; } .srow.send .nm { font: 300 12.5px var(--ui); color: #6f766e… |
| `renderer/styles.css:581` | S | 1px 1px .42s .16 1 .3 1 .42s .16 1 .3 1 .42s | .sframe { position: absolute; width: 1px; border-left: 1px solid #2b3b3b; transition: top .42s cubic-bezier(.… |
| `renderer/styles.css:584` | S | 1px .42s .16 1 .3 1 .42s .16 1 .3 1 | .sbar { position: absolute; width: 1px; background: #232723; transition: top .42s cubic-bezier(.16,1,.3,1), h… |
| `renderer/styles.css:585` | S | 3px | .sbar.on { width: 3px; background: #5a5442; } |
| `renderer/styles.css:587` | S | 1px 4px 3.5px 6px | .sarw::after { content: ''; position: absolute; right: -1px; top: -4px; border: 3.5px solid transparent; bord… |
| `renderer/styles.css:589` | Z S | 8px 1px 1px 3 .42s .16 1 .3 1 .42s .16 1 .3 1 .3s | .sband { position: absolute; left: 8px; background: #191a19; box-shadow: inset 0 1px 0 #2c2f2c, inset 0 -1px … |
| `renderer/styles.css:591` | S | 10px 16px 22px | .sband .in { padding: 10px 16px 0 22px; } |
| `renderer/styles.css:592` | S | 300 13.5px | .sband .sum { font: 300 13.5px var(--ui); color: #c9cdc5; } |
| `renderer/styles.css:593` | S | 12px | .sband .sum.code { font: 12px var(--mono); color: #9aa294; } |
| `renderer/styles.css:594` | S | 8px 92px 1fr 3px 12px 300 12.5px 1.55 | .sband .facts { margin-top: 8px; display: grid; grid-template-columns: 92px 1fr; gap: 3px 12px; font: 300 12.… |
| `renderer/styles.css:596` | S | 8px 4px 16px 300 11.5px | .sband .ways, .ways.pv { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 16px; font: 300 11.5px var… |
| `renderer/styles.css:597` | S | 11.5px 400 | .ways b { font: 11.5px var(--mono); font-weight: 400; color: #7d7356; } |
| `renderer/styles.css:598` | S | 10px 20px | .ways.pv { padding: 10px 20px; } |
| `renderer/styles.css:600` | S | 3px | .g-possible { color: #8b9189; text-decoration: underline dotted #5f665f; text-underline-offset: 3px; } |
| `renderer/styles.css:602` | S | 300 12.5px | .schip { font: 300 12.5px var(--ui); color: #c9cdc5; padding: 0; } |
| `renderer/styles.css:605` | S | 3px 8px 9px | .sspine { position: absolute; right: 3px; top: 8px; width: 9px; cursor: pointer; } |
| `renderer/styles.css:606` | Z | 4 | .sret { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; z-index: 4; } |
| `renderer/styles.css:608` | S | 12px | .srow.sfold { color: #c9c2ac; cursor: pointer; } .srow.sfold .pl { color: var(--accent); width: 12px; text-al… |
| `renderer/styles.css:609` | S | 1px 14px 8px 2px | .srow.sfold .nt { color: #6f766e; } .srow.sfold .mini { display: inline-flex; align-items: flex-end; gap: 1px… |
| `renderer/styles.css:610` | S | 8px 12px 1.6 | .scall { margin-top: 8px; font: 12px/1.6 var(--mono); color: #8b9189; } |
| `renderer/styles.css:611` | S | 300 11.5px 2px | .scall .from { font: 300 11.5px var(--ui); color: #5f665f; margin-bottom: 2px; } |
| `renderer/styles.css:615` | Z S | 6 420px 560px 16px 36px .55 8px 14px 8px .18s | .speek { position: absolute; z-index: 6; min-width: 420px; max-width: 560px; background: #202220; box-shadow:… |
| `renderer/styles.css:617` | S | 300 12px 5px 14px 8px | .speek .h { font: 300 12px var(--ui); color: #c9cdc5; padding: 0 0 5px 14px; } .speek .h i { font-style: norm… |
| `renderer/styles.css:620` | Z S | 21 16px 36px .5 7px 260px 520px | .schap { position: absolute; z-index: 21; background: #1f201f; box-shadow: 0 16px 36px rgba(0,0,0,.5); paddin… |
| `renderer/styles.css:622` | S | 46px 11.5px 400 | .schap button b { min-width: 46px; font: 11.5px var(--mono); font-weight: 400; color: var(--accent); } |
| `renderer/styles.css:623` | S | 34px 173 155 111 .1 | .schap button.sub { padding-left: 34px; } .schap button.on { color: #e3e6df; background: rgba(173,155,111,.1)… |
| `renderer/styles.css:624` | Z S | 50% 14px 50% 22 640px 100% 60px 18px 40px .55 6px | .sfind { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); z-index: 22; width: min(640px… |
| `renderer/styles.css:625` | S | 10px 10px 16px 1px 13px | .sfind .in { display: flex; align-items: baseline; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #2… |
| `renderer/styles.css:626` | S | 300 13px | .sfind .q { color: var(--accent); } .sfind .fn { color: #e3e6df; font: 300 13px var(--ui); } |
| `renderer/styles.css:627` | S | 1 13px | .sfind input { flex: 1; background: none; border: 0; outline: 0; font: 13px var(--mono); color: #e3e6df; } |
| `renderer/styles.css:630` | S | 400 300 11.5px | .sfind .opt b { color: var(--accent); font-weight: 400; } .sfind .opt .w { margin-left: auto; font: 300 11.5p… |
| `renderer/styles.css:631` | S | 173 155 111 .12 8px 16px 300 12.5px | .sfind .opt.on { background: rgba(173,155,111,.12); color: #e3e6df; } .sfind .none { padding: 8px 16px; font:… |
| `renderer/styles.css:632` | S | 3px | .srow .nt.ask { cursor: pointer; text-decoration: underline dotted #4a5a5a; text-underline-offset: 3px; point… |
| `renderer/styles.css:633` | S | 12px 8px | .srow.swhat { color: #c9cdc5; } .srow.swhat .pl { color: #8a7f5f; width: 12px; text-align: center; } .srow.sw… |
| `renderer/styles.css:634` | Z S | 8 16px 36px .55 6px | .swmenu { position: absolute; z-index: 8; background: #202220; box-shadow: 0 16px 36px rgba(0,0,0,.55); paddi… |
| `renderer/styles.css:636` | Z | 7 100% 1px 12px 30px .4 | .scmp { position: absolute; z-index: 7; display: flex; transform: translateY(-100%); background: #1c1d1c; box… |
| `renderer/styles.css:637` | S | 10px 18px 12px 180px 12px 1.7 1px 280px | .scmp .col { padding: 10px 18px 12px; min-width: 180px; font: 12px/1.7 var(--mono); color: #9ea39b; } .scmp .… |
| `renderer/styles.css:638` | S | 300 12.5px 4px 32px | .scmp .h { font: 300 12.5px var(--ui); color: var(--accent); margin-bottom: 4px; } .scmp .n { display: inline… |
| `renderer/styles.css:639` | S | 300 13px 300 12px 1.8 | .scmp .rt { font: 300 13px var(--ui); color: #c9cdc5; } .scmp .no { font: 300 12px/1.8 var(--ui); color: #6f7… |
| `renderer/styles.css:642` | OK S | 12px 18px 300 10.5px | .skyk { display: flex; align-items: center; gap: 12px; height: 18px; flex: none; font: 300 10.5px var(--ui); … |
| `renderer/styles.css:644` | S | 8px 8px 4px 1px | .skyk i { display: inline-block; width: 8px; height: 8px; margin-right: 4px; vertical-align: -1px; } |
| `renderer/styles.css:646` | S | 5px 5px 50% 2px 3px | .skyk i.ed { width: 5px; height: 5px; border-radius: 50%; background: #e0904f; vertical-align: 0; } .skyk i.n… |
| `renderer/styles.css:648` | S | 20px 16px 5px 400 12px .35 | .skyk .zb { min-width: 20px; height: 16px; padding: 0 5px; font: 400 12px var(--mono); color: var(--dim); bac… |
| `renderer/styles.css:649` | S | 400 10.5px 34px | .skyk .zv { font: 400 10.5px var(--mono); color: var(--fg); min-width: 34px; text-align: center; } |
| `renderer/styles.css:650` | S | 1 5px | .skyw { flex: 1; min-height: 0; overflow-x: auto; overflow-y: hidden; } .skyw::-webkit-scrollbar { height: 5p… |
| `renderer/styles.css:652` | S | 400 13.5px | .sskytip .w { font: 400 13.5px var(--mono); color: var(--bright); } |
| `renderer/styles.css:653` | S | 300 12px 2px | .sskytip .d { font: 300 12px var(--ui); color: var(--dim); margin-top: 2px; } |
| `renderer/styles.css:655` | S | 4px | .sskytip .d.k { color: var(--faint); margin-top: 4px; } |
| `renderer/styles.css:658` | S | 9px 4px 8px 6px 1.5px 1.5px 40deg | .stick { position: absolute; left: 9px; width: 4px; height: 8px; margin-top: 6px; border: solid #5f8f7a; bord… |
| `renderer/styles.css:660` | S | 380px 10px 2px 8px 300 13px | .snoteedit { width: 380px; margin-left: 10px; background: #171817; border: 0; outline: 0; padding: 2px 8px; f… |
| `renderer/styles.css:661` | Z S | 7 30px 17px 11.5px 17px .15s .15 | .shint { position: absolute; z-index: 7; width: 30px; height: 17px; background: #2e2b20; color: #f0e3bd; font… |
| `renderer/styles.css:662` | S | 1 5px 2px 13px | .srow.chg .n, .srow.chg .nm { color: #9fd8c0 !important; } .srow.chg { opacity: 1 !important; } .srow.chg::af… |
| `renderer/styles.css:669` | S | 12.5px | .scap .key { font: 12.5px var(--mono); color: var(--accent); } |
| `renderer/styles.css:671` | S | 64px 1px 13px | .sgoto { width: 64px; background: transparent; border: 0; border-bottom: 1px solid #4f564f; outline: none; fo… |
| `renderer/styles.css:672` | Z S | 30px 20px 21 12px 18px 3px 300 12.5px 16px 36px .5 | .skeys { position: absolute; right: 30px; top: 20px; z-index: 21; background: #1f201f; padding: 12px 18px; di… |
| `renderer/styles.css:673` | S | 96px 1fr 12px 12px 400 | .skeys div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; } .skeys b { font: 12px var(--mono); … |
| `renderer/styles.css:674` | OK S | 4px 20px 10px 3px 300 12px 12px | .sfrom { padding: 4px 20px 10px; display: grid; gap: 3px; } .sfrom .h { font: 300 12px var(--ui); color: #5f6… |
| `renderer/styles.css:675` | S | 1 12px | .scode { flex: 1; min-height: 0; overflow: auto; margin: 0 12px; background: #1b1c1b; } |
| `renderer/styles.css:678` | S | 10px 12px | .lanes { display: flex; gap: 10px; margin-right: 12px; } |
| `renderer/styles.css:683` | S | 6px 300 10.5px 10px | .card-h .depth { margin-left: auto; display: flex; align-items: center; gap: 6px; font: 300 10.5px var(--ui);… |
| `renderer/styles.css:684` | S | 10px | .card-h .depth + .loc { margin-left: 10px; } |
| `renderer/styles.css:685` | S | 2px | .card-h .depth .gauge { display: flex; gap: 2px; } |
| `renderer/styles.css:686` | S | 3px 3px | .card-h .depth .gauge i { width: 3px; height: 3px; background: var(--c); } |
| `renderer/styles.css:688` | S | 1 1 14px 22px 2px 12px 1px 255 255 255 .04 | .sechead { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 14px; margin: 22px 0 2px; padding-… |
| `renderer/styles.css:689` | S | 300 19px | .sechead > span:first-child { font: 300 19px var(--ui); color: var(--bright); } |
| `renderer/styles.css:690` | S | 5px 4px 2px | .colorctl { display: grid; gap: 5px; margin: 4px 0 2px; } |
| `renderer/styles.css:691` | S | 10px | .colorctl .crow { display: flex; align-items: center; gap: 10px; } |
| `renderer/styles.css:692` | S | 22px 22px 1px 255 255 255 .08 | .colorctl .swatch { width: 22px; height: 22px; flex: none; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .0… |
| `renderer/styles.css:693` | S | 104px 13px | .colorctl .hex { width: 104px; font: 13px var(--mono); } |
| `renderer/styles.css:694` | S | 70px 1fr 8px 300 11.5px | .cslide { display: grid; grid-template-columns: 70px 1fr; align-items: center; gap: 8px; font: 300 11.5px var… |
| `renderer/styles.css:695` | S | 8px | .cslide input[type=range] { -webkit-appearance: none; appearance: none; height: 8px; margin: 0; } |
| `renderer/styles.css:696` | S | 10px 16px 1px | .cslide input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 16px; backgr… |
| `renderer/styles.css:698` | Z | 60 1px 18px 44px .6 | .magnifier { position: fixed; z-index: 60; overflow: hidden; background: var(--bg); border: 1px solid #6a6248… |
| `renderer/styles.css:701` | S | 6px 4px 11px 4px | .magnifier .mg-z { position: absolute; right: 6px; bottom: 4px; font: 11px var(--mono); color: #8a7f5f; backg… |
| `renderer/styles.css:702` | S | 8px 12px | .mgchips { display: inline-flex; align-items: baseline; gap: 8px; } .mgz { font: 12px var(--mono); color: #8b… |
| `renderer/styles.css:704` | S | 8px 2px 12px 8px | .ffind { display: flex; align-items: center; gap: 8px; padding: 2px 12px 8px; flex: none; } |
| `renderer/styles.css:705` | S | 1 5px 8px 300 13px | .ffind input { flex: 1; min-width: 0; background: var(--card); border: 0; outline: none; padding: 5px 8px; fo… |
| `renderer/styles.css:707` | S | 300 11.5px 12px 4px | .found .fcount { font: 300 11.5px var(--ui); color: var(--faint); padding: 0 12px 4px; } |
| `renderer/styles.css:711` | Z | 6 | .csearch { position: absolute; inset: 0; z-index: 6; background: var(--bg); display: flex; flex-direction: co… |
| `renderer/styles.css:712` | S | 12px 12px 18px 6px 6px 12px | .csearch .q { display: flex; align-items: center; gap: 12px; margin: 12px 18px 6px; padding: 6px 12px; backgr… |
| `renderer/styles.css:713` | S | 1 300 16px | .csearch .q input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; font: 300 16px … |
| `renderer/styles.css:714` | S | 300 12.5px | .csearch .d { color: var(--dim); font: 300 12.5px var(--ui); } |
| `renderer/styles.css:716` | S | 1 18px 18px | .cres { flex: 1; overflow: auto; padding: 0 18px 18px; } |
| `renderer/styles.css:717` | S | 10px 12px 2px 300 12.5px | .cres .grp { display: flex; gap: 10px; align-items: baseline; margin: 12px 0 2px; font: 300 12.5px var(--ui);… |
| `renderer/styles.css:720` | S | 14px 23px 12.5px | .cres .hit { display: flex; gap: 14px; align-items: baseline; height: 23px; font: 12.5px var(--mono); color: … |
| `renderer/styles.css:723` | S | 2px 8px | .playc { display: inline-flex; gap: 2px; margin-right: 8px; } |
| `renderer/styles.css:724` | S | 26px 22px 6px 300 12.5px | .playc button { min-width: 26px; height: 22px; padding: 0 6px; font: 300 12.5px var(--ui); color: var(--dim);… |
| `renderer/styles.css:727` | S | 34px | .playc .spd { min-width: 34px; } |
| `renderer/styles.css:728` | S | 1 4px 22px 22px | .progs { flex: 1; overflow: auto; padding: 4px 22px 22px; } |
| `renderer/styles.css:729` | S | 12px 10px 6px 6px 12px | .progs .q { display: flex; align-items: center; gap: 12px; margin: 10px 0 6px; padding: 6px 12px; background:… |
| `renderer/styles.css:730` | S | 1 300 15px | .progs .q input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; font: 300 15px va… |
| `renderer/styles.css:732` | S | 10px 14px 2px 300 12.5px | .progs .grp { display: flex; gap: 10px; align-items: baseline; margin: 14px 0 2px; font: 300 12.5px var(--ui)… |
| `renderer/styles.css:738` | S | 12px | .progs .pr .w { margin-left: auto; font-size: 12px; color: var(--dim); } |
| `renderer/styles.css:741` | S | 17px 32px | .progs .top { font-size: 17px; height: 32px; } |
| `renderer/styles.css:742` | S | 300 14px 4px | .backp { font: 300 14px var(--ui); color: #ad9b6f; margin-right: 4px; } |
| `renderer/styles.css:744` | OK S | 18px 10px 12px 18px | .sline { position: absolute; height: 18px; display: flex; gap: 10px; align-items: baseline; font: 12px/18px v… |
| `renderer/styles.css:745` | S | 30px | .sline .ln { color: #3a3f3a; min-width: 30px; text-align: right; flex: none; } |
| `renderer/styles.css:748` | Z OK S | 50 10px | .glide { position: fixed; z-index: 50; pointer-events: none; overflow: hidden; white-space: nowrap; padding: … |
| `renderer/styles.css:749` | S | 13px 22% 3px | font: 13px var(--mono); color: #e8d9ad; background: color-mix(in srgb, var(--accent) 22%, #1a1b1a); box-shado… |
| `renderer/styles.css:752` | S | 4px 10px 4px 12px 10px 70% | .plinks { margin: 4px 0 10px; padding: 4px 12px 10px; background: color-mix(in srgb, var(--card) 70%, transpa… |
| `renderer/styles.css:753` | S | 14px 300 13px 24px | .plinks .pl { display: flex; gap: 14px; font: 300 13px/24px var(--ui); color: var(--fg); } |
| `renderer/styles.css:755` | S | 12.5px | .plinks .f { font: 12.5px var(--mono); color: var(--bright); } .plinks .by { color: var(--dim); } |
| `renderer/styles.css:757` | Z S | 100% 6px 40 560px 70vw 18px 40px .55 4px | .sfndl { position: absolute; right: 0; top: calc(100% + 6px); z-index: 40; width: 560px; max-width: 70vw; bac… |
| `renderer/styles.css:758` | S | 12px 6px 14px 300 13px 1.45 | .sfndl button { display: flex; gap: 12px; align-items: baseline; padding: 6px 14px; text-align: left; font: 3… |
| `renderer/styles.css:760` | S | 58px 11.5px | .sfndl .g { flex: none; width: 58px; font-size: 11.5px; color: var(--dim); } |
| `renderer/styles.css:764` | S | 500 20px 5px | .sprev .pstep b { font: 500 20px var(--mono); color: #e3e6df; margin: 0 5px; } |
| `renderer/styles.css:766` | S | 300 11px 6px | .sprev .pfn small { font: 300 11px var(--ui); color: var(--dim); margin-left: 6px; } |
| `renderer/styles.css:769` | S | 44px 14px 1.5px | .sconn { margin: 0 0 0 44px; height: 14px; border-left: 1.5px dashed #ad9b6f; } |
| `renderer/styles.css:770` | Z | 100vw 100vh 8 | .slink { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 8; ove… |
| `renderer/styles.css:771` | S | 12px 12px 10px 12px 9px 1px 227 214 173 .55 | .ibx { margin: auto 12px 12px; padding: 10px 12px 9px; border: 1px dotted rgba(227, 214, 173, .55); backgroun… |
| `renderer/styles.css:772` | S | 8px | .ibx .h { display: flex; align-items: center; gap: 8px; } |
| `renderer/styles.css:776` | S | 64px 1fr 4px 10px 8px 300 12px 1.45 | .ibx .k { display: grid; grid-template-columns: 64px 1fr; gap: 4px 10px; margin-top: 8px; font: 300 12px/1.45… |
| `renderer/styles.css:778` | S | 400 11.5px | .ibx .k code { font: 400 11.5px var(--mono); color: #c9cec6; word-break: break-all; } |
| `renderer/styles.css:780` | S | 7px 300 11px | .ibx .src { margin-top: 7px; font: 300 11px var(--ui); color: var(--dim); } |
| `renderer/styles.css:784` | OK S | 16px 8px 22px 3px 300 12px | .gtop { display: flex; align-items: center; gap: 16px; padding: 8px 22px 3px; font: 300 12px var(--ui); color… |
| `renderer/styles.css:786` | S | 500 13px 5px 400 | .gtop b { font: 500 13px var(--mono); color: #e3e6df; margin-right: 5px; } .gtop .xf b { color: #e0a060; } .g… |
| `renderer/styles.css:787` | OK S | 6px 3px 22px 8px 300 11.5px 1px | .gkey { display: flex; align-items: center; gap: 6px; padding: 3px 22px 8px; font: 300 11.5px var(--ui); colo… |
| `renderer/styles.css:789` | S | 2px 9px 3px 2px | .gkey .sws { display: inline-flex; gap: 2px; } .gkey .sws i { width: 9px; height: 3px; border-radius: 2px; } |
| `renderer/styles.css:790` | S | 10px 500 11px | .gkey .kt { margin-left: 10px; } .gkey .kt b { font: 500 11px var(--mono); color: #c9cec6; } |
| `renderer/styles.css:791` | S | 8px 500 11px 1px 4px 16px | .gkey .kc { margin-left: 8px; font: 500 11px var(--mono); font-style: normal; color: #c9cec6; border: 1px sol… |
| `renderer/styles.css:793` | S | 10px | .gkey .dots { margin-left: 10px; } |
| `renderer/styles.css:794` | S | 1px 2px 10px 300 12px 255 255 255 .07 | .gtop .seg { display: flex; border: 1px solid #2e322e; } .gtop .seg button { padding: 2px 10px; font: 300 12p… |
| `renderer/styles.css:795` | S | 1 62px | .gscroll { position: relative; flex: 1; min-height: 0; overflow: auto; padding-bottom: 62px; } |
| `renderer/styles.css:799` | S | 400 10px | .gch span { font: 400 10px var(--mono); color: #5f665f; } |
| `renderer/styles.css:803` | S | 12px 20px 2px | .grb { position: absolute; left: 12px; width: 20px; border-right: 2px solid var(--c); display: flex; align-it… |
| `renderer/styles.css:813` | S | 2px 227 214 173 | .gcell { position: absolute; display: flex; align-items: center; justify-content: center; gap: 2px; cursor: d… |
| `renderer/styles.css:814` | S | 3px 3px 50% | .gcell s { width: 3px; height: 3px; border-radius: 50%; background: #2a2d2a; } |
| `renderer/styles.css:823` | S | 400 10px | .gcell .sep { font: 400 10px var(--mono); color: #5f665f; } |
| `renderer/styles.css:824` | S | 2px | .dots { display: inline-flex; align-items: center; gap: 2px; } |
| `renderer/styles.css:825` | S | 5px 5px 50% 1px | .dots b { width: 5px; height: 5px; border-radius: 50%; border: 1px solid #6f766f; } |
| `renderer/styles.css:827` | S | 4px 500 11px | .dots em { margin-left: 4px; font: 500 11px var(--mono); font-style: normal; color: #c9cec6; } |
| `renderer/styles.css:828` | Z | 1.5px 2 | .gcell.hv { box-shadow: inset 0 0 0 1.5px #7fa3c4; z-index: 2; } |
| `renderer/styles.css:829` | Z | 1.5px 16px 227 214 173 .25 2 | .gcell.on { box-shadow: inset 0 0 0 1.5px #e3d6ad, 0 0 16px rgba(227, 214, 173, .25); z-index: 2; } |
| `renderer/styles.css:831` | Z S | 2px 3px 1.5px 18px 227 214 173 .2 3 | .gcell.pk { flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 2px; padding: 3px… |
| `renderer/styles.css:838` | Z | 3 | .glinks { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 3; overflow: visible; } |
| `renderer/styles.css:843` | S | 7px 21px 5px | .gstep { display: flex; align-items: center; gap: 7px; height: 21px; padding: 0 5px; background: #222422; cur… |
| `renderer/styles.css:844` | S | 500 11px | .gstep i { padding: 0; border: 0; font: 500 11px var(--mono); color: #9ea39b; } .gstep.dn i { color: #6f766f;… |
| `renderer/styles.css:846` | S | 300 10px | .gstep small { font: 300 10px var(--ui); color: var(--dim); } |
| `renderer/styles.css:849` | Z | 5 | .gstrip { position: absolute; background: var(--bg); pointer-events: none; z-index: 5; } |
| `renderer/styles.css:850` | Z | 7 | .gstrip.top { z-index: 7; } |
| `renderer/styles.css:851` | Z | 6 | .gview .grh, .gview .grb { z-index: 6; } |
| `renderer/styles.css:852` | Z | 8 | .gview .gch, .gview .gfb { z-index: 8; } |
| `renderer/styles.css:853` | Z | 10 | .gcorner { position: absolute; background: var(--bg); z-index: 10; } |
| `renderer/styles.css:854` | Z | 100% 1 | .gtothd { position: absolute; left: 0; width: 100%; background: var(--bg); z-index: 1; } |
| `renderer/styles.css:855` | Z | 1 | .progs .grp { position: sticky; top: 0; z-index: 1; background: var(--bg); } |
| `renderer/styles.css:856` | Z S | 1 10px 10px 4px 12px 10px 10px 4px 12px | .ibx.full .in > .h { position: sticky; top: 0; z-index: 1; background: #181918; margin: -10px -10px -4px -12p… |
| `renderer/styles.css:859` | S | 64px 1.2 | .gax.w2 { white-space: normal; width: 64px; line-height: 1.2; } |
| `renderer/styles.css:860` | S | 6px 6px 400 11px | .gtot .t { position: absolute; left: 6px; display: flex; align-items: center; gap: 6px; font: 400 11px var(--… |
| `renderer/styles.css:861` | S | 4px | .gtot .t i { display: block; height: 4px; background: #4a504a; } .gtot .t.pk { color: #e3d6ad; } .gtot .t.pk … |
| `renderer/styles.css:862` | Z S | 40px 7 90px | .gmk { position: absolute; left: 0; height: 40px; background: var(--bg); z-index: 7; box-shadow: 0 90px 0 0 v… |
| `renderer/styles.css:863` | S | 2px 32px 2px 400 11px | .gmk .m { position: absolute; top: 2px; height: 32px; display: flex; flex-direction: column; justify-content:… |
| `renderer/styles.css:864` | S | 5px | .gmk .m i { display: block; width: 5px; background: #4a504a; } .gmk .m.pk { color: #e3d6ad; } .gmk .m.pk i { … |
| `renderer/styles.css:871` | S | 3px 4px | .sfrom code, .ibx .cl code { padding: 3px 4px; } |
| `renderer/styles.css:872` | S | 4px 14px 300 11px | .sprev .clk { margin: 4px 14px 0; font: 300 11px var(--ui); color: #e3d6ad; flex: none; } |
| `renderer/styles.css:873` | S | 1 1 110px | .sprev .scodewrap { flex: 1 1 0; min-height: 110px; display: flex; flex-direction: column; } |
| `renderer/styles.css:876` | S | 6px 12px 12px | .hdiv { position: relative; margin: 6px 12px 0; height: 12px; cursor: row-resize; display: flex; align-items:… |
| `renderer/styles.css:877` | S | 5px 1px | .hdiv::before { content: ''; position: absolute; left: 0; right: 0; top: 5px; height: 1px; background: #2e322… |
| `renderer/styles.css:878` | S | 46px 5px 1px 1px | .hdiv .grip { position: relative; width: 46px; height: 5px; border-top: 1px solid #6f766f; border-bottom: 1px… |
| `renderer/styles.css:880` | S | 2px 12px 12px | .ibx.full { margin: 2px 12px 12px; padding: 0; overflow-y: auto; flex: none; } |
| `renderer/styles.css:881` | S | 10px 10px 9px 12px | .ibx.full .in { padding: 10px 10px 9px 12px; } |
| `renderer/styles.css:882` | S | 7px | .ibx.full::-webkit-scrollbar { width: 7px; } .ibx.full::-webkit-scrollbar-thumb { background: #4a504a; } |
| `renderer/styles.css:883` | S | 9px 7px 1px | .ibx .sec { margin-top: 9px; padding-top: 7px; border-top: 1px solid #2a2d2a; } |
| `renderer/styles.css:884` | S | 5px 600 10px .07em | .ibx h6 { margin: 0 0 5px; font: 600 10px var(--ui); letter-spacing: .07em; color: #ad9b6f; text-transform: u… |
| `renderer/styles.css:885` | S | 300 12.5px 500 15px | .ibx .big2 { font: 300 12.5px var(--ui); color: var(--fg); } .ibx .big2 b { font: 500 15px var(--mono); color… |
| `renderer/styles.css:886` | S | 62px 1fr 2px 8px 5px 6px 4px | .ibx .cl { display: grid; grid-template-columns: 62px 1fr auto; gap: 2px 8px; padding: 5px 6px; margin-top: 4… |
| `renderer/styles.css:888` | S | 500 11.5px | .ibx .cl .sp { font: 500 11.5px var(--mono); color: #9ea39b; } .ibx .cl.now .sp { color: #e3d6ad; } |
| `renderer/styles.css:889` | S | 300 11px | .ibx .cl .o, .ibx .cl .lc { font: 300 11px var(--ui); color: var(--dim); } .ibx .cl .lc { text-align: right; } |
| `renderer/styles.css:891` | S | 70px 1fr 3px 10px 300 12px 1.45 | .ibx .kv { display: grid; grid-template-columns: 70px 1fr; gap: 3px 10px; font: 300 12px/1.45 var(--ui); colo… |
| `renderer/styles.css:892` | S | 400 11px | .ibx .kv > span:nth-child(odd) { color: var(--dim); } .ibx .kv code { font: 400 11px var(--mono); color: #c9c… |

## 5. Unused

| Line | Why | Text |
|---|---|---|
| `renderer/components/FlowBoxes.tsx:20` | the file is not imported by shipped code | type Zoom = 'all' \| 'width' \| '100' \| '150' \| ''; |
| `renderer/components/FlowBoxes.tsx:22` | the file is not imported by shipped code | const METRO = (t: number) => 1 - Math.pow(1 - t, 4); |
| `renderer/components/FlowBoxes.tsx:23` | the file is not imported by shipped code | const LABEL_PX = 12, LABEL_CH = 7.2; |
| `renderer/components/FlowBoxes.tsx:24` | the file is not imported by shipped code | const storedZoom = (): Zoom \| null => { try { const z = localStorage.getItem('flow.boxes.zoom'); return z ===… |
| `renderer/components/FlowBoxes.tsx:41` | the file is not imported by shipped code | const [size, setSize] = createSignal({ w: 1000, h: 700 }); |
| `renderer/components/FlowBoxes.tsx:58` | the file is not imported by shipped code | const z = !fitted && !chosen ? (fitK('width') >= LEVEL_AT.functions ? 'width' : '100') : zoom() \|\| 'width'; |
| `renderer/components/FlowBoxes.tsx:67` | the file is not imported by shipped code | const k1 = Math.min(1.5, f('functions')); |
| `renderer/components/FlowBoxes.tsx:69` | the file is not imported by shipped code | const k2 = Math.min(LEVEL_AT.functions - 0.001, f('files')); |
| `renderer/components/FlowBoxes.tsx:71` | the file is not imported by shipped code | return Math.max(MIN_K, Math.min(LEVEL_AT.files - 0.001, f('folders'))); |
| `renderer/components/FlowBoxes.tsx:73` | the file is not imported by shipped code | function applyZoom(z: Zoom, ms = 360) { |
| `renderer/components/FlowBoxes.tsx:75` | the file is not imported by shipped code | const k1 = z === '100' ? 1 : z === '150' ? 1.5 : z === 'all' \|\| z === 'width' ? fitK(z) : k(); |
| `renderer/components/FlowBoxes.tsx:97` | the file is not imported by shipped code | k1 = Math.max(MIN_K, Math.min(2.5, k1)); |
| `renderer/components/FlowBoxes.tsx:113` | the file is not imported by shipped code | function scrollTo(x: number, y: number, ms = 520): Promise<void> { |
| `renderer/components/FlowBoxes.tsx:118` | the file is not imported by shipped code | function reveal(r: { x: number; y: number; w: number; h: number }, ms = 520): Promise<void> { |
| `renderer/components/FlowBoxes.tsx:119` | the file is not imported by shipped code | const m = 70, kk = k(), x = r.x * kk + PAD, y = r.y * kk + PAD, w = r.w * kk, h = r.h * kk; |
| `renderer/components/FlowBoxes.tsx:123` | the file is not imported by shipped code | const nx = far ? x - vw / 3 : x < vx + m ? x - m : x + w > vx + vw - m ? x + w - vw + m : vx; |
| `renderer/components/FlowBoxes.tsx:124` | the file is not imported by shipped code | const ny = far ? y - vh / 3 : y < vy + m ? y - m : y + h > vy + vh - m ? y + h - vh + m : vy; |
| `renderer/components/FlowBoxes.tsx:133` | the file is not imported by shipped code | createEffect(on([selRow, lay], () => { if (!walking) revealRow(selRow(), 560); }, { defer: true })); |
| `renderer/components/FlowBoxes.tsx:138` | the file is not imported by shipped code | return r ? reveal({ x: r.x, y: r.y - 14, w: Math.min(r.w, 300), h: 28 }, ms) : Promise.resolve(); |
| `renderer/components/FlowBoxes.tsx:190` | the file is not imported by shipped code | const total = seg[seg.length - 1], ms = reduce() ? 0 : Math.max(260, Math.min(1500, (total * k()) / 0.9)) / s… |
| `renderer/components/FlowBoxes.tsx:197` | the file is not imported by shipped code | const f = (d - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]); |
| `renderer/components/FlowBoxes.tsx:199` | the file is not imported by shipped code | setMarker({ at: p, path: [...pts.slice(0, i), p] }); |
| `renderer/components/FlowBoxes.tsx:201` | the file is not imported by shipped code | const sx = p.x * k() + PAD - scroller.scrollLeft, sy = p.y * k() + PAD - scroller.scrollTop, mg = 50; |
| `renderer/components/FlowBoxes.tsx:204` | the file is not imported by shipped code | scrollTo(Math.max(0, p.x * k() + PAD - scroller.clientWidth / 2), Math.max(0, p.y * k() + PAD - scroller.clie… |
| `renderer/components/FlowBoxes.tsx:231` | the file is not imported by shipped code | await revealRow(stepOf(s.run, s.items[to]), 420 / speed()); |
| `renderer/components/FlowBoxes.tsx:243` | the file is not imported by shipped code | await new Promise((res) => setTimeout(res, 380 / speed())); |
| `renderer/components/FlowBoxes.tsx:258` | the file is not imported by shipped code | if (first) await reveal({ x: first.x, y: first.y - 14, w: 200, h: 28 }, 420); |
| `renderer/components/FlowBoxes.tsx:261` | the file is not imported by shipped code | const watch = setInterval(() => { const mk = marker(); if (mk) at(mk.at); }, 30); |
| `renderer/components/FlowBoxes.tsx:266` | the file is not imported by shipped code | setTimeout(() => setHot(new Set<number>()), 1600); |
| `renderer/components/FlowBoxes.tsx:279` | the file is not imported by shipped code | let capTimer: ReturnType<typeof setTimeout> \| undefined; |
| `renderer/components/FlowBoxes.tsx:280` | the file is not imported by shipped code | function say(key: string, what: string, why = '') { setCaption({ key, what, why }); clearTimeout(capTimer); c… |
| `renderer/components/FlowBoxes.tsx:290` | the file is not imported by shipped code | if (e.altKey && (key === '=' \|\| key === '+' \|\| key === '≠')) { e.preventDefault(); zoomTo(k() * 1.25, { ms: 2… |
| `renderer/components/FlowBoxes.tsx:291` | the file is not imported by shipped code | if (e.altKey && (key === '-' \|\| key === '–')) { e.preventDefault(); zoomTo(k() / 1.25, { ms: 260 }); return; } |
| `renderer/components/FlowBoxes.tsx:296` | the file is not imported by shipped code | if (key === '+' \|\| key === '=') { setSpeed(Math.min(4, speed() * 1.5)); return; } |
| `renderer/components/FlowBoxes.tsx:297` | the file is not imported by shipped code | if (key === '-') { setSpeed(Math.max(0.25, speed() / 1.5)); return; } |
| `renderer/components/FlowBoxes.tsx:303` | the file is not imported by shipped code | if (route() && /^[1-9]$/.test(key)) { const r = route()!, i = Number(key) - 1; if (i < r.list.length) setRout… |
| `renderer/components/FlowBoxes.tsx:315` | the file is not imported by shipped code | zoomTo(k() * Math.exp(-e.deltaY / 300), { ax: e.clientX - r.left, ay: e.clientY - r.top }); |
| `renderer/components/FlowBoxes.tsx:333` | the file is not imported by shipped code | if ((zoom() === 'width' \|\| zoom() === 'all') && (Math.abs(w - old.w) > 12 \|\| Math.abs(h - old.h) > 12)) apply… |
| `renderer/components/FlowBoxes.tsx:357` | the file is not imported by shipped code | const CULL_AT = 120; |
| `renderer/components/FlowBoxes.tsx:380` | the file is not imported by shipped code | const below = window.innerHeight - h.rect.bottom, above = h.rect.top, down = below >= above; |
| `renderer/components/FlowBoxes.tsx:381` | the file is not imported by shipped code | const room = Math.max(120, (down ? below : above) - 16); |
| `renderer/components/FlowBoxes.tsx:382` | the file is not imported by shipped code | return { left: '${Math.max(8, Math.min(h.rect.left, window.innerWidth - 560))}px', [down ? 'top' : 'bottom']:… |
| `renderer/components/FlowBoxes.tsx:385` | the file is not imported by shipped code | const room = Math.max(120, Math.max(window.innerHeight - h.rect.bottom, h.rect.top) - 16); |
| `renderer/components/FlowBoxes.tsx:386` | the file is not imported by shipped code | const n = Math.max(3, Math.floor((room - 16) / 23)); |
| `renderer/components/FlowBoxes.tsx:394` | the file is not imported by shipped code | const W = 180, sc = W / (l.w + 2 * PAD), H = Math.max(30, (l.h + 2 * PAD) * sc), dpr = window.devicePixelRati… |
| `renderer/components/FlowBoxes.tsx:401` | the file is not imported by shipped code | x.strokeRect(v.x / kk * sc + 0.5, v.y / kk * sc + 0.5, Math.min(W - 1, size().w / kk * sc), Math.min(H - 1, s… |
| `renderer/components/FlowBoxes.tsx:407` | the file is not imported by shipped code | const r = mini.getBoundingClientRect(), sc = 180 / (l.w + 2 * PAD); |
| `renderer/components/FlowBoxes.tsx:421` | the file is not imported by shipped code | const W = l.w + 2 * PAD, H = l.h + 2 * PAD + (unreached() ? 30 : 0); |
| `renderer/components/FlowBoxes.tsx:422` | the file is not imported by shipped code | let out = '<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-fa… |
| `renderer/components/FlowBoxes.tsx:423` | the file is not imported by shipped code | for (const g of l.groups) out += '<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="#1a2020" s… |
| `renderer/components/FlowBoxes.tsx:424` | the file is not imported by shipped code | for (const x of l.lines) out += '<polyline points="${x.pts.map((p) => '${p.x},${p.y}').join(' ')}" fill="none… |
| `renderer/components/FlowBoxes.tsx:427` | the file is not imported by shipped code | out += '<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#1a1b1a" stroke="#3a3f3a"/><text x="… |
| `renderer/components/FlowBoxes.tsx:429` | the file is not imported by shipped code | const y = p.y + r.y + 15; |
| `renderer/components/FlowBoxes.tsx:431` | the file is not imported by shipped code | ? '<text x="${p.x + 32}" y="${y}" font-size="12" text-anchor="end" fill="#a39467" font-family="monospace">${R… |
| `renderer/components/FlowBoxes.tsx:432` | the file is not imported by shipped code | : '<text x="${p.x + 44}" y="${y - 2}" font-size="11" fill="#4f6a6a">↻ ${esc(m.run.frames[r.frame!].text)}</te… |
| `renderer/components/FlowBoxes.tsx:435` | the file is not imported by shipped code | for (const b of placeLabels(l, 1, LABEL_CH)) out += '<rect x="${b.x - b.w}" y="${b.y - b.h / 2}" width="${b.w… |
| `renderer/components/FlowBoxes.tsx:445` | the file is not imported by shipped code | flash('saved ${basename(file)}', 3000); |
| `renderer/components/FlowBoxes.tsx:452` | the file is not imported by shipped code | const scale = Math.min(2, 16000 / x.W, 16000 / x.H); |
| `renderer/components/FlowBoxes.tsx:454` | the file is not imported by shipped code | img.src = 'data:image/svg+xml;charset=utf-8,${encodeURIComponent(x.out)}'; |
| `renderer/components/FlowBoxes.tsx:455` | the file is not imported by shipped code | try { await img.decode(); } catch { flash('could not draw the picture', 4000); return; } |
| `renderer/components/FlowBoxes.tsx:461` | the file is not imported by shipped code | flash('saved ${basename(file)} · ${c.width} × ${c.height}', 3000); |
| `renderer/components/FlowBoxes.tsx:476` | the file is not imported by shipped code | <div class="body" style={{ height: '100%' }}> |
| `renderer/components/FlowBoxes.tsx:479` | the file is not imported by shipped code | <For each={h().fns.slice(0, hoverFits(h()))}>{(i) => <div><span class="n">{R()[i].n}</span><span class="nm">{… |
| `renderer/components/FlowBoxes.tsx:484` | the file is not imported by shipped code | <div class="ph wrap" style={{ padding: '0 22px' }}> |
| `renderer/components/FlowBoxes.tsx:486` | the file is not imported by shipped code | <Show when={header()}><span class="seqk" style={{ 'margin-left': '14px' }}>{header()}</span></Show> |
| `renderer/components/FlowBoxes.tsx:493` | the file is not imported by shipped code | <button class="chip" title="save the diagram as drawn: an SVG picture or a PNG image" onClick={() => setPalet… |
| `renderer/components/FlowBoxes.tsx:498` | the file is not imported by shipped code | <Show when={lay()} fallback={<div class="empty" style={{ position: 'absolute', inset: 0 }}>{runStatus() \|\| st… |
| `renderer/components/FlowBoxes.tsx:501` | the file is not imported by shipped code | <svg class="bxed" width={lay()!.w + 40} height={lay()!.h + 40}> |
| `renderer/components/FlowBoxes.tsx:509` | the file is not imported by shipped code | <path class="ah" d={'M${q.x - 6} ${q.y - 3.5} L${q.x} ${q.y} L${q.x - 6} ${q.y + 3.5} Z'} /> |
| `renderer/components/FlowBoxes.tsx:525` | the file is not imported by shipped code | onDblClick={() => { if (lv() !== 'functions') { const r = scroller.getBoundingClientRect(), b = (scroller.que… |
| `renderer/components/FlowBoxes.tsx:528` | the file is not imported by shipped code | <div class="t" title={f.startsWith('dir:') ? f.slice(4) \|\| 'the top folder' : rel(f)}>{f.startsWith('dir:') ?… |
| `renderer/components/FlowBoxes.tsx:543` | the file is not imported by shipped code | style={{ top: '${r.y}px', background: heat() && howOftenLevel(S()!.run, r.row).level ? 'rgba(111,158,158,${[0… |
| `renderer/components/FlowBoxes.tsx:560` | the file is not imported by shipped code | style={{ left: '${b.x - b.w}px', top: '${b.y - b.h / 2}px', width: '${b.w}px', height: '${b.h}px', 'font-size… |
| `renderer/components/FlowBoxes.tsx:577` | the file is not imported by shipped code | <For each={[['all', 'fit all'], ['width', 'fit width'], ['100', '100%'], ['150', '150%']] as [Zoom, string][]… |
| `renderer/components/FlowBoxes.tsx:578` | the file is not imported by shipped code | <button class="chip" title={'zoom out (${ALT} −)'} onClick={() => zoomTo(k() / 1.25, { ms: 260 })}>−</button> |
| `renderer/components/FlowBoxes.tsx:579` | the file is not imported by shipped code | <span class="ro">{Math.round(k() * 100)}%</span> |
| `renderer/components/FlowBoxes.tsx:580` | the file is not imported by shipped code | <button class="chip" title={'zoom in (${ALT} +)'} onClick={() => zoomTo(k() * 1.25, { ms: 260 })}>+</button> |
| `renderer/components/FlowBoxes.tsx:589` | the file is not imported by shipped code | <div class="ph" style={{ padding: '0 20px' }}><span style={{ color: 'var(--bright)' }}>{r().list.length} rout… |
| `renderer/components/FlowBoxes.tsx:597` | the file is not imported by shipped code | <div class="ways pv"><span><b>1–{Math.min(9, r().list.length)}</b> one route</span><span><b>Enter</b> walk it… |
| `renderer/lib/flowlayout.ts:8` | the file is not imported by shipped code | const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; |
| `renderer/lib/flowlayout.ts:13` | the file is not imported by shipped code | const x = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]); |
| `renderer/lib/flowlayout.ts:14` | the file is not imported by shipped code | const y = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]); |
| `renderer/lib/flowlayout.ts:21` | the file is not imported by shipped code | export const footprint = (b: BoxAt, pad = 4): Rect => { |
| `renderer/lib/flowlayout.ts:25` | the file is not imported by shipped code | export const labelSize = (text: string, thread: boolean) => ({ w: text.length * (thread ? 6.4 : 7.6) + 16, h:… |
| `renderer/lib/flowlayout.ts:37` | the file is not imported by shipped code | x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + b.w / 2; y2 = b.y - 2; ang = 90; |
| `renderer/lib/flowlayout.ts:38` | the file is not imported by shipped code | if (b.y < a.y) { y1 = a.y; y2 = b.y + b.h + 2; ang = -90; } |
| `renderer/lib/flowlayout.ts:41` | the file is not imported by shipped code | const dx = Math.max(40, (x2 - x1) / 2), dy = ang > 0 ? 60 : -60; |
| `renderer/lib/flowlayout.ts:47` | the file is not imported by shipped code | search: for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82]) { |
| `renderer/lib/flowlayout.ts:49` | the file is not imported by shipped code | for (const s of [0, 1, -1, 2, -2, 3, -3]) { |
| `renderer/lib/flowlayout.ts:50` | the file is not imported by shipped code | const x = cx - ty * s * 13, y = cy + tx * s * 13; |
| `renderer/lib/flowlayout.ts:53` | the file is not imported by shipped code | for (const o of blocked) cost += overlap(r, o) * 4; |
| `renderer/lib/flowlayout.ts:55` | the file is not imported by shipped code | cost += Math.abs(s) * 0.5 + Math.abs(t - 0.5); |
| `renderer/lib/flowlayout.ts:57` | the file is not imported by shipped code | if (cost < 5) break search; |
| `renderer/lib/flowlayout.ts:66` | the file is not imported by shipped code | export function folderFrames(boxes: (BoxAt & { folder: string })[], pad = 22): (Rect & { folder: string })[] { |
| `renderer/lib/flowlayout.ts:74` | the file is not imported by shipped code | return [...by].map(([folder, r]) => ({ folder, x: r.x - pad, y: r.y - pad - 14, w: r.w + 2 * pad, h: r.h + 2 … |
| `renderer/styles.css:126` | no shipped use of .call-mark | .call-mark { text-underline-offset: 4px; } |
| `renderer/styles.css:145` | no shipped use of .std-row | .std-row { font: 300 12.5px/1.6 var(--ui); color: #7b8279; padding: 2px 12px; } |
| `renderer/styles.css:253` | no shipped use of .bxs | .bxs { position: absolute; left: 0; top: 0; right: 0; bottom: 34px; overflow: auto; cursor: default; } |
| `renderer/styles.css:254` | no shipped use (found by the check of every rule; this line holds no number) | .bxs.drag |
| `renderer/styles.css:255` | no shipped use of .bxsz | .bxsz { position: relative; overflow: hidden; } |
| `renderer/styles.css:256` | no shipped use of .bxw | .bxw { position: absolute; transform-origin: 0 0; } |
| `renderer/styles.css:257` | no shipped use of .bxed | .bxed { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; } |
| `renderer/styles.css:258` | no shipped use of .bxed | .bxed .ln { fill: none; stroke: #3f453f; stroke-width: 1; transition: stroke .3s, opacity .3s; } |
| `renderer/styles.css:259` | no shipped use of .bxed .ah | .bxed .ah { fill: #3f453f; stroke: none; transition: fill .3s, opacity .3s; } |
| `renderer/styles.css:260` | no shipped use of .bxed | .bxed .hit { fill: none; stroke: transparent; stroke-width: 10; pointer-events: stroke; cursor: pointer; } |
| `renderer/styles.css:261` | no shipped use of .bxed | .bxed .thread .ln { stroke-dasharray: 5 4; } |
| `renderer/styles.css:262` | no shipped use (found by the check of every rule; this line holds no number) | .bxed .chain .ln, .bxed .chain .ah |
| `renderer/styles.css:263` | no shipped use of .bxed | .bxed .now .ln { stroke: var(--flow-now); stroke-width: 2; } .bxed .now .ah { fill: var(--flow-now); } |
| `renderer/styles.css:264` | no shipped use of .bxed | .bxed .on .ln { stroke: var(--flow-now); stroke-width: 1.5; stroke-dasharray: 6 4; animation: bxflow .9s line… |
| `renderer/styles.css:265` | no shipped use of .bxed .ah | .bxed .dim .ln, .bxed .dim .ah { opacity: .18; } |
| `renderer/styles.css:266` | no shipped use of .bxed | .bxed .walk { fill: none; stroke: #e8d9ad; stroke-width: 2; opacity: .35; } |
| `renderer/styles.css:268` | no shipped use of .fbox | .fbox { position: absolute; background: #1a1b1a; border: 1px solid #2e322e; cursor: default; transition: opac… |
| `renderer/styles.css:269` | no shipped use of .fbox | .fbox.cur { border-color: var(--flow-now); background: #1f1e19; box-shadow: 0 0 0 1px rgba(173,155,111,.25); … |
| `renderer/styles.css:270` | no shipped use of .fbox | .fbox .t { position: absolute; left: 12px; top: 8px; right: 34px; font: 300 15px var(--ui); color: #c9cdc5; w… |
| `renderer/styles.css:271` | no shipped use of .fbox | .fbox .t i { font-style: normal; color: #4f564f; font-size: 11.5px; margin-left: 6px; } |
| `renderer/styles.css:272` | no shipped use of .fbox | .fbox .lc { position: absolute; right: 10px; top: 10px; font: 300 11.5px var(--ui); color: #4f7a7a; } |
| `renderer/styles.css:273` | no shipped use of .fbox | .fbox .s { position: absolute; left: 12px; top: 42px; font: 300 15px var(--ui); color: #5f665f; white-space: … |
| `renderer/styles.css:274` | no shipped use of .fbox | .fbox .start { position: absolute; right: calc(100% + 10px); top: 9px; font: 300 12px var(--ui); color: var(-… |
| `renderer/styles.css:275` | no shipped use of .lv-files .fbox .lv-folders | .lv-files .fbox .t, .lv-folders .fbox .t { font-size: calc(14px * var(--inv)); left: calc(12px * var(--inv));… |
| `renderer/styles.css:276` | no shipped use of .lv-files .fbox .lv-folders | .lv-files .fbox .t i, .lv-folders .fbox .t i { font-size: calc(11px * var(--inv)); } |
| `renderer/styles.css:277` | no shipped use of .lv-files .fbox .lv-folders | .lv-files .fbox .s, .lv-folders .fbox .s { font-size: calc(11.5px * var(--inv)); left: calc(12px * var(--inv)… |
| `renderer/styles.css:278` | no shipped use of .lv-files .fbox .s2 .lv-folders | .lv-files .fbox .s2, .lv-folders .fbox .s2 { top: calc(46px * var(--inv)); } |
| `renderer/styles.css:279` | no shipped use of .lv-files .fbox .lv-folders | .lv-files .fbox .lc, .lv-folders .fbox .lc { font-size: calc(11px * var(--inv)); right: calc(10px * var(--inv… |
| `renderer/styles.css:280` | no shipped use of .lv-files .fbox .lv-folders | .lv-files .fbox .start, .lv-folders .fbox .start { font-size: calc(12px * var(--inv)); top: calc(9px * var(--… |
| `renderer/styles.css:281` | no shipped use (found by the check of every rule; this line holds no number) | .lv-files .fbox, .lv-folders .fbox (and :hover) |
| `renderer/styles.css:282` | no shipped use of .fbox | .fbox .fr { position: absolute; left: 0; right: 0; height: 21px; display: flex; align-items: baseline; gap: 9… |
| `renderer/styles.css:283` | no shipped use (found by the check of every rule; this line holds no number) | .fbox .fr:hover |
| `renderer/styles.css:284` | no shipped use of .fbox | .fbox .fr .n { width: 20px; text-align: right; color: #6f6650; font-variant-numeric: tabular-nums; flex: none… |
| `renderer/styles.css:285` | no shipped use of .fbox | .fbox .fr .nm { overflow: hidden; text-overflow: ellipsis; } |
| `renderer/styles.css:286` | no shipped use of .fbox | .fbox .fr .c { margin-left: auto; font: 300 11px var(--ui); color: #6f9e9e; padding-left: 8px; } |
| `renderer/styles.css:287` | no shipped use of .fbox | .fbox .fr.chain { color: #d6d8cf; background: rgba(173,155,111,.06); } .fbox .fr.chain .n { color: #a39467; } |
| `renderer/styles.css:288` | no shipped use of .fbox | .fbox .fr.sel { background: rgba(173,155,111,.32); color: #fff6df; box-shadow: inset 4px 0 var(--flow-now), i… |
| `renderer/styles.css:289` | no shipped use of .fbox | .fbox .fr.on { background: rgba(173,155,111,.1); color: #e3e6df; } .fbox .fr.on .n { color: #b8a676; } |
| `renderer/styles.css:290` | no shipped use of .fbox | .fbox .fr.hot { background: rgba(173,155,111,.24); color: #f0eadb; box-shadow: inset 3px 0 var(--flow-now); } |
| `renderer/styles.css:291` | no shipped use of .fbox .lpl | .fbox .fr.dim, .fbox .lpl.dim { opacity: .3; } |
| `renderer/styles.css:292` | no shipped use (found by the check of every rule; this line holds no number) | .fbox .fr.wx .nm, .fbox .fr .c.x |
| `renderer/styles.css:293` | no shipped use of .fbox .lpl | .fbox .lpl { position: absolute; left: 44px; right: 10px; height: 16px; font: 300 11px/16px var(--ui); color:… |
| `renderer/styles.css:294` | no shipped use (found by the check of every rule; this line holds no number) | .fbox .lpl.hot |
| `renderer/styles.css:295` | no shipped use of .bxgrp | .bxgrp { position: absolute; background: rgba(111,158,158,.035); border: 1px solid #263030; } |
| `renderer/styles.css:296` | no shipped use of .bxgrp | .bxgrp span { position: absolute; left: 12px; top: 8px; font: 300 19px var(--ui); letter-spacing: .14em; text… |
| `renderer/styles.css:297` | no shipped use of .flab | .flab { position: absolute; background: var(--bg); font-family: var(--mono); color: #c9b98f; text-align: righ… |
| `renderer/styles.css:298` | no shipped use of .flab | .flab.t { font-family: var(--ui); font-weight: 300; color: #8a7f9a; } |
| `renderer/styles.css:299` | no shipped use of .flab | .flab.lit, .flab.on { color: #f0e3bd; } .flab.on { box-shadow: inset 0 0 0 1px #5a5442; } .flab.dim { opacity… |
| `renderer/styles.css:300` | no shipped use of .bxdot | .bxdot { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; background: #f0e3bd; box-shado… |
| `renderer/styles.css:301` | no shipped use of .bxctl | .bxctl { position: absolute; left: 0; right: 16px; bottom: 0; height: 34px; display: flex; align-items: cente… |
| `renderer/styles.css:302` | no shipped use of .bxctl .lvl | .bxctl .lvl { font: 300 12px var(--ui); color: #4f564f; } .bxctl .ro { font: 12px var(--mono); color: #8b9189… |
| `renderer/styles.css:303` | no shipped use of .bxmini | .bxmini { position: absolute; left: 16px; bottom: 48px; background: #141514; border: 1px solid #2a2d2a; curso… |
| `renderer/styles.css:304` | no shipped use of .bxroute | .bxroute { position: absolute; left: 22px; top: 10px; z-index: 3; background: var(--bg); padding: 3px 10px 3p… |
| `renderer/styles.css:305` | no shipped use of .bxroute | .bxroute .h { color: var(--accent); margin-right: 6px; } .bxroute b { font: 12.5px var(--mono); font-weight: … |
| `renderer/styles.css:306` | no shipped use of .fbox | .fbox .fr.chg { color: #9fd8c0; box-shadow: inset 2px 0 #79c9ae; } .fbox .fr.chg .n { color: #79c9ae; } .fbox… |
| `renderer/styles.css:311` | no shipped use of .hpop | .hpop { position: fixed; overflow: hidden; max-width: calc(100vw - 16px); background: #222422; box-shadow: 0 … |
| `renderer/styles.css:312` | no shipped use of .hpop | .hpop div { display: flex; gap: 12px; padding: 3px 14px; font: 13px var(--mono); color: var(--bright); white-… |
| `renderer/styles.css:313` | no shipped use of .hpop | .hpop .n { width: 26px; text-align: right; color: #c9b98f; flex: none; } |
| `renderer/styles.css:314` | no shipped use (found by the check of every rule; this line holds no number) | .hpop .nm |
| `renderer/styles.css:315` | no shipped use of .hpop | .hpop .more { font: 300 12px var(--ui); color: var(--dim); } |
| `renderer/styles.css:316` | no shipped use of .hpop | .hpop .no { color: #4a4f4a; min-width: 0; overflow: hidden; text-overflow: ellipsis; } |
| `renderer/styles.css:419` | no shipped use of .fgroup | .fgroup { position: absolute; border: 1px dashed #2f342f; pointer-events: none; } |
| `renderer/styles.css:420` | no shipped use of .fgroup | .fgroup span { position: absolute; left: 10px; top: 6px; font: 300 12.5px var(--ui); color: #586058; white-sp… |
| `renderer/styles.css:421` | no shipped use of .fbox | .fbox.pinned { border-style: solid; box-shadow: inset 0 -2px 0 #4a5a4a; } |
| `renderer/styles.css:422` | no shipped use of .fbox | .fbox .pin { position: absolute; right: 6px; top: -19px; font: 300 11.5px var(--ui); color: #6f786f; } |
| `renderer/styles.css:423` | no shipped use (found by the check of every rule; this line holds no number) | .fbox .pin:hover |
| `renderer/styles.css:428` | no shipped use of .bxv | .flow.bxv .scap { bottom: 48px; } |
| `renderer/styles.css:459` | no shipped use of .slane | .slane { position: absolute; top: 6px; z-index: 2; font: 300 12.5px var(--ui); color: #4f564f; white-space: n… |
| `renderer/styles.css:492` | no shipped use (found by the check of every rule; this line holds no number) | .mchip.t-thread |
| `renderer/styles.css:527` | no shipped use (found by the check of every rule; this line holds no number) | .fbox .fr.cadd .nm, .fbox .fr.cchg .nm::after |
| `renderer/styles.css:557` | no shipped use of .t-thread: the tone "thread" is declared in metrofacts.ts:5 and never set | .seqv.metro:not(.jpick) .srow.sel .mchip.t-thread { color: #6a2f5e; border-color: rgba(106, 47, 94, .6); } |
| `renderer/styles.css:750` | no shipped use of .fbox .hubt | .fbox .hubt { position: absolute; left: 0; top: -20px; font: 300 12px var(--ui); color: #6f9e9e; white-space:… |
| `renderer/styles.css:751` | no shipped use of .lv-files .fbox .hubt .lv-folders | .lv-files .fbox .hubt, .lv-folders .fbox .hubt { font-size: calc(12px * var(--inv)); top: calc(-20px * var(--… |
| `shared/flowboxes.ts:15` | the file is not imported by shipped code | const ROW_H = 21, LOOP_H = 16, HEAD = 36; |
| `shared/flowboxes.ts:16` | the file is not imported by shipped code | export const BOX_W: Record<Level, number> = { functions: 262, files: 300, folders: 400 }; |
| `shared/flowboxes.ts:18` | the file is not imported by shipped code | export const PAD = 28; |
| `shared/flowboxes.ts:19` | the file is not imported by shipped code | export const LEVEL_AT = { functions: 0.7, files: 0.4 }; |
| `shared/flowboxes.ts:21` | the file is not imported by shipped code | export const labelScale = (k: number) => Math.max(1, 0.95 / k); |
| `shared/flowboxes.ts:22` | the file is not imported by shipped code | export const MIN_K = 0.3; |
| `shared/flowboxes.ts:46` | the file is not imported by shipped code | const dirOf = (f: string) => { const r = rel(f), k = r.lastIndexOf('/'); return k < 0 ? '' : r.slice(0, k); }; |
| `shared/flowboxes.ts:65` | the file is not imported by shipped code | const gap = level === 'files' ? 46 : 58; |
| `shared/flowboxes.ts:66` | the file is not imported by shipped code | return { w: BOX_W[level], h: Math.max(level === 'files' ? 150 : 176, gap * (n + 1)), rows: [] }; |
| `shared/flowboxes.ts:74` | the file is not imported by shipped code | return { w: BOX_W.functions, h: y + 10, rows }; |
| `shared/flowboxes.ts:85` | the file is not imported by shipped code | return parts.length > 4 ? '${parts.slice(0, 4).join(' · ')} +${parts.length - 4}' : parts.join(' · '); |
| `shared/flowboxes.ts:91` | the file is not imported by shipped code | export const HUB = { boxes: 15, from: 6 }; |
| `shared/flowboxes.ts:98` | the file is not imported by shipped code | if (level !== 'functions') Object.assign(node.layoutOptions, { 'elk.portConstraints': 'FIXED_SIDE', 'elk.spac… |
| `shared/flowboxes.ts:102` | the file is not imported by shipped code | { id: 'in${r.row}', x: 0, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'WEST' } }, |
| `shared/flowboxes.ts:103` | the file is not imported by shipped code | { id: 'out${r.row}', x: g.w - 1, y: r.y + 10, width: 1, height: 1, layoutOptions: { 'elk.port.side': 'EAST' }… |
| `shared/flowboxes.ts:125` | the file is not imported by shipped code | (na.ports ??= []).push({ id: '${k}:out', width: 1, height: 1, layoutOptions: { 'elk.port.side': 'EAST' } }); |
| `shared/flowboxes.ts:126` | the file is not imported by shipped code | (nb.ports ??= []).push({ id: '${k}:in', width: 1, height: 1, layoutOptions: { 'elk.port.side': 'WEST' } }); |
| `shared/flowboxes.ts:131` | the file is not imported by shipped code | const gapX = Math.max(level === 'functions' ? 96 : 84, Math.round((widest * 7.2 + 10) * sMax + 24 * sMax)); |
| `shared/flowboxes.ts:132` | the file is not imported by shipped code | const left = Math.round(64 * (level === 'functions' ? 1 : sMax)); |
| `shared/flowboxes.ts:138` | the file is not imported by shipped code | 'elk.padding': '[top=12,left=${left},bottom=12,right=12]', 'elk.layered.spacing.nodeNodeBetweenLayers': Strin… |
| `shared/flowboxes.ts:139` | the file is not imported by shipped code | 'elk.spacing.edgeEdge': level === 'functions' ? '12' : '36', 'elk.layered.spacing.edgeEdgeBetweenLayers': lev… |
| `shared/flowboxes.ts:145` | the file is not imported by shipped code | if (c.children) { groups.push({ dir: c.id.slice(4), x: c.x, y: c.y, w: c.width, h: c.height }); for (const k … |
| `shared/flowboxes.ts:173` | the file is not imported by shipped code | return g ? { x: p.x, y: p.y + g.y + 10, w: p.w } : null; |
| `shared/flowboxes.ts:178` | the file is not imported by shipped code | return nums.length < 2 \|\| parts.length < 2 ? text : '${nums[0]}…${nums[nums.length - 1]} ·${parts.length}'; |
| `shared/flowboxes.ts:181` | the file is not imported by shipped code | export function placeLabels(lay: Lay, s = 1, charW = 7.2): Label[] { |
| `shared/flowboxes.ts:187` | the file is not imported by shipped code | at.set(k, { b: { keys: ['${l.a}>${l.b}'], text: l.text, full: l.text, x: q.x - 12 * s, y: q.y, w: 0, h: 0, th… |
| `shared/flowboxes.ts:190` | the file is not imported by shipped code | for (const { b } of todo) { b.w = (b.text.length * charW + 10) * s; b.h = 15 * s; } |
| `shared/flowboxes.ts:201` | the file is not imported by shipped code | if (Math.abs(p0.y - p1.y) > 0.5) continue; |
| `shared/flowboxes.ts:202` | the file is not imported by shipped code | const lo = Math.min(p0.x, p1.x), hi = Math.max(lo, Math.max(p0.x, p1.x) - (i === pts.length - 1 ? 12 * s : 0)… |
| `shared/flowboxes.ts:203` | the file is not imported by shipped code | for (let x = hi; x >= lo - 0.01; x -= 6 * s) spots.push([x, p0.y]); |
| `shared/flowboxes.ts:215` | the file is not imported by shipped code | const c = lab * 10 + box; |
| `shared/flowboxes.ts:216` | the file is not imported by shipped code | if (c < cost - 0.01) { cost = c; left = lab; onBox = box; best = [x, y]; } |
| `shared/flowboxes.ts:227` | the file is not imported by shipped code | b.w = (b.text.length * charW + 10) * s; |
| `shared/flowboxes.ts:261` | the file is not imported by shipped code | const add = (p: Pt) => { const l = pts[pts.length - 1]; if (!l \|\| Math.abs(l.x - p.x) > 0.5 \|\| Math.abs(l.y -… |
| `shared/flowboxes.ts:266` | the file is not imported by shipped code | if (e) { add({ x: ra.x + ra.w - 30, y: ra.y }); for (const q of e.pts) add(q); add({ x: rb.x + 34, y: rb.y })… |
| `shared/flowboxes.ts:267` | the file is not imported by shipped code | else { add({ x: ra.x + 34, y: ra.y }); add({ x: ra.x + 10, y: ra.y }); add({ x: rb.x + 10, y: rb.y }); add({ … |
| `shared/flowboxes.ts:277` | the file is not imported by shipped code | const climb = A.slice(0, A.indexOf(common) + 1), descend = B.slice(0, B.indexOf(common) + 1).reverse(); |
| `shared/flowboxes.ts:279` | the file is not imported by shipped code | const add = (q: Pt[]) => { for (const p of q) { const l = pts[pts.length - 1]; if (!l \|\| Math.abs(l.x - p.x) … |
| `shared/flowboxes.ts:282` | the file is not imported by shipped code | if (!pts.length) { const r = rowAt(m, lay, stepOf(m.run, to)); if (r) pts.push({ x: r.x + 34, y: r.y }); } |
| `shared/flowboxes.ts:302` | the file is not imported by shipped code | export function viewRect(scroll: { x: number; y: number }, size: { w: number; h: number }, k: number, margin … |

## 6. No action

| Line | Code | Values | Text |
|---|---|---|---|
| `main/compilers.ts:14` | OUT | 5000 | const run: Run = (exe, args) => { try { return execFileSync(exe, args, { encoding: 'utf8', timeout: 5000, win… |
| `main/compilers.ts:25` | OUT | 7 15 | const names = ['g++', ...Array.from({ length: 7 }, (_, k) => 'g++-${15 - k}')]; |
| `main/compilers.ts:54` | OUT | 10 | const sdk = newest(path.join(kitsRoot, 'Include'), /^10\.\d+\.\d+\.\d+$/); |
| `main/compilers.ts:68` | OUT | 10 | const kits = path.join(pf86, 'Windows Kits', '10'); |
| `main/compilers.ts:82` | OUT | 98 14 03 14 11 14 17 20 23 26 | if ((m = f.match(/^-std=(?:c\|gnu)\+\+(\w+)$/))) return '/std:c++${{ '98': '14', '03': '14', '11': '14', '1z':… |
| `main/compilers.ts:83` | OUT | 99 89 90 11 | if ((m = f.match(/^-std=(?:c\|gnu)(\d+)$/))) return '/std:c${m[1] === '99' \|\| m[1] === '89' \|\| m[1] === '90' ?… |
| `main/files.ts:90` | OUT | 16 | const bufferName = (file: string) => crypto.createHash('sha1').update(file).digest('hex').slice(0, 16) + '.js… |
| `main/langpacks.ts:23` | OUT |  | if (hit && Date.now() - hit.at < 600_000) return hit.list; |
| `main/langpacks.ts:30` | OUT | 403 | if (!r.ok) throw new Error(r.status === 403 ? 'the server is limiting requests right now — try again in a whi… |
| `main/langpacks.ts:63` | OUT | 8 | const re = new RegExp('^cpython-(\\d+\\.\\d+\\.\\d+)\\+(\\d{8})-${triple.replace(/[-.]/g, '\\$&')}-install_on… |
| `main/langpacks.ts:67` | OUT | 64 | if (!m \|\| !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) continue; |
| `main/langpacks.ts:68` | OUT |  | const minor = m[1].split('.').slice(0, 2).join('.'); |
| `main/langpacks.ts:69` | OUT | 7 | const r: Release = { kind: 'python', name: 'python', version: m[1], asset: a.name, url: a.browser_download_ur… |
| `main/langpacks.ts:81` | OUT | 64 | if (!f \|\| !/^[0-9a-f]{64}$/.test(f.sha256 ?? '')) continue; |
| `main/langpacks.ts:95` | OUT | 8 | const rels = await json('https://api.github.com/repos/rust-lang/rust-analyzer/releases?per_page=8', { Accept:… |
| `main/langpacks.ts:98` | OUT | 4 | if (r.prerelease \|\| r.draft \|\| !/^\d{4}-\d{2}-\d{2}$/.test(r.tag_name)) continue; |
| `main/langpacks.ts:100` | OUT | 64 | if (!a \|\| !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) continue; |
| `main/langpacks.ts:101` | OUT | 7 | out.push({ kind, name: 'rust-analyzer', version: r.tag_name, asset: a.name, url: a.browser_download_url, size… |
| `main/langpacks.ts:108` | OUT | 5 | const rels = await json('https://api.github.com/repos/rust-lang/rust/releases?per_page=5', { Accept: 'applica… |
| `main/langpacks.ts:114` | OUT | 64 | if (!/^[0-9a-f]{64}$/.test(sum)) continue; |
| `main/langpacks.ts:130` | OUT | 7 | return [{ kind, name: 'pyright', version: m.version, asset: path.basename(new URL(url).pathname), url, size: … |
| `main/langpacks.ts:178` | OUT | 16 20 20 3 | const p = execFile(cmd, args, { cwd, env: { ...process.env, ...env }, signal, maxBuffer: 16 << 20, timeout: 2… |
| `main/lsp.ts:22` | OUT | 5 | const p = packsDir ? path.join(packsDir, setting.slice(5), 'bin', EXE) : ''; |
| `main/lsp.ts:31` | OUT | 5000 | if (process.platform === 'darwin') return execFileSync('xcrun', ['--find', 'clangd'], { encoding: 'utf8', tim… |
| `main/lsp.ts:33` | OUT | 5000 | return execFileSync(which, ['clangd'], { encoding: 'utf8', timeout: 5000 }).split(/\r?\n/)[0].trim() \|\| null; |
| `main/lsp.ts:52` | OUT | 65536 | try { const b = Buffer.alloc(65536); head = b.toString('utf8', 0, fs.readSync(fd, b, 0, b.length, 0)); } fina… |
| `main/lsp.ts:101` | OUT | 12 | const dir = path.join(stateDir, 'compile-db', createHash('sha1').update(root).digest('hex').slice(0, 12)); |
| `main/lsp.ts:124` | OUT |  | return { ...e, command: k < 0 ? '${c} ${add}' : '${c.slice(0, k)} ${add}${c.slice(k)}' }; |
| `main/lsp.ts:263` | OUT |  | const timer = setTimeout(() => { |
| `main/lsp.ts:265` | OUT | 1000 | this.onLog('${this.name}: ${method} had no answer in ${ms / 1000} s'); |
| `main/lsp.ts:267` | OUT | 1000 | reject(new Error('${method}: no answer from ${this.name} in ${ms / 1000} s')); |
| `main/lsp.ts:271` | OUT | 2.0 | try { this.send({ jsonrpc: '2.0', id, method, params }); } |
| `main/lsp.ts:277` | OUT | 2.0 | this.send({ jsonrpc: '2.0', method, params }); |
| `main/lsp.ts:286` | OUT | 4 | if (!m) { this.buf = this.buf.subarray(sep + 4); continue; } |
| `main/lsp.ts:288` | OUT | 4 | if (this.buf.length < sep + 4 + len) return; |
| `main/lsp.ts:289` | OUT | 4 4 | const body = this.buf.subarray(sep + 4, sep + 4 + len).toString('utf8'); |
| `main/lsp.ts:290` | OUT | 4 | this.buf = this.buf.subarray(sep + 4 + len); |
| `main/lsp.ts:312` | OUT | 2.0 | this.send({ jsonrpc: '2.0', id, result }); |
| `main/lsp.ts:356` | OUT | 8 | if (dbCache.size > 8) dbCache.clear(); |
| `main/lsp.ts:383` | OUT | 20 | if (!flags.some((f) => /^-std=/.test(f))) flags.push('-std=c++20'); |
| `main/main.ts:1` | OUT |  | import { app, BrowserWindow, dialog, ipcMain, shell, Menu, MenuItemConstructorOptions, powerMonitor, crashRep… |
| `main/main.ts:65` | OUT |  | let win: BrowserWindow \| null = null; |
| `main/main.ts:70` | OUT |  | win = new BrowserWindow({ |
| `main/main.ts:71` | OK | 1440 900 760 480 | width: 1440, height: 900, minWidth: 760, minHeight: 480, |
| `main/main.ts:94` | OUT |  | watchTimer = setTimeout(() => { |
| `main/main.ts:96` | OUT | 120 | }, 120); |
| `main/main.ts:154` | OUT | 150 | watchTimerBatch = setTimeout(() => { const b = [...batch]; batch = new Set(); send('fs:changedBatch', b); }, … |
| `main/main.ts:181` | OUT |  | let settingWin: BrowserWindow \| null = null, settingJob: WorkerJob \| null = null, workerDone: ((r: WorkerResu… |
| `main/main.ts:196` | OUT |  | settingWin = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'),… |
| `main/main.ts:215` | OUT | 12 | const id = sha1('${j.root}\n${j.folder ?? ''}\n${j.flags.join('\u0001')}').slice(0, 12); |
| `main/main.ts:231` | OUT | 64 20 | const gitOut = (root: string, args: string[]) => new Promise<string>((res, rej) => execFile('git', ['-C', roo… |
| `main/main.ts:245` | OUT | 12 | const dir = path.join(CHANGES, sha.slice(0, 12)), tree = path.join(dir, 'tree'); |
| `main/main.ts:271` | OUT | 4 | for (const o of all.slice(4)) fs.rmSync(path.join(CHANGES, o.n), { recursive: true, force: true }); |
| `main/main.ts:285` | OUT | 12 | const ccDir = movedDb(lsp.ccDir!, root, there, path.join(CHANGES, rev.slice(0, 12), 'db')); |
| `main/main.ts:379` | OUT |  | const t = setTimeout(() => { if (checkWait.get(file)?.version === version) checkWait.delete(file); res(null);… |
| `main/main.ts:404` | OUT | 45000 | const base = await readWith(file, uri, text, lang, 45000); |
| `main/main.ts:413` | OUT | 40 25000 | if (tries >= 40 \|\| Date.now() - t0 > 25000) break; |
| `main/main.ts:414` | OUT | 8000 | const after = await readWith(file, uri, applyEdit(text, c.edit), lang, 8000); |
| `main/main.ts:431` | OUT | 90000 | .finally(() => { if (gen === checkGen) { clearTimeout(checkIdle); checkIdle = setTimeout(stopCheck, 90000); }… |
| `main/main.ts:438` | OUT | 12 16 | const keptFile = (root: string, key: string) => path.join(KEPT, sha1(root).slice(0, 12), '${sha1(key).slice(0… |
| `main/main.ts:455` | OUT | 40 | for (const o of all.slice(40)) fs.rmSync(path.join(dir, o.n), { force: true }); |
| `main/main.ts:483` | OUT | 4000 | ipcMain.handle('log', (_e, line: string) => log('interface: ${String(line).slice(0, 4000)}')); |
| `main/main.ts:522` | OUT | 5000 | try { sdk = execFileSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8', timeout: 5000 }).trim() \|\| null; }… |
| `main/main.ts:545` | OUT | 8000 | if (!versions.has(p)) versions.set(p, new Promise((res) => execFile(p, ['--version'], { timeout: 8000 }, (_e,… |
| `main/main.ts:623` | OUT | 1.3 | if (!dbg.isAttached()) dbg.attach('1.3'); |
| `main/main.ts:625` | OUT | 500 | await dbg.sendCommand('Profiler.setSamplingInterval', { interval: 500 }); |
| `main/main.ts:637` | OUT | 100 | setTimeout(() => app.quit(), 100); |
| `main/main.ts:646` | OUT |  | ...(process.platform === 'darwin' ? [{ label: 'SkyCodeX', submenu: [{ role: 'about' }, { type: 'separator' },… |
| `main/main.ts:648` | OUT |  | cmd('newFile', 'New File', 'CmdOrCtrl+N'), cmd('openFile', 'Open File…', 'CmdOrCtrl+Shift+O'), cmd('openFolde… |
| `main/main.ts:649` | OUT |  | { type: 'separator' }, cmd('save', 'Save', 'CmdOrCtrl+S'), cmd('saveAs', 'Save As…', 'CmdOrCtrl+Shift+S'), cm… |
| `main/main.ts:653` | OUT |  | { label: 'Go', submenu: [cmd('quickOpen', 'Quick Open…', 'CmdOrCtrl+P'), cmd('goToSymbol', 'Go to Symbol…', '… |
| `main/main.ts:667` | TEST | 180 15 5 | const smokeLimit = scenario === 'probe' ? 180 : scenario === 'large' ? 15 : 5; |
| `main/main.ts:668` | TEST |  | if (smoke) setTimeout(() => { log('smoke: timed out after ${smokeLimit} minutes'); app.exit(2); }, smokeLimit… |
| `main/packs.ts:46` | OUT | 10 10 | const pa = a.split(/[.\-]/).map((x) => parseInt(x, 10) \|\| 0), pb = b.split(/[.\-]/).map((x) => parseInt(x, 10… |
| `main/packs.ts:62` | OUT | 8 | const re = new RegExp('^llvm-mingw-(\\d{8})-ucrt-${cpu}\\.zip$'); |
| `main/packs.ts:77` | OUT |  | if (hit && Date.now() - hit.at < 600_000) return hit.list; |
| `main/packs.ts:78` | OUT | 40 | const res = await fetch('https://api.github.com/repos/${src.repo}/releases?per_page=40', { headers: { Accept:… |
| `main/packs.ts:79` | OUT | 403 | if (!res.ok) throw new Error(res.status === 403 ? 'GitHub is limiting requests right now — try again in a whi… |
| `main/packs.ts:85` | OUT | 64 | if (!m \|\| !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) continue; |
| `main/packs.ts:86` | OUT | 7 | list.push({ kind, name: src.name, version: m.version, asset: a.name, url: a.browser_download_url, size: a.siz… |
| `main/packs.ts:94` | OUT | 3 6 | export const expectedBytes = (r: Pick<Release, 'size' \| 'format'>) => r.size * (r.format === 'zip' ? 3 : 6); |
| `main/packs.ts:116` | OUT | 20 | if (done - last > 1 << 20 \|\| done === total) { last = done; onProgress({ phase: 'download', done, total }); } |
| `main/packs.ts:154` | OUT | 12 12 | if (sha !== want) throw new Error('checksum mismatch — the download was damaged or altered, so it was deleted… |
| `main/search.ts:18` | OUT | 8000 | if (buf.subarray(0, 8000).includes(0)) return; |
| `main/search.ts:23` | OUT | 200 120 | if (batch.length >= 200 \|\| Date.now() - last > 120) flush(); |
| `main/search.ts:25` | OUT | 8 | await Promise.all(Array.from({ length: 8 }, async () => { |
| `main/settings.ts:16` | OUT |  | const section = key.slice(0, key.lastIndexOf('.')); |
| `main/settings.ts:93` | OUT |  | lines[ln - 1] = line.slice(0, s) + v + (rest ? newPad + rest : ''); |
| `main/settings.ts:96` | OUT |  | const section = key.slice(0, key.lastIndexOf('.')); |
| `main/terminal.ts:31` | OUT | 3000 | try { execFileSync(platform === 'win32' ? 'where' : 'which', [prog], { stdio: 'ignore', timeout: 3000 }); ret… |
| `main/unpack.ts:62` | OUT | 22 65535 | const tail = Math.min(size, 22 + 65535), buf = Buffer.alloc(tail); |
| `main/unpack.ts:65` | OUT | 22 | for (let i = tail - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; } |
| `main/unpack.ts:67` | OUT | 10 12 16 | let count = buf.readUInt16LE(e + 10), cdSize = buf.readUInt32LE(e + 12), cdOff = buf.readUInt32LE(e + 16); |
| `main/unpack.ts:69` | OUT | 20 | const loc = e - 20; |
| `main/unpack.ts:71` | OUT | 8 56 | const z64 = Number(buf.readBigUInt64LE(loc + 8)), rec = Buffer.alloc(56); |
| `main/unpack.ts:72` | OUT | 56 | fs.readSync(fd, rec, 0, 56, z64); |
| `main/unpack.ts:73` | OUT | 32 40 48 | count = Number(rec.readBigUInt64LE(32)); cdSize = Number(rec.readBigUInt64LE(40)); cdOff = Number(rec.readBig… |
| `main/unpack.ts:80` | OUT | 4 8 10 | const madeBy = cd.readUInt16LE(p + 4) >> 8, method = cd.readUInt16LE(p + 10); |
| `main/unpack.ts:81` | OUT | 20 24 | let csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24); |
| `main/unpack.ts:82` | OUT | 28 30 32 | const nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32); |
| `main/unpack.ts:83` | OUT | 38 | const attrs = cd.readUInt32LE(p + 38); |
| `main/unpack.ts:84` | OUT | 42 | let offset = cd.readUInt32LE(p + 42); |
| `main/unpack.ts:85` | OUT | 46 46 | const name = cd.toString('utf8', p + 46, p + 46 + nlen); |
| `main/unpack.ts:86` | OUT | 46 46 | for (let x = p + 46 + nlen; x < p + 46 + nlen + xlen;) { |
| `main/unpack.ts:89` | OUT | 4 | let q = x + 4; |
| `main/unpack.ts:90` | OUT | 8 | if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; } |
| `main/unpack.ts:91` | OUT | 8 | if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; } |
| `main/unpack.ts:94` | OUT | 4 | x += 4 + len; |
| `main/unpack.ts:96` | OUT | 16 3 | out.push({ name, method, csize, usize, offset, mode: attrs >>> 16, unix: madeBy === 3 }); |
| `main/unpack.ts:97` | OUT | 46 | p += 46 + nlen + xlen + clen; |
| `main/unpack.ts:111` | OUT | 30 | const hdr = Buffer.alloc(30); |
| `main/unpack.ts:112` | OUT | 30 | fs.readSync(fd, hdr, 0, 30, en.offset); |
| `main/unpack.ts:114` | OUT | 30 26 28 | const start = en.offset + 30 + hdr.readUInt16LE(26) + hdr.readUInt16LE(28); |
| `main/unpack.ts:117` | OUT | 8 | if (en.method !== 0 && en.method !== 8) throw new Error('unsupported compression in ${en.name}'); |
| `main/unpack.ts:120` | OUT | 8 | return en.method === 8 ? s.pipe(zlib.createInflateRaw()) : s; |
| `main/unpack.ts:141` | OUT | 256 | for (let i = a + 1; i < a + n; i++) v = v * 256 + b[i]; |
| `main/unpack.ts:145` | OUT | 8 | return s ? parseInt(s, 8) : 0; |
| `main/unpack.ts:155` | OUT | 10 | const len = parseInt(data.toString('ascii', p, sp), 10); |
| `main/unpack.ts:158` | OUT |  | const k = rec.slice(0, eq), v = rec.slice(eq + 1); |
| `main/unpack.ts:186` | OUT | 512 512 512 | const pad = (512 - (size % 512)) % 512; |
| `main/unpack.ts:190` | OUT | 512 | while (await need(512)) { |
| `main/unpack.ts:191` | OUT | 512 | const h = take(512); |
| `main/unpack.ts:193` | OUT | 156 48 | const type = String.fromCharCode(h[156] \|\| 48); |
| `main/unpack.ts:194` | OUT | 124 12 | let size = octal(h, 124, 12); |
| `main/unpack.ts:195` | OUT | 257 262 | const ustar = h.toString('ascii', 257, 262) === 'ustar'; |
| `main/unpack.ts:196` | OUT | 100 | let name = cstr(h, 0, 100); |
| `main/unpack.ts:197` | OUT | 345 345 155 | if (ustar && h[345]) name = '${cstr(h, 345, 155)}/${name}'; |
| `main/unpack.ts:198` | OUT | 157 100 | let link = cstr(h, 157, 100); |
| `main/unpack.ts:214` | OUT | 5 | if (type === '5') { fs.mkdirSync(at, { recursive: true }); stats.dirs++; await body(size); continue; } |
| `main/unpack.ts:222` | OUT | 7 | if (type !== '0' && type !== '7') { await body(size); continue; } |
| `main/unpack.ts:224` | OUT | 100 8 | const out = fs.createWriteStream(at, { mode: fileMode(octal(h, 100, 8)) }); |
| `main/unpack.ts:230` | OUT | 100 8 | fs.chmodSync(at, fileMode(octal(h, 100, 8))); |
| `preload/preload.ts:102` | OK | 0.75 | zoom: (f: number) => webFrame.setZoomFactor(Math.min(2, Math.max(0.75, f \|\| 1))), |
| `renderer/App.tsx:29` | OK | 0.31 | const [codeW, setCodeW] = createSignal(Math.round(window.innerWidth * 0.31)); |
| `renderer/App.tsx:88` | OK | 280 | <Split onDrag={(dx) => { setCodeW(Math.max(280, codeW() + dx)); redraw(); }} /> |
| `renderer/App.tsx:91` | OK | 140 | <Split onDrag={(dx) => { setFilesW(Math.max(140, filesW() - dx)); redraw(); }} /> |
| `renderer/components/AppBar.tsx:20` | OK |  | <button class="barbtn refresh" classList={{ on: refreshing() }} disabled={refreshing()} title={t('Read every … |
| `renderer/components/AppMenu.tsx:42` | OK | 12px 280 0.16 0.3 | const a = el.animate([{ transform: 'translate3d(0,12px,0)', opacity: 0 }, { transform: 'none', opacity: 1 }],… |
| `renderer/components/Card.tsx:60` | OK |  | if (v === 'busy') return <span class="depth" title={t('measuring how deep its calls go')}>…</span>; |
| `renderer/components/CompareChip.tsx:21` | OK |  | const chipText = () => { const c = comparing(); return c ? 'compared with ${c.olderLabel}${c.state === 'readi… |
| `renderer/components/CompareChip.tsx:28` | OK | 8 8 | <div class="setm" ref={(el) => requestAnimationFrame(() => { const r = el.getBoundingClientRect(); if (r.left… |
| `renderer/components/CompilerWindow.tsx:43` | OK | 10px .985 260 0.16 0.3 | const a = el.animate([{ transform: 'translate3d(0,10px,0) scale(.985)', opacity: 0 }, { transform: 'none', op… |
| `renderer/components/CompilerWindow.tsx:51` | OK | 120 120 40 | const move = (m: PointerEvent) => setPos({ x: Math.min(window.innerWidth - 120, Math.max(-el.offsetWidth + 12… |
| `renderer/components/CompilerWindow.tsx:58` | OK |  | setRel({ ...rel(), [kind]: 'looking…' }); |
| `renderer/components/CompilerWindow.tsx:95` | OUT | 5 | : i.setting.startsWith('pack:') ? 'language pack · ${i.setting.slice(5)}' : 'custom path'; |
| `renderer/components/CompilerWindow.tsx:103` | OK | 10 10 | <button title={mini() ? 'Expand' : 'Minimise'} onClick={() => setMini(!mini())}><svg viewBox="0 0 10 10"><pat… |
| `renderer/components/CompilerWindow.tsx:104` | OK | 10 10 .5 9 9 | <button class="x" title="Close" onClick={() => setCompilerOpen(false)}><svg viewBox="0 0 10 10"><path d="M.5 … |
| `renderer/components/CompilerWindow.tsx:108` | OK |  | <Show when={info()} fallback={<div class="sub">reading…</div>}>{(i) => ( |
| `renderer/components/CompilerWindow.tsx:213` | OUT | 4 7 | <div class="dim">It goes into {i().packsDir}{c().replaces ? ', replacing ${c().replaces}' : ''} and needs abo… |
| `renderer/components/CompilerWindow.tsx:214` | OUT | 512 256 | It is checked against the {c().r.sha512 ? 'SHA-512 the npm registry' : 'SHA-256 ' + (c().r.source.startsWith(… |
| `renderer/components/CompilerWindow.tsx:222` | OUT | 256 | <span>{p().id} · {p().phase === 'download' ? 'downloading ${mb(p().done)} of ${mb(p().total)}' : p().phase ==… |
| `renderer/components/CompilerWindow.tsx:226` | OK | 100 100 | <div class="bar"><i style={{ width: '${p().phase === 'download' && p().total ? (p().done / p().total) * 100 :… |
| `renderer/components/Editor.tsx:69` | OUT |  | settleTimer = window.setTimeout(() => { |
| `renderer/components/Editor.tsx:75` | OUT | 260 100 | }, saver() ? 260 : 100); |
| `renderer/components/Editor.tsx:83` | OK | 8 4 | editorExtensions({ tabSize: s['editor.tab_size'] ?? (langOf(file) === 'go' ? 8 : 4), wrap: !!s['editor.word_w… |
| `renderer/components/FilesPane.tsx:17` | OUT | 250 | export const refreshTree = () => { clearTimeout(treeTimer); treeTimer = window.setTimeout(() => setListVersio… |
| `renderer/components/FilesPane.tsx:119` | OK | 100% | <div class="pane files" style={{ height: '100%' }}> |
| `renderer/components/FilesPane.tsx:126` | OK |  | <button class="chip" onClick={pick}>{t('open…')}</button></div> |
| `renderer/components/Flow.tsx:29` | OK | 260 | host?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }); |
| `renderer/components/Flow.tsx:31` | OUT | 40 | for (let i = 0; i < 40 && !(to = sel(v)); i++) await new Promise((r) => requestAnimationFrame(r)); |
| `renderer/components/Flow.tsx:41` | OK | 420 .16 .3 | { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' }); |
| `renderer/components/Flow.tsx:59` | OK | 1.5 3 4 4 1.5 | <Show when={magnify()}><button class="chip mgz" title="the magnifier's strength: 1.5×, 2×, 3×, 4×" onClick={(… |
| `renderer/components/Flow.tsx:64` | OK | 100% | <div style={{ height: '100%' }} onKeyDown={(e) => { |
| `renderer/components/GridView.tsx:37` | OK | 4 | const N = nc * nr * 4, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap: [n… |
| `renderer/components/GridView.tsx:45` | OK | 4 4 | for (let d = 0; d < 4; d++) { const i = a.i + DI[d], j = a.j + DJ[d]; if (!free(i, j)) continue; const st = (… |
| `renderer/components/GridView.tsx:49` | OK | 3 | const cell = st >> 2, d = st & 3, i = cell % nc, j = (cell / nc) \| 0; |
| `renderer/components/GridView.tsx:51` | OK | 4 | for (let e = 0; e < 4; e++) { |
| `renderer/components/GridView.tsx:52` | OK | 4 | if (e === (d + 2) % 4) continue; |
| `renderer/components/GridView.tsx:55` | OK | 4 3 4 | const ns = (nj * nc + ni) * 4 + e, cost = c + 1 + (e === d ? 0 : 3) + (used[(nj * nc + ni) * 2 + (e % 2)] ? 4… |
| `renderer/components/GridView.tsx:105` | OK | 900 600 | const [vw, setVw] = createSignal(900), [vh, setVh] = createSignal(600), [sl, setSl] = createSignal(0), [st, s… |
| `renderer/components/GridView.tsx:122` | OK | 8 6 | const openH = pr >= 0 ? 8 + Math.min(6, pickCell().length) * LINE_H : 0; |
| `renderer/components/GridView.tsx:143` | OK | 100 | return { fns: m.rows.length, callers: m.cols.length, calls, cross: calls ? Math.round((cross / calls) * 100) … |
| `renderer/components/GridView.tsx:170` | OUT |  | const at = (item: number): Cell \| null => { const k = m.cellOf[item]; if (!k) return null; const p = k.indexO… |
| `renderer/components/GridView.tsx:243` | OUT |  | const [ck, rk] = [k.slice(0, k.indexOf('>')), k.slice(k.indexOf('>') + 1)], ci = colIdx().get(ck), rj = rowId… |
| `renderer/components/GridView.tsx:278` | OK | 650 | await new Promise((res) => setTimeout(res, 650 / speed())); |
| `renderer/components/GridView.tsx:313` | OK | 3 1.5 | if (key === '+' \|\| key === '=') { setSpeed(Math.min(3, speed() * 1.5)); return; } |
| `renderer/components/GridView.tsx:314` | OK | 0.25 1.5 | if (key === '-') { setSpeed(Math.max(0.25, speed() / 1.5)); return; } |
| `renderer/components/GridView.tsx:352` | OK | 100% | <div class="body" style={{ height: '100%' }}> |
| `renderer/components/GridView.tsx:381` | OK | 4 9 | <span class="kt">· calls in a square in order: <b>4 · 9</b></span> |
| `renderer/components/GridView.tsx:382` | OK | 5 4 | <span class="dots"><b class="dn" /><b class="dn" /><b class="now" /><b /><b /><em>5</em></span><span>4 or mor… |
| `renderer/components/GridView.tsx:385` | OK |  | <Show when={model()} fallback={<div class="empty">{runStatus() \|\| status() \|\| 'building…'}</div>}> |
| `renderer/components/GridView.tsx:421` | OK | 0.08 0.5 | style={{ left: '${rc().x}px', top: '${rc().y}px', width: '${rc().w}px', height: '${rc().h}px', '--c': col().g… |
| `renderer/components/GridView.tsx:445` | OK | 5 4 5 5 4 4 | <marker id="glk-in" markerUnits="userSpaceOnUse" viewBox="0 0 5 4" refX="5" refY="2" markerWidth="5" markerHe… |
| `renderer/components/GridView.tsx:446` | OK | 5 4 5 5 4 4 | <marker id="glk-out" markerUnits="userSpaceOnUse" viewBox="0 0 5 4" refX="5" refY="2" markerWidth="5" markerH… |
| `renderer/components/GridView.tsx:447` | OK | 5 4 5 5 4 4 | <marker id="glk-call" markerUnits="userSpaceOnUse" viewBox="0 0 5 4" refX="5" refY="2" markerWidth="5" marker… |
| `renderer/components/GridView.tsx:457` | OK | 4 28 | <For each={rows()}>{(r, j) => <div class="t" classList={{ pk: pick()?.r === r.key }} style={{ top: '${HEAD + … |
| `renderer/components/GridView.tsx:463` | OK | 3 14 | <For each={cols()}>{(c, i) => <div class="m" classList={{ pk: pick()?.c === c.key }} style={{ left: '${SIDE +… |
| `renderer/components/Header.tsx:10` | OK |  | const shortStatus = (s?: string) => (!s ? '' : s === 'starting' ? t('starting…') : s.endsWith(' ready') ? s :… |
| `renderer/components/Header.tsx:14` | OK | 14 14 24 24 1.6 | <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"> |
| `renderer/components/Header.tsx:15` | OK | 12 12 3.4 | <circle cx="12" cy="12" r="3.4" /> |
| `renderer/components/Header.tsx:16` | OK | 45 90 135 180 225 270 315 12 2.6 12 6.2 12 12 3 | <For each={[0, 45, 90, 135, 180, 225, 270, 315]}>{(a) => <line x1="12" y1="2.6" x2="12" y2="6.2" transform={'… |
| `renderer/components/Header.tsx:17` | OK | 12 12 6.6 | <circle cx="12" cy="12" r="6.6" /> |
| `renderer/components/Header.tsx:45` | OK |  | <Show when={page() === 'editor' && serverLang(files.active)} fallback={<span>{indexing() ?? (lspState() === '… |
| `renderer/components/Header.tsx:48` | OK | 10 10 | <button title={t('Minimise')} aria-label={t('Minimise')} onClick={() => api.win.minimize()}><svg viewBox="0 0… |
| `renderer/components/Header.tsx:49` | OK | 10 10 .5 .5 9 9 | <button title={t('Maximise')} aria-label={t('Maximise')} onClick={() => api.win.maximize()}><svg viewBox="0 0… |
| `renderer/components/Header.tsx:50` | OK | 10 10 .5 9 9 | <button class="x" title={t('Close')} aria-label={t('Close')} onClick={() => api.win.close()}><svg viewBox="0 … |
| `renderer/components/Magnifier.tsx:35` | OUT | 90 | mo = new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(recopy, 90); }); |
| `renderer/components/PlayControls.tsx:1` | OK | 0.25 0.5 1.5 3 | const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3]; |
| `renderer/components/PlayControls.tsx:4` | OK | 6 | const next = () => SPEEDS.find((s) => s > props.speed + 1e-6) ?? SPEEDS[0]; |
| `renderer/components/PlayControls.tsx:5` | OK | 100 100 | const label = () => '${Math.round(props.speed * 100) / 100}×'; |
| `renderer/components/Preview.tsx:14` | OK | 0.16 0.3 0.55 0.45 | const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)', IN = 'cubic-bezier(0.55, 0, 1, 0.45)'; |
| `renderer/components/Preview.tsx:17` | OK | 170 | const MIN_COL = 170; |
| `renderer/components/Preview.tsx:36` | OK | 800 | const [areaW, setAreaW] = createSignal(800); |
| `renderer/components/Preview.tsx:37` | OK | 0.5 | const [frac, setFrac] = createSignal(stored('litho.preview.split', 0.5)); |
| `renderer/components/Preview.tsx:83` | OUT | 3 4 5 6 7 | createEffect(on([levels, win, () => files.active, () => pal(0) + pal(1) + pal(2) + pal(3) + pal(4) + pal(5) +… |
| `renderer/components/Preview.tsx:176` | OK | 30px 900px 80deg 240 30 | anims.push(...turnstile(out, [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(-30px,0,0) perspec… |
| `renderer/components/Preview.tsx:177` | OK | 240 30 | if (cols[w]) anims.push(cols[w].animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,0,0… |
| `renderer/components/Preview.tsx:179` | OK | 600 160 | if (mid) anims.push(mid.animate([{ transform: 'translate3d(${frozen()?.get(w) ?? w1()}px,0,0)' }, { transform… |
| `renderer/components/Preview.tsx:180` | OK | 170px 600 260 50 | anims.push(...turnstile(inc, [{ transform: 'translate3d(170px,0,0)', opacity: 0 }, { transform: 'none', opaci… |
| `renderer/components/Preview.tsx:184` | OK | 170px | for (const c of [0, 1]) if (cols[to + c]) anims.push(...turnstile(onScreen(cols[to + c], '.card, .pnote, .mor… |
| `renderer/components/Preview.tsx:185` | OK | 620 100 70 45 | (i) => ({ duration: 620, delay: 100 + c * 70 + i * 45, easing: EXPO, fill: 'backwards' }))); |
| `renderer/components/Preview.tsx:256` | OK | 900 | el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 900); |
| `renderer/components/Preview.tsx:274` | OK | 0px 0.5 | style={{ left: '0px', width: '${colWidth(li)}px', transform: 'translateX(${slotX(li - win())}px)', visibility… |
| `renderer/components/Preview.tsx:293` | OK |  | {lspState() === 'failed' ? lspMessage() : lspState() !== 'ready' ? t('open a folder to start') : busy() ? '…'… |
| `renderer/components/Preview.tsx:298` | OK | 0.15 0.85 | <Handle left={w1()} onDrag={(dx) => setFrac(Math.max(0.15, Math.min(0.85, (w1() + dx) / cardsW())))} onEnd={(… |
| `renderer/components/Programs.tsx:13` | OUT |  | const top = (rel: string) => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '.'); |
| `renderer/components/Programs.tsx:32` | OK |  | setLinks({ busy: 'tracing ${list.length} programs…', starts: [], shared: [], of: list.length }); |
| `renderer/components/Programs.tsx:36` | OK |  | g = await exclusive(() => connectPrograms(root(), starts, (n) => setLinks((l) => l && { ...l, busy: 'tracing … |
| `renderer/components/Programs.tsx:64` | OK | 100% | <div class="body" style={{ height: '100%' }}> |
| `renderer/components/Programs.tsx:75` | OUT |  | <input value={q()} placeholder="find a program — name or folder, any case" spellcheck={false} ref={(el) => se… |
| `renderer/components/SearchPanel.tsx:31` | OK |  | if (result.running) return '${result.hits.length.toLocaleString()} so far…'; |
| `renderer/components/SearchPanel.tsx:44` | OUT |  | <div class="grp"><b>{basename(file)}</b><span>{rel(file).slice(0, -basename(file).length)}</span><span class=… |
| `renderer/components/SeqCode.tsx:60` | OK | 260 | if (n >= local) { timer = window.setTimeout(() => view?.dispatch({ effects: setWalk.of(-1) }), 260 / k); retu… |
| `renderer/components/SeqCode.tsx:61` | OK | 110 | n++; timer = window.setTimeout(tick, 110 / k); |
| `renderer/components/Sequence.tsx:43` | OK | 1000 700 | const [width, setWidth] = createSignal(1000), [height, setHeight] = createSignal(700); |
| `renderer/components/Sequence.tsx:44` | OK | 140 | const [boxH, setBoxH] = createSignal(140); |
| `renderer/components/Sequence.tsx:223` | OK | 0.36 | const target = g.y[c.at] - viewH() * 0.36; |
| `renderer/components/Sequence.tsx:229` | OK | 400 400 | const lo = scroll() - 400, hi = scroll() + height() + 400, out: number[] = []; |
| `renderer/components/Sequence.tsx:277` | OK | 16 0.6 | const h = Math.min(16, (y2 - y1) * 0.6); |
| `renderer/components/Sequence.tsx:279` | OK | 3 3 3 3 | const at = (t: number, a: number, b: number, c: number, d: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t… |
| `renderer/components/Sequence.tsx:280` | OK | 30 | for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (at(m, y1, y1 + h, y2 - h, y2) < y) lo = m; else h… |
| `renderer/components/Sequence.tsx:353` | OK |  | let timer: ReturnType<typeof setInterval> \| undefined; |
| `renderer/components/Sequence.tsx:359` | OK | 900 | timer = setInterval(() => { if (atEnd()) { setPlaying(false); return; } go('next', true); }, 900 / k); |
| `renderer/components/Sequence.tsx:431` | OUT |  | const items = [...new Set([...r.rows.slice(0, -1), ...r.at].map((row) => s.itemOf[row]))].filter((it) => it >… |
| `renderer/components/Sequence.tsx:440` | OK |  | let tourTimer: ReturnType<typeof setInterval> \| undefined; |
| `renderer/components/Sequence.tsx:474` | OK | 1500 | tourTimer = setInterval(tourStep, 1500 / speed()); |
| `renderer/components/Sequence.tsx:494` | OUT | 300 | await new Promise((r) => setTimeout(r, 300)); |
| `renderer/components/Sequence.tsx:548` | OK | 4 1.5 4 1.5 0.25 1.5 | ' ': () => setPlaying(!playing()), '+': () => setSpeed(Math.min(4, speed() * 1.5)), '=': () => setSpeed(Math.… |
| `renderer/components/Sequence.tsx:567` | OUT |  | setTimeout(() => setJunctionPick(n), 0); |
| `renderer/components/Sequence.tsx:574` | OUT |  | const fi = j.kind === 'arm' ? Number(j.id.slice(2)) : s.run.frames.findIndex((f) => f.kind === 'guard' && f.o… |
| `renderer/components/Sequence.tsx:623` | OUT |  | let chapTimer: ReturnType<typeof setTimeout> \| undefined; |
| `renderer/components/Sequence.tsx:628` | OUT |  | let peekTimer: ReturnType<typeof setTimeout> \| undefined; |
| `renderer/components/Sequence.tsx:709` | OK | 400 400 | const lo = scroll() - 400, hi = scroll() + height() + 400; |
| `renderer/components/Sequence.tsx:723` | OK | 100% | <div class="body" style={{ height: '100%' }}> |
| `renderer/components/Sequence.tsx:745` | OK | 8 8 | <div class="sfndl" ref={(el) => requestAnimationFrame(() => { const r = el.getBoundingClientRect(); if (r.lef… |
| `renderer/components/Sequence.tsx:777` | OK |  | <Show when={S() && geom()} fallback={<div class="empty" style={{ position: 'absolute', inset: 0 }}>{runStatus… |
| `renderer/components/Sequence.tsx:807` | OK | 16 0.6 | <Show when={prev() >= 0}>{(_) => { const a = prev(), x1 = () => geom()!.barX[a], y1 = () => cy(a), x2 = () =>… |
| `renderer/components/Sequence.tsx:808` | OK | 3.5 0.3 | return <path d={'M${x1()} ${y1()} C${x1()} ${y1() + h()} ${x2()} ${y2() - h()} ${x2()} ${y2()}'} stroke={colO… |
| `renderer/components/Sequence.tsx:809` | OK | 5 2.5 2.5 0.45 | <Show when={cur()?.at === it} fallback={<circle cx={geom()!.barX[it]} cy={cy(it)} r="5" fill="#171817" stroke… |
| `renderer/components/Sequence.tsx:810` | OK | 12 227 214 173 .16 6.5 | <circle cx={geom()!.barX[it]} cy={cy(it)} r="12" fill="rgba(227,214,173,.16)" /><circle cx={geom()!.barX[it]}… |
| `renderer/components/Sequence.tsx:815` | OK | 6 5 6 2.5 6 5 2.5 5 | <defs><marker id="mloop" markerUnits="userSpaceOnUse" viewBox="0 0 6 5" refX="6" refY="2.5" markerWidth="6" m… |
| `renderer/components/Sequence.tsx:826` | OK | 1.6 0.75 | <Show when={m.bypass}><path d={m.bypass} stroke={m.col} stroke-width="1.6" fill="none" stroke-linecap="round"… |
| `renderer/components/Sequence.tsx:844` | OK | 10 10 | <svg class="sret" width="10" height="10" ref={(el) => requestAnimationFrame(() => { |
| `renderer/components/Sequence.tsx:846` | OK | 3 3 | arc.style.strokeDasharray = '3 3'; |
| `renderer/components/Sequence.tsx:847` | OK | 100% 650 | arc.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 650, easing: 'ea… |
| `renderer/components/Sequence.tsx:848` | OK | 0.7 1700 | el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1700, fill: 'forwards' … |
| `renderer/components/Sequence.tsx:849` | OK | 0.35 400 8 | (el.querySelector('.hd') as SVGPathElement).animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity:… |
| `renderer/components/Sequence.tsx:869` | OK | 0.5 450 | onMouseEnter={(ev) => { clearTimeout(peekTimer); if (sel()) return; const up = (ev.currentTarget as HTMLEleme… |
| `renderer/components/Sequence.tsx:935` | OK | 400 | <Show when={geom()!.y[N()] < scroll() + height() + 400}> |
| `renderer/components/Sequence.tsx:976` | OK | 250 | onMouseMove={(e) => { const y = e.clientY - canvas.getBoundingClientRect().top; clearTimeout(chapTimer); chap… |
| `renderer/components/Sequence.tsx:977` | OK | 400 | onMouseLeave={() => { clearTimeout(chapTimer); chapTimer = setTimeout(() => setChapPop(null), 400); }} /> |
| `renderer/components/Sequence.tsx:995` | OUT |  | <input class="sgoto" type="text" placeholder={p().kind === 'W' ? 'a member or global' : 'a parameter or what … |
| `renderer/components/Sequence.tsx:1003` | OUT |  | <div class="scap"><span class="key">G</span>go to step <input class="sgoto" type="text" placeholder="number, … |
| `renderer/components/Sequence.tsx:1013` | OUT |  | <input class="snoteedit" type="text" value={notesByItem()[cur()!.at] ?? ''} placeholder="kept with this step … |
| `renderer/components/Sequence.tsx:1024` | OUT |  | <input type="text" placeholder="a function in this run" value={f().q} ref={(el) => setTimeout(() => el.focus(… |
| `renderer/components/Sequence.tsx:1041` | OUT |  | <div class="paths" tabindex="0" ref={(el) => setTimeout(() => el.focus())} onKeyDown={(e) => { |
| `renderer/components/Sequence.tsx:1093` | OK | 800 | const [w, setW] = createSignal(800); |
| `renderer/components/Sequence.tsx:1097` | OK | 24 30000 | const zMax = () => { const n = seq()?.items.length ?? 1, dpr = window.devicePixelRatio \|\| 1; return Math.max(… |
| `renderer/components/Sequence.tsx:1106` | OK | 3 | const n = s.items.length, bw = W / Math.max(1, n), maxD = Math.max(1, ...s.items.map((r) => s.run.rows[r].dep… |
| `renderer/components/Sequence.tsx:1109` | OK | 111 158 158 0.28 0.06 0.06 | if (loops) { x.fillStyle = 'rgba(111,158,158,${Math.min(0.28, 0.06 + loops * 0.06)})'; x.fillRect(i * bw, 0, … |
| `renderer/components/Sequence.tsx:1110` | OK | 3 8 | const h = 3 + (r.depth / maxD) * (H - 8), lit = i === hv, now = i === props.at; |
| `renderer/components/Sequence.tsx:1111` | OK | 227 214 173 .10 | if (lit) { x.fillStyle = 'rgba(227,214,173,.10)'; x.fillRect(i * bw, 0, Math.max(2, Math.ceil(bw)), H); } |
| `renderer/components/Sequence.tsx:1113` | OK | 3 | const hh = lit ? Math.min(H - 2, h + 3) : h, bx = i * bw + gap / 2, bwid = Math.max(lit \|\| now ? 2 : 1, bw - … |
| `renderer/components/Sequence.tsx:1114` | OK | 0.72 | x.globalAlpha = lit \|\| now ? 1 : 0.72; |
| `renderer/components/Sequence.tsx:1117` | OK | 1.5 1.5 1.5 3 1.5 | if (now) { x.strokeStyle = '#e3d6ad'; x.lineWidth = 1.5; x.strokeRect(bx - 1.5, H - hh - 1.5, bwid + 3, hh + … |
| `renderer/components/Sequence.tsx:1118` | OK | 4 | if (props.changedItems.has(i)) { x.fillStyle = '#e0904f'; x.beginPath(); x.arc(i * bw + bw / 2, H - hh - 4, 2… |
| `renderer/components/Sequence.tsx:1125` | OK | 0.5 | const bx = ((props.at + 0.5) / n) * w() * z(); |
| `renderer/components/Sequence.tsx:1159` | OK | 100 | <button class="zb" title="zoom out the run bars" disabled={z() <= 1} onClick={() => zoom(1 / 2)}>−</button><s… |
| `renderer/components/SettingChip.tsx:37` | OUT |  | const label = [...[...pending()].map(([k, c]) => wordOf(k, c)), ...typedFlags().map((f) => (f.startsWith('-U'… |
| `renderer/components/SettingChip.tsx:41` | OK |  | const chipText = () => { const s = setting(); return s ? '${s.label}${s.state === 'reading' ? ' …' : s.state … |
| `renderer/components/SettingChip.tsx:47` | OK | 8 8 | <div class="setm" ref={(el) => requestAnimationFrame(() => { const r = el.getBoundingClientRect(); if (r.left… |
| `renderer/components/Settings.tsx:17` | OUT |  | const sectionOf = (k: string) => k.slice(0, k.lastIndexOf('.')); |
| `renderer/components/Settings.tsx:89` | OUT | 0.1 | const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2); |
| `renderer/components/Settings.tsx:94` | OK | 200 | const slider = d.max !== undefined && range <= 200; |
| `renderer/components/Settings.tsx:95` | OK | 3 0.05 10 0.1 80 0.5 | const step = range <= 3 ? 0.05 : range <= 10 ? 0.1 : range <= 80 ? 0.5 : 1; |
| `renderer/components/Settings.tsx:108` | OK | 10 | else if (e.key === 'ArrowUp' \|\| e.key === 'ArrowDown') { e.preventDefault(); commit(cur() + (e.key === 'Arrow… |
| `renderer/components/Settings.tsx:110` | OK | 100 | const pct = () => (((cur() - (d.min ?? 0)) / (range \|\| 1)) * 100); |
| `renderer/components/Settings.tsx:135` | OK | 100 200 300 400 500 600 700 800 900 | const all = real.length ? real : [100, 200, 300, 400, 500, 600, 700, 800, 900]; |
| `renderer/components/Settings.tsx:146` | OK |  | <div class="doc">{ws.loading ? 'reading the font…' : ws()?.length ? '${props.family()} has ${ws()!.length} we… |
| `renderer/components/Settings.tsx:157` | OUT | 9 | const alpha = () => cur().length === 9; |
| `renderer/components/Settings.tsx:163` | OK | 60 120 180 240 300 360 50 100 | const stops = k === 'h' ? [0, 60, 120, 180, 240, 300, 360] : k === 'a' ? [0, 1] : [0, 50, 100]; |
| `renderer/components/Settings.tsx:164` | OK | 90deg | return 'linear-gradient(90deg, ${stops.map(at).join(', ')})'; |
| `renderer/components/Settings.tsx:179` | OK | 359 100 100 | {slider('h', 'hue', 359, 1)}{slider('s', 'saturation', 100, 1)}{slider('l', 'lightness', 100, 1)} |
| `renderer/components/Settings.tsx:180` | OK | 0.01 | <Show when={alpha()}>{slider('a', 'opacity', 1, 0.01)}</Show> |
| `renderer/components/Settings.tsx:231` | OK | 1400px 75deg 260 40 0.55 0.45 | const anims = kids.map((k, i) => k.animate([{ transform: 'none', opacity: 1 }, { transform: 'perspective(1400… |
| `renderer/components/Settings.tsx:239` | OK | 1400px 70deg 60px | [{ transform: 'perspective(1400px) rotateY(70deg) translate3d(60px,0,0)', opacity: 0 }, { transform: 'none', … |
| `renderer/components/Settings.tsx:240` | OK | 620 40 60 0.16 0.3 | { duration: 620, delay: 40 + i * 60, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'backwards' })); |
| `renderer/components/StartWindow.tsx:14` | OK | 60000 86400000 | const min = Math.round((Date.now() - at) / 60000), day = Math.floor((Date.now() - at) / 86400000); |
| `renderer/components/StartWindow.tsx:16` | OK | 60 | if (min < 60) return t('{n} min ago', { n: min }); |
| `renderer/components/StartWindow.tsx:17` | OK | 24 60 | if (min < 24 * 60 && new Date(at).getDate() === new Date().getDate()) return t('today'); |
| `renderer/components/StartWindow.tsx:19` | OK | 7 | if (day < 7) return t('{n} days ago', { n: day }); |
| `renderer/components/StartWindow.tsx:64` | OK | 22 22 22 22 1.3 .5 | <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><path d=… |
| `renderer/components/StartWindow.tsx:68` | OK | 22 22 22 22 1.3 .5 .5 | <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><path d=… |
| `renderer/components/StartWindow.tsx:75` | OK | 5 | <div class="st-foot"><span><b>1–5</b> {t('open a recent folder')}</span><span><b>Esc</b> {t('close')}</span><… |
| `renderer/components/StepPreview.tsx:16` | OUT |  | const underlineCall = (text: string, name: string) => { const e = escH(text), n = escH(name), i = e.indexOf(n… |
| `renderer/components/StepPreview.tsx:22` | OK | 170 110 | const CARD_KEY = 'flow.cardH', CARD_MIN = 170, CODE_MIN = 110; |
| `renderer/components/StepPreview.tsx:23` | OK | 260 260 | const savedCard = (() => { try { const v = Number(localStorage.getItem(CARD_KEY)); return v >= CARD_MIN ? v :… |
| `renderer/components/StepPreview.tsx:27` | OK | 280 440 440 | const savedW = (() => { try { const v = Number(localStorage.getItem(WIDTH_KEY)); return v >= 280 ? v : 440; }… |
| `renderer/components/StepPreview.tsx:30` | OK | 280 420 | return <Split onDrag={(dx) => setStepW(Math.round(Math.max(280, Math.min(window.innerWidth - 420, stepW() - d… |
| `renderer/components/StepPreview.tsx:138` | OK | 0.9 1.5 4 2.2 | if (link.dataset.d !== d) { link.dataset.d = d; link.innerHTML = '<path d="${d}" fill="none" stroke="#e3d6ad"… |
| `renderer/index.html:4` | OUT | 8 | <meta charset="utf-8"> |
| `renderer/lib/actions.ts:52` | OK |  | placeholder: 'rename ${old} to…', |
| `renderer/lib/actions.ts:105` | OK |  | setPalette({ placeholder: 'open file…', items: all.map((f) => ({ label: relPath(root(), f), run: () => openFi… |
| `renderer/lib/actions.ts:111` | OK |  | placeholder: 'go to symbol in project… (type to search)', |
| `renderer/lib/actions.ts:185` | OK |  | ['Open file…', '⌘/Ctrl ⇧ O', openFileDialog], |
| `renderer/lib/actions.ts:186` | OK |  | ['Open folder…', '⌘/Ctrl O', openFolderDialog], |
| `renderer/lib/actions.ts:187` | OK |  | ['Save as…', '⌘/Ctrl ⇧ S', saveAs], |
| `renderer/lib/actions.ts:202` | OK |  | setPalette({ placeholder: 'command…', items: cmds.map(([label, detail, run]) => ({ label, detail, run })) }); |
| `renderer/lib/actions.ts:210` | OUT | 6 | if (b[i] === a[j]) { run++; score += 1 + run * 2 + (i === 0 \|\| /[\/_:.\s-]/.test(b[i - 1]) ? 6 : 0); j++; } e… |
| `renderer/lib/actions.ts:212` | OUT | 0.01 | return j === a.length ? score - b.length * 0.01 : null; |
| `renderer/lib/api.ts:16` | OUT | 6 9 12 | export const FN_KINDS = new Set([6, 9, 12]); |
| `renderer/lib/api.ts:24` | OUT |  | return normPath(/^\/[A-Za-z]:/.test(s) ? s.slice(1) : s); |
| `renderer/lib/cm.ts:45` | OK | 600 | { tag: t.heading, color: 'var(--bright)', fontWeight: '600' }, |
| `renderer/lib/cm.ts:47` | OK | 600 | { tag: [t.strong], fontWeight: '600', color: 'var(--bright)' }, |
| `renderer/lib/cm.ts:54` | OK | 100% | export const baseTheme = EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }, … |
| `renderer/lib/flow.ts:58` | OUT | 16 | await pool(files, 16, async (f) => { |
| `renderer/lib/flow.ts:76` | OUT | 12 | return it ?? { name: e.name, kind: 12, uri: fileToUri(e.file), range: { start: pos, end: pos }, selectionRang… |
| `renderer/lib/flow.ts:85` | OUT |  | const dirs = f.slice(root.length + 1).split(/[\\/]/).slice(0, -1); |
| `renderer/lib/flow.ts:86` | OUT |  | return dirs.slice(0, 2).some((d) => PUBLIC_DIR.test(d)) && !dirs.some((d) => /^(tests?\|examples?\|samples?\|thi… |
| `renderer/lib/flow.ts:114` | OUT | 16 | await pool(files, 16, async (f) => { |
| `renderer/lib/flow.ts:188` | OUT |  | const dirs = (f: string) => f.split(/[\\/]/).slice(0, -1); |
| `renderer/lib/flow.ts:234` | OUT | 6 | if (it.kind !== 6 \|\| !cls) return []; |
| `renderer/lib/flow.ts:237` | OUT | 6 12 | const hits = (await workspaceSymbols(it.name)).filter((s) => s.name === it.name && (s.kind === 6 \|\| s.kind ==… |
| `renderer/lib/flow.ts:256` | OUT | 12 | else if (c.to.kind === 12 && /^\w+$/.test(c.to.name) && /\.c$/i.test(uriToFile(c.to.uri))) { const d = await … |
| `renderer/lib/flow.ts:294` | OUT | 16 | await pool([...new Set([...nodes.values()].map((n) => uriToFile(n.item.uri)))], 16, (f) => readText(f)); |
| `renderer/lib/flow.ts:300` | OK | 26 65 64 26 65 26 | const laneId = (e: number) => (e < 26 ? String.fromCharCode(65 + e) : String.fromCharCode(64 + Math.floor(e /… |
| `renderer/lib/flow.ts:352` | OUT | 27 64 3 | const order = (s: string) => { const m = s.match(/^([A-Z]*)(t?)(\d+)/); return m ? (m[1] ? [...m[1]].reduce((… |
| `renderer/lib/flow.ts:383` | OUT |  | const first = laneStarts.slice(0, e).reduce((a, l) => a + l.length, 0); |
| `renderer/lib/flow.ts:443` | OUT | 9 | const target = (it: CallItem): Target => ({ key: keyOf(it), name: it.name, project: nodes.has(keyOf(it)), cto… |
| `renderer/lib/flow.ts:450` | OUT | 12 | await pool([...byFile.keys()], 12, async (file) => { |
| `renderer/lib/flow.ts:463` | OUT | 6 9 | if (ast) { try { fx = { ...effects(ast, text), owner: it.kind === 6 \|\| it.kind === 9 ? it.detail : undefined … |
| `renderer/lib/flowstore.ts:63` | OK |  | say(t('finding entry points…')); |
| `renderer/lib/flowstore.ts:70` | OK |  | say('tracing calls from ${what}…'); |
| `renderer/lib/flowstore.ts:71` | OK |  | const g = await buildFlow(root(), (n) => say('tracing calls from ${what}… ${n} functions'), start ? [start] :… |
| `renderer/lib/flowstore.ts:77` | OUT | 30000 2000 | if (g.unresolved && Date.now() - firstBuild < 30000) { clearTimeout(retryTimer); retryTimer = window.setTimeo… |
| `renderer/lib/flowstore.ts:119` | OK |  | setStatus('${statusOf(k.graph)} · ${t('as last time, checking…')}'); |
| `renderer/lib/flowstore.ts:121` | OUT | 120000 | holdTimer = window.setTimeout(() => releaseKept(true), 120000); |
| `renderer/lib/flowstore.ts:151` | OUT | 60000 | const mine = ++settling, until = Date.now() + 60000; |
| `renderer/lib/flowstore.ts:157` | OUT | 2000 | await new Promise((r) => setTimeout(r, 2000)); |
| `renderer/lib/flowstore.ts:170` | OK |  | if (!held) setRunStatus(t('reading each function…')); |
| `renderer/lib/flowstore.ts:171` | OK |  | const run = await buildRun(l.start, (d, n) => { if (!held) setRunStatus('reading each function… ${d} of ${n}'… |
| `renderer/lib/flowstore.ts:195` | OK |  | setSettingRaw({ ...c, state: 'reading', note: 'reading the code with ${c.label}…' }); |
| `renderer/lib/flowstore.ts:219` | OK |  | setComparingRaw({ ...c, state: 'reading', note: 'reading ${c.olderLabel}${c.newer === 'work' ? '' : ' and ${c… |
| `renderer/lib/flowstore.ts:345` | OK | 1.5 4 | const storedMag = (() => { try { const v = Number(localStorage.getItem('flow.magnify')); return v >= 1.5 && v… |
| `renderer/lib/flowstore.ts:346` | OK | 1.5 4 | const lastMag = (() => { try { const v = Number(localStorage.getItem('flow.magnify.last')); return v >= 1.5 &… |
| `renderer/lib/flowstore.ts:356` | OK | 1.5 3 4 | const steps = [1.5, 2, 3, 4], i = steps.indexOf(magnify() \|\| magStrength); |
| `renderer/lib/fonts.ts:4` | OK | 100 200 300 400 500 600 700 | { name: 'ArX F1', mono: true, bundled: true, weights: [100, 200, 300, 400, 500, 600, 700] }, |
| `renderer/lib/fonts.ts:5` | OK | 300 350 400 600 700 | { name: 'Selawik', mono: false, bundled: true, weights: [300, 350, 400, 600, 700] }, |
| `renderer/lib/fonts.ts:16` | OUT | 20px | ctx.font = '20px "${family.replace(/"/g, '')}", serif'; |
| `renderer/lib/fonts.ts:17` | OUT | 0.5 | return Math.abs(ctx.measureText('iiiiiiiiii').width - ctx.measureText('WWWWWWWWWW').width) < 0.5; |
| `renderer/lib/fonts.ts:36` | OK | 100 200 350 300 | [/hairline\|thin/, 100], [/extra ?light\|ultra ?light/, 200], [/semi ?light\|demi ?light/, 350], [/light/, 300], |
| `renderer/lib/fonts.ts:37` | OK | 500 600 800 900 700 | [/medium/, 500], [/semi ?bold\|demi ?bold/, 600], [/extra ?bold\|ultra ?bold/, 800], [/black\|heavy/, 900], [/bo… |
| `renderer/lib/fonts.ts:40` | OK | 100 200 300 350 400 500 600 700 800 900 | 100: 'thin', 200: 'extra light', 300: 'light', 350: 'semilight', 400: 'regular', 500: 'medium', 600: 'semibol… |
| `renderer/lib/fonts.ts:51` | OK | 400 | ws.add(STYLE_WEIGHTS.find(([re]) => re.test(st))?.[1] ?? 400); |
| `renderer/lib/goto.ts:122` | OK |  | hoverTimer = window.setTimeout(async () => { |
| `renderer/lib/goto.ts:126` | OK | 70 | }, 70); |
| `renderer/lib/hlcode.ts:11` | OUT | 3 3 3 3 | else if (m[3]) out += KW.test(m[3]) ? '<span class="kw">${m[3]}</span>' : '<span class="fn">${m[3]}</span>'; |
| `renderer/lib/hlcode.ts:12` | OUT | 4 4 4 4 | else if (m[4]) out += KW.test(m[4]) ? '<span class="kw">${m[4]}</span>' : m[4]; |
| `renderer/lib/hlcode.ts:13` | OUT | 5 | else out += esc(m[5]); |
| `renderer/lib/langlsp.ts:57` | OUT | 150 | timers.set(file, window.setTimeout(() => send(file, get()), 150)); |
| `renderer/lib/langs.ts:18` | OUT | 6000 12 | const head = text.slice(0, 6000).replace(/\/\*(?![^*]*-\*-)[\s\S]*?\*\//g, '').split('\n').filter((l) => l.tr… |
| `renderer/lib/lines.ts:27` | OK | 26 0.55 | const k = Math.max(26, (x2 - l.lead) * 0.55); |
| `renderer/lib/lines.ts:29` | OK | 0.22 | const fade = l.dim ? 0.22 : 1; |
| `renderer/lib/lines.ts:30` | OK | 1.4 0.8 3 1.5 4 0.95 0.45 3 1.8 | if (l.lead - x1 > 2) out += '<path d="M${x1} ${y1} L${l.lead} ${y1}" stroke="${l.color}" stroke-width="${l.ho… |
| `renderer/lib/lines.ts:31` | OK | 7 .16 | if (l.hot) out += '<path d="${d}" stroke="${l.color}" stroke-width="7" opacity=".16" stroke-linecap="round" f… |
| `renderer/lib/lines.ts:32` | OK | 0.8 0.9 0.5 0.75 4 4 | out += '<path d="${d}" stroke="${l.color}" stroke-width="${l.hot ? 2 : l.edge ? 0.8 : 0.9}" opacity="${(l.hot… |
| `renderer/lib/lines.ts:37` | OK | 2.6 1.6 0.8 | } else if (!l.onDot) out += '<circle cx="${x2}" cy="${y2}" r="${l.hot ? 2.6 : 1.6}" fill="${l.color}" opacity… |
| `renderer/lib/lines.ts:45` | OK | 4 3 5 5 1.3 | + '<path d="M${x + 4} ${y - e * 3} l4 ${e * 5} l4 ${-e * 5}" stroke="${color}" fill="none" stroke-width="1.3"… |
| `renderer/lib/lines.ts:50` | OK | 22 0.5 | const k = Math.max(22, (b - a) * 0.5); |
| `renderer/lib/lines.ts:52` | OK | 7 .16 | return (hot ? '<path d="${d}" stroke="${color}" stroke-width="7" opacity=".16" stroke-linecap="round" fill="n… |
| `renderer/lib/lines.ts:53` | OK | 0.2 0.75 | + '<path d="${d}" stroke="${color}" stroke-width="${hot ? 2 : 1}" opacity="${hot ? 1 : dim ? 0.2 : 0.75}" fil… |
| `renderer/lib/lsp.ts:48` | OUT |  | while (stops.length && now - stops[0] > 60_000) stops.shift(); |
| `renderer/lib/lsp.ts:54` | OK | 3 | setLspState('failed'); setLspMessage(stops.length > 2 ? 'clangd stopped 3 times in a minute · press refresh t… |
| `renderer/lib/lsp.ts:77` | OUT |  | changeTimers.set(file, window.setTimeout(() => { |
| `renderer/lib/lsp.ts:84` | OUT | 150 | }, 150)); |
| `renderer/lib/lsp.ts:115` | OUT | 40 | const BG_MAX = 40; |
| `renderer/lib/lsp.ts:140` | OUT | 3 4 5 6 7 8 9 10 13 14 21 22 25 | const KIND: Record<number, string> = { 2: 'method', 3: 'function', 4: 'function', 5: 'property', 6: 'variable… |
| `renderer/lib/lsp.ts:160` | OUT | 16 | return { label: String(it.filterText ?? it.label).trim(), displayLabel: String(it.label).trim(), detail: it.d… |
| `renderer/lib/lsp.ts:181` | OUT | 400 | const isCode = /^\s*(\/\/\|[\w:<>*&\s,()]+\s[\w:~]+\(\|[\w:]+\s*$\|(class\|struct\|enum\|using\|template\|namespace)\… |
| `renderer/lib/lsp.ts:183` | OUT | 3 | el.textContent = part.replace(/\n{3,}/g, '\n\n').replace(/^---$/gm, '').trim(); |
| `renderer/lib/lsp.ts:190` | OK | 350 | }, { hoverTime: 350 }); |
| `renderer/lib/lsp.ts:281` | OUT | 30 | if (!inProject(file)) { if (parsedLib.size > 30) parsedLib.clear(); parsedLib.set(file, hit); } |
| `renderer/lib/motion.ts:10` | OK | 100 200 300 400 500 600 700 13px | for (const w of [100, 200, 300, 400, 500, 600, 700]) document.fonts.load('${w} 13px "ArX F1"').catch(() => {}… |
| `renderer/lib/motion.ts:11` | OK | 300 350 400 600 700 13px | for (const w of [300, 350, 400, 600, 700]) document.fonts.load('${w} 13px "Selawik"').catch(() => {}); |
| `renderer/lib/motion.ts:13` | OUT | 2000 300 | 'requestIdleCallback' in window ? (window as any).requestIdleCallback(go, { timeout: 2000 }) : setTimeout(go,… |
| `renderer/lib/paths.ts:6` | OK | 4 4 | const a = Math.min(4, Math.hypot(Q.x - P.x, Q.y - P.y) / 2), b = Math.min(4, Math.hypot(R.x - Q.x, R.y - Q.y)… |
| `renderer/lib/preview.ts:67` | OUT | 6 | const bodiless = std && (def === c.to \|\| def.range.start.line < c.to.selectionRange.start.line - 6 |
| `renderer/lib/preview.ts:84` | OUT | 24 | if (trees.size > 24) trees.clear(); |
| `renderer/lib/preview.ts:163` | OUT | 12 | key: '${kind}:${file}#${a}:${name}', item: { name, kind: 12, uri: fileToUri(file), range: r, selectionRange: … |
| `renderer/lib/preview.ts:173` | OUT |  | setLevels([...ls.slice(0, idx), m, ...(m !== fresh && keepsDeeper(old, m) ? ls.slice(idx + 1) : [])]); |
| `renderer/lib/preview.ts:230` | OUT | 30000 | if (Date.now() - first > 30000) return; |
| `renderer/lib/preview.ts:232` | OUT | 1500 | retryTimers.set(key, window.setTimeout(() => { retryTimers.delete(key); run(); }, 1500)); |
| `renderer/lib/preview.ts:249` | OUT |  | const ls = levels().slice(0, levelIdx + 1); |
| `renderer/lib/preview.ts:323` | OUT | 16 | await pool(frontier, 16, async (it) => { |
| `renderer/lib/repair.ts:29` | OUT |  | const before = l.text.slice(0, f.from - l.from), after = l.text.slice(f.to - l.from), gone = doc.sliceString(… |
| `renderer/lib/repair.ts:43` | OK | 24 8 | const beside = r.right + 24 + w <= window.innerWidth - 8; |
| `renderer/lib/repair.ts:102` | OUT | 3 | marks.push({ at: l.to, d: Decoration.widget({ widget: new FixesWidget(fs, indent), block: true, side: 3 }) }); |
| `renderer/lib/repair.ts:146` | OUT | 700 | soon() { clearTimeout(this.timer); this.timer = window.setTimeout(() => void this.run(), 700); } |
| `renderer/lib/repair.ts:157` | OK |  | setRepairNote({ file, text: t('checking fixes…') }); |
| `renderer/lib/search.ts:20` | OUT |  | timer = window.setTimeout(async () => { |
| `renderer/lib/search.ts:23` | OUT | 180 | }, 180); |
| `renderer/lib/store.ts:129` | OUT |  | bufferTimers.set(path, window.setTimeout(() => { |
| `renderer/lib/store.ts:134` | OUT | 1000 | }, 1000)); |
| `renderer/lib/store.ts:138` | OUT |  | autosaveTimers.set(path, window.setTimeout(() => save(path), s['editor.autosave_delay_ms'])); |
| `renderer/lib/store.ts:196` | OUT | 400 | sessionTimer = window.setTimeout(() => api.session.set({ root: root(), open: files.list.map((f) => f.path), a… |
| `renderer/settingworker.ts:7` | OUT |  | const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)); |
| `renderer/settingworker.ts:8` | OUT | 100 | async function until(cond: () => boolean, ms: number) { const end = Date.now() + ms; while (!cond() && Date.n… |
| `renderer/settingworker.ts:12` | OUT | 100 | while (Date.now() < end) { if (!cond()) since = 0; else if (!since) since = Date.now(); else if (Date.now() -… |
| `renderer/settingworker.ts:21` | OUT | 60000 | if (!(await until(() => lspState() === 'ready', 60000))) throw new Error('clangd did not start for this setti… |
| `renderer/settingworker.ts:22` | OUT | 10000 | await until(() => !!indexing() \|\| indexEpoch() > 0, 10000); |
| `renderer/settingworker.ts:23` | OUT | 1500 30 60000 | await quiet(() => !indexing(), 1500, 30 * 60000); |
| `renderer/settingworker.ts:28` | OUT | 60000 | for (const end = Date.now() + 60000; Date.now() < end;) { |
| `renderer/settingworker.ts:34` | OUT | 2000 | await sleep(2000); |
| `renderer/settingworker.ts:36` | OUT | 1500 | await sleep(1500); |
| `renderer/styles.css:1` | OK | 300 | @font-face { font-family: 'Selawik'; src: url('/Selawik/selawkl.ttf'); font-weight: 300; } |
| `renderer/styles.css:2` | OK | 350 | @font-face { font-family: 'Selawik'; src: url('/Selawik/selawksl.ttf'); font-weight: 350; } |
| `renderer/styles.css:3` | OK | 400 | @font-face { font-family: 'Selawik'; src: url('/Selawik/selawk.ttf'); font-weight: 400; } |
| `renderer/styles.css:4` | OK | 600 | @font-face { font-family: 'Selawik'; src: url('/Selawik/selawksb.ttf'); font-weight: 600; } |
| `renderer/styles.css:5` | OK | 700 | @font-face { font-family: 'Selawik'; src: url('/Selawik/selawkb.ttf'); font-weight: 700; } |
| `renderer/styles.css:6` | OK | 100 | @font-face { font-family: 'ArX F1'; src: url('/ArXF1/ArXF1-Thin.otf'); font-weight: 100; } |
| `renderer/styles.css:7` | OK | 200 | @font-face { font-family: 'ArX F1'; src: url('/ArXF1/ArXF1-ExtraLight.otf'); font-weight: 200; } |
| `renderer/styles.css:8` | OK | 300 | @font-face { font-family: 'ArX F1'; src: url('/ArXF1/ArXF1-Light.otf'); font-weight: 300; } |
| `renderer/styles.css:9` | OK | 400 | @font-face { font-family: 'ArX F1'; src: url('/ArXF1/ArXF1-Regular.otf'); font-weight: 400; } |
| `renderer/styles.css:10` | OK | 500 | @font-face { font-family: 'ArX F1'; src: url('/ArXF1/ArXF1-Medium.otf'); font-weight: 500; } |
| `renderer/styles.css:11` | OK | 600 | @font-face { font-family: 'ArX F1'; src: url('/ArXF1/ArXF1-Semibold.otf'); font-weight: 600; } |
| `renderer/styles.css:12` | OK | 700 | @font-face { font-family: 'ArX F1'; src: url('/ArXF1/ArXF1-Bold.otf'); font-weight: 700; } |
| `renderer/styles.css:22` | OK | 13px 1.6 400 .9 | --code-size: 13px; --code-lh: 1.6; --code-ls: 0px; --code-weight: 400; --preview-scale: .9; |
| `renderer/styles.css:25` | OK | 100% 300 | html, body, #root { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--fg); font-… |
| `renderer/styles.css:33` | OK | 100% | .app { display: flex; flex-direction: column; height: 100%; } |
| `renderer/styles.css:38` | OK | .18s | .pivot button { color: #313531; transition: color .18s; } |
| `renderer/styles.css:48` | OK | 1 | .wctl:hover { opacity: 1; } |
| `renderer/styles.css:54` | OK | 1 | .body { flex: 1; min-height: 0; display: flex; } |
| `renderer/styles.css:55` | OK |  | .pane { position: relative; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: col… |
| `renderer/styles.css:57` | OK | 1 | .ph .grow { flex: 1; } |
| `renderer/styles.css:63` | OK | 115 150 150 .12 | .split:hover, .split.drag { background: rgba(115, 150, 150, .12); } |
| `renderer/styles.css:70` | OK | 255 255 255 .035 | .ti.on { background: rgba(255, 255, 255, .035); color: var(--bright); } |
| `renderer/styles.css:74` | OK | 1 | .code { flex: 1; min-height: 0; } |
| `renderer/styles.css:75` | OK | 100% | .cm-editor { height: 100%; background: var(--bg); color: var(--fg); font-family: var(--mono); } |
| `renderer/styles.css:81` | OK | 255 255 255 .022 | .cm-activeLine { background: rgba(255, 255, 255, .022) !important; } |
| `renderer/styles.css:82` | OK | 2px | .cm-cursor { border-left: 2px solid #6f8f8f !important; } |
| `renderer/styles.css:86` | OK | 255 255 255 .06 | .cm-tooltip-autocomplete ul li[aria-selected] { background: rgba(255, 255, 255, .06) !important; color: var(-… |
| `renderer/styles.css:99` | OK | 127 158 130 .25 | .cm-searchMatch { background: rgba(127, 158, 130, .25) !important; } |
| `renderer/styles.css:102` | OK | .38 | .cm-dimmed { opacity: .38; } |
| `renderer/styles.css:106` | OK | 255 255 255 .025 | .rs:hover { background: rgba(255, 255, 255, .025); } |
| `renderer/styles.css:111` | OK | 127 158 130 .16 | .rs .ed .add { color: #8fbf8f; background: rgba(127, 158, 130, .16); } |
| `renderer/styles.css:112` | OK | .55 | .rs .ed .del { color: var(--err); opacity: .55; text-decoration: line-through; } |
| `renderer/styles.css:128` | OK |  | .prev { background: var(--prev); overflow: hidden; } |
| `renderer/styles.css:133` | OK | 2px | .card.focus { background: var(--card-hi); box-shadow: inset 2px 0 #4e6a6a; } |
| `renderer/styles.css:138` | OK | 12px | .card-h .num { color: #c9b98f; font-size: calc(12px * var(--hk)); } |
| `renderer/styles.css:150` | OK | .35 | .shiftbar button:disabled { opacity: .35; cursor: default; } |
| `renderer/styles.css:154` | OK | 10px .985 | @keyframes st-in { from { opacity: 0; transform: translateY(10px) scale(.985); } } |
| `renderer/styles.css:169` | OK | 255 255 255 .045 | .st-rc:hover, .st-rc:focus-visible { background: rgba(255, 255, 255, .045); } |
| `renderer/styles.css:182` | OK | 9% | .st-big.go { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, transparent); } |
| `renderer/styles.css:184` | OK | 15% | .st-big.go:hover, .st-big.go:focus-visible { background: color-mix(in srgb, var(--accent) 15%, transparent); } |
| `renderer/styles.css:188` | OK | 400 | .st-foot b { font-weight: 400; color: var(--dim); } |
| `renderer/styles.css:194` | OK | 1px | .shiftbar .pnav button + button { border-left: 1px solid #343834; } |
| `renderer/styles.css:208` | OK | .45 | .ctl.idle { opacity: .45; } |
| `renderer/styles.css:223` | OK | 255 255 255 .05 | .combo-list button.hi { background: rgba(255, 255, 255, .05); color: var(--bright); } |
| `renderer/styles.css:227` | OK | 1 | .pathrow input[type=text] { margin-top: 0; flex: 1; min-width: 0; } |
| `renderer/styles.css:239` | OK | 40px | .tog.on i { transform: translate3d(40px, 0, 0); } |
| `renderer/styles.css:240` | OK | 1 | .tog.on b { transform: scaleX(1); } |
| `renderer/styles.css:246` | OK | 255 255 255 .03 | .choices.weights button:hover { background: rgba(255, 255, 255, .03); color: #8b9189; } |
| `renderer/styles.css:247` | OK | 255 255 255 .04 | .choices.weights button.on { border-left-color: var(--accent); background: rgba(255, 255, 255, .04); } |
| `renderer/styles.css:249` | OK | .6 | .choices.weights button.synth { opacity: .6; } |
| `renderer/styles.css:252` | OK | 1 | .flow { position: relative; flex: 1; min-height: 0; overflow: hidden; outline: none; } |
| `renderer/styles.css:267` | OK | 10 | @keyframes bxflow { from { stroke-dashoffset: 10; } to { stroke-dashoffset: 0; } } |
| `renderer/styles.css:310` | OK | 173 155 111 .09 .45 | .bxr.on { background: rgba(173,155,111,.09); border-left-color: var(--flow-now); } .bxr.dim { opacity: .45; } |
| `renderer/styles.css:319` | OK |  | .bar i { position: absolute; top: 0; bottom: 0; } |
| `renderer/styles.css:321` | OK | 16px 1 | @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } } |
| `renderer/styles.css:327` | OK | 115 150 150 .12 | .psplit:hover, .psplit.drag { background: rgba(115, 150, 150, .12); } |
| `renderer/styles.css:330` | OK | .18s .18s | .card { transition: background .18s, box-shadow .18s; } |
| `renderer/styles.css:331` | OK | .18s .18s .22s | .card { transition: background .18s, box-shadow .18s, opacity .22s; } |
| `renderer/styles.css:332` | OK | 9% 4px 1px 45% | .card.lit { --tint: color-mix(in srgb, var(--c) 9%, #1b1c1b); background: var(--tint); box-shadow: inset 4px … |
| `renderer/styles.css:333` | OK | 4px 40% .6s .16 1 .3 1 | .card.lit::after { content: ''; position: absolute; inset: 0; box-shadow: 0 0 0 4px color-mix(in srgb, var(--… |
| `renderer/styles.css:335` | OK | 17% | .card.lit .card-h { background: color-mix(in srgb, var(--c) 17%, #1b1c1b); } |
| `renderer/styles.css:338` | OK | .5 | .pcol.haslit .card:not(.lit) { opacity: .5; } |
| `renderer/styles.css:339` | OK | .85 | .pcol.haslit .card:not(.lit):hover { opacity: .85; } |
| `renderer/styles.css:340` | OK | 1 1.012 | @keyframes lit-ring { from { opacity: 1; transform: scale(1.012); } to { opacity: 0; transform: none; } } |
| `renderer/styles.css:347` | OK | 4px 50% | @keyframes tip-in { from { opacity: 0; transform: translate(-4px, -50%); } } |
| `renderer/styles.css:352` | OK | 255 255 255 .05 | .pal-it.on { background: rgba(255, 255, 255, .05); color: var(--bright); } |
| `renderer/styles.css:361` | OK | 255 255 255 .05 | .appmenu button:hover { background: rgba(255, 255, 255, .05); color: var(--bright); } |
| `renderer/styles.css:378` | OK | 1 | .cwin-h .grow { flex: 1; } |
| `renderer/styles.css:391` | OK | 255 255 255 .03 | .cwin .copt:hover:not(:disabled) { background: rgba(255, 255, 255, .03); } |
| `renderer/styles.css:392` | OK | .45 | .cwin .copt:disabled { opacity: .45; cursor: default; } |
| `renderer/styles.css:400` | OK | .4 | .cwin .lnk:disabled { opacity: .4; cursor: default; } |
| `renderer/styles.css:404` | OK | 1 | .cwin .cpack .grow { flex: 1; min-width: 0; color: var(--bright); } |
| `renderer/styles.css:407` | OK | 255 255 255 .04 | .cwin .cvers button:hover:not(:disabled) { background: rgba(255, 255, 255, .04); } |
| `renderer/styles.css:409` | OK | .6 | .cwin .cvers button.have { opacity: .6; } |
| `renderer/styles.css:414` | OK | .2s | .cwin .cprog .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent); transition: … |
| `renderer/styles.css:415` | OK | 1.2s | .cwin .cprog .bar i.pulse { animation: cbar 1.2s ease-in-out infinite; } |
| `renderer/styles.css:416` | OK | 50% .45 | @keyframes cbar { 50% { opacity: .45; } } |
| `renderer/styles.css:425` | OK | 1.5px 2px | :where(button, [role=button], input, select, [tabindex]):focus-visible { outline: 1.5px solid var(--accent); … |
| `renderer/styles.css:434` | OK | .001ms .001ms | html.calm *, html.calm *::before, html.calm *::after { animation-duration: .001ms !important; animation-delay… |
| `renderer/styles.css:435` | OK | .001ms .001ms | @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .001ms !important; ani… |
| `renderer/styles.css:442` | OK | 1 | .clang .grow { flex: 1; min-width: 0; } |
| `renderer/styles.css:444` | OK | 400 | .clang .dim b { font-weight: 400; color: var(--fg); } |
| `renderer/styles.css:446` | OK | 1 | .seqv { position: relative; flex: 1; overflow: hidden; outline: none; --now: var(--flow-now); --rep: var(--fl… |
| `renderer/styles.css:447` | OK | .5s .16 1 .3 1 | .seqin { position: absolute; left: 0; top: 0; right: 0; transition: transform .5s cubic-bezier(.16,1,.3,1); } |
| `renderer/styles.css:461` | OK | 90deg 100% 32px 90deg 100% 32px | -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent); mask-image: linear-gradient(… |
| `renderer/styles.css:462` | OK | .42s .16 1 .3 1 .42s .16 1 .3 1 .42s .42s | transition: top .42s cubic-bezier(.16,1,.3,1), left .42s cubic-bezier(.16,1,.3,1), opacity .42s, color .42s; } |
| `renderer/styles.css:465` | OK |  | .mtrack { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; } |
| `renderer/styles.css:474` | OK | .42s .16 1 .3 1 .42s .16 1 .3 1 .42s .42s .12s | .seqv.metro .srow { gap: 0; transition: top .42s cubic-bezier(.16,1,.3,1), left .42s cubic-bezier(.16,1,.3,1)… |
| `renderer/styles.css:475` | OK | 227 214 173 .055 2px 227 214 173 .35 | .seqv.metro .srow:not(.sel):hover { background-color: rgba(227, 214, 173, .055); box-shadow: inset 2px 0 rgba… |
| `renderer/styles.css:490` | OK | 90deg 100% 24px 90deg 100% 24px | .seqv.metro .srow.sel .mnotes { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparen… |
| `renderer/styles.css:499` | OK | .55 | .srow.far { opacity: .55; } |
| `renderer/styles.css:500` | OK | .18 | .seqv.waysout .srow.wq { opacity: .18 !important; } |
| `renderer/styles.css:501` | OK | 1 | .seqv.waysout .srow.wx { opacity: 1 !important; } |
| `renderer/styles.css:504` | OK | .18 | .seqv.following .srow.fq { opacity: .18 !important; } |
| `renderer/styles.css:505` | OK | 1 | .seqv.following .srow.fw { opacity: 1 !important; } |
| `renderer/styles.css:506` | OK | .32 | .srow.sdead { opacity: .32; } |
| `renderer/styles.css:519` | OK | .4 | .setm .go:disabled { opacity: .4; cursor: default; } |
| `renderer/styles.css:526` | OK | .55 | .sline .gh.gone { color: #b8766b; border-color: #6b4a44; opacity: .55; } |
| `renderer/styles.css:535` | OK | 173 155 111 .12 | .spickl button:hover { background: rgba(173,155,111,.12); color: var(--bright); } |
| `renderer/styles.css:547` | OK | 2px | .seqv.metro:not(.jpick) .srow.sel { background: #e3d6ad; border-radius: 2px; } |
| `renderer/styles.css:551` | OK | 23 24 23 .08 | .seqv.metro:not(.jpick) .srow.sel .mcall { background: rgba(23, 24, 23, .08); } |
| `renderer/styles.css:552` | OK | 23 24 23 .35 | .seqv.metro:not(.jpick) .srow.sel .mchip { border-color: rgba(23, 24, 23, .35); } |
| `renderer/styles.css:553` | OK | 2px | .seqv.metro:not(.jpick) .srow.sel .snote { background: transparent; box-shadow: inset 2px 0 #171817; } |
| `renderer/styles.css:555` | OK | 138 74 18 .6 | .seqv.metro:not(.jpick) .srow.sel .mchip.t-warn { color: #8a4a12; border-color: rgba(138, 74, 18, .6); } |
| `renderer/styles.css:556` | OK | 47 90 51 .6 | .seqv.metro:not(.jpick) .srow.sel .mchip.t-ok { color: #2f5a33; border-color: rgba(47, 90, 51, .6); } |
| `renderer/styles.css:558` | OK | 34 88 90 .6 | .seqv.metro:not(.jpick) .srow.sel .mchip.t-link { color: #22585a; border-color: rgba(34, 88, 90, .6); } |
| `renderer/styles.css:559` | OK | 61 74 53 .5 | .seqv.metro:not(.jpick) .srow.sel .mchip.t-comment { color: #3d4a35; border-color: rgba(61, 74, 53, .5); } |
| `renderer/styles.css:569` | OK | 227 214 173 .055 | .sjn:hover { background-color: rgba(227, 214, 173, .055); } |
| `renderer/styles.css:575` | OK | 50vh | .sfind .paths { max-height: 50vh; overflow-y: auto; } |
| `renderer/styles.css:578` | OK | 1.2 | .mtrack .jloop { fill: none; stroke: #6f9e9e; stroke-width: 1.2; } |
| `renderer/styles.css:579` | OK | 1.2 2.5 2.5 | .mtrack .jfork { fill: none; stroke-width: 1.2; stroke-dasharray: 2.5 2.5; } |
| `renderer/styles.css:586` | OK | 1px .42s .16 1 .3 1 | .sarw { position: absolute; height: 0; border-top: 1px solid #353935; transition: top .42s cubic-bezier(.16,1… |
| `renderer/styles.css:588` | OK | .4 | .sarw.thread { border-top-style: dashed; } .sarw.hot { border-top-color: var(--now); } .sarw.hot::after { bor… |
| `renderer/styles.css:590` | OK | .94 | @keyframes sunfold { from { transform: scaleY(.94); opacity: 0; } } |
| `renderer/styles.css:607` | OK | 1 | .sret path { fill: none; stroke: var(--flow-return); stroke-width: 1; } |
| `renderer/styles.css:614` | OK | 173 155 111 .13 3px | .scall .hit { background: rgba(173,155,111,.13); box-shadow: inset 3px 0 #ad9b6f; color: #e3e6df; } .scall .h… |
| `renderer/styles.css:616` | OK | 100% | .speek.up { transform: translateY(-100%); } |
| `renderer/styles.css:645` | OK | 1.5px 111 158 158 .3 | .skyk i.now { box-shadow: inset 0 0 0 1.5px #e3d6ad; } .skyk i.loop { background: rgba(111, 158, 158, .3); } |
| `renderer/styles.css:656` | OK | 50% 3px | @keyframes tip-up { from { opacity: 0; transform: translate(-50%, 3px); } } |
| `renderer/styles.css:666` | OK | .22 | .seqv.onpath .srow.off { opacity: .22 !important; } |
| `renderer/styles.css:676` | OK | 100% | .scode .cm-editor { height: 100%; } |
| `renderer/styles.css:677` | OK | 173 155 111 .14 3px | .scode .snext { background: rgba(173, 155, 111, .14); box-shadow: inset 3px 0 #ad9b6f; } |
| `renderer/styles.css:681` | OK | .5px 85% 1px .15s .15s | .callbox { outline: .5px solid color-mix(in srgb, var(--c) 85%, transparent); outline-offset: 1px; border-rad… |
| `renderer/styles.css:682` | OK | 10% | .callbox:hover { outline-color: var(--c); background: color-mix(in srgb, var(--c) 10%, transparent); } |
| `renderer/styles.css:699` | OK |  | .magnifier .mg-in { position: absolute; left: 0; top: 0; transform-origin: 0 0; } |
| `renderer/styles.css:709` | OK | 30% 2px | mark { background: color-mix(in srgb, var(--accent) 30%, transparent); color: #e8d9ad; border-radius: 2px; } |
| `renderer/styles.css:718` | OK | 400 | .cres .grp b { font-weight: 400; color: var(--fg); } |
| `renderer/styles.css:719` | OK | 1 | .cres .grp .grow { flex: 1; } |
| `renderer/styles.css:722` | OK | 10% 3px | .cres .hit.on { background: color-mix(in srgb, var(--accent) 10%, transparent); box-shadow: inset 3px 0 var(-… |
| `renderer/styles.css:726` | OK | 22% | .playc button.on { color: #e8d9ad; background: color-mix(in srgb, var(--accent) 22%, var(--card)); } |
| `renderer/styles.css:733` | OK | 400 | .progs .grp b { font-weight: 400; color: var(--fg); } |
| `renderer/styles.css:739` | OK | 10% | .progs .pr.on, .progs .pr:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(… |
| `renderer/styles.css:740` | OK | 3px | .progs .pr.on { box-shadow: inset 3px 0 var(--accent); } |
| `renderer/styles.css:747` | OK | 70% 70% | .sline .kw { color: color-mix(in srgb, var(--kw) 70%, #1a1b1a); } .sline .fn { color: color-mix(in srgb, var(… |
| `renderer/styles.css:759` | OK | 173 155 111 .12 | .sfndl button:hover { background: rgba(173,155,111,.12); color: var(--bright); } |
| `renderer/styles.css:767` | OK | 400 | .sfrom .h b { font-weight: 400; color: var(--link); } |
| `renderer/styles.css:768` | OK | 2px | .sfrom code u { text-decoration: none; color: #e3d6ad; border-bottom: 2px solid #ad9b6f; } |
| `renderer/styles.css:782` | OK | 1 | .gview { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; outline: none; } |
| `renderer/styles.css:801` | OK | 600 | .gch.on b, .grh.on b { color: #e3d6ad; } .gch.pk b, .grh.pk b { color: #e3e6df; font-weight: 600; } .gch.lv b… |
| `renderer/styles.css:808` | OK | .3 | .gview.following .grh:not(.fw) b, .gview.following .gch:not(.fw) b { opacity: .3; } |
| `renderer/styles.css:809` | OK | .38 | .grh.dim b, .gch.dim b { opacity: .38; } |
| `renderer/styles.css:812` | OK | 1px 45% | .gbox { position: absolute; border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); pointer-events: … |
| `renderer/styles.css:815` | OK | 999px 227 214 173 .045 | .gcell.x, .gcell.pl { box-shadow: inset 0 0 0 999px rgba(227, 214, 173, .045); } |
| `renderer/styles.css:816` | OK | 999px 127 163 196 .07 | .gcell.hl { box-shadow: inset 0 0 0 999px rgba(127, 163, 196, .07); } |
| `renderer/styles.css:817` | OK | 1px | .gcell.has { background: #1f211f; box-shadow: inset 0 0 0 1px #2e322e; cursor: pointer; } |
| `renderer/styles.css:818` | OK | 14% | .gcell.has.same { background: color-mix(in srgb, var(--c) 14%, #1b1c1b); } |
| `renderer/styles.css:819` | OK | 100% | .gview.heat .gcell.has { background: color-mix(in srgb, #e3d6ad calc(var(--h) * 100%), #1b1c1b); } |
| `renderer/styles.css:830` | OK | 1.5px | .gcell.rt { box-shadow: inset 0 0 0 1.5px #7fa3a3; } |
| `renderer/styles.css:833` | OK | 23 24 23 .3 | .gcell.on:not(.pk) i { color: #171817; border-color: rgba(23, 24, 23, .3); } |
| `renderer/styles.css:839` | OK | .6 | .glinks .ln { fill: none; stroke-width: .6; stroke-linecap: round; stroke-linejoin: round; } |
| `renderer/styles.css:847` | OK | 1px | .gstep:hover { box-shadow: inset 0 0 0 1px #7fa3c4; } |
| `renderer/styles.css:865` | OK | .25 | .gview.focus .gcell:not(.x):not(.on) { opacity: .25; } |
| `renderer/styles.css:869` | OK | 1.5px 1px 2px | .cbx { outline: 1.5px solid #7a90c4; outline-offset: 1px; border-radius: 2px; cursor: pointer; } |
| `renderer/styles.css:874` | OK | 1 | .sprev .scodewrap .scode { flex: 1; min-height: 0; } |
| `renderer/styles.css:875` | OK | 255 255 255 .02 .45 | .scode .swalked { background: rgba(255, 255, 255, .02); } .scode .snot { opacity: .45; } |
| `renderer/styles.css:887` | OK | 3px | .ibx .cl:hover { background: #222422; } .ibx .cl.now { box-shadow: inset 3px 0 #e3d6ad; } .ibx .cl.dn .sp { c… |
| `shared/color.ts:1` | OUT | 6 8 | export const isColor = (v: unknown): v is string => typeof v === 'string' && /^#([0-9a-f]{6}\|[0-9a-f]{8})$/i.… |
| `shared/color.ts:6` | OUT | 16 255 | const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255; |
| `shared/color.ts:7` | OUT | 3 5 9 7 9 16 255 | const r = n(1), g = n(3), b = n(5), a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1; |
| `shared/color.ts:12` | OUT | 6 4 | h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; |
| `shared/color.ts:13` | OUT | 60 360 360 | h = (h * 60 + 360) % 360; |
| `shared/color.ts:15` | OUT | 100 100 | return { h, s: s * 100, l: l * 100, a }; |
| `shared/color.ts:19` | OUT | 100 100 100 100 360 360 360 | const S = Math.min(100, Math.max(0, s)) / 100, L = Math.min(100, Math.max(0, l)) / 100, H = ((h % 360) + 360)… |
| `shared/color.ts:20` | OUT | 60 | const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = L - c / 2; |
| `shared/color.ts:21` | OUT | 60 120 180 240 300 | const [r, g, b] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < … |
| `shared/color.ts:22` | OUT | 255 16 | const hx = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'); |
| `shared/defpick.ts:7` | OUT |  | const dirsOf = (f: string) => f.split(/[\\/]/).slice(0, -1); |
| `shared/entries.ts:7` | OUT |  | const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean), dirs = parts.slice(0, -1), stem = (parts[pa… |
| `shared/entries.ts:10` | OUT | 6 | if (TEST.test(d)) s -= 6; |
| `shared/entries.ts:11` | OUT | 4 | else if (TOOL.test(d)) s -= 4; |
| `shared/entries.ts:16` | OUT | 3 | if (/test/i.test(stem)) s -= 3; |
| `shared/entries.ts:17` | OUT | 0.5 | return s - dirs.length * 0.5; |
| `shared/entries.ts:21` | OUT | 10 | return list.map((e, i) => ({ e, i, s: entryScore(e.rel) - (e.kind === 'interrupt' ? 10 : 0) })).sort((a, b) =… |
| `shared/flowcore.ts:16` | OUT | 3 | if (m) return '×${Number(m[3]) + (m[2] === '<=' ? 1 : 0)}'; |
| `shared/flowcore.ts:30` | OK |  | return 'do … ${squash(tail)}'; |
| `shared/flowfacts.ts:92` | OUT | 3 3 | for (const n of proto ? kids(proto) : []) { const m = n.kind === 'ParmVar' ? parm(n) : null; if (m && !params… |
| `shared/flowfacts.ts:103` | OUT | 3 | for (const n of proto ? kids(proto) : []) { const m = n.kind === 'ParmVar' ? /ParmVarDecl .* (?:used \|referen… |
| `shared/flowrun.ts:42` | OUT | 4194304 | const KEY = 4194304; |
| `shared/flowrun.ts:70` | OUT | 10 | for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1); |
| `shared/flowrun.ts:301` | OUT |  | const cond = this.stmts(body.slice(0, 1)); |
| `shared/flowrun.ts:304` | OUT |  | return { label: t.slice(0, t.indexOf(')') + 1) \|\| 'catch', line: c.range!.start.line, body: this.stmts(kids(c… |
| `shared/flowrun.ts:317` | OUT |  | return { t: 'loop', kind: 'do', text: 'do … ' + t.slice(t.lastIndexOf('while')).replace(/;$/, ''), line, coun… |
| `shared/flowrun.ts:377` | OUT |  | const operands = c.slice(1); |
| `shared/flowrun.ts:390` | OUT |  | this.args(c.slice(1), out, starts, true); |
| `shared/flowrun.ts:413` | OUT |  | const args = kids(n).slice(1).map((a) => (a.range ? this.oneLine(a.range) : '')); |
| `shared/flowrun.ts:414` | OUT |  | const argx = kids(n).slice(1).map((a) => { const x = exprOf(a); return x.k === '?' ? null : x; }); |
| `shared/flowrun.ts:507` | OUT |  | return { text: n.arms[i].label === 'then' ? n.text : '${n.text} … else', exit: ex[i]!, line: n.line, arm: i }; |
| `shared/flowrun.ts:564` | OUT | 64 | for (let i = 0; i < queue.length && i < 64; i++) { if (FN_KIND.test(queue[i].kind)) return queue[i]; queue.pu… |
| `shared/flowseq.ts:83` | OUT |  | if (name === 'back') return trail.length > 1 ? { trail: trail.slice(0, -1) } : refuse('this is where the walk… |
| `shared/flowseq.ts:159` | OK | 4 | export function embers(trail: StepState[], n = 4): number[] { |
| `shared/flowseq.ts:280` | OK | 4 | if (c.to - c.from + 1 > N / 4) { |
| `shared/flowseq.ts:307` | OUT | 3 3 | if (m[3]) for (const part of decodeURIComponent(m[3]).split(',')) { |
| `shared/flowseq.ts:308` | OUT |  | const k = part.indexOf(':'), it = Number(part.slice(0, k)); |
| `shared/flowseq.ts:532` | OUT |  | const name = k.startsWith('::') ? k.slice(2) : k; |
| `shared/flowseq.ts:561` | OUT | 100 11 100 13 10 | export const ordinal = (n: number) => '${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd']… |
| `shared/flowvalues.ts:28` | OUT | 128 | case 'CharacterLiteral': { const v = /\s(\d+)\s*$/.exec(a)?.[1]; return v && ty && Number(v) < 128 ? { k: 'in… |
| `shared/flowvalues.ts:41` | OUT | 3 | case 'ConditionalOperator': return ty && e.length === 3 ? { k: 'cond', ty, c: exprOf(e[0]), a: exprOf(e[1]), … |
| `shared/flowvalues.ts:51` | OUT |  | return v && BigInt(v) <= 32767n ? { k: 'int', v, ty: 'int' } : Q; |
| `shared/flowvalues.ts:70` | OUT | 16 32 32 64 | const MODELS: Model[] = [16, 32].flatMap((i) => [32, 64].flatMap((l) => [true, false].map((c) => ({ int: i, l… |
| `shared/flowvalues.ts:81` | OUT | 8 | case 'char': return { bits: 8, signed: m.charSigned }; |
| `shared/flowvalues.ts:82` | OUT | 8 | case 'signed char': return { bits: 8, signed: true }; |
| `shared/flowvalues.ts:83` | OUT | 8 | case 'unsigned char': case 'char8_t': return { bits: 8, signed: false }; |
| `shared/flowvalues.ts:84` | OUT | 16 | case 'short': return { bits: 16, signed: true }; |
| `shared/flowvalues.ts:85` | OUT | 16 | case 'unsigned short': case 'char16_t': return { bits: 16, signed: false }; |
| `shared/flowvalues.ts:88` | OUT | 32 | case 'char32_t': return { bits: 32, signed: false }; |
| `shared/flowvalues.ts:91` | OUT | 64 | case 'long long': return { bits: 64, signed: true }; |
| `shared/flowvalues.ts:92` | OUT | 64 | case 'unsigned long long': return { bits: 64, signed: false }; |
| `shared/flowwatch.ts:8` | OUT | 6 | for (let k = 0; k < 6; k++) { |
| `shared/gridlinks.ts:60` | OUT |  | for (let k = i; k < s0.length; k++) { if (s0[k] === '(') d++; else if (s0[k] === ')' && --d === 0) return s0.… |
| `shared/gridmodel.ts:42` | OUT |  | for (const [k, v] of cells) cols.get(k.slice(0, k.indexOf('>')))!.count += v.length; |
| `shared/junctions.ts:36` | OUT | 3 | const head = when.slice(0, i), label = when.slice(i + 3); |
| `shared/metrofacts.ts:43` | OUT |  | const head = b.slice(0, i).trimEnd(), word = /([A-Za-z_][\w:]*)$/.exec(head)?.[1] ?? ''; |
| `shared/metrofacts.ts:70` | OUT |  | return { line, call, name, result: resultTarget(line.slice(0, at), line.slice(at + call.length)) }; |
| `shared/metrofacts.ts:172` | OUT |  | const sigEnd = text.findIndex((l) => l.includes('{')), signature = (sigEnd >= 0 ? text.slice(0, sigEnd + 1).j… |
| `shared/paths.ts:1` | OUT |  | export const normPath = (p: string) => (/^[A-Za-z]:[\\/]/.test(p) ? p[0].toUpperCase() + p.slice(1).replace(/… |
| `shared/repair.ts:21` | OUT |  | export const applyEdit = (text: string, e: Edit) => text.slice(0, e.from) + e.insert + text.slice(e.to); |
| `shared/repair.ts:108` | OUT |  | return old && e.insert.length > old.length && e.insert.endsWith(old) ? { from: e.from, to: e.from, insert: e.… |
| `shared/repair.ts:153` | OUT | 3 | const exp = /^expected '([^']{1,3})'/.exec(m); |
| `shared/repair.ts:182` | OUT | 3 | if (lang === 'cpp' && !inStd && !GLOBAL.has(name) && at >= 0 && !/::\s*$/.test(text.slice(Math.max(0, at - 3)… |
| `shared/repair.ts:196` | OUT | 300 | const eq = /^[^;=]*?[^=!<>]=(?!=)\s*/.exec(text.slice(p, p + 300)); |
| `shared/settings-schema.ts:40` | OK | 13 6 72 | { key: 'font.size', type: 'number', default: 13, min: 6, max: 72, doc: 'code text size', unit: 'px' }, |
| `shared/settings-schema.ts:41` | OK | 6 | { key: 'font.letter_spacing', type: 'number', default: 0, min: -2, max: 6, doc: 'space between letters', unit… |
| `shared/settings-schema.ts:42` | OK | 400 100 900 | { key: 'font.weight', type: 'number', default: 400, min: 100, max: 900, doc: 'code text weight' }, |
| `shared/settings-schema.ts:43` | OK | 1.6 3 | { key: 'font.line_height', type: 'number', default: 1.6, min: 1, max: 3, doc: 'line height', unit: '× size' }, |
| `shared/settings-schema.ts:46` | OK | 0.9 0.5 1.5 | { key: 'font.preview.scale', type: 'number', default: 0.9, min: 0.5, max: 1.5, doc: 'preview text size', unit… |
| `shared/settings-schema.ts:48` | OK | 0.75 | { key: 'ui.scale', type: 'number', default: 1, min: 0.75, max: 2, doc: 'size of the whole interface', unit: '… |
| `shared/settings-schema.ts:51` | OK | 4 16 | { key: 'editor.tab_size', type: 'number', default: 4, min: 1, max: 16, doc: 'indent width', unit: 'spaces' }, |
| `shared/settings-schema.ts:54` | OK | 1000 200 60000 | { key: 'editor.autosave_delay_ms', type: 'number', default: 1000, min: 200, max: 60000, doc: 'for autosave = … |
| `shared/settings-schema.ts:88` | OK |  | c('code.keyword', '--kw', '#739696', 'if, for, return, class, …'), |
| `shared/settings-schema.ts:98` | OK | 9 | ...['#86a8e7', '#79c9ae', '#bc9fe6', '#d4c26a', '#6fc0dc', '#a6cf82', '#e2dccb', '#9c96f0'].map((d, i) => c('… |
| `shared/settings-schema.ts:128` | OUT |  | const defs = SETTINGS.filter((d) => d.key.slice(0, d.key.lastIndexOf('.')) === sec.name); |
| `shared/settings-schema.ts:130` | OUT | 36 | lines.push('', '[${sec.name}]'.padEnd(36) + '# ${sec.doc}'); |
| `shared/settings-schema.ts:133` | OUT | 18 14 | lines.push('${name.padEnd(18)}= ${tomlValue(d.default).padEnd(14)} # ${d.doc}'); |
| `shared/symname.ts:14` | OUT |  | const head = s.slice(0, i); |
| `shared/symname.ts:15` | OUT |  | return /operator\s*$/.test(head) && s.slice(i, i + 2) === '()' ? s.slice(0, i + 2) : head; |
