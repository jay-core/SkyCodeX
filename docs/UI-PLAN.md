# SkyCodeX UI: plan for a generic, clean, non-overlapping and clear interface

Proposed 2026-11-13, for the user's approval. Nothing in it is built. It extends
[UI-GENERALIZATION.md](UI-GENERALIZATION.md), which holds the root causes and the general rules.

## 0. What is measured so far

**Layers in the stylesheet** (listed by script, `src/renderer/styles.css`, 979 rules): 104 rules position an element
on top of others (94 absolute, 8 fixed, 2 sticky); 53 rules set a z-index, using 20 different values from 1 to 60,
with no named layers. Which element may cover which is therefore decided case by case.

**Real overlaps on screen:** a test-only scenario, `overlaps`, is written (in `src/renderer/smoke.ts`). It walks
every step in the grid and the metro and counts: arrows running over text, arrow labels covering squares, names or
other labels, the dotted link to the card running over text, and text on text in the metro. Its counts are the
baseline of phase 3.

First run, tinyhttp, 2026-11-13, all 30 steps, no errors:

| View | Kind | Layer rule broken | Count | Steps with it |
|---|---|---|---|---|
| Grid | the dotted link to the card runs over text (labels, chips, conditions) | connector over text | 62 | 29 of 30 |
| Grid | an arrow runs over text (call arrows over labels and chips) | connector over text | 28 | 10 of 30 |
| Grid | an arrow label covers a name or a total | annotation over content | 10 | 6 of 30 |
| Grid | an arrow label covers a square | annotation over content | 0 | 0 |
| Grid | two arrow labels overlap | annotation over annotation | 0 | 0 |
| Metro | text on text | measured while rows were still moving: not a result | 364 | 29 of 30 |

The metro moves its rows for 0.42 s after each step, and the first run measured 3 frames after the move. The
scenario now waits until no animation with an end is running (none looping was found) and keeps every sample.

Second run, tinyhttp, 2026-11-13, all 30 steps, no errors, nothing still moving after the wait:

| View | Kind | Layer rule broken | Count | Steps with it | What it runs over |
|---|---|---|---|---|---|
| Grid | the dotted link to the card runs over text | connector over text | 62 | 29 of 30 | 39 call totals (`×1`, `×2`, `×3`), 9 condition labels, 4 call labels, 10 step numbers (19 and 20 four times each, 28, 15) |
| Grid | an arrow runs over text | connector over text | 28 | 10 of 30 | call arrows 14 (over their own step's call labels, value labels, step numbers 8, 22, 25); in arrows 11 and out arrows 3 (over value and condition labels) |
| Grid | an arrow label covers a name or total | annotation over content | 10 | 6 of 30 | condition labels 7, call labels 2, a value label 1, all over call totals |
| Grid | an arrow label covers a square | annotation over content | 0 | 0 | |
| Grid | two arrow labels overlap | annotation over annotation | 0 | 0 | |
| Metro | text on text | annotation over annotation | 0 | 0 | |
| Metro | the dotted link to the card runs over text | connector over text | 0 | 0 | whether the link is drawn in the metro was not recorded |

Third run, tinyhttp, 2026-11-14, before any grid change: the same counts (62, 28, 10, 0, 0). After the first grid
correction (labels measured, kept inside the squares' area and clear of arrows), the same day: the dotted link over
text 58, arrows over text 18, labels over a name or total 0, labels over squares 0, labels over labels 0.

All 100 grid overlaps break a layer rule of §1; none is a needed overlay. The full list is in the run's report
(`report.overlaps[kind].all`). Not yet measured: the trap fixtures, the generated programs, other window sizes,
fonts and scales, and every view other than the grid and the metro.

## 1. Every layered element, sorted by whether it should overlap

Sorted by the rule's name and what is known of the element from reading the components; each is confirmed by
reading its rule and component in phase 3, before anything changes.

| Layer | May it cover other content? | Elements (CSS class) |
|---|---|---|
| **Overlays** | Yes: that is their job. They must not hide the thing they describe, must fit the window, and must close. | hover tag `.gtag`, repair reason `.rtip`, peek `.speek`, skyline tip `.sskytip`, caption `.scap`, jump letters `.shint`, menus `.appmenu` `.smenu` `.setm` `.swmenu` `.combo-list`, lists `.sfndl` `.schap` `.skeys`, find `.sfind`, search `.csearch`, windows `.cwin` `.startv` `.set`, magnifier `.magnifier`, the Tab glide `.glide`, an opened square `.gcell.pk` |
| **Frozen structure** | Yes, but only content scrolled underneath it, never content beside it. | grid headings and totals `.gcorner` `.gch` `.gfb` `.grh` `.grb` `.gtot` `.gtothd` `.gmk` `.gstrip`, header `.hdr`, sticky group and card headings `.progs .grp` `.ibx.full .in > .h` |
| **Connectors** | Only empty space, and only touching their own two ends. Never over text, a number or a name. | grid arrows `.glinks`, the dotted link to the card `.slink`, preview connectors `.links`, return route `.sret` |
| **Annotations** | No. Placed beside what they describe, never on anything else. | arrow labels `.glab`, legend `.mlegend`, step band `.sband`, compare column `.scmp`, play bar `.shiftbar` |
| **Lifts** | Only their own outline over the neighbouring gap. | `.gcell.on` `.gcell.hv`, dividers `.split` `.psplit` |
| **Dead** | Removed with the boxes view, which nothing uses. | `.bxdot` `.bxmini` `.bxroute`, and (corrected 2026-11-13 by the re-count in [UI-INVENTORY.md](UI-INVENTORY.md) §5, which found no shipped use) `.hpop` `.flab` `.slane` `.fgroup` |

## 2. The plan, in four phases

Every step of every phase follows the same five moves: say the one thing that changes; a check that fails today;
the change; the check passes and every other check is unchanged; your approval before the next step.

### Phase 1. Generic UI

Goal: every element placed the same way for a one-line program and for millions of lines, at any window size.

1. Build the checks first: the generated programs and conditions of UI-GENERALIZATION §6, and the checks for its
   rules 1 to 6, read from the drawn page.
2. The grid, class by class (UI-GENERALIZATION §2): measured text; arrows that end on what the eye sees (X1, mock-up
   approved first); offsets from the space; sizes from content with everything cut reachable; one view at every
   size, built only where visible (X6–X9); every kind of step drawn (X5).
3. The metro, the step card and right pane, the preview columns, the editor's panes, the windows and menus, in that
   order, each with the same inventory of fixed numbers first.

Done when: every check passes at every size and condition of §6, on every view.

### Phase 2. Sanitation and hygiene

Goal: one source for every size, colour and layer; no dead or duplicated UI code.

1. One spacing scale, one type scale and one set of named layers, as CSS variables. Every `z-index` uses a named
   layer from §1; every size uses the scale. A check fails on any raw number left in a rule.
   Decided by the user on 2026-11-14: the layer names keep today's values exactly, so the stacking does not change
   (where today's order breaks §1, for example the arrow label `.glab` at 4 above the opened square `.gcell.pk` at 3,
   it is listed and fixed in phase 3); the scales are real scales, every value moved to its nearest step, shown to
   the user as before-and-after screenshots first; "every size" means padding, margin, gap and font sizes in this
   step, while positions and fixed widths and heights are left to the per-view work.
2. Every colour is either a setting or on a written list of fixed colours (TEST-SUITE P5.C.2).
3. Remove what nothing reaches: the boxes view (`FlowBoxes.tsx`, `lib/flowlayout.ts`, its styles), after its tests
   are retired with your approval (P4.T.7).
   Decided by the user on 2026-11-14: every boxes-only part goes, including the parts of `shared/flowboxes.ts` and
   `flowboxes.test.ts` that only the boxes view needs; `routesBetween`, `frameWords` and `RouteInfo`, which the grid
   and the metro import, stay with their tests (P2.S16.T02, P2.S16.T05).
4. One helper per job: short names (D7), HTML escaping (D17), and the other duplicates of the register.
5. No component over 400 lines holding several concerns (`Sequence.tsx` 1,174, `GridView.tsx` 516): geometry moves
   to `lib/`, as `lib/paths.ts` began.

Done when: the hygiene checks pass and the type check, unit tests, build and every smoke scenario are unchanged.

### Phase 3. Overlaps and overlays

Goal: overlap only where §1 says it is needed; nowhere else.

1. Run the `overlaps` scenario on tinyhttp, the trap fixtures and the generated programs: the baseline count of
   every kind of overlap, per view.
2. Confirm §1 by reading each of the 53 layered rules and its component; correct the table where reading disagrees.
3. Write each layer's rule as a check:
   - connectors never cross text and touch only their ends;
   - annotations overlap nothing;
   - overlays fit the window, never hide what they describe, and close with Esc or by moving away;
   - frozen structure covers only content scrolled under it.
4. Fix until every count that should be 0 is 0, at every size of phase 1. Where a crossing cannot be avoided (two
   arrows that must cross), it crosses at a right angle with a gap, and that is written down as allowed.

Done when: every unwanted overlap is 0 on every view and size, and every overlay passes its rule.

### Phase 4. UX and aesthetics

Goal: nothing ambiguous, nothing that makes the reader stop and wonder.

1. A screen-by-screen walk with you, on tinyhttp and ThreadX, at the three window sizes. For each element, four
   questions: what does it mean; can it be mistaken for something else (a file count "1" read as step 1); does it
   say how to leave or undo; does the eye find it where it expects it.
2. Each answer that fails becomes a finding with a screenshot, and a correction shown as a mock-up before it is
   built.
3. Visual weight and rhythm: line widths readable at every scale (the arrows are 0.6 px today); alignment to the
   spacing scale; contrast at least the suite's Ct; one meaning per colour and shape, explained on the page (the
   arrow colours, the dots).
4. Every arrow and mark gets its hover (your decision of 2026-11-13).

Done when: you have walked every screen and every finding is corrected or decided.

## 3. Order

Phases 1 and 3 share their checks, so they run view by view together: the grid first, then the metro, then the
rest. Phase 2's layer names and scales come before phase 3's fixes, so overlaps are fixed once, against named
layers. Phase 4 runs on each view as soon as phases 1 to 3 are done for it, so you see finished views one by one.

1. Phase 2 steps 1 and 3 (named layers and scales; dead boxes view removed). Changed by the user on 2026-11-14:
   the named layers and the removal of the boxes view come first; the two scales move after the grid.
2. The grid: phases 1, 3 and 4. Then the spacing scale and the type scale (phase 2 step 1, P5.S.3 to P5.S.5).
   Decided by the user on 2026-11-14: fixes go class by class. Each class has one run of its checks before, all its
   fixes, and one run after; anything that got worse is traced to its fix before the next class. The checks of
   phase 1 step 1 (TEST-SUITE P5.R.4) are built first; the items needing the user's decision or a mock-up are
   reviewed with the user once, before the classes start.
   Reviewed and decided by the user on 2026-11-14: X1 and X5 as the mock-ups of 2026-11-13 show (already decided
   then); the files × files view goes, by rule 5; repeats and recursion as the mock-up shows (×N in the caller's
   square, ↻N for a call in a loop with every pass counted in times called, ↻ alone when the count is not known, ⟲ on
   the square and the row for a call back into a function still running, with a hover sentence); folded calls as a
   +N mark in the caller's square, listed by name and line on hover; file colours only separate neighbouring files,
   the key says so, and every file band shows its name; captions and messages stay until the next key, click or step,
   with no timer.
3. The metro: phases 1, 3 and 4.
4. The step card, right pane and preview: phases 1, 3 and 4.
5. The editor's panes, windows and menus: phases 1, 3 and 4.
6. Phase 2 steps 2, 4 and 5 across everything.

## 4. What this plan cannot promise

- Taste: whether a screen is pleasing is your judgement, given in phase 4.
- Systems not on this machine: Windows and Linux font rendering are checked only when those systems are available.
- Sizes beyond the generated programs: the checks prove the rules at the sizes tested and the design keeps cost flat
  by building only what is visible; millions of lines are designed for, not run.
