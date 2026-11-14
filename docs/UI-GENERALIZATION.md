# SkyCodeX UI: why placement breaks, and the rules that make it hold for any codebase

Written 2026-11-13. Nothing here is built yet except where marked.

## 1. The rule (the user's, 2026-11-13)

Every part of the UI is placed generically and reliably, for any codebase, from a one-line program to millions
of lines, and its placement does not depend on the code shown or on the window size. It applies to everything
in the UI, not only the grid.

## 2. Why the grid was unreliable: the evidence

Every number other than 0, 1 and 2 in `src/renderer/components/GridView.tsx` was listed by a script: 105
numbers on 48 lines. `src/shared/gridlinks.ts` and `src/shared/gridmodel.ts` have none. Each of the 48 lines is
in exactly one class below.

| Class | What it assumes | Lines | Faults it caused |
|---|---|---|---|
| A. Text size estimated from character count | every glyph has one width, at one font and scale | 187 (5.6 px a character), 250 (6.3), 345 (7.5) | labels and the hover tag overlap or land on squares with other fonts, sizes, scales and non-ASCII names (U3) |
| B. The container's geometry used for its content | what the eye sees is the whole slot | `rectOf` (137) used for arrow ends (83–85) | arrows stop up to 23 px short of the numbered box (X1) |
| C. Fixed pixel offsets that do not scale with the space | there is always room for them | 79, 80, 188, 189, 193, 257, 258, 260, 261, 313 | arrows shifted 3 px more each, up to 21 px off a 19–28 px row (X2) |
| D. Fixed sizes for content of any length | names, counts and lists stay short | 16 (`SIDE`, `HEAD`, `TOT`, `FOOT`, `OPEN_W`, `LINE_H`, `SKY`), 132, 134, 135, 341, 346, 347, 509; CSS `.grh` 190 px, `.grh b` 150 px, `.gch` 48 px with 2 lines, `.gtot` 74 px | long names cut; two-line headers clipped |
| E. Caps that hide information | a few items are enough | 152 (3 most called), 186 (labels cut at 64 characters), 248 (tag lists 4 steps then "…"), 436 (8 dots), 495 (routes 1–9 by key) | information out of reach (V-list) |
| F. A size threshold that switches the view | large runs need a different picture | 16 (`BIG = 1800` cells) | above 1,800 cells a files × files view, its "1" read as a step, and no visible way back (X6–X8) |
| G. Structural cases left out | every step has a square | 176–178 (no square, no arrows) | no arrows for the first step (X5); several calls into one square share one arrow (V22) |
| H. Information on a timer | the reader is quick | 266 (caption 2.6 s), 349 (message 3 s) | messages vanish (V18, V19) |
| Not a fault | relative weights and encodings | 36, 44, 48, 50, 51, 54 (route search), 66 (corner radius), 115 (first size, replaced at once), 142, 143, 153, 237, 288, 323, 324, 330, 391, 392, 431, 453 | none |

The common root: each value was chosen to look right on the samples the views were built against (tinyhttp and
the smaller ThreadX programs). Nothing measured what was drawn, and nothing tested other lengths, counts, fonts,
scales, window sizes or run sizes. Every class above is a value that is right for one size and wrong for others.

## 3. The general rules

1. **Measure, never estimate.** A label, tag or box is placed from its drawn size, read after it is drawn, or
   from the actual font's measured text width. Never from a character count. (Fixes class A.)
2. **Place by what the eye sees.** Arrows, outlines and tags attach to the element the reader sees (the numbered
   box, the name), not to the slot that holds it. (Class B.)
3. **Offsets come from the space available.** Spacing between parallel lines, label gaps and detours are worked
   out from the row or column size and the number of items that share it, with a limit that can never exceed
   the space. (Class C.)
4. **Size from content, within bounds; whatever is cut stays reachable.** Widths and heights follow the content
   up to a bound; past it, the element scrolls or shows the full text on hover. (Classes D and E; the standing
   no-silent-clipping rule.)
5. **One view at every size.** No view changes into another at a size. Cost is kept flat by building only what
   is on screen (virtual rows and columns), not by switching views. (Classes F and X9.)
