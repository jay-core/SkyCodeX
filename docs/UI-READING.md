# SkyCodeX UI: every line of every shipped file, read

Started 2026-11-14 at the user's request ("read all lines"). Each of the 90 shipped files in
[UI-INVENTORY.md](UI-INVENTORY.md) §1 is read in full, every line, in the order of [UI-PLAN.md](UI-PLAN.md) §3.
Each line is checked against the fault codes of UI-INVENTORY.md §2 (A, B, C, D, E+, E±, E-, F, G, O, H, W, LIMIT)
and the layer rules of UI-PLAN.md §1. A finding already in UI-INVENTORY.md is not repeated here; a new one is listed
with its line and code, and then added there. One code is new: **V**, work or memory that grows with the whole run
or project rather than with what is on screen (UI-GENERALIZATION.md rule 5), including what fails outright at a
size. And **U**, a placement or visibility that may confuse a reader, for the walk with the user in phase 4 of
UI-PLAN.md.

Line counts were taken from `wc -l` on 2026-11-13; each is confirmed by the read itself.

## Ledger

| Area | File | Lines | Read | New findings |
|---|---|---|---|---|
| grid | src/renderer/components/GridView.tsx | 516 | 516 | 134, 135 V: `Math.max(...)` over every row and column fails past the engine's argument limit · 411 V: every square of every row and column is built, in view or not (X9) · 92 G: file colours repeat after 10 files (`PAL[i % 10]`), so two files share a colour while the key says "colour = file" · 108 C: the visible height subtracts the run bars' height by its fixed value (`SKY`) · 161 G: if the links of a step fail to compute, no arrow is drawn and nothing says why · 304 C: scrolling a square into view assumes the frozen headings' sizes (`SIDE`, `TOT`, `HEAD`, `FOOT`, `SKY`) · 315 O: after the open square, one Esc clears the followed value, the route, focus and the drill together and stops play · 449 G: arrows have no hover (rule 8 of UI-GENERALIZATION.md; the user's decision of 2026-11-13) · 471 G: the grid's run bars are given no edited steps and no notes, which the metro's show · correction: `styles.css:845` (`.gstep code`) is E-, not E+: the title on its row (431) holds the step number, not the code · ~~correction: `styles.css:806` also cuts the ƒ number~~ withdrawn on re-reading in the grid review (2026-11-14): `.grh span` and `.grh` have no clip, so the ƒ number is not cut; past 30 px it runs over the name, which the D on 806 covers · new in the grid review: `styles.css:807` E-, the followed value's words (`.grh .gw`) are cut with an ellipsis and no title holds them |
| grid | src/shared/gridmodel.ts | 46 | 46 | 13 G: names are shortened to the part after the last `::`, so `A::run` and `B::run` read the same in headings and in their titles |
| grid | src/shared/gridlinks.ts | 137 | 137 | 60 E-: a condition that goes on past its line is shown cut at the line's end, with no mark · 86 LIMIT: a value is followed back through parameters one level only (`depth < 1`), then its arrow stops without a word · 115 G: only `if`, `while` and `switch` at the start of a line count as decisions on a value; `for`, `?:`, `&&`/`\|\|` and `case` do not · 130 G: the "calls" label counts callees by short name, so calls to `A::run` and `B::run` are merged into one "run ×2" |
| metro | src/renderer/components/Sequence.tsx | 1173 | 1173 | 66 G: if the what-if choices fail to compute, they vanish without a word · 95 G: jump letters are two of 19, so they repeat after 361 rows in view · 172 G: if the junctions fail to compute, every junction row vanishes without a word · 219 C: the view height subtracts the run bars by their fixed value (`SKY`) · 252 G: names shortened after the last `::`, as in the grid · 258 G: line colours repeat after 10 files while the key says "line colour = file" · 366 G: with "reduce motion" on, the return route is not drawn at all, not just drawn still · 610 V (new code): the depth spine draws every step on each redraw, whatever is in view · 920 O: the what-if menu is placed 30 px right of its row and never fitted to the window · 1007 G: a "go to" that is not a number or a walk closes with nothing said · 1060 O: the key list (26 rows) has no height limit or scroll, so it runs past a short window · 1106 V: `Math.max(...)` over every step fails past the JavaScript engine's argument limit on very large runs · 1107 V: the run bars draw every step on each redraw · 1112 G: value steps are drawn in their own colour, which the bars' key (1155) leaves out |
| metro | src/renderer/components/SeqCode.tsx | 68 | 68 | none |
| metro | src/shared/flowseq.ts | 561 | 561 | 195 V: `Math.max(...)` over every step's depth (the argument limit again) · 197 C: every row's text starts after the deepest step anywhere in the run (`metroX(maxD) + 26`), so a run deeper than about 185 levels puts all text past the right edge of a 1,000 px pane · 217 V: the layout computes every step's place each time the current step moves · 403 V: the facts of one step scan every row of the run for its calls · 445 V: the code rows walk every step whenever the detail level or folding changes · corrections: lines 182, 184, 194, 202–207 are on paths no shipped code reaches (the only caller, Sequence.tsx:216, asks for `mode: 'metro'`), so they are unused, not C or F; with them `Sequence.tsx:715–719` and `:838–842` (cross-file arrows, the C at `:841`) never draw, and the `.sarw` rules (styles.css:586–588) are unused · correction: `Sequence.tsx:749` is not a fault: findings are only ever "proved" or "possible" (line 483) · correction to UI-INVENTORY.md §1 (class G): the metro marks a new thread by its note "⇢ on a new thread" (Sequence.tsx:1081), not by dashed arrows, which never draw; `.srow.thread` (Sequence.tsx:866) has no style |
| metro | src/shared/metrofacts.ts | 202 | 202 | 29 E-: a call written over several lines is shown cut at the end of its first line, with no mark · 96, 97 E+: only the first lock and the first exception are noted on the row; the card lists all · 111 V: "pure" walks every step under the row, for the entry row the whole run · 158 V: the step card scans every step of the run three times (158, 167, 175) · 191 G: loops in the card are counted by matching `for (`, `while (` and `do {` in the text, comments and strings included |
| metro | src/shared/junctions.ts | 96 | 96 | correction: line 27 is not a cut of shown text: the first 48 characters only look up the condition's line, so it is not a fault (was E-) |
| metro | src/shared/flowcore.ts | 107 | 107 | correction (made on reading flowrun.ts): the G first written here is withdrawn. The run, which the metro and the grid draw, finds thread starts with `THREAD_START` (flowrun.ts:35), which includes ThreadX's `tx_thread_create` and other RTOS calls; this shorter list (`THREAD_RE`) only numbers the call graph (flow.ts:321). Left as a hygiene item: two lists for one fact |
| card and preview | src/renderer/components/StepPreview.tsx | 276 | 276 | 16 G: the call is underlined at the first place its name occurs in the line, which can be an earlier word of the same name · 60 G: if the step card fails to compute, the card is left out without a word · 68 G: the same for "takes" and "gives" · 92 G: the same for the junction card · 129 V: the dotted link is redrawn on every animation frame, 60 times a second, while the pane is open, with two page queries each time · 219 V: the card builds a row for every call of the function in the run, however many |
| card and preview | src/renderer/components/Preview.tsx | 313 | 313 | 272 V: every level of cards stays built (each card an editor), only hidden when out of the two shown columns · 279 G: cards are coloured by place from 8 colours, so cards 1 and 9 of a column share a colour, and so do their outlines and connectors · 300 E-: the bar under the columns does not wrap; in a narrow preview its last buttons fall past the pane's edge, which clips them (`.prev` hides overflow, styles.css:128), so they cannot be reached |
| card and preview | src/renderer/components/Card.tsx | 81 | 81 | none |
| card and preview | src/renderer/components/Magnifier.tsx | 61 | 61 | 14 V: the lens copies the whole view it magnifies (every row of the metro's view or every square of the grid), again on every change, 90 ms after it |
| card and preview | src/renderer/lib/preview.ts | 357 | 357 | 72 G: when a file cannot be read (40 gives an empty text), the card shows only the function's name or detail as its code, with nothing said · 345 G: "how deep" walks each function once, at the first place it is met, so a function reached by a short path and by a long one is counted at the short one; the tip still calls it "the deepest chain" · correction: line 129 is E-, not E±: the macros, static_asserts, lambdas and pointer calls past the card limit are dropped without being counted in "+N more" (only call cards are, line 63) |
| card and preview | src/renderer/lib/lines.ts | 56 | 56 | 46 E-: the card name at a column's edge (shown when the card is scrolled away) is drawn inside the preview's clip, so a long name is cut at the pane's edge with no way to read it · 49–54 unused: `curveSvg` is called by nothing |
| card and preview | src/renderer/lib/callmarks.ts | 28 | 28 | none |
| editor, windows, menus | src/renderer/App.tsx | 109 | 109 | none beyond the list |
| editor, windows, menus | src/renderer/main.tsx | 7 | 7 | none |
| editor, windows, menus | src/renderer/index.html | 12 | 12 | none |
| editor, windows, menus | src/renderer/settingworker.ts | 49 | 49 | none (it draws nothing) |
| editor, windows, menus | src/renderer/components/AppBar.tsx | 24 | 24 | none: the suspected G at line 18 is withdrawn: the setting's default is `true` (settings-schema.ts:55), and the settings always start from their defaults (main/settings.ts:34) |
| editor, windows, menus | src/renderer/components/AppMenu.tsx | 50 | 50 | none beyond the list |
| editor, windows, menus | src/renderer/components/CompareChip.tsx | 46 | 46 | none beyond the list |
| editor, windows, menus | src/renderer/components/CompilerWindow.tsx | 251 | 251 | 31 G (read, not run): if reading the compiler's state fails, the resource's error is not handled, so the window shows nothing useful or fails to draw · 33 O: the window's place is restored from the last session and never fitted to the window as it is now, so after a smaller window it can open partly or wholly out of sight |
| editor, windows, menus | src/renderer/components/Editor.tsx | 135 | 135 | 88 G: system headers open read-only, and typing into them does nothing and says nothing |
| editor, windows, menus | src/renderer/components/FilesPane.tsx | 138 | 138 | 20 G: if listing a folder fails, the error is not handled (the same as CompilerWindow.tsx:31) · 22 V: every row of every open folder is built, however many files · 122 E- (predicted from the widths, not seen): the pane's header holds four buttons on one line in a pane that starts 180 px wide; `.pane` hides overflow, so the last buttons are cut off and cannot be reached until the pane is widened |
| editor, windows, menus | src/renderer/components/Flow.tsx | 74 | 74 | none beyond the list |
| editor, windows, menus | src/renderer/components/FlowBoxes.tsx | 602 | 602 | the whole file is unused (nothing imports it); not judged further · 4: a comment (`// @ts-expect-error …`), which the no-comments rule forbids; reported, not changed |
| editor, windows, menus | src/renderer/components/Header.tsx | 54 | 54 | 34 G: open files are tabbed by file name only, so two files of the same name read the same (their titles hold the paths) · 47 U (new code): the window's own buttons (minimise, maximise, close) are fully transparent until the pointer is over them (styles.css:47–48) |
| editor, windows, menus | src/renderer/components/Palette.tsx | 50 | 50 | none beyond the list |
| editor, windows, menus | src/renderer/components/PlayControls.tsx | 14 | 14 | none |
| editor, windows, menus | src/renderer/components/Programs.tsx | 108 | 108 | none beyond the list |
| editor, windows, menus | src/renderer/components/SearchPanel.tsx | 56 | 56 | none beyond the list |
| editor, windows, menus | src/renderer/components/SettingChip.tsx | 75 | 75 | none beyond the list |
| editor, windows, menus | src/renderer/components/Settings.tsx | 274 | 274 | 10 G: the pages list their sections by name, and the schema's `compiler` section (settings-schema.ts:28) is on no page, so its settings are never shown here (the compiler window sets some of them) |
| editor, windows, menus | src/renderer/components/Split.tsx | 17 | 17 | none |
| editor, windows, menus | src/renderer/components/StartWindow.tsx | 79 | 79 | correction: `styles.css:166` (the recent folder's path) is E+, not E-: its row's title holds the full path (line 51) |
| editor, windows, menus | src/renderer/lib/actions.ts | 213 | 213 | 47, 69, 90, 109 G: rename, fixes, find references and go to symbol do nothing and say nothing while clangd is not ready (and rename also when the cursor is on no word) · correction: line 118 is E+, not E-: typing narrows the symbol search, so every symbol can be reached · correction: `Palette.tsx:18` is E+, not E-: typing filters every item before the first 80 are shown |
| editor, windows, menus | src/renderer/lib/api.ts | 27 | 27 | none |
| editor, windows, menus | src/renderer/lib/cm.ts | 85 | 85 | none: the C++ fallback at line 61 is never used by the editor, because `syntaxFor` returns an empty grammar for plain text (langs.ts:49), not nothing (the G suspected here is withdrawn) |
| editor, windows, menus | src/renderer/lib/flow.ts | 506 | 506 | 460 G: when clangd gives no syntax tree for a function, its body is taken as empty, so the run shows it calling nothing, with no word |
| editor, windows, menus | src/renderer/lib/flowlayout.ts | 75 | 75 | the whole file is unused (nothing imports it) |
| editor, windows, menus | src/renderer/lib/flowstore.ts | 358 | 358 | 141, 267, 276 V: the whole run is turned into JSON text to compare it, on each check, each line-up and each time it is shown |
| editor, windows, menus | src/renderer/lib/fonts.ts | 54 | 54 | none (where the font list cannot be read, the combo's hint says so, Settings.tsx:204) |
| editor, windows, menus | src/renderer/lib/goto.ts | 151 | 151 | correction: line 95 is E-, not LIMIT: the peek of a definition stops at 40 lines with no mark that more follows · 96 G: the end of a peeked definition is found by counting `{` and `}`, those inside strings and comments included |
| editor, windows, menus | src/renderer/lib/hlcode.ts | 16 | 16 | 6 G: the one-line highlighter used in the metro and the step card colours `//` comments but not `/* … */`, which are drawn as code |
| editor, windows, menus | src/renderer/lib/hwheel.ts | 6 | 6 | none |
| editor, windows, menus | src/renderer/lib/i18n.ts | 3 | 3 | none |
| editor, windows, menus | src/renderer/lib/langlsp.ts | 105 | 105 | none |
| editor, windows, menus | src/renderer/lib/langs.ts | 56 | 56 | none |
| editor, windows, menus | src/renderer/lib/lsp.ts | 298 | 298 | 101 G: clangd's "Unable to handle compilation" error is filtered out of the editor, so the one message that says why a file is not understood is never shown · 232 G: a function written on one line is not a function for the preview (`end.line > start.line`), so with the cursor in it the preview says the cursor is outside any function |
| editor, windows, menus | src/renderer/lib/motion.ts | 14 | 14 | none |
| editor, windows, menus | src/renderer/lib/paths.ts | 10 | 10 | none |
| editor, windows, menus | src/renderer/lib/power.ts | 14 | 14 | none |
| editor, windows, menus | src/renderer/lib/refresh.ts | 33 | 33 | none |
| editor, windows, menus | src/renderer/lib/repair.ts | 175 | 175 | none beyond the list |
| editor, windows, menus | src/renderer/lib/search.ts | 31 | 31 | none beyond the list |
| editor, windows, menus | src/renderer/lib/seqtext.ts | 32 | 32 | 29 V: a file that cannot be read is forgotten after the failure, so every later look-up reads it again; meanwhile the metro shows its rows with no code text, and nothing says why |
| editor, windows, menus | src/renderer/lib/store.ts | 214 | 214 | 60 H: one message at a time: a new one replaces the one on screen at once, so a message can vanish unread · 188 G: a file changed on disk while it has unsaved edits is marked (`diskChanged`), but nothing draws the mark; only a 7-second message says so (189) |
| stylesheet | src/renderer/styles.css | 892 | 892 | 168, 356–357 U: the remove button of a recent folder and the close button of a file tab are transparent until the pointer is over them · 464: in the metro the call bars and cross-file arrows are hidden (`display: none`), so `.sbar` (584–585) and `.sarw` (586–588) never show, and `Sequence.tsx:835–837` builds bars no one sees · 840 G: the three arrow colours of the grid (in, out, call) are explained nowhere on the page; the grid's key (GridView.tsx:375–383) covers squares and dots only · 858, 862 C: the totals column and the call-count row hide what scrolls under them with a shadow of a fixed 60 px and 90 px |
| shared logic | src/shared/color.ts | 24 | 24 | none |
| shared logic | src/shared/defpick.ts | 16 | 16 | none |
| shared logic | src/shared/entries.ts | 22 | 22 | none |
| shared logic | src/shared/flowalign.ts | 146 | 146 | 69 V: "lines changed" builds a table of every line of the old version against every line of the new (rows × columns numbers), so a long function costs memory by the square of its length |
| shared logic | src/shared/flowboxes.ts | 306 | 306 | unused apart from `routesBetween` and `frameWords` (243–257), which hold no fault |
| shared logic | src/shared/flowfacts.ts | 157 | 157 | 25–26 G: locks and allocations are recognised by fixed name lists, so a lock or an allocation through any other API is not noted, in the metro or the card |
| shared logic | src/shared/flowpairs.ts | 125 | 125 | 4–10 G: what is opened and must be closed (locks, memory, files, folders) is recognised by fixed name lists; any other API's pairs are not checked |
| shared logic | src/shared/flowrun.ts | 808 | 808 | 52 G: when the analysis of a function fails, every call in it is marked `approx`, which the metro and the card show as "~ in a macro" / "inside a macro" (Sequence.tsx:311, flowseq.ts:411), so a failure reads as a macro · 804–805 G: when the ways out or the open-and-close pairs of a function fail to compute, they are left out without a word · 725: a function with no analysis is listed in `run.missing`; where that list is drawn was not traced |
| shared logic | src/shared/flowvalues.ts | 260 | 260 | none (it draws nothing) |
| shared logic | src/shared/flowwatch.ts | 79 | 79 | none |
| shared logic | src/shared/levelmerge.ts | 13 | 13 | none |
| shared logic | src/shared/paths.ts | 1 | 1 | none |
| shared logic | src/shared/repair.ts | 241 | 241 | none beyond the list |
| shared logic | src/shared/search.ts | 26 | 26 | none beyond the list |
| shared logic | src/shared/settings-schema.ts | 168 | 168 | 92 G: the colour setting "parameters" (`--par`) is used by no rule (searched in the renderer), so changing it changes nothing · 101 G: the colour setting "races and other risks" (`--flow-risk`) feeds `--risk` (styles.css:446), which no rule uses, so it changes nothing · 63: `compiler.path` can be set only in settings.toml (see Settings.tsx:10) · and from flowrun.ts:725: `run.missing` is read by nothing in the renderer, so functions SkyCodeX could not analyse are never named on screen (G) |
| shared logic | src/shared/symname.ts | 31 | 31 | none |
| main process | src/main/compilers.ts | 123 | 123 | 103 and 115 are already in UI-INVENTORY.md (LIMIT and E-), so not new · 14 G: a compiler that does not answer `--version` within 5 s is passed over without a word |
| main process | src/main/datadir.ts | 61 | 61 | none |
| main process | src/main/fetch-clangd.ts | 50 | 50 | none (a build script; it draws nothing) |
| main process | src/main/files.ts | 110 | 110 | 60 G: folders named build, out, cmake-build-…, third_party, external or vendor are skipped when files are listed, so their files never appear in "find a file" or in the folder search, and nothing says so (the tree still shows them) |
| main process | src/main/langpacks.ts | 277 | 277 | 95 LIMIT: only rust-analyzer's last 8 releases are looked at · 108 LIMIT: only Rust's last 5 releases · 40 G: when the server does not give a size, the size is taken as 0 (used at 115 and 130); how the pack list shows that 0 was not traced |
| main process | src/main/lsp.ts | 385 | 385 | 69, 74 and 99 are already in UI-INVENTORY.md (LIMIT), so not new · 67 G: folders named third_party, third-party or vendor are left out of that database, so their files are not understood either, with no word (as files.ts:60) |
| main process | src/main/main.ts | 668 | 668 | 443 V: the flow's fingerprint reads the size and time of every source file in the project each time it is checked |
| main process | src/main/packs.ts | 199 | 199 | 40 G: an installed pack whose manifest cannot be read is left out of the list without a word · 78 LIMIT: only the newest 40 releases of clang and clangd are looked at · 144 G: the free-space message rounds up to whole gigabytes, so a pack that needs 50 MB is said to need "about 1 GB" |
| main process | src/main/search.ts | 31 | 31 | 17 (part of the LIMIT at line 5): files over 4 MB are skipped, and the summary does not say how many |
| main process | src/main/settings.ts | 101 | 101 | none |
| main process | src/main/targets.ts | 33 | 33 | none beyond the list |
| main process | src/main/terminal.ts | 43 | 43 | none |
| main process | src/main/unpack.ts | 258 | 258 | none (refused entries are counted and said, packs.ts:173) |
| main process | src/preload/preload.ts | 114 | 114 | none |

Read: 14,546 of 14,546 lines, 90 of 90 files. The sum of the Lines column, added row by row, is 14,546.
Correction: the earlier progress line said 12,207 lines for the first 76 files; added row by row they are 12,093.
Merged into UI-INVENTORY.md on 2026-11-14: §2 (counts) and §3b (the new rows, the moves and the withdrawals).
