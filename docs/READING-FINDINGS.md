# SkyCodeX: findings from reading the code

## Status

- **What this is.** A register of every defect and design weakness seen while reading the source for the coverage audits of `docs/TEST-SUITE.md` on 2026-11-09, 2026-11-10 and 2026-11-11.
- **What it is not.** None of these is a test result. Nothing here was run. Every entry is a prediction from reading, with the place in the code it comes from. It becomes a finding only when its unit in `docs/TEST-SUITE.md` runs and fails. Nothing here has been fixed (rule R13).
- **Line numbers** are those of the files as they were when read (working tree of branch `feat/editor-v1`, 2026-11-11).
- **Files read in full:** the 22 files of `src/shared/`, the 24 of `src/renderer/lib/`, the 24 of `src/renderer/components/`, `App.tsx`, `main.tsx`, `settingworker.ts`, `src/preload/preload.ts`, and in `src/main/`: `lsp.ts`, `compilers.ts`, `targets.ts`, `files.ts`, `settings.ts`, `main.ts`, `search.ts`. 81 files.
- **Read on 2026-11-12 for Part 3:** the six files of `src/main/` not read before, and `src/build/check-smoke.mjs` and `make-icon.cjs`. 31 files were read in full that day; see `docs/TEST-SUITE.md` P3.0.2.
- **Product code is 95 files** (counted on 2026-11-12, `src/build/` included), not the 91 used before.
- **Files not read,** so not covered by this register: `src/renderer/index.html` and `styles.css`; `smoke.ts` and `probe.ts` beyond their import lines; `src/tests/`; `src/concepts/`.

## Part 2: engine correctness (75 entries)

### Calls and definitions

| # | Where | What the code does | Unit |
|---|---|---|---|
| 1 | `src/shared/defpick.ts:1–5`, `9–15` | The A1 fix counts only files named in the compile database. A definition compiled through `#include "impl/f.c"` is dropped in favour of another listed copy. | P2.S2.T25 |
| 2 | `src/shared/defpick.ts:4` | When no copy is in the build, every copy is kept. A project's own `printf` that the build never compiles is still followed. | P2.S2.T27 |
| 3 | `src/renderer/lib/flow.ts:227–244`, `src/shared/flowrun.ts:753–757` | A method with the same name in a derived class is listed as an override without checking that the call is virtual. | P2.S2.T38 |
| 4 | `src/renderer/lib/flow.ts:118–121`, `131–139`, `237–238` | Classes are matched by the last part of their name, so `a::Base` and `b::Base` are one class. | P2.S2.T37 |
| 5 | `src/renderer/lib/flow.ts:256` | The stable pick among several definitions applies only to plain functions in `.c` files. | P2.S2.T39 |
| 6 | `src/renderer/lib/lsp.ts:251`, `src/main/lsp.ts:67`, `src/main/files.ts:60` | Three rules decide which folders belong to the project, and they list different folders. A `main` under a folder the file scan skips (`build/`, `out/`, `external/`, `vendor/`, `third_party/`) is never listed as a start. | P2.S1.T17, P2.S2.T40 |
| 7 | `src/renderer/lib/lsp.ts:251`, `src/renderer/lib/api.ts:27`, `src/renderer/lib/flow.ts:66`, `85`, `src/renderer/lib/actions.ts:117` | "Inside the folder" is tested as a text prefix, so `app-common/` counts as inside `app/`. The correct form is at `src/renderer/components/FilesPane.tsx:12`. | P2.S2.T44, P2.S13.H2 |
| 8 | `src/renderer/lib/flow.ts:41`, `src/renderer/lib/lsp.ts:271`, `src/main/lsp.ts:68`, `316`, `src/main/files.ts:53`, `src/renderer/lib/langs.ts:28`, `src/renderer/components/Editor.tsx:14` | At least seven lists decide which files are C-family, and they differ. `.m` and `.mm` are missing from the file scan, so a `main` there is never listed. | P2.S1.T16, P2.S13.H8 |
| 9 | `src/main/files.ts:56`, `62`, `src/main/lsp.ts:69`, `74`, `99`, `src/renderer/lib/flow.ts:80` | Limits (20,000 sources, 12 folders deep, 400 include folders, 2,000 API functions) are reached without saying so. | P2.S1.T15, P2.S2.T41 |
| 10 | `src/renderer/lib/flow.ts:55–72` | Entry points are found in the text before macros and `#if` are applied: a `main` in disabled code is listed, one written by a macro is missed. | P2.S1.T03, P2.S1.T04 |
| 11 | `src/main/lsp.ts:361–385` | A file clang does not know by its extension (`.inl`, `.ipp`, `.tcc`) is read as a C++ header, even in a C project. | P2.S2.T42 |
| 12 | `src/renderer/lib/flow.ts:67`, `288` | Build-target names are used only in the "how they connect" view and only with more than one `main`; the program list names programs from their files. | P2.S1.T14 |
| 13 | `src/renderer/lib/flow.ts:85–86` | Public headers count only when `include/` is in the first two folder levels. | P2.S1.T18 |

### Function shape