6. **Every kind of item has a defined drawing.** The entry step, a repeat, a call through a pointer, a value,
   a folded call, an empty square, several calls in one square, a call to itself: each one written down and
   tested. (Class G.)
7. **Nothing that matters disappears on a timer.** A message that times out can be found again. (Class H; asked
   of the user before, not decided.)
8. **Every arrow says what it is on hover.** Whatever an arrow shows (a call, a value coming in, a result going
   out), its hover box says it (the user's decision of 2026-11-13).

## 4. The same patterns across the whole UI

A pattern scan of all 50 renderer files and the stylesheet (8,503 lines), 2026-11-13. These are lines that match
a pattern, not yet read one by one, so some are not faults. Superseded the same day by the full re-count in
[UI-INVENTORY.md](UI-INVENTORY.md): 90 shipped files, 1,573 lines, each read and given a verdict.

| Pattern | Lines | Most in |
|---|---|---|
| text size estimated from a character count | 6 | GridView, Preview, Sequence, actions, lines |
| text or lists cut at a fixed number | 56 | actions, flowstore, Sequence, GridView, CompilerWindow |
| a size threshold | 16 | GridView, Sequence, flow, lsp, preview |
| fixed pixel sizes | 560 | `styles.css` (512), GridView (13), Preview (9) |
| one-line text hidden when too long (CSS) | 43 | `styles.css` |
| information on a timer | 6 | GridView, Sequence, SeqCode, FlowBoxes, flowstore, motion |

Each line will be read and put in a class of section 2, view by view: the grid, the metro, the step card and
right pane, the preview columns, the editor's own panes, the windows and menus.

## 5. Mock-ups (X1 and X5, the user's choices of 2026-11-13)

Made on the running app with tinyhttp, by the test-only smoke scenario `arrows-mock`, which redraws the arrows
by the proposed rules over the real grid. In `docs/mockups/flow/grid-arrows/`, before and after:

- `mock-step5-*`: four call arrows from `start` end on the numbered boxes 10, 6, 9 and 7, on their middles
  (rule 2). Before: at the slot edges, up to 23 px short.
- `mock-step1-*`: `main`, which has no square, gets arrows from its column heading down to 2, 4, 5 and 30
  (rule 6). Before: none.
- `mock-step10-*`, `mock-step23-*`: steps with values coming in and going out.

The mock-ups draw the lines 1 px wide; the app draws them 0.6 px wide.

## 6. The tests that prove the rules (P5.R, made specific)

Generated C programs, one dimension changed at a time, each run through every step in the grid and the metro,
with every check read from the drawn page:

| Dimension | Values |
|---|---|
| Function name length | 1, 10, 40, 120, 300 characters; ASCII and wide non-ASCII |
| Calls in one square | 1, 2, 3, 4, 8, 50 |
| Calls made by one step | 0, 1, 5, 20 |
| Step-number digits | 1, 3, 5 |
| Cells in the grid | 4, 400, 1,800, 1,801, 10,000, 90,000 |
| Kinds of step | entry, step, repeat, indirect, value, folded, call to itself |
| Files | 1, 10, 11, 60 (the file palette has 10 colours) |
| Font size, interface scale, window | 9 / 13 / 24; 0.75 / 1 / 2; 760×480, 1440×900, 2560×1440 |

Checks, each with no tolerance beyond 1 px: every arrow ends on its target's box and middle; the entry step has
its arrows; no label, tag or box overlaps another; every cut text is reachable; every arrow has a hover; the same
view at every size; the number of elements built stays within what is on screen. The `arrows` smoke scenario,
built 2026-11-13, is the first of these checks.

## 7. Order of work, each step approved by the user

1. Build X1 (measured ends) and X5 (arrows from the entry heading) as the mock-ups show; the `arrows` check must
   then pass with 0 faults on tinyhttp.
2. The generator for section 6, and the checks for rules 1–6 on the grid.
3. The grid made general, class by class (A, C, D, E, F, G), each class shown failing first.
4. The same for each other view, in the order of section 4.