| # | Where | What the code does | Unit |
|---|---|---|---|
| 14 | `src/shared/flowrun.ts:501–508` | Code after an early exit is marked conditional only when the exit is in a plain `if`. After a `switch` case, a nested `if` or a loop that returns, it is shown as always running. | P2.S3.T28 |
| 15 | `src/shared/flowrun.ts:491–500` | A call that never returns, inside an arm, is not treated as an exit for the code after it. | P2.S3.T02 |
| 16 | `src/shared/flowrun.ts:406`, `418–425` | The operands of a built-in operator (`a() + b()`) are shown in a fixed order; only call arguments are marked unsequenced. | P2.S3.T25 |
| 17 | `src/shared/flowrun.ts:37`, `370–374`, `378–379` | The C++17 right-before-left order of assignment is applied to C and to older C++ too. | P2.S3.T26 |
| 18 | `src/shared/flowrun.ts:316–317`, `534–548` | A `do … while` loop's text is cut at the last "while" in it, even inside a name; a `;` in a comment splits a `for` header. | P2.S3.T27 |
| 19 | `src/shared/flowrun.ts:346–351` | A lambda's steps are placed where it is written, not where it is called. | P2.S3.T19 |
| 20 | `src/shared/flowfacts.ts:22`, `src/shared/flowrun.ts:34` | `__attribute__((noreturn))` is recognised only when it stands alone in its parentheses. | P2.S3.T23 |
| 21 | `src/shared/flowrun.ts:549–558` | A fixed loop count is stated when a macro hides a `return`, or a project function never returns; `i != 3` starting from 5 gives 0. | P2.S8.T21 |
| 22 | `src/shared/junctions.ts:25–31` | A junction's line is found by searching for the condition's text, so a comment repeating it wins. | P2.S3.T22 |

### What functions change

| # | Where | What the code does | Unit |
|---|---|---|---|
| 23 | `src/shared/flowfacts.ts:59–68` | A write to an element of a global array, through a pointer parameter, or by a library call such as `memset` is recorded as a read or not at all. | P2.S5.T01, P2.S5.T02, P2.S5.T05 |
| 24 | `src/shared/flowfacts.ts:53`, `74` | A write to a static local is not reported; a thread-local is reported as a plain global. | P2.S5.T08 |
| 25 | `src/shared/flowfacts.ts:74` | A global whose type begins with `const` is skipped, including a pointer to const, which can be written. | P2.S5.T17 |
| 26 | `src/shared/flowfacts.ts:33–37`, `59–68` | `m.x = 1` is recorded as a read of the member `m`. | P2.S5.T18 |
| 27 | `src/shared/flowfacts.ts:41–42` | Whether a function returns a value is judged from its type as written: a typedef of `void` counts as a value, a returned function pointer as none. | P2.S5.T20, P2.S5.T21 |
| 28 | `src/shared/flowfacts.ts:83–86` | A result is seen as thrown away only when the call stands directly in a block; `if (c) f();` is missed. | P2.S6.T13 |
| 29 | `src/shared/flowfacts.ts:75–82` | A lock is stated without the lines it is held between; an allocation is named by the function called, not the type. | P2.S5.T13, P2.S5.T14 |
| 30 | `src/shared/flowseq.ts:399` | A throw is graded proved, where the design words it "may throw". | P2.S5.T12 |

### Text shown

| # | Where | What the code does | Unit |
|---|---|---|---|
| 31 | `src/shared/metrofacts.ts:20–30`, `81` | A call written over several lines is shown cut at the end of its first line, or rebuilt from its arguments. | P2.S6.T01 |
| 32 | `src/shared/metrofacts.ts:43–45` | `return (f(x));` is labelled "argument of return". | P2.S6.T12 |
| 33 | `src/shared/metrofacts.ts:191` | Loops in a body are counted from its text: a `do … while` counts twice, loops in comments and strings count. | P2.S6.T19 |
| 34 | `src/shared/metrofacts.ts:141–150` | Library calls are found from the text; block comments are not removed, and `#if defined(X)` counts. | P2.S6.T18 |
| 35 | `src/shared/metrofacts.ts:171–172` | The signature is cut at the first `{`, so a default value written `{}` cuts it short. | P2.S6.T17 |
| 36 | `src/shared/gridlinks.ts:39–54` | The step a passed value "comes from" ignores plain assignments in between. | P2.S6.T15 |
| 37 | `src/shared/gridlinks.ts:108–118` | Decisions that read a result are found line by line from the text. | P2.S6.T16 |
| 38 | `src/shared/flowseq.ts:424–433` | A banner comment is quoted as punctuation. | P2.S6.T10 |
| 39 | `src/renderer/components/StepPreview.tsx:16` | The call marked in a line is the first place its name appears, even inside a longer name. | P2.S6.T20 |

### Pointers and threads

| # | Where | What the code does | Unit |
|---|---|---|---|
| 40 | `src/shared/flowcore.ts:82–85`, `src/renderer/lib/flow.ts:475–482` | The candidates of a pointer call are every name that equals a function's name, with no check of type, cut at 12 without saying so. | P2.S7.T01, P2.S7.T09, P2.S7.T11 |
| 41 | `src/shared/flowcore.ts:84` | An address taken through a cast or a `?:` is missed. | P2.S7.T10 |
| 42 | `src/shared/flowrun.ts:386–390`, `407` | Every function named among a thread start's arguments is run as a thread, including one passed as data. | P2.S7.T08 |
| 43 | `src/shared/flowrun.ts:35` and `src/shared/flowcore.ts:107`; `src/shared/flowfacts.ts:25` and `src/shared/flowpairs.ts:5–6`; `src/shared/flowfacts.ts:26` and `src/shared/flowpairs.ts:7` | Thread starts, locks and allocations each have two tables with different entries. | P2.L.4 |
| 44 | `src/shared/flowrun.ts:388`, `src/shared/flowfacts.ts:80–82` | The tables match on the bare name, so a project function of the same name is taken for the library's. | P2.L.3 |

### Derived views

| # | Where | What the code does | Unit |
|---|---|---|---|
| 45 | `src/shared/flowseq.ts:379–380` | Inside a loop of unknown count, a step is said to run "once per pass" even when a counted loop inside repeats it. | P2.S8.T10 |
| 46 | `src/shared/flowseq.ts:373–378` | A static initializer inside a counted loop is said to run "at most N times"; it runs once. | P2.S8.T11 |
| 47 | `src/shared/flowseq.ts:516–518`, `src/shared/flowrun.ts:717–721` | A function's body is laid out once, so when it runs on two threads the second is not seen and the race is missed. | P2.S8.T22 |
| 48 | `src/shared/flowseq.ts:524–525`, `src/shared/flowwatch.ts:53–61` | Globals are compared by name, so two `static` variables of one name in different files are one variable. | P2.S8.T23 |
| 49 | `src/shared/flowseq.ts:520`, `528–530`, `534` | A use counts as locked when its function holds any lock anywhere, and a race needs both sides unlocked. By section 8b, which governs (the user's decision of 2026-11-12), a lock on one side or two different locks is still a race, so both units are predicted to fail. The race's text says "no lock on either side" where section 8b's label is "two threads, no common lock". Section 10b of the design said "no lock in either function" (the S3 finding against the design document); it was corrected on 2026-11-12. | P2.S8.T12, P2.S8.T13 |
| 50 | `src/shared/flowpairs.ts:30–42` | Memory freed through another name, a null check after `malloc`, and a failed lock are each reported as left open. | P2.S8.T24 |
| 51 | `src/shared/flowseq.ts:246–249`, `333` | The what-if question for a `case` arm asks whether the `switch` "is false"; the walkthrough words the right side of `\|\|` as if the left were true. | P2.S8.T19 |
| 52 | `src/renderer/components/Sequence.tsx:446–447` | The tour says "once" for a step under a condition and counts only the innermost loop. | P2.S8.T27 |
| 53 | `src/renderer/components/Sequence.tsx:415–416`, `447`, `625`, `648`, `654`, `1142`, against `871` | The header, chapter list, find list, tour and run-bar tip show the function's number where the rows show the step's number. | P2.S4.I10 |
| 54 | `src/renderer/components/Sequence.tsx:416`, `992` | The find list is cut at 9 and the watch list at 12 without saying so. | P2.S8.T28 |
| 55 | `src/shared/flowseq.ts:288–289`, `src/renderer/components/Sequence.tsx:482`, `493–494` | A walk's link keeps only its last 40 places; the walkthrough waits 300 ms for file texts and writes empty lines if they are late. | P2.S11.I13, P2.S11.I14 |
| 56 | `src/shared/flowseq.ts:125`, `154` | "Another pass" is offered at the last pass of a counted loop, where it is refused. | P2.S11.I11 |
| 57 | `src/renderer/components/StepPreview.tsx:77–83` | The names said to decide a junction are picked from the condition's text by pattern, so a member name is treated as a variable. | P2.S8.T26 |
| 58 | `src/shared/flowseq.ts:278–284` | Every chapter longer than a quarter of the run is split; the design says "the largest". Which is meant is open. | P2.S8.T18 |

### Versions, settings and the kept picture

| # | Where | What the code does | Unit |
|---|---|---|---|
| 59 | `src/renderer/lib/flowstore.ts:205–211`, compared with `180–189` | A comparison with an older version never looks at that version's compile errors; a setting does. | P2.S9.T16 |
| 60 | `src/renderer/settingworker.ts:28–35` | After 60 seconds the last run is used even if it never settled. | P2.D.1 |
| 61 | `src/renderer/lib/flowstore.ts:323–343` | Unsaved-change marks compare positions from the built text with lines of the editor's text. | P2.S9.T14 |
| 62 | `src/main/main.ts:439–447`, `src/main/files.ts:53`, `60` | The kept picture's fingerprint leaves out skipped folders (`vendor/`, `external/`, `build/`, `out/`, `third_party/`) and some file types. | P2.I.3 |
| 63 | `vite.config.ts:7–8` | The analyser stamp covers `src/shared` and `src/renderer/lib` only, not `src/main` or the components. | P2.I.6 |

### Programs

| # | Where | What the code does | Unit |
|---|---|---|---|
| 64 | `src/renderer/lib/flow.ts:275` | Any method named `start` called with a string counts as starting a program. | P2.S12.T06 |
| 65 | `src/renderer/components/Programs.tsx:26`, `30`, `70`, `81` | The limit of 20 programs is stated only in a button's tooltip; the result says how many were traced, not that others were left out. | P2.S12.T05 |
| 66 | `src/renderer/components/Programs.tsx:84` | Shared files are shown by file name alone. | P2.S12.T04 |

### Repair

| # | Where | What the code does | Unit |
|---|---|---|---|
| 67 | `src/main/main.ts:407`, `413`, `424` | Errors are counted after cutting the list to 12; tries stop at 40 or 25 seconds, and an untried error reads as "no fix found". | P2.S10.T10, P2.S10.T11 |

### Preview cards, go to definition, search

| # | Where | What the code does | Unit |
|---|---|---|---|
| 68 | `src/renderer/lib/preview.ts:315–351`, `src/renderer/components/Card.tsx:61` | The card says "the deepest chain"; the number is the depth at which each function is first met. | P2.S14.T05 |
| 69 | `src/renderer/lib/preview.ts:61`, `src/renderer/components/Card.tsx:58`, `75–76`, `src/renderer/components/Preview.tsx:283` | Every file outside the project is called standard-library code. | P2.S14.T09 |
| 70 | `src/renderer/lib/lsp.ts:232` | A function written on one line is never "the function under the cursor", so it gets no cards. | P2.S14.T08 |
| 71 | `src/renderer/lib/preview.ts:69`, `129` | A card's text stops at 400 lines; cards of other kinds are cut at the limit with no "+N more". | P2.S14.T03, P2.S14.T04 |
| 72 | `src/renderer/lib/goto.ts:81–88`, `92–101` | The reason "inside an `#if`" comes from a scan of the text; the peek stops at 40 lines. | P2.S15.T02, P2.S15.T03 |
| 73 | `src/renderer/lib/actions.ts:94–98` | The references list takes each line's text from disk, while the line numbers are for the unsaved text. | P2.S15.T04 |
| 74 | `src/main/search.ts:5`, `17–18`, `20`, `25–29` | Folder search skips files over 4 MB, binary files and skipped folders without saying so; counts one hit per line; names the wrong cap; its hit order depends on timing. | P2.S13.H9 |
| 75 | `src/shared/symname.ts:1–5`, `26` | `operator<=>` loses its name when template brackets are removed. | P2.S13.H7 |

## Part 1: code design (31 entries)

### Unreachable code and layer breaks

| # | Where | What was seen | Unit |
|---|---|---|---|
| D1 | `src/renderer/components/FlowBoxes.tsx` (602 lines) | No file read imports it: not `main.tsx:1–4`, `App.tsx:1–26`, `Flow.tsx:1–9`, the other 22 components, the 24 files of `src/renderer/lib/`, nor the import lines of `smoke.ts:1–22` and `probe.ts:1–16`. Fixed 2026-11-14: the file was removed (UI-PLAN phase 2 step 3; checked by P5.S.6). | P1.D4.4.a |
| D2 | `src/shared/flowboxes.ts`, `src/renderer/lib/flowlayout.ts` | Of `flowboxes.ts`, live code uses only `routesBetween` and `frameWords` (`GridView.tsx:10`, `Sequence.tsx:8`); the rest is used only by `FlowBoxes.tsx`. No product file read imports `flowlayout.ts`. Fixed 2026-11-14: `flowlayout.ts` was removed and `flowboxes.ts` cut to `RouteInfo`, `routesBetween` and `frameWords` (checked by P5.S.6). | P1.D4.1.a, P1.D4.4.a |
| D3 | `src/renderer/lib/refresh.ts:7` | A lib file imports a component. | P1.D1.2.a |
| D4 | `src/renderer/smoke.ts:22`, `src/renderer/probe.ts:16` | The two files import each other. | P1.D1.4.a |
| D5 | `src/renderer/App.tsx:16` | The app imports `smoke.ts`, so the test tools are in the shipped window bundle. | P1.D1.5.a, rule R10 |

### One capability, several implementations (P1.D2)

| # | Capability | Places |
|---|---|---|
| D6 | Which files are C-family | the seven places of entry 8, and `src/main/targets.ts:25`, `src/renderer/lib/flow.ts:376` |
| D7 | A name without its qualifier | `metrofacts.ts:18`, `gridlinks.ts:14`, `junctions.ts:21`, `gridmodel.ts:13`, `flowalign.ts:83`, `flowseq.ts:238`, `251`, `273`, `323`, `501`, `GridView.tsx:18`, `StepPreview.tsx:14`, `Sequence.tsx:252`, `1141`, `FlowBoxes.tsx:21` |
| D8 | Numbering of functions and steps | `flow.ts:303–347`, `flowrun.ts:723`, `flowseq.ts:551–560` |
| D9 | The loops around a position | `flowcore.ts:42–51`, `flowseq.ts:46–49` |
| D10 | A loop's count or label | `flowcore.ts:11–31`, `flowrun.ts:549–558` |
| D11 | How often a step runs | `flowseq.ts:370–381`, `flowboxes.ts:295–300`, `Sequence.tsx:446–447` |
| D12 | The sentence for a frame | `flowseq.ts:351–368`, `flowseq.ts:330–335`, `Sequence.tsx:1070–1087`, `flowboxes.ts:257` |
| D13 | A function's signature as text | `metrofacts.ts:171–172`, `Sequence.tsx:679` |
| D14 | Tables of thread starts, locks, allocations | the three pairs of entry 43 |
| D15 | Matching a parenthesis | `flowrun.ts:516–527`, `flowcore.ts:33–40` |
| D16 | Line and offset arithmetic | `flowcore.ts:97–105`, `flowfacts.ts:153–157`, `repair.ts:10–20`, `flowrun.ts:68–74` |
| D17 | Escaping text for HTML | `lib/repair.ts:24`, `StepPreview.tsx:15`, `Sequence.tsx:171`, `hlcode.ts:2`, `lines.ts:56`, `FlowBoxes.tsx:420` |
| D18 | Escaping text for a pattern | `gridlinks.ts:16`, `search.ts:2`, `flowwatch.ts:46`, `flow.ts:412`, `main.ts:275` |
| D19 | Running tasks a few at a time | `flow.ts:44–47`, `lib/preview.ts:354–357` |
| D20 | Writing a value as TOML | `settings-schema.ts:116–120`, `main/settings.ts:54–58` |
| D21 | The order of play | `GridView.tsx:268–273`, `FlowBoxes.tsx:211–221`, and a different rule at `Sequence.tsx:356–360` |
| D22 | Walking the project's folders | `main/lsp.ts:71–90`, `main/files.ts:62–73`, `75–88`, `main/targets.ts:9–33` |
| D23 | Reading the compile database | `main/lsp.ts:109–115`, `352–359`, `main/compilers.ts:97` |
| D24 | A call's text on its line | `metrofacts.ts:20–30`, `StepPreview.tsx:113`, `GridView.tsx:350` |

### Other design entries

| # | Where | What was seen | Unit |
|---|---|---|---|
| D25 | `entries.ts:21`, `flow.ts:71`, `486`, `defpick.ts:14`, `flowwatch.ts:78`, `main/files.ts:44`, `SettingChip.tsx:25`, `fonts.ts:28`, `SearchPanel.tsx:30–32`, `StartWindow.tsx:20` | Ordering and number text that follow the machine's language. | P1.D8 |
| D26 | `lib/lsp.ts:242`, `245`, `248`, `flowrun.ts:50–53`, `flow.ts:463`, `StepPreview.tsx:60`, `68`, `92`, `Sequence.tsx:66`, `172`, `GridView.tsx:167` | Errors turned into an empty answer with no message. A function whose calls could not be read then looks like one that calls nothing. | P1.D7, P2.I.5 |
| D27 | `flow.ts:22`, `437`, `488`, `lib/preview.ts:36`, `291`, `305`, `seqtext.ts:6`, `lib/goto.ts:59`, `main.ts:503`, `542` | Long-lived maps with no size limit. | P1.D6.3 |
| D28 | `Sequence.tsx` (1,173 lines), `FlowBoxes.tsx` (602), `GridView.tsx` (522) | Components over the 400-line limit that hold facts, geometry, event handling and markup together. | P1.D10.7 |
| D29 | `flowcore.ts:73`, `82–85`, `flow.ts:51–52`, `118`, `275`, `metrofacts.ts:32–51`, `119–122`, `191`, `gridlinks.ts:110–116`, `junctions.ts:25–31`, `flowfacts.ts:22`, `55`, `90`, `flowpairs.ts:38`, `flowrun.ts:549–556`, `flowalign.ts:134–142`, `lib/goto.ts:84–86`, `lib/preview.ts:134–136` | Patterns applied to source text for facts the compiler's tree already holds. | P1.D5 |
| D30 | `src/preload/preload.ts:44–47`, `src/main/main.ts:135–139` | The window can read, create and write a file at any path through the bridge; the handlers do not check the path. | P1.D1.6.g |
| D31 | `src/shared/symname.ts` (31 lines) | No product file imports it; only `src/tests/core.test.ts:111` does (`symbolQuery`). Found by running P5.S.6 on 2026-11-14 (a run, not only a reading); kept by the user's decision of 2026-11-14 and listed by P5.S.6 instead of failing it. | P1.D4.4.a, P5.S.6 |

## Notes for the parts not yet written (no unit yet)

**Part 3** now has its own section below; the four notes that were here are covered by P3.D.5, P3.M.4 and entry D26.

**Part 5, UI rendering:**
- A row's note shows at most two globals written, one lock and one throw, with no sign that more exist (`metrofacts.ts:95–97`).
- A link's label in the grid is cut at 64 characters (`GridView.tsx:182`); names are cut in the exported picture (`GridView.tsx:341`).
- The loop text in the metro header is cut at 34 characters (`Sequence.tsx:651`).
- The command and file palette shows at most 80 entries (`Palette.tsx:18`); go to symbol at most 60 (`actions.ts:118`); neither says so.
- Quick open lists only source files, so `CMakeLists.txt` and Markdown files cannot be opened from it (`actions.ts:104`).
- A typed build flag that the box does not accept is dropped without a message (`SettingChip.tsx:33`).
- "clangd X is the latest" is said whenever the listed version is not newer, including when the version text cannot be compared (`CompilerWindow.tsx:27`, `125–127`).
- A typed number is rounded to the slider's step before it is saved (`Settings.tsx:104`).
- Code rows colour any name before a `(` as a function and do not recognise block comments (`hlcode.ts:6–13`).
- Which rows "around the step" hides is decided in the component (`Sequence.tsx:176–188`).

## Part 3: execution integrity and speed (24 entries, read on 2026-11-12)

| # | Where | What the code does | Unit |
|---|---|---|---|
| E1 | `src/main/packs.ts:78`, `src/main/langpacks.ts:29`, `34`, `39` | Release lookups have no time limit and cannot be cancelled. | P3.W.T01 |
| E2 | `src/main/main.ts:231`, `250–251` | `git log`, `git archive` and `tar` have no time limit. | P3.W.T02 |
| E3 | `src/main/main.ts:192–210` | The hidden window's job has no limit of its own; it ends only if its process dies or its page fails to load. | P3.W.T03 |
| E4 | `src/main/files.ts:62–73`, `src/main/targets.ts:9–33`, `src/main/lsp.ts:71–105` | Whole-tree walks run synchronously on the main process (file list, folder search, build targets, the generated compile database). | P3.B.2 |
| E5 | `src/main/lsp.ts:31–33`, `src/main/compilers.ts:14`, `32–40` | Finding clangd, GCC and MSVC runs programs synchronously, up to 5 s each, every time the compiler window opens (`main.ts:549` clears the results). | P3.B.2 |
| E6 | `src/main/terminal.ts:26`, `31` | On Linux, finding a terminal can hold the main process for up to ten 3-second waits in turn. | P3.B.2 |
| E7 | `src/main/packs.ts:130–137`, `168`, `184–185` | Measuring and removing a pack walk and delete it synchronously on the main process. | P3.B.2 |
| E8 | `src/main/lsp.ts:352–358`, `src/main/compilers.ts:97`, `src/main/main.ts:330–347` | The whole compile database is parsed synchronously, for headers, for compiler drivers and for the list of built files. | P3.B.2 |
| E9 | `src/renderer/lib/flow.ts:35`, `460` | Parsing and analysis run on the window's thread; the roadmap lists them as to be moved to workers. | P3.B.4 |
| E10 | `src/main/lsp.ts:239` | Stopping clangd sends the terminate signal once, and neither waits nor follows with the kill signal. | P3.P.4 |
| E11 | `src/main/main.ts:583`, `src/main/lsp.ts:236`, `src/renderer/lib/langlsp.ts:25–36` | After any pack install, the language engines are stopped without telling the window; it keeps them as started, so Rust, Python and Go requests fail and edits are dropped until the folder is opened again. | P3.P.5 |
| E12 | `src/main/files.ts:5–26` | A save writes a new file and renames it over the old name: a symbolic link becomes a plain file and the file it named is not updated; a hard link stops sharing the text; extended attributes are lost. | P3.D.4 |
| E13 | `src/renderer/lib/store.ts:129–134`, `src/renderer/App.tsx:75` | Unsaved text reaches disk one second after an edit, and closing the window does nothing to save the rest. | P3.D.5 (b) |
| E14 | `src/renderer/lib/store.ts:64–72`, `199–211`, `src/renderer/App.tsx:51` | Kept unsaved texts are offered back only when the app starts. After Open Folder on the same folder, the file opens with its disk text, and the next edit replaces the kept text. | P3.D.5 (c) |
| E15 | `src/main/main.ts:139`, `src/renderer/lib/store.ts:133` | A save removes the file's kept text, even when the file was edited during the write. | P3.D.5 (e) |
| E16 | `src/main/packs.ts:171–172` | Replacing a pack removes the old folder before the new one is renamed into place. | P3.D.8 |
| E17 | `src/main/packs.ts:146`, `177` | An install removes the whole `.unpacking` folder at its end, so a second copy of the app loses its own unpack. | P3.D.8 |
| E18 | `src/main/packs.ts:145`, `152` | An archive at a local address is compared only with its own hash, never with a pinned checksum. | P3.D.9 |
| E19 | `src/main/unpack.ts:237`, `src/main/packs.ts:68` | Every clang toolchain on macOS and Linux is tar.zst, and reading it needs `zlib.createZstdDecompress`. Whether the shipped Electron 45 has it is not known from reading. | P3.D.11 |
| E20 | `src/main/langpacks.ts:38–40`, `src/main/packs.ts:143–144` | A failed HEAD request gives a size of 0, so the free-space check passes whatever the room. | P3.D.12 |
| E21 | `src/renderer/lib/lsp.ts:24`, `132`, `212–222` | A file's symbols are kept by version number. The numbers start again at 1 after clangd restarts or a background file is reopened, so symbols of an older text can be returned: the wrong function under the cursor, and the wrong preview cards (S1). | P3.M.4 |
| E22 | `src/main/lsp.ts:281` | Each piece of a clangd answer is joined to all the bytes before it, so receiving an answer takes time that grows with the square of its size. | P3.M.5 |
| E23 | `src/main/main.ts` (read in full) | No single-instance lock: two copies can run on one data folder. | P3.R.3 |
| E24 | `src/main/main.ts:68–88`, `206` | Only the hidden window's page process is watched; if the main window's page crashes, nothing reloads it or says so. | P3.R.5 |

## Part 4: test tools (14 entries, read on 2026-11-12)

| # | Where | What was read | Unit |
|---|---|---|---|
| G1 | `.github/workflows/release.yml:49` | The test step has `continue-on-error: true`: failing tests never stop a release. **Fixed 2026-11-13** (fix 3, approved by the user): the line is removed; `src/tests/release.test.ts` failed before and passes after; the workflow still parses, with 13 build steps. Not run on GitHub. | P4.C.1 |
| G2 | `src/build/check-smoke.mjs:14`, `src/renderer/smoke.ts:555–665` | check-smoke requires `flowBoxes`, which the boot scenario no longer writes: the boot check fails on every build, in CI too (`release.yml:62`, `104`). **Confirmed 2026-11-12 by a run; fixed 2026-11-13** (fix 1, approved by the user): the rule tests `gridSquares`; `src/tests/checksmoke.test.ts` failed before and passes after; a real boot run now passes the check. | P4.S.2, P4.C.2 |
| G3 | `src/build/check-smoke.mjs:26–29` | Four rules read fields the boot scenario never writes (`boxKeptStep`, `boxCollisions`, `layoutWorker`, `boxRoutes`), so they never fire; four grid fields are written and never judged. **Fixed 2026-11-13** (fix 2, approved by the user): the rules judge `gridKeptStep`, `gridCollisionsAfterTab` and `gridRoutes`; the `layoutWorker` rule is removed (the boxes layout is unreachable, D2). Three tests in `src/tests/checksmoke.test.ts` failed before and pass after; a real boot run passes. | P4.S.2 |
| G4 | `src/renderer/smoke.ts:65–85` | Of 22 scenarios only boot has a verdict rule; 8 record failures in `errors` that nothing reads; 13 record values only. | P4.S.1 |
| G5 | `src/renderer/smoke.ts:48–52`, `87`, `254`, `909`, `1461` | A wait that runs out returns false and the scenario carries on. | P4.S.3 |
| G6 | `src/renderer/probe.ts:50–51`, `101–131` | Probe records with no check pass when the function does not throw. | P4.S.4 |
| G7 | `src/renderer/smoke.ts:36`, `46`, `src/renderer/probe.ts:58`, `454` | Frame limit 25 ms, long tasks up to 250 ms counted as fine, and reduced motion for the whole probe: none matches the suite's 16.7 ms. | P4.S.5 |
| G8 | `src/tests/exits.test.ts:48–49` | A fixed absolute path into an old session's temporary folder; when it is missing the test returns with no assertion and passes. The path holds the user's home-folder name, in a public repository. **Confirmed and fixed 2026-11-13** (fix 4, approved by the user): the test takes ThreadX from `SKYCODEX_TEST_THREADX` and is skipped with that reason when it is absent; before, vitest listed it as passed with the folder missing; after, as skipped; run against ThreadX 6.5.2 it passes. The path is gone from the test file, but stays in the git history. | P4.T.2, P4.T.5 |
| G15 | `src/tests/fixtures/*-flow.json` (all 10) | Found 2026-11-13 while checking fix 4: the recorded clangd answers hold the absolute paths of the machine they were recorded on, 3,091 times in all, so the user's home-folder name is in all 10 files, and all 10 are committed in a public repository. Rewriting the fixtures removes it from new commits only; removing it from the history would rewrite the published history, which is the user's decision. Not fixed. | P4.F.1 |
| G9 | `src/tests/engine.test.ts:16`, `41`, `compilers.test.ts:137`, `packs.test.ts:143` | Tests skipped when clangd or an environment variable is missing; `npm test` still succeeds. | P4.T.2 |
| G10 | `src/tests/engine.test.ts:12` | Runs the sample's `build.sh`, which writes into `samples/`. | P4.T.6 |
| G11 | `src/tests/flowrun.test.ts:103` | Expects a lambda's step where the lambda is written; approved P2.S3.T19 expects it at the call. | P4.T.4 |
| G12 | `src/tests/fixtures/record-flow.mjs:11`, `51`, `src/tests/flowrun.fixture.ts:15` | Recordings store no clangd version and no hash of the sample texts they are replayed against; the recorder needs `src/concepts/`. | P4.F.1, P4.F.2 |
| G13 | `src/tests/packs.test.ts:90–96` | The tar.zst test runs in vitest's Node, so it says nothing about the shipped Electron (entry E19). | P4.T.8 |
| G14 | `src/tests/flowlinks.test.ts:9–17` | Holds its own copy of `server.cpp`'s text, which can drift from the sample. | P4.T.5 |

## Part 5: UI rendering (16 entries, read on 2026-11-12)

| # | Where | What was read | Unit |
|---|---|---|---|
| U1 | `src/shared/settings-schema.ts:53`, `src/renderer/lib/store.ts:136` | `editor.autosave = "focus"` promises to save when you leave the window; only `delay` has a handler, so nothing is saved. | P5.D.4 |
| U2 | `src/renderer/components/GridView.tsx:98`, `Sequence.tsx:256–260` | The grid and the metro give file colours in different orders, so one file can have two colours. | P5.C.3 |
| U3 | `GridView.tsx:183`, `246`, `185`, `256`, `src/renderer/lib/lines.ts:43` | Label and tag widths are estimated from character counts, and when every place collides the first is used anyway: text on text, or a tag over squares, with other fonts and sizes. | P5.T.3, P5.L.5 |
| U4 | `Sequence.tsx:651`, `793`, `859`, `875–892`; `GridView.tsx:182`, `437`; `StepPreview.tsx:220–222`; `Preview.tsx:266`; `styles.css:461`, `710`, `715`, `841` | Text cut with no way to read the rest (no title, no scroll). | P5.T.1 |
| U5 | `Sequence.tsx:299`, `416`, `906`, `992`; `Palette.tsx:18`; `src/renderer/lib/actions.ts:118`; `CompilerWindow.tsx:167`, `202` | Lists cut without saying how many are left out. | P5.T.2 |
| U6 | `styles.css` (from line 547), `Sequence.tsx:607–618`, `1089`, `StepPreview.tsx:138`, `lib/lines.ts:46` | Many colours are fixed in the code; the colour settings move only CSS variables. | P5.C.2 |
| U7 | `src/renderer/components/Magnifier.tsx:15` | The lens removes every canvas from its copy: the spine and the run bars are missing from it. | P5.L.4 |
| U8 | `Sequence.tsx:866`, `GridView.tsx:426` | Rows and squares have no accessible name; §7 wants each row read with its number, name, file and state. | P5.K.4 |
| U9 | `src/shared/settings-schema.ts:18–36` | No `[keys]` section and no setting to turn captions off, both promised by §7. | P5.K.2, P5.K.3 |
| U10 | `Sequence.tsx:32–39`, `536`, `551` | Keys in the design that are not built: P, ⌥→ / ⌥←, ↓ into an indirect call; C and A mean other things. | P5.K.1 |
| U11 | `Sequence.tsx:548`, `PlayControls.tsx:1`, `GridView.tsx:319` | The metro's + key reaches 4×; the button and the grid stop at 3×; the plan says 0.25×–3×. | P5.M.3 |
| U12 | `StepPreview.tsx:128–140` | The dotted link is redrawn on every frame while the pane is open, even when nothing changes. | P5.M.4 |
| U13 | `Sequence.tsx:697–704`, and no matching text in the file | Approved metro items missing: "▲ above / ▼ below", chapter summary items, folding of repeated passes and of chapters on long runs. | P5.D.2 |
| U14 | `docs/FLOW-DESIGN.md` §5b, `docs/FLOW-VIEWS-PLAN.md` §1 | The colour budget ("files and functions get no colour") disagreed with the approved metro line colours and grid file bands. Decided 2026-11-12: the plan governs; §5b corrected. | P5.C.1 |
| U15 | `Sequence.tsx:359`, `GridView.tsx:284`, `SeqCode.tsx:61` | Play and the walk run on timers, not the one animation clock the roadmap plans. | P5.M.2 |
| U16 | `docs/FLOW-DESIGN.md` §3, §3b, §7 | The design still speaks of "sequence" and "boxes"; the plan renamed them and removed boxes. | P5.D.3 |

## Information out of reach (21 entries, from the readings of 2026-11-12)

The user's standing rule, 2026-11-12: every area whose information grows or shrinks with the codebase must be scrollable, so nothing it holds is out of reach. These are the places where reading shows it may not be. Unit P5.T.1 or P5.T.2 checks each.

**Areas that grow and do not scroll**

| # | Where | What happens |
|---|---|---|
| V1 | `styles.css:37`, `Header.tsx:29–39` | The row of open-file tabs is `overflow: hidden` with no scroll: tabs past the width are hidden and cannot be reached. |
| V2 | `styles.css:43`, `Header.tsx:41–46` | The status text (indexing progress, repair note, clangd state) is one unwrapped line with no scroll; a long one runs under the window buttons or off the window. |
| V3 | `styles.css:757`, `Sequence.tsx:744–752` | The findings list has no height limit and no scroll: with many findings it runs off the bottom of the window. |
| V4 | `styles.css:533`, `Sequence.tsx:992` | The watch and journey picker has no height limit, and shows 12 names with nothing said about the rest. |
| V5 | `styles.css:668`, `Sequence.tsx:990`, `GridView.tsx:476` | Captions are one unwrapped line with no width limit inside a view that hides overflow: a long caption is cut at both ends. |
| V6 | `styles.css:629`, `Sequence.tsx:1051` | In find, a long path (`a › b › c …`) is cut with no ellipsis and no hover. |
| V7 | `styles.css:135`, `Card.tsx:54–70` | In a card's header, a long function name pushes the file and line out of sight; the name is cut with no hover. |

**Lists cut where the rest cannot be reached**

| # | Where | What happens |
|---|---|---|
| V8 | `Sequence.tsx:416` | Find shows 9 functions, nothing said. |
| V9 | `Sequence.tsx:926–930` | What-if compare shows 8 steps then "+N more", with no way to see them. |
| V10 | `Programs.tsx:84–85` | Shared files: 12, then "+N more", with no way to see them. |
| V11 | `FilesPane.tsx:59`, `74` | The file filter shows 500 ("500+"); the rest only by typing more. |
| V12 | `Palette.tsx:18`, `src/renderer/lib/actions.ts:118` | The palette shows 80 and go to symbol 60, nothing said. |
| V13 | `CompilerWindow.tsx:167`, `202` | Release lists show 10 toolchains and 8 of other kinds, nothing said. |
| V14 | `SearchPanel.tsx:8`, `52` | Search shows 3,000 hits, then "N more — narrow the search". |
| V15 | `Preview.tsx:282` | Preview cards past `preview.max_cards`: "+N more" naming the first 4. |
| V16 | `Sequence.tsx:299` | The edit-ripple note names 3 functions (+N) and 6 steps, then "…" with no count. |
| V17 | `Sequence.tsx:637`, `906`, `Card.tsx:64` | The peek shows 9 lines then "…"; the folded row's mini spine 40 bars; the depth gauge 8 marks (its number is in text). |

**Messages that vanish, and pictures too dense to read**

| # | Where | What happens |
|---|---|---|
| V18 | `src/renderer/lib/store.ts:59–62`, `App.tsx:103` | Toasts, failures included, vanish after 3.2 s (6–12 s for some) and are not kept anywhere the user can open again. |
| V19 | `Sequence.tsx:323–327`, `GridView.tsx:262` | Captions vanish after 2.6 s. |
| V20 | `styles.css:461` and entry U4 | Metro rows fade out at the right edge with no ellipsis and no hover, and the other texts of U4 are cut with nothing to hover. |
| V21 | `Sequence.tsx:597–620` | The spine draws every step into the pane's height with no zoom or scroll: on a long run many steps share one pixel. The run bars below it have zoom and scroll. |
| V22 | `src/shared/gridlinks.ts:125–133`, `GridView.tsx:163–168`, `191–200`, `styles.css:839–840` | In the grid, the grey arrows from the current step to the calls it makes are missing in several cases with nothing said: a step that calls a function already run (a repeat) gets none; a call folded into its caller's row gets none; several calls into one square share one arrow; a failure while working them out shows no arrows at all. The lines are 0.6 px wide. Read on 2026-11-13 after the user reported seeing arrows from only some squares. No unit yet. |

## Grid breakages reported by the user (2026-11-13, on ThreadX)

Seen by the user in the running app, with screenshots; the causes below are from reading the code the same
day. None is fixed. No unit of `docs/TEST-SUITE.md` covers them yet.

| # | What the user saw | Cause, by reading | Where |
|---|---|---|---|
| X1 | Grey arrows stop short of the numbered boxes they point at | An arrow ends at the edge of the whole grid slot. The numbered box is narrower than its slot and sits in its middle, so the arrowhead stops in empty space beside it. | `GridView.tsx:137`, `83–85` |
| X2 | Grey arrows end between two rows, so the target is unclear | Each further arrow of one kind is shifted 3 px more, along its whole length and at both ends. The fifth call arrow ends 15 px off the row's middle, and rows are 19 to 28 px high. **Confirmed and fixed 2026-11-13** (approved by the user, batch 2): the last straight run and the arrowhead no longer take the shift. Measured on tinyhttp by the new smoke scenario `arrows` (30 steps, 45 arrows): arrows ending more than 3 px off their box's middle went from 22 to 5. The 5 left are thought to arrive between two numbered boxes in one square, which is X1; not verified. | `GridView.tsx:189`, `83–85`, `131` |
| X3 | Nothing says what an arrow means | Arrows take no pointer events, so nothing can show on hover. Only the first call arrow gets a label, and it is cut at 64 characters. The key ribbon does not explain the three arrow colours. | `styles.css:838`, `GridView.tsx:181–182`, `201`, `381–389` |
| X4 | Arrows of other colours were there before and are gone | Not a fault of drawing: teal arrows show where a value passed in comes from, gold arrows show which later steps read this step's result. A step that takes no named value and whose result nobody reads has neither. Nothing on the page says so. | `gridlinks.ts:70–107`, `styles.css:840` |
| X5 | With `main` selected there are no arrows at all | The entry step has no caller, so it has no square; without a square for the current step nothing is drawn, although `main` makes calls. | `GridView.tsx:176–178` |
| X6 | On a run of 500+ steps the grid is replaced by something else | When rows × columns pass 1,800 the grid switches to files × files. The 187-step run has 47 × 36 = 1,692 and stays a grid. The only notice is one line in the corner. The user expects the same grid at every size. | `GridView.tsx:16`, `103–104`, `392`, `511` |
| X7 | "A box numbered 1 at two intersections" | In files × files the number is how many calls go from one file to another. It is drawn exactly like a step number, so "1" reads as step 1. | `GridView.tsx:517` |
| X8 | Clicking it led to a reduced view with no way back | The click opens that pair of files only. The ways back are the "← all files" chip, which sits inside the one-line summary ribbon after the "most called" text and can be pushed out of sight, and Esc, which first closes an open square. Neither is said. | `GridView.tsx:375`, `321`, `392` |
| X9 | Every square is built whatever the size | The grid makes one element per row × column, filled or empty. This is why a size limit exists at all; showing the full grid at any size needs only the visible part built (P5.L.3). | `GridView.tsx:417–446` |

**The probe on ThreadX, 2026-11-13.** It ran for 180 minutes and was ended by the app's own limit
(`data/logs/skycodex.log`: "smoke: timed out after 180 minutes"), so it wrote no report. It had walked three
programs and saved 12 failure screenshots, the most it keeps, in the first 5 minutes. The user used the probe's
window while it ran. What stopped it from finishing is not known.

`src/main/files.ts:13` syncs a saved file but not its folder; whether a save survives a power cut cannot be tested (P3, boundary item 1).
