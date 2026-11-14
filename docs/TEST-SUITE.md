# SkyCodeX test suite: the source of testing truth

## 0. Status

| Part | Scope | State |
|---|---|---|
| 1 | Code design sweep | Approved 2026-11-09 |
| 2 | Engine correctness | Approved 2026-11-09; the race rule decided 2026-11-12 (section 8b governs); the additions of the coverage audits of 2026-11-09, 2026-11-10 and 2026-11-11 approved 2026-11-12 |
| 3 | Execution integrity and speed | Approved 2026-11-12, with the limits of P3.0.8 and the change to R6 |
| 4 | Test tools, report and order | Approved 2026-11-12 |
| 5 | UI rendering | Approved 2026-11-12, with the limits of P5.0.6; family P5.S approved 2026-11-14 |
| 6 | The 24-hour run, compressed | Approved 2026-11-12, with the values of Table P6-1 and the limits of P6.0.7 |

Parts are written one at a time and each is approved by the user before the next is started. Nothing in a part is run before the part is approved and the user says yes to its commands.

## 1. Authority and use

1. This document is the only source of truth for testing SkyCodeX. Every testing action is one of the units written here, done exactly as written, recorded as written.
2. A test that is not written here is not run. If a need appears, the document is changed first (section 8), then the test is run.
3. Before any testing action, the unit's ID is named in chat, with what it checks and why, and the commands it needs. Commands run only after the user's explicit yes.
4. A unit is done only when it has exactly one verdict and its evidence is recorded (section 6).

## 2. Integrity rules

These rules hold for every unit, every part and every run. A run that breaks one of them is void and is repeated.

- **R1 Read-only.** Parts 1 to 3 never change product behaviour, samples or project settings. The only files they may add or change are test support: `tools/sweep/`, `samples/engine-traps/`, `src/tests/`, the checks layer (`src/renderer/smoke.ts`, `src/renderer/probe.ts` and new files beside them) and test-only hooks under R10. Before and after each run, a content hash of `src/`, `samples/`, `package.json` and the build configuration, leaving out those test-support paths, is recorded; the two must be equal.
- **R2 Execution integrity.** Any later change made because of a finding keeps semantics, behaviour and run time exactly as they were, except for the defect being fixed, and is proven by the units that cover the changed code.
- **R3 Design integrity.** Any later change keeps the architecture: layers, process boundaries and the single owner of each piece of state, as defined in Part 1.
- **R4 Independent truth.** Every verdict is decided against something that does not come from the code under test: a rule written here, a second independent method, clang or clangd, a generated ground truth, or a hand-worked known answer. A unit with no such truth gets the verdict "not checked", never "pass".
- **R5 One verdict.** Every unit ends in exactly one of: pass, fail, not checked, needs review. No unit passes by default, by absence of output, or by a time-out.
- **R6 Repeatable.** The same commit and working tree give a byte-identical report, apart from a separate field of timestamps, measured times and measured values (memory, counts and sizes). Each part's report is produced twice and compared; any difference voids the run.
- **R7 Proven detectors.** Every detector is validated on its known-positive and known-negative samples (P1.V) before its results count. A detector that misses a known positive, or flags a known negative, is void until fixed.
- **R8 Offline, no new dependencies, commands asked.** Everything runs offline with tools already in the repository or on the machine. No dependency is added without the user's explicit yes. No command runs without the user's explicit yes.
- **R9 No comments.** No file written for testing contains comments.
- **R10 Test-only hooks.** Any hook a later part needs exists only in a test build: a build made with the build-time switch `SKYCODEX_TEST_BUILD` set. Every hook has a unique name listed in the part that needs it. The shipped build is made without the switch, and its bundle is searched for every listed hook name; finding one breaks this rule.
- **R11 Test codebases removed.** Outside codebases fetched for testing (ThreadX, LLVM, RTEMS and others) and their indexes are deleted from the machine after use, with the user's yes.
- **R12 Counts never hide.** Results are reported per unit family as checked, pass, fail, not checked and needs review. No single percentage is reported alone.
- **R13 Findings are not fixes.** A finding never changes product code by itself. Fixes come only from the Phase 4 plan, approved by the user. A fix may come before the full run when the user approves it by name. It then carries its own test, shown failing before the change and passing after, and the full suite still runs afterwards, unchanged.
- **R14 Stable IDs.** Unit IDs are never reused or renumbered. A withdrawn unit keeps its ID and is marked withdrawn, with the date and reason, in the change log.

## 3. Terms

- **Product code:** every file under `src/` except `src/tests/` and `src/concepts/`.
- **Layer:** one of the groups of files defined in Table P1-1. Every file under `src/` belongs to exactly one layer.
- **Value import:** an import that brings a value at run time. **Type-only import:** an import of types only (`import type`, or every imported name marked `type`); it is erased at build time.
- **Unit:** an indivisible check: one instance, one question, one verdict.
- **Instance rule:** the exact rule that produces the list of instances of a unit family (for example, one instance per file). The full list of instances is part of the report.
- **Detector:** the procedure that finds the instances or answers the question.
- **Finding:** a fail verdict, kept in the findings list with its severity (section 7).
- **Sink:** a place where a value becomes visible or durable. The closed list of sinks is in P1.0.6.
- **Trigger:** an event after which some state may be out of date. The closed list of triggers is in P1.0.7.

## 4. How a unit is written

Every unit states, in this order:

1. **ID and name.**
2. **Instances:** the instance rule.
3. **Check:** what is examined and how, in words.
4. **Truth:** what the result is compared against (R4).
5. **Pass:** the exact condition for pass. Anything else is fail, unless the unit names when it is "not checked" or "needs review".
6. **Record:** what the record of a fail or a needs-review contains, beyond the fields every record has (section 6).
7. **Severity** of a fail (section 7).

Where several units in a group share the same truth, record or severity, the group states it once and it applies to every unit in the group.

## 5. How the suite runs

1. **State under test.** The commit hash, the list of uncommitted changes and the content hash from R1 are recorded at the start of each run.
2. **Tools.** Node and the TypeScript compiler interface already in the repository's development dependencies. Their versions, Electron's version and clangd's version are recorded at the start of each run.
3. **Where testing files live.** Sweep scripts and their samples live in `tools/sweep/`, outside `src/`, so they are never part of the shipped app. Reports are written to `data/logs/sweep/`.
4. **Order inside a part.** Detector validation first (P1.V), then the components in the order written. A component whose detector is void is not run.
5. **Twice.** Each part's report is produced twice on the same state and compared (R6).

## 6. Records and reports

Every unit record has: unit ID, instance, verdict, location (file and line, or file and range), the truth used, what was expected, what was observed, and a pointer to the evidence (report path and entry). A needs-review record also states the exact question still to be answered. When it is answered, the answer and its evidence are added and the verdict is replaced; the old verdict stays in the record's history.

Each part produces:

1. `data/logs/sweep/partN-report.json`: every record, every instance list, and the counts per unit family as in R12.
2. `data/logs/sweep/partN-findings.md`: every fail and needs-review, grouped by severity, each with its record.
3. A summary in chat: counts per family, then every S1 and S2 finding in full, then the number of S3 findings with a pointer to the findings file.

## 7. Severity of findings

- **S1:** can produce a wrong fact or a wrong picture shown to the user.
- **S2:** can crash, hang, leak, slow down without bound, or lose or corrupt data.
- **S3:** design discipline: duplication, unaccounted code, unclear ownership, missing bounds that cannot yet cause S1 or S2.

When a finding could fit two levels, it takes the higher one.

## 8. Changing this document

This document changes only with the user's explicit approval. Every change is dated in the change log at the end, with what changed and why. A unit that a run shows to be impossible as written is not run differently; it is reported, the document is changed with approval, and then it is run as changed.

---

# Part 1: Code design sweep

**Purpose.** Find design flaws in SkyCodeX's own code before they become behaviour: wrong layering, one capability built several ways, copied code, code nothing uses or runs, text parsing where structure exists, state with no owner or no reset, errors swallowed, results that depend on the machine or on timing, holes in typing, and undisciplined reactive UI code.

**What Part 1 is not.** It does not judge whether the engine's results are right (Part 2), how fast or robust the app is (Part 3), how the UI renders (Part 5), or long runs (Part 6). Where a Part 1 unit can only be decided by running the app, it records the question and the later unit that answers it.

## P1.0 Scope, inputs and tools

### P1.0.1 File set
- **P1.0.1.a Files in scope.** Instances: one instance per file under `src/`. Check: the file's name ends in `.ts` or `.tsx`, or it is listed in the report as out of scope with its extension. Pass: every file is either in scope or listed. Severity: S3.
- **P1.0.1.b Readable.** Instances: one instance per in-scope file. Check: the TypeScript compiler interface parses it with no syntax error. Pass: no syntax error. Severity: S2.

### P1.0.2 Layers

**Table P1-1, layers.**

| Layer | Files |
|---|---|
| main | `src/main/` and below |
| preload | `src/preload/` and below |
| shared | `src/shared/` and below |
| lib | `src/renderer/lib/` and below |
| components | `src/renderer/components/` and below |
| checks | `src/renderer/smoke.ts` and `src/renderer/probe.ts` |
| shell | every other file under `src/renderer/` |
| tests | `src/tests/` and below |
| concepts | `src/concepts/` and below |

- **P1.0.2.a One layer each.** Instances: one instance per in-scope file. Check: the file matches exactly one row of Table P1-1. Pass: exactly one. Record: the rows matched (none or several). Severity: S3.

### P1.0.3 Entry files
- **P1.0.3.a Entries named.** Instances: one instance per entry named in the build configuration files at the repository root and in the `main` field of `package.json`. Check: the named file exists in the file set. Pass: it exists. Severity: S2.
- **P1.0.3.b Entries complete.** Instances: one instance per run of P1. Check: the entries found by P1.0.3.a include one entry each for the main process, the preload and the renderer. Pass: all three present. Severity: S2.

### P1.0.4 Tools recorded
- **P1.0.4.a Versions.** Instances: one per run. Check: Node, TypeScript, Electron and clangd versions are recorded. Pass: all four recorded. Severity: S3.

### P1.0.5 Two independent ways of reading the code
Every enumeration in Part 1 that can be done two independent ways is done both ways: once with the TypeScript compiler interface (syntax tree and type checker), and once with a plain token scan that does not use the TypeScript compiler. The two lists are compared unit by unit where the component says so. A difference is "needs review" with both lists, never silently resolved.

### P1.0.6 Sinks (closed list)
1. Values returned from engine functions in `src/shared/` and `src/renderer/lib/flow.ts` that become part of a flow graph, a run, a sequence or a grid model.
2. Text written to the kept-picture store, the session file, the recent-folders file, the settings file or browser storage.
3. Text or order of elements in the page.
4. Text written to the app log or to the status line, the run status, the clangd message or a flash message.
5. Replies returned across the process boundary (IPC handler return values).
6. Report files written by the smoke checks and the probe.

### P1.0.7 Triggers (closed list)
1. An edit in the editor.
2. A save.
3. A change on disk reported by the file watcher.
4. A change of the compile database.
5. The end of clangd's indexing.
6. A change of the open folder.
7. A clangd stop and restart.
8. A change of settings.
9. A switch to another program in the flow tab.

## P1.V Detector validation

Every detector in Part 1 has a known-positive sample and a known-negative sample in `tools/sweep/fixtures/`, written as small TypeScript files for this purpose only, and, where stated, known positives in the real code that were confirmed by reading on 2026-11-09. Each validation is a unit.

- **P1.V.1 Positive found.** Instances: one per (detector, known positive). Check: the detector reports the positive. Pass: reported. Severity of fail: the detector is void (R7).
- **P1.V.2 Negative not flagged.** Instances: one per (detector, known negative). Check: the detector does not report the negative. Pass: not reported. Severity of fail: the detector is void (R7).

The samples for each detector are listed under each component as "Validation".

## P1.D1 Layers, process boundary and import cycles

**Truth:** Tables P1-1, P1-2 and P1-3 and the rules written here.

### P1.D1.1 Import enumeration
- **P1.D1.1.a Imports by compiler.** Instances: one per in-scope file. Check: list every import declaration, every re-export, every dynamic import and every `require` call, with its specifier, whether it is type-only, and the file it resolves to under the repository's TypeScript settings. Pass: the list is produced. Severity: S3.
- **P1.D1.1.b Imports by token scan.** Instances: one per in-scope file. Check: the same list by the plain token scan (P1.0.5). Pass: the list is produced. Severity: S3.
- **P1.D1.1.c Both agree.** Instances: one per in-scope file. Check: the two lists are equal. Pass: equal. Otherwise needs review, with both lists. Severity: S3.
- **P1.D1.1.d Relative imports resolve.** Instances: one per relative specifier. Check: it resolves to a file in the file set. Pass: resolves. Severity: S2.

### P1.D1.2 Layer rules

**Table P1-2, allowed value imports** (importer on the left; "type" means type-only imports are allowed but value imports are not).

| Importer | main | preload | shared | lib | components | checks | shell | tests | concepts |
|---|---|---|---|---|---|---|---|---|---|
| main | yes | no | yes | no | no | no | no | no | no |
| preload | no | yes | no | no | no | no | no | no | no |
| shared | no | no | yes | no | no | no | no | no | no |
| lib | no | type | yes | yes | no | no | no | no | no |
| components | no | type | yes | yes | yes | no | no | no | no |
| checks | no | type | yes | yes | yes | yes | no | no | no |
| shell | no | type | yes | yes | yes | see P1.D1.5 | yes | no | no |
| tests | yes | yes | yes | yes | yes | yes | yes | yes | no |
| concepts | yes | yes | yes | yes | yes | yes | yes | no | yes |

- **P1.D1.2.a Value import allowed.** Instances: one per value import between two in-scope files. Check: the cell for (importer layer, target layer) is "yes". Pass: "yes". Record: the edge and the cell. Severity: S3.
- **P1.D1.2.b Type-only import allowed.** Instances: one per type-only import between two in-scope files. Check: the cell is "yes" or "type". Pass: "yes" or "type". Severity: S3.

### P1.D1.3 Package rules

**Table P1-3, packages.**

| Layer | Allowed packages | Never allowed |
|---|---|---|
| shared | `@lezer/` packages | `electron`, any Node built-in module (any `node:` specifier and the bare names of Node built-ins), `solid-js`, `@codemirror/` packages, every other package |
| main | Node built-ins, `electron`, packages the main process lists in its build configuration | `solid-js`, `@codemirror/` packages |
| preload | `electron` | every other package |
| lib, components, checks, shell | every installed package except those never allowed | `electron`, any Node built-in module |

- **P1.D1.3.a Package allowed.** Instances: one per (file, package import) in product code. Check: the package is allowed for the file's layer in Table P1-3. Pass: allowed. Record: the file, the package and the row. Severity: S2 for a Node built-in or `electron` in the renderer (the renderer runs sandboxed), S3 otherwise.

### P1.D1.4 Cycles
- **P1.D1.4.a No value cycles.** Instances: one per strongly connected group of two or more product files in the graph of value imports. Check: such a group exists. Pass: never (each instance is a fail). Record: the files and the import edges that close the cycle. Severity: S2.
- **P1.D1.4.b Type cycles listed.** Instances: one per strongly connected group of two or more product files in the graph that also includes type-only imports, and is not already a value cycle. Pass: never (each instance is a fail). Severity: S3.

### P1.D1.5 Test-support code kept apart
- **P1.D1.5.a One importer of checks.** Instances: one per product file outside the checks layer that imports a checks file. Check: the importer is the single file that reads the smoke scenario from the command line. Pass: it is that file. Record: the importer. Severity: S3.
- **P1.D1.5.b Exports used only by checks or tests.** Instances: one per export of a product file outside the checks layer. Check: every file that imports it is in the checks or tests layer. Pass: at least one importer is product code outside the checks layer. Otherwise fail: a test hook lives in product code. Severity: S3.

### P1.D1.6 Process boundary
- **P1.D1.6.a Every invoke has one handler.** Instances: one per channel name invoked in the preload. Check: exactly one handler with that name is registered in the main process. Pass: exactly one. Severity: S2.
- **P1.D1.6.b Every handler is invoked.** Instances: one per handler registered in the main process. Check: the preload invokes its channel. Pass: invoked. Severity: S3.
- **P1.D1.6.c Every event has a listener.** Instances: one per channel the main process sends to the window. Check: the preload listens on it. Pass: listens. Severity: S2.
- **P1.D1.6.d Every listener has a sender.** Instances: one per channel the preload listens on. Check: the main process sends on it. Pass: sends. Severity: S3.
- **P1.D1.6.e One door to the bridge.** Instances: one per place in product code outside `src/renderer/lib/api.ts` that reads the bridge object the preload exposes. Check: such a place exists. Pass: never (each instance is a fail). Severity: S3.
- **P1.D1.6.f Every bridge member used.** Instances: one per member of the object the preload exposes. Check: product code in the renderer uses it. Pass: used. Severity: S3.
- **P1.D1.6.g Handlers check their arguments.** Instances: one per handler in the main process. Check: every argument from the window is checked for type before it is used in a file path, a command or a cache key. Truth: reading the handler body; the record names the check's file and line. Pass: checked. Severity: S2.

**Validation (P1.D1).** Positives: a shared sample importing `electron`; a shared sample importing `node:fs`; a lib sample importing a components sample; two samples importing each other with values; a preload sample invoking a channel with no handler sample; a renderer sample reading the bridge object directly. Negatives: a components sample importing a lib sample; a lib sample with a type-only import from a preload sample; a main sample importing a shared sample.

## P1.D2 One capability, one implementation

**Truth:** for equivalence, running each implementation on the same input set and comparing outputs exactly; for contracts, reading the code with file and line evidence.

### P1.D2.0 Capability catalogue (closed list)

| ID | Capability | Detection rule (an implementation is any function that…) | Input set for comparison |
|---|---|---|---|
| C1 | Find a function's definition | sends `textDocument/definition`, `workspace/symbol` or `textDocument/prepareCallHierarchy`, or maps a function name to a definition by searching file text | every call site in `samples/tinyhttp`, `samples/programs` and, while it is on the machine, the ThreadX test copy |
| C2 | Read a file's text | returns a file's text from disk, from the editor's buffer or from a cache of either | every file of `samples/tinyhttp` in three states: unchanged, edited and not saved, changed on disk |
| C3 | Tell a source file from a header | tests a file name's extension for C or C++ source or header | every file path under `src/`, `samples/` and the ThreadX test copy, plus the fixed list in P1.D2.0.1 |
| C4 | Produce the "call as written" text | slices a source line around a call position to produce display text | every step of the runs of `samples/tinyhttp`, `samples/exits`, `samples/values`, `samples/programs` |
| C5 | Shorten a name or path for display | removes a qualifier, a folder or an extension from a name or path for display | the fixed list in P1.D2.0.2 |
| C6 | Count the folders two paths share | counts leading path segments two paths have in common | the fixed list in P1.D2.0.3 |
| C7 | List the project's files | lists source or header files under a folder | `samples/` and each of its folders, and the ThreadX test copy |
| C8 | List the functions defined in a file | returns function names and lines defined in a file's text | every file of `samples/` |
| C9 | Work out what a function changes | produces the writes, reads, locks or allocations of a function | every function in the runs used for C4 |
| C10 | Detect a thread start or hand-over | decides from text or syntax that a function is started on a thread or handed over by address | every call site used for C1 |
| C11 | Number steps or functions | assigns step or function numbers to rows of a run | the runs used for C4 |
| C12 | Find the loops around a position | returns the loops enclosing a position in a function | every call position in the runs used for C4 |
| C13 | Read or write browser storage | reads or writes browser storage | each key present, absent, and with storage that throws on access |
| C14 | Escape text for a regular expression | escapes special characters of a string for use in a regular expression | every printable ASCII character alone and in pairs, plus the non-ASCII list in P1.D2.0.4 |
| C15 | Normalise a path | changes separators, drive letter case, or resolves relative parts | the fixed list in P1.D2.0.3 |
| C16 | Wait with a time limit | waits for a condition or a reply and gives up after a set time | contract comparison only (P1.D2.2) |
| C17 | Order names or paths | sorts or compares names or paths for display or choice | the fixed list in P1.D2.0.5 |
| C18 | Extract a condition's text | produces the text of a branch or loop condition for display | every decision in the runs used for C4 |

#### P1.D2.0.1 Fixed file names for C3
`a.c`, `a.C`, `a.cc`, `a.cpp`, `A.CPP`, `a.Cpp`, `a.cxx`, `a.c++`, `a.m`, `a.mm`, `a.cu`, `a.h`, `a.H`, `a.hh`, `a.hpp`, `a.hxx`, `a.h++`, `a.inl`, `a.ipp`, `a.tcc`, `a.tpp`, `a.txt`, `a`, `.h`, `a.c.bak`, `a.tar.gz`, `dir.c/file`, `dir.h/file.c`.

#### P1.D2.0.2 Fixed names for C5
`f`, `ns::f`, `a::b::c`, `A::operator()`, `A::operator::`, `A::~A`, `f<int>`, `std::vector<int>::push_back`, `(lambda at x.cpp:3:5)`, `ä::ü`, `/a/b/c.cpp`, `C:\a\b\c.cpp`, `c.cpp`, `/a/b/`, and the empty name.

#### P1.D2.0.3 Fixed paths for C6 and C15
`/a/b/c.c` with `/a/b/d.c`; `/a/b/c.c` with `/a/b/c.c`; `/a/b/c.c` with `/a/x/c.c`; `/a/b/c.c` with `/z/b/c.c`; `/a/b/c/d.c` with `/a/b/e.c`; `/a/b/c.c` with `/a/b/`; `C:\a\b\c.c` with `C:/a/b/d.c`; `c:\a\b\c.c` with `C:\a\b\d.c`; `a/b/c.c` with `a/b/d.c`; `/a//b/c.c` with `/a/b/d.c`; `/a/./b/c.c` with `/a/b/d.c`; `/a/b/../b/c.c` with `/a/b/d.c`; a path with spaces; a path with non-ASCII characters; a path reached through a symbolic link and its real path.

#### P1.D2.0.4 Non-ASCII list for C14
`é`, `ß`, `İ`, `ı`, `漢`, `🙂`, a combining accent alone, a right-to-left mark.

#### P1.D2.0.5 Fixed names for C17
`common/src/a.c`, `common_smp/src/a.c`, `common_modules/a.c`, `ports/linux/a.c`, `ports_smp/linux/a.c`, `a_b`, `a-b`, `a.b`, `a/b`, `A`, `a`, `Ä`, `ä`, `z`, `İ`, `i`, `ı`, `10`, `9`, `x10`, `x9`, `_x`, `x_`, and the empty name.

### P1.D2.1 Enumeration
- **P1.D2.1.a Implementations found.** Instances: one per capability. Check: the detection rule run over product code, and the same rule run by the token scan (P1.0.5); both lists equal. Pass: equal. Otherwise needs review with both lists. Severity: S3.
- **P1.D2.1.b Every implementation read.** Instances: one per implementation found. Check: reading confirms the function performs the capability. Pass: confirmed with file and line. A detector hit that is not the capability is removed from the list with its reason. Severity: S3.

### P1.D2.2 Contracts
- **P1.D2.2.a Contract written.** Instances: one per implementation. Check: write down its inputs, its output, its side effects, its failure behaviour and its time limit if any, each with file and line. Pass: all five written. Severity: S3.

### P1.D2.3 Pairs
- **P1.D2.3.a Pair compared.** Instances: one per unordered pair of implementations of the same capability, for capabilities with an input set. Check: run both on every input of the input set and compare outputs exactly. Pass: never. Each instance ends as one of: **duplicate** (same output on every input: fail S3, one of the two is redundant), **divergent** (different output on at least one input: fail S1 when either output reaches a sink of P1.0.6 item 1 or 3, S3 otherwise; the record names the first differing input and both outputs), or **not comparable** (different contracts by P1.D2.2: needs review with both contracts).
- **P1.D2.3.b Contract pair compared (C16).** Instances: one per unordered pair of implementations of C16. Check: compare contracts: what is waited for, the limit, what happens at the limit. Pass: never. Each instance ends as duplicate (S3) or as not comparable with reasons (needs review).

**Validation (P1.D2).** Positives confirmed in the real code on 2026-11-09: C3 has an implementation in `src/renderer/lib/flow.ts` and one in `src/main/lsp.ts`, and their header lists differ (`tpp`); C12 has `loopsAt` in `src/shared/flowcore.ts` and `loopsAt` in `src/shared/flowseq.ts`; C6 has one implementation in `src/shared/defpick.ts` and one inside `nearest` in `src/renderer/lib/flow.ts`; C5 has `short` in `src/renderer/components/GridView.tsx` and in `src/renderer/probe.ts`; C17 uses `localeCompare` in `src/renderer/lib/flow.ts` and `src/shared/defpick.ts`, and a default `Intl.Collator` in `src/renderer/lib/flow.ts`; C7 is called six times per build in `src/renderer/lib/flow.ts`. Negatives: a sample function that tests a file extension for `.json` is not C3; a sample function that sorts numbers is not C17.

## P1.D3 Copied code

**Truth:** exact comparison of normalised tokens; thresholds fixed here.

### P1.D3.1 Token clones
**Normalisation:** comments and white space removed; every identifier replaced by one placeholder; every string, number and regular expression literal replaced by one placeholder per literal kind; every other token kept as is.

- **P1.D3.1.a Clone pairs.** Instances: one per pair of non-overlapping regions in product code, in one file or in two, with 50 or more consecutive equal normalised tokens. Check: such a pair exists. Pass: never (each instance is a fail). Record: both regions and the token count. Severity: S3.
- **P1.D3.1.b Equal function bodies.** Instances: one per pair of product functions with five or more statements whose normalised bodies are equal. Pass: never. Severity: S3.

### P1.D3.2 Repeated literals
- **P1.D3.2.a Repeated text and patterns.** Instances: one per string or regular expression literal of 20 or more characters that appears, exactly, in two or more product files. Pass: never. Record: the literal and every place. Severity: S3, raised to S1 when P1.D2 shows two copies of the same purpose differ.
- **P1.D3.2.b Repeated limits.** Instances: one per numeric literal of 100 or more, or any time limit in milliseconds, that appears in two or more product files. Check: reading decides whether the places mean the same limit. Pass: they mean different things, with the meaning of each written. Otherwise fail: one limit with several copies. Severity: S3.

**Validation (P1.D3).** Positives: two sample functions equal except for names; a sample regular expression of 25 characters in two sample files; in the real code, the value 20000 as the crawl limit in `src/renderer/lib/flow.ts` and as the source cap in `src/main/lsp.ts`. Negatives: two sample functions of the same shape but 30 tokens long; a 19-character literal in two sample files.

## P1.D4 Unaccounted code

### P1.D4.1 Exports
- **P1.D4.1.a Export used.** Instances: one per export of a product file that is not an entry (P1.0.3). Check: some file imports it. Pass: imported by product code. Record: the export. Severity: S3. (Exports imported only by checks or tests are judged by P1.D1.5.b.)

### P1.D4.2 Code that never runs
**Runs that count:** the unit tests; each smoke scenario on its own sample (jump, default, boot, watch, fonts, exits, values, programs, change); the probe on `samples/tinyhttp`; the probe on the ThreadX test copy. Coverage is collected from the main process by Node's built-in coverage and from the window by Chromium's precise coverage, both offline, in a test build (R10). These runs need the user's yes for their commands.

- **P1.D4.2.a Coverage collected.** Instances: one per run that counts. Check: coverage was produced for both processes. Pass: produced. Otherwise every unit in P1.D4.2 that depends on it is "not checked". Severity: S3.
- **P1.D4.2.b Function runs.** Instances: one per product function. Check: it ran at least once in the union of the runs. Pass: ran. Otherwise needs review with the question: which user action reaches it; the answer either names a later test unit that must reach it (fail S3: not covered by any check) or shows it is unreachable (fail S3: dead code).
- **P1.D4.2.c Branch runs.** Instances: one per arm of every `if`, `else`, conditional expression, `switch` case, `&&`, `||`, `??` and optional chain in product code. Check: the arm ran at least once. Pass and record as P1.D4.2.b.

### P1.D4.3 Unused names
**Check method:** the TypeScript compiler run once more with unused locals, unused parameters and unreachable code reported, using a separate settings file in `tools/sweep/` that extends the repository's settings; the repository's own settings are not changed.

- **P1.D4.3.a Unused local or import.** Instances: one per such report in product code. Pass: never. Severity: S3.
- **P1.D4.3.b Unused parameter.** Instances: one per such report in product code. Check: reading decides whether the parameter is required by a contract (a callback signature, an interface). Pass: required, with the contract named. Otherwise fail. Severity: S3.
- **P1.D4.3.c Unreachable code.** Instances: one per such report, and one per condition in product code that is a constant (`true`, `false`, a literal number). Pass: never. Severity: S3.

### P1.D4.4 Orphan files
- **P1.D4.4.a File reached.** Instances: one per product file. Check: it is an entry or is reachable from an entry by imports. Pass: reachable. Severity: S3.

### P1.D4.5 Settings and text keys
- **P1.D4.5.a Setting read.** Instances: one per setting key defined in the settings schema. Check: product code reads it. Pass: read. Severity: S3.
- **P1.D4.5.b Setting defined.** Instances: one per setting key read in product code. Check: the schema defines it. Pass: defined. Severity: S2.
- **P1.D4.5.c Text key defined.** Instances: one per (translation key used in product code, language table). Check: the table defines the key. Pass: defined. Severity: S1 (the user would see a key instead of text).
- **P1.D4.5.d Text key used.** Instances: one per key defined in any language table. Check: product code uses it. Pass: used. Severity: S3.

**Validation (P1.D4).** Positives: a sample export nobody imports; a sample function no sample run calls; a sample setting read but not defined. Negatives: a sample export imported by another sample; a sample parameter required by a callback signature.

## P1.D5 Text parsing where structure may exist

### P1.D5.1 Inventory
- **P1.D5.1.a Every pattern listed.** Instances: one per regular expression literal and per `RegExp` construction in product code. Check: both readers of P1.0.5 find it. Pass: both find it. Otherwise needs review. Severity: S3.
- **P1.D5.1.b What it reads.** Instances: one per pattern. Check: trace the text the pattern is applied to, back to its origin, and classify it as exactly one of: C or C++ source text; clangd reply text (syntax tree dump, hover, messages); a file path; text shown in the UI; settings or command text; other. Truth: the trace, with each step's file and line. Pass: classified with the trace. Severity: S3.
- **P1.D5.1.c What it is for.** Instances: one per pattern that reads source text or clangd reply text. Check: write its purpose in one sentence and the exact set of inputs it must accept and reject. Pass: written. Severity: S3.

### P1.D5.2 Structure available
**Closed list of structured sources:** clangd's syntax tree request, document symbols, document highlights, hover, definition, call hierarchy, semantic tokens, inactive regions; and, as truth only, clang's JSON syntax tree.

- **P1.D5.2.a Replaceable.** Instances: one per pattern from P1.D5.1.c. Check: decide whether a structured source in the closed list gives the same information. Pass: none gives it, with the reason. Otherwise fail: the pattern should be replaced, naming the source. Severity: S3, raised to S1 if P1.D5.3 finds a wrong result.

### P1.D5.3 Attacks
**Closed list of attack classes:**
1. The construct inside a line comment.
2. The construct inside a block comment.
3. The construct inside a string literal.
4. The construct inside a character literal.
5. The construct split across lines.
6. Windows line endings.
7. Tabs and mixed indentation.
8. The construct produced by a macro, and a macro that looks like the construct.
9. Nested parentheses, brackets and template angle brackets.
10. Non-ASCII identifiers and non-ASCII text before the construct on the same line.
11. The construct in code disabled by `#if 0` or an inactive `#ifdef`.
12. An input of 100,000 characters on one line.

- **P1.D5.3.a Pattern under attack.** Instances: one per (pattern from P1.D5.1.c, attack class). Input: a small C or C++ text written for that pattern and that class, stored in `tools/sweep/fixtures/`, with its expected result written next to it from the pattern's purpose (P1.D5.1.c) and confirmed by clang's JSON syntax tree. Check: the pattern's result equals the expected result. Pass: equal. Record: the input, both results. Severity: S1 when the pattern's result reaches a sink of P1.0.6 item 1 or 3, S3 otherwise.

### P1.D5.4 Run time on hostile input
- **P1.D5.4.a Pattern stays fast.** Instances: one per pattern in product code. Input: for each repeated part of the pattern, a run of 100,000 characters that the repeated part accepts, followed by one character that makes the whole match fail. Check: time to finish. Pass: under 50 ms. Record: the input's shape and the time. Severity: S2.

### P1.D5.5 Reading clangd's text dump
- **P1.D5.5.a Dump pattern against real dumps.** Instances: one per (pattern that reads clangd's syntax tree dump, declaration kind) for these kinds: a parameter whose type is a macro; a parameter of function-pointer type; an unnamed parameter; a K&R parameter; an array parameter; `const` and `volatile` parameters; a parameter with a default value; a variadic function; a parameter whose name equals a type name. Input: clangd's dump for a fixture declaring that kind. Check: the values the pattern extracts equal those in clang's JSON syntax tree for the same declaration. Pass: equal. Severity: S1.

**Validation (P1.D5).** Positives confirmed in the real code on 2026-11-09: the class-base pattern in `src/renderer/lib/flow.ts`; the thread pattern exported from `src/shared/flowcore.ts`; the process-spawn pattern in `src/renderer/lib/flow.ts`; the interrupt-name and interrupt-mark patterns in `src/renderer/lib/flow.ts`; the parameter pattern in `src/shared/flowfacts.ts`. Negatives: a sample pattern applied only to a settings key is classified "settings or command text".

## P1.D6 State and caches

### P1.D6.1 Inventory
- **P1.D6.1.a Every long-lived state listed.** Instances: one per module-level binding declared with `let` or `var`; one per module-level binding to a map, set, array or object that is changed anywhere; one per module-level signal; one per field of a class of which the app keeps a single long-lived instance. Check: both readers of P1.0.5 find it. Pass: both find it. Otherwise needs review. Severity: S3.
- **P1.D6.1.b One owner.** Instances: one per state item. Check: list every module that writes it. Pass: exactly one module writes it, or the writes from other modules all go through functions exported by the declaring module. Record: every writer with file and line. Severity: S3.

### P1.D6.2 Cache keys
- **P1.D6.2.a Key complete.** Instances: one per cache (a state item that stores computed values under a key). Check: list every input the computing code reads; compare with what the key contains. Pass: every input that can change between two uses is in the key, or is a trigger that clears the cache (P1.D6.4). Record: each missing input. Severity: S1 when the cached value reaches a sink of P1.0.6 item 1 or 3, S2 otherwise.

### P1.D6.3 Bounds
- **P1.D6.3.a Bounded.** Instances: one per cache and per list that only grows. Check: a size limit, an eviction, or a clearing on a trigger that happens in normal use. Pass: present, with file and line. Otherwise fail; the item is also added to the Part 6 risk list. Severity: S2.

### P1.D6.4 Clearing on triggers
- **P1.D6.4.a Depends on trigger.** Instances: one per (state item, trigger of P1.0.7). Check: decide from what the value is computed whether the trigger can make it wrong. Truth: the computing code's reads, with file and line. Pass: the answer is written. Severity: S3.
- **P1.D6.4.b Cleared on trigger.** Instances: one per (state item, trigger) answered "can make it wrong" in P1.D6.4.a. Check: the trigger's handler reaches code that clears or rebuilds the item, by following calls in our code. Pass: reached, with the path. If the path goes through a call that cannot be followed without running the app, the verdict is "not checked" and the record names the Part 3 unit that will confirm it. Otherwise fail. Severity: S1 when the item's value reaches a sink of P1.0.6 item 1 or 3, S2 otherwise.

**Trigger handlers** are found by this rule: every subscription to a bridge event, every window or document event listener, every handler registered in the main process for the triggers of P1.0.7, the functions that start clangd and change the open folder, the editor's change listener, and the function that switches programs.

### P1.D6.5 Placeholders
- **P1.D6.5.a Placeholder handled.** Instances: one per read of a module-level state item whose first value is a placeholder (empty text, `null`, `-1`, an empty collection) in a function that can run before the real value is set. Check: the read handles the placeholder. Truth: the read site and the guard, with file and line. Pass: handled. Severity: S2.

**Validation (P1.D6).** Positives confirmed in the real code on 2026-11-09: the maps `texts`, `flowCache` and `candidates` in `src/renderer/lib/flow.ts` have no size limit; `nameIdx`, `taken` and `lastCrawl` are module-level state in the same file; the module-level bindings in `src/renderer/lib/flowstore.ts` (`builtFor`, `firstBuild`, `building`, `again`, `builtEpoch`, `chosen`, `side`). Negatives: a sample cache with a size limit of 10 and eviction of the oldest entry.

## P1.D7 Error discipline

**Closed list of visible sinks:** the status line, the run status, the clangd message, a flash message, the app log, a reply `{ ok: false, message }` across the process boundary that the window shows.

### P1.D7.1 Inventory
- **P1.D7.1.a Every handler listed.** Instances: one per `catch` clause, per `.catch(` callback, per rejection callback of `.then`, per `finally` block that returns a value, in product code. Check: both readers of P1.0.5 find it. Pass: both find it. Otherwise needs review. Severity: S3.

### P1.D7.2 Handler behaviour
- **P1.D7.2.a Discards or keeps.** Instances: one per handler. Check: does the handler discard the error (empty body, or a neutral value returned without passing the error on)? Pass: the answer is written. Severity: S3.
- **P1.D7.2.b Reaches a visible sink.** Instances: one per handler. Check: the handler, or the code it hands the error to, reaches a visible sink. Pass: reached, with the path. Otherwise go to P1.D7.2.c. Severity: S3.
- **P1.D7.2.c Silence justified.** Instances: one per handler that reaches no visible sink. Check: one of exactly two justifications holds: the operation is a best-effort step whose failure leaves every sink of P1.0.6 unchanged; or the code continues on a fallback that gives the same result at every sink. Truth: reading, with file and line. Pass: one holds, named. Otherwise fail. Severity: S1 when the silent failure can change a sink of P1.0.6 item 1 or 3, S2 otherwise.

### P1.D7.3 Promises left running
- **P1.D7.3.a Rejection handled.** Instances: one per promise-returning call in product code whose result is neither awaited, returned, nor given a rejection handler. Pass: never (each instance is a fail). Severity: S2.

### P1.D7.4 Time limits
- **P1.D7.4.a Expiry visible.** Instances: one per time limit in product code (a timer used as a deadline, a race against a timer, a wait loop with an end time). Check: when the limit expires, a visible sink states the reason. Pass: stated. Severity: S2.
- **P1.D7.4.b Expiry consistent.** Instances: one per time limit. Check: when the limit expires, every flag or state the waiting code set before waiting is reset or left valid. Pass: reset or valid, with file and line. Severity: S2.

### P1.D7.5 Last-resort handlers
- **P1.D7.5.a Main process.** Instances: one per kind: uncaught exception, unhandled rejection. Check: the main process registers a handler that writes to the app log. Pass: registered. Severity: S2.
- **P1.D7.5.b Window.** Instances: one per kind: error event, unhandled rejection. Check: the window registers a handler that writes to the app log through the bridge. Pass: registered. Severity: S2.

**Validation (P1.D7).** Positives: a sample empty `catch`; a sample promise called without `await` or handler; a sample timer deadline with no message. Negatives: a sample `catch` that sets the status line; a sample `catch` on a cache write whose failure changes nothing.

## P1.D8 Results that depend on the machine or on timing

**Closed list of hazard patterns:**
1. `localeCompare`.
2. `Intl.Collator` created without a fixed locale and fixed options.
3. Any `toLocale…` method.
4. The current date or time (`Date.now`, `new Date`, `performance.now`).
5. Random numbers (`Math.random`, crypto random).
6. Iterating a map, set or object whose entries are inserted inside asynchronous callbacks that can finish in different orders.
7. A sort whose comparison can return zero for two different elements.
8. A sort without a comparison function on values that are not text.
9. `JSON.stringify` of an object used as a key.
10. Floating-point values compared for equality or rounded before a discrete decision.

### P1.D8.1 Inventory
- **P1.D8.1.a Every hazard listed.** Instances: one per occurrence of a pattern in product code. Check: both readers of P1.0.5 find it, for patterns 1 to 5, 8 and 9; patterns 6, 7 and 10 are found by the compiler reader and confirmed by reading. Pass: found and, where stated, confirmed. Severity: S3.

### P1.D8.2 Effect
- **P1.D8.2.a Reaches a sink.** Instances: one per occurrence. Check: follow the value to the sinks of P1.0.6. Truth: the path, with file and line. Pass: the answer is written. Severity: S3.
- **P1.D8.2.b Hazard decided.** Instances: one per occurrence. Check: it is harmless (the value reaches only timing records or log timestamps), or it is a hazard (it can change a sink of P1.0.6). Pass: harmless, with the path. A hazard is a fail, and its record names the Part 2 unit that will confirm it by running under two locales and shuffled timing. Severity: S1 when it reaches a sink of item 1 or 3, S2 otherwise.

**Validation (P1.D8).** Positives confirmed in the real code on 2026-11-09: `localeCompare` in the program sort and in `stablePick`; a default `Intl.Collator` in `buildRun`; the `nodes` map in `crawl` filled from a pool of asynchronous requests. Negatives: `performance.now` used only to compute a duration written to the log.

## P1.D9 Holes in typing

**Closed list of occurrences:** an explicit `any` (as a type, a type argument or a cast); a double cast through `unknown`; a cast of data from outside the process (a bridge reply, a clangd reply, parsed JSON, browser storage, a file read); a non-null assertion; a directive that silences the type checker.

### P1.D9.1 Inventory
- **P1.D9.1.a Every occurrence listed.** Instances: one per occurrence in product code. Check: both readers of P1.0.5 find it. Pass: both find it. Otherwise needs review. Severity: S3.

### P1.D9.2 Outside data
- **P1.D9.2.a Origin.** Instances: one per occurrence. Check: the value comes from outside the process or from our own code. Truth: the trace, with file and line. Pass: classified. Severity: S3.
- **P1.D9.2.b Checked before use.** Instances: one per occurrence classified as outside data. Check: on every path from where the value enters to where it is used, its shape is checked (type tests, array tests, property tests). Pass: checked, with each check's file and line. Severity: S2, raised to S1 when an unchecked wrong shape could change a sink of P1.0.6 item 1 or 3.

### P1.D9.3 Our own data
- **P1.D9.3.a Invariant stated.** Instances: one per non-null assertion or cast on our own data. Check: write the invariant that makes it safe and where it is established. Pass: written, with file and line. Otherwise fail. Severity: S2.

### P1.D9.4 Stricter compile
**Check method:** the TypeScript compiler run once more with implicit `any`, strict null checks and checked index access reported, using a separate settings file in `tools/sweep/`; the repository's own settings are not changed.

- **P1.D9.4.a Each report judged.** Instances: one per report in product code. Check: reading decides whether the reported value can be missing or of the wrong type at run time. Pass: it cannot, with the reason and file and line. Otherwise fail. Severity: S2.

**Validation (P1.D9).** Positives confirmed in the real code on 2026-11-09: a double cast through `unknown` in `movedDb` in `src/main/main.ts`; `any` in parameters in `src/renderer/probe.ts`. Negatives: a sample cast of a value right after an array test.

## P1.D10 Reactive discipline in the UI

**Scope:** files in the components, lib, checks and shell layers that use the UI framework's reactive primitives.

### P1.D10.1 Inventory
- **P1.D10.1.a Every reactive primitive listed.** Instances: one per memo, computed, effect, render effect, selector, resource, `on` wrapper, mount handler and cleanup handler. Check: both readers of P1.0.5 find it. Pass: both find it. Otherwise needs review. Severity: S3.

### P1.D10.2 Memos are pure
- **P1.D10.2.a No side effect.** Instances: one per memo, computed and selector. Check: its body writes no signal, store, page element, module-level state, browser storage or bridge call. Pass: none. Record: each write with file and line. Severity: S1.

### P1.D10.3 Effects do not feed themselves
- **P1.D10.3.a No self-feeding.** Instances: one per effect and render effect. Check: the effect writes no signal it also reads, or an equality test prevents a second run. Pass: neither, or the test is named with file and line. Severity: S2.

### P1.D10.4 Declaration order
- **P1.D10.4.a Nothing used before it is declared.** Instances: one per reference, inside a callback that runs immediately on creation (memo, computed, render effect, selector, or `on` without deferral), to a `const` or `let` declared later in the same function scope. Pass: never (each instance is a fail). Severity: S2 (the app stops with "used before defined").

### P1.D10.5 Every resource released
- **P1.D10.5.a Listener, timer, observer, frame request released.** Instances: one per event listener, timer, interval, observer or animation frame request created in a component or in an effect. Check: a matching removal runs in a cleanup handler or in the effect's own cleanup. Pass: present, with file and line. Otherwise fail; the item is also added to the Part 6 risk list. Severity: S2.

### P1.D10.6 Untracked reads
- **P1.D10.6.a Read tracked when it matters.** Instances: one per signal read inside an asynchronous callback (timer, promise continuation, animation frame) that is itself inside a memo or effect. Check: the result of the read does not decide the memo's value or the effect's output. Pass: it does not, with the reason. Otherwise fail. Severity: S1.

### P1.D10.7 Component size and concerns
**Closed list of concerns:** turning engine data into display values; geometry and layout arithmetic; measuring the page; handling keys, pointer and wheel events; producing markup.

- **P1.D10.7.a Length.** Instances: one per component file. Check: 400 lines or fewer. Pass: 400 or fewer. Severity: S3.
- **P1.D10.7.b Reactive count.** Instances: one per component file. Check: 30 reactive primitives or fewer. Pass: 30 or fewer. Severity: S3.
- **P1.D10.7.c Concerns.** Instances: one per component file. Check: count the concerns present, each shown by file and line. Pass: two or fewer. Severity: S3.

### P1.D10.8 Shared state written from two layers
- **P1.D10.8.a One layer writes.** Instances: one per module-level signal. Check: its writers are all in one layer, or all writes from other layers go through functions of the declaring module. Pass: so. Record: each writer with its layer. Severity: S3.

**Validation (P1.D10).** Positives: a sample memo that sets a signal; a sample memo that reads a constant declared after it; a sample component that adds a window listener with no cleanup; a sample effect that reads and writes the same signal. Negatives: a sample effect that adds a listener and removes it in its cleanup; a sample memo that only reads signals.

## P1.Z Part 1 is complete when

1. Every detector of Part 1 has passed validation (P1.V).
2. Every unit instance of P1.0 to P1.D10 has exactly one verdict, and every needs review has been answered or carried, by name, into the Phase 4 list.
3. The Part 1 report was produced twice on the same state and the two are byte-identical apart from timestamps (R6).
4. The content hash of R1 is equal before and after.
5. The findings file and the chat summary have been produced as in section 6.

---

# Part 2: Engine correctness

**Purpose.** Prove, fact by fact, that what the engine states about a program is true and complete: which programs exist, which function each call reaches, the order of steps, the conditions and loops around them, the ways out, what each function changes, the text shown for each call, pointer targets and thread starts, the derived views, versions and configurations, and the repair engine's edits.

**What Part 2 is not.** It checks the engine's outputs as the engine returns them, not as the page draws them (Part 5), and not speed or robustness (Part 3).

## P2.0 Contract, truth and scoring

### P2.0.1 The engine's contract (closed list)
1. `docs/FLOW-DESIGN.md` sections 2 (the analyser and its evaluation order), 3 (programs and how they connect), 3c and 4 (what the sequence derives from the run: folding, numbering, chapters, what-if, the walk's link and the walkthrough), 5 (the code rows of the detail levels), 6 (stepping and static truth), 7 (what each move does, not the keys that start it), 8 (the fact engine, its rules, its wording table and its three grades), 8b (analyses), 9 (large codebases), 10 (C and C++ read as gcc or MSVC) and 10b (built since).
2. The exactness rule of `docs/FLOW-DESIGN.md` section 8: everything stated is true; nothing unproved is stated as proved; unknown stays unknown.
3. Where a feature description in item 1 allows something that item 2 forbids, item 2 governs, and the difference is also recorded as an S3 finding against the design document.
4. Where two sections of item 1 say different things about the same fact, the unit's verdict is needs review, its record quotes both texts, and an S3 finding is recorded against the design document. The unit is decided once the user has said which text governs and the design document has been corrected.

Every expected answer in Part 2 cites the contract item or the truth source it comes from.

### P2.0.2 Truth sources (closed list)

| ID | Source | How it is obtained | Trusted for | Not trusted for |
|---|---|---|---|---|
| T1 | clang's JSON syntax tree | clang run with `-fsyntax-only` and its JSON syntax-tree dump, on the same file with the same compile command the engine uses | calls and the declaration each reaches, positions as written and through macros, canonical types, statements, assignments and their targets, address-of, reads | what runs on which thread; anything across translation units |
| T2 | clangd replies | requests the engine's derivation does not use for that fact: definition, document highlights with their read and write kinds, hover types, inactive regions | where a name is defined, read or written; a declared type | facts the engine itself derived from the same reply |
| T3 | The compile database | the fixture's own `compile_commands.json` | which files the build compiles | which program links which file |
| T4 | Generator ground truth | the spec a generated program was written from (P2.G) | the program's call tree, order, conditions, loops, writes | anything the generator did not write |
| T5 | Hand-worked answers | written in each fixture's answers file before the engine is ever run on it; the file's hash recorded at that moment | the facts listed in it | facts not listed in it |
| T6 | Invariance | the same fixture under a transformation that must not change a fact (P2.M) | equality of facts across the transformation | correctness of either side |

**Clang binary for T1.** On macOS, Xcode's clang (`xcrun clang`); elsewhere, clang from the installed LLVM pack. Its version is recorded. If no clang binary is present, Part 2 does not start, and the user is asked to approve installing the LLVM pack.

### P2.0.3 Fact kinds (closed list)

Each fact kind has a definition, an equality rule, and its truth sources. A produced fact is compared to an expected fact by the equality rule only.

**Common equality rules, used by name below:**
- **Line:** lines are 1-based and must be equal.
- **Column:** both sides are turned into UTF-16 code units from the start of the line (clang's columns are bytes; the engine's are UTF-16) and must be equal.
- **Text:** both sides have line splices (a backslash followed by a line end) removed, then every run of white space, line ends included, turned into one space, then trimmed; the results must be equal.
- **Name:** exact, including any qualifier the engine shows; when the engine shows a shortened name, its full name from the run must be equal.
- **File:** the absolute path, with the folder under test as its root, must be equal.
- **Set:** the two sets of items must be equal; order is not compared unless the fact kind says so.

| Kind | Definition | Equality | Truth |
|---|---|---|---|
| F1 | A program: an entry point's file, function name, line, kind (`main` or interrupt) and its name (from a CMake or Meson file when one names it); for a folder with no `main`, the public API start: the set of functions the flow starts from | File, Name, Line, kind and name exact; the API set by Set | T1, T5 |
| F2 | Program order class: entries the ranking puts first versus last, by the path classes of `docs/FLOW-DESIGN.md` section 9 | every first-class entry listed before every last-class entry | T5 |
| F3 | A call edge: the call site (File, Line, Column) and the definition it reaches (File, Line) | all exact | T1, T2, T3, T5 |
| F4 | A step: its kind (step, reference, indirect, value), its function, its caller step, its call site, its position in the run | kind, Name, caller by position, call site by Line and Column, order exact | T1, T4, T5 |
| F5 | A frame around a step: kind (loop, arm, guard, thread), label (`then`, `else`, `case <expr>`, `default`, `for`, `while`, `do`, `return`, `break`, `continue`, `goto`, `throw`), the construct's text, its owner function | kind and label exact, text by Text, owner by Name | T1, T4, T5 |
| F6 | A way out of a function: kind (return, throw, break, continue, goto, co_return, never-returning call), Line, text, the conditions leading to it, early or final | kind, Line, Text, Set of condition texts by Text, early or final exact | T1, T5 |
| F7 | Never returns: a function no path of which reaches its end or a return | yes or no exact | T1, T5 |
| F8 | A parameter: name, type as written, canonical type, passing mode (a copy, by pointer, by reference, a view) | name exact, types by Text, mode exact | T1, T2 |
| F9 | A write: the function, the target class (global, member, static local, thread-local, element of global, pointee of parameter, parameter's own copy), the target's name, the Line | all exact | T1, T2, T5 |
| F10 | A use of outside state: the function, the target, and whether it is a read of the value or only its address taken | all exact | T1 |
| F11 | A lock held (the mutex as written, the line it is taken, and the line it is released or the end of its scope), an allocation (the type allocated, for `new`, `make_unique` and `make_shared`; the function's name for the malloc family, which allocates no type), a possible throw (the type thrown); each with its function and Line, as the wording table of `docs/FLOW-DESIGN.md` section 8 states them | all exact, mutex and type by Text | T1, T5 |
| F12 | Purity: pure, not pure, not known. Pure is what the wording of `docs/FLOW-DESIGN.md` section 8 says, "reads only its arguments": the function reads nothing but its parameters, what they point to, the object it is called on and its own locals; it writes nothing but its own locals; every call it makes is pure. Not known when it calls a function outside the project that no library table describes | exact | T1 |
| F13 | The call as written, and where the result goes (a variable, returned, used in a decision, thrown away, none) | call by Text, target exact | T1, T5 |
| F14 | A note on a step | P2.S6.R1 | T1, T5 |
| F15 | Passing: each argument as written, the parameter it binds to, the passing mode, and the earlier step it comes from | argument by Text, rest exact | T1, T5 |
| F16 | Results used: each later step or decision that reads a step's result | Set by step position and Line | T1, T5 |
| F17 | A junction: kind (exit, arm), the Line of its condition's keyword, the condition text, the then text and its Line, the steps in its arm | all exact, texts by Text | T1, T5 |
| F18 | A what-if: the steps folded when one condition is flipped, and the count stated | Set of steps and count exact | T5 |
| F19 | Candidates of an indirect call: the set of functions it could reach, and its grade | Set exact, grade exact | T1 (canonical types and address-of), T5 |
| F20 | A hand-over: a function named without being called (stored, passed, registered), and whether the engine runs it as a thread | Name, Line, thread yes or no exact | T1, T5 |
| F21 | A loop count: fixed count stated, or "depends on data" | exact | T1, T5 |
| F22 | A grid cell: caller function, called function, the step numbers in it; row and column totals; the cross-file share | all exact | T4, T5 and the run |
| F23 | A chapter: name and its first and last step | exact | T5 |
| F24 | A finding: race, result thrown away, pair not closed; with its places | kind and places exact | T5 |
| F25 | A watch or journey hit: the step and how (sets, reads, passed on as, returns, a copy) | Set exact | T1, T5 |
| F26 | A value settled per call: the arm ruled out and its stated reason | arm by Line, reason by Text | T5 |
| F27 | A configuration fact: a step only in one setting, or a ghost not in this build | step and setting exact | T5 |
| F28 | A change fact: added, removed, changed (with line count), now inside a condition | each exact | T5 |
| F29 | A repair suggestion: the edit, the errors it clears, no new error anywhere, no cast | all exact | T1 (errors before and after), T5 |
| F30 | A limit stated: depth cut, node limit, functions not found, approximate placement | the statement is present whenever its limit is reached | T4, T5 |
| F31 | A folded call: a call shown inside its caller's row (`uses …`) instead of on a row of its own | Set per caller exact | T1 (the function's extent, its calls, and the frames around the call) with the rule of `docs/FLOW-DESIGN.md` section 4: folded exactly when the function has 3 lines or fewer or is an operator, calls nothing, and runs where it is called with no condition or loop of the caller around the call |
| F32 | How often a step runs: the count or range stated, and its grade | exact | T1 with the rule of `docs/FLOW-DESIGN.md` sections 2 and 8: the product of the counts of the loops around it; a static initializer once; inside a loop whose count is not known, the count per pass of that loop, graded unknown; "at most" when a condition is around it |
| F33 | A step's numbers: its step number, its function number, and which call of that function it is | exact | the run, by the rule of `docs/FLOW-DESIGN.md` section 4 |
| F34 | A move: from a position and its loop passes, the move, and then the new position and passes, or the refusal and its reason | exact | the run, by the rules of `docs/FLOW-DESIGN.md` sections 6 and 7 (P2.S11) |
| F35 | A card fact: how many times the function is called and by whom with each caller's count, its signature as written, the library calls in its body, the number of loops in its body, the thread the step runs on, the two files the call crosses | counts and Sets exact, signature by Text, files by File | T1, T5 |
| F36 | A sentence: any text the engine composes for a fact (row notes, card lines, step facts, junction words, what-if questions, the captions of moves, walkthrough lines) | the sentence equals its template, as confirmed under P2.C.3, filled with the fact's own values; names and conditions by Text, numbers exact | P2.C.3, T1, T5 |
| F37 | How programs connect: one program starts another (by `system`, the `exec` family, `posix_spawn` or `CreateProcess`, with a string naming the other program); each file used by more than one program, with the programs that use it | Sets exact | T1, T5 |
| F38 | A code row of a detail level: the line number and text of each source line shown under a function at the decisions level and at the all-code level | Line exact, text verbatim | the file's text with the rule of `docs/FLOW-DESIGN.md` section 5: at the decisions level, only lines whose statement is an `if`, `else`, `switch` (with its `case` and `default` labels), `return`, `break`, `continue`, `throw` (with `try` and `catch`), `goto`, `co_return` or a loop header; at the all-code level, every line of the body except blank lines, lone braces and the lines of calls shown as rows; never a line inside a comment, a string or inactive code; a long block cut only with the number of lines left out stated |
| F39 | A walk kept outside the app: the walk's link and the walkthrough file | the link opens to the same positions, passes and notes; each walkthrough line is true of its place | the run, P2.S11 |
| F40 | A graph fact: what the status line and the programs view state about the whole trace: the functions and files reached, the files never reached, each program's function numbers and file-to-file lines, loop labels, calls not yet resolved, and each limit reached | counts and Sets exact, labels by Text | the run, T1, T5 |
| F41 | A preview card: for the function under the cursor, each call it makes with the definition shown (file, first line, text), its kind (call, macro, static_assert, lambda, through a pointer), its call sites, the number of cards hidden or folded into "+N more", and for a card the depth and the number of functions below it | all exact, text verbatim | T1, T5, and the settings' own descriptions of `preview.include_std`, `preview.include_other` and `preview.max_cards` |
| F42 | A go-to-definition answer: the destination (file and line) of a name, or the reason given when there is none | destination exact; the reason is true of the place | T1, T5 |
| F43 | An unsaved-change mark: the steps whose function's lines differ between the editor and the file on disk | Set exact | the two texts |
| F44 | A helper result: the output of a shared helper the editor relies on (search matches, path and address conversion, colour conversion, settings read and written, symbol names, a file's language) | exact | hand answers (T5) and the rule stated in P2.S13 |

**Grades.** Every fact the engine states with a grade (proved, possible, unknown) is also compared on its grade, by the rule of `docs/FLOW-DESIGN.md` section 8: proved for what holds on every run, possible for a complete set of options one of which happens, unknown for what needs running. A wrong grade is a fail of that fact.

### P2.0.4 The fact dump
For each fixture and each of its entry points, a test-support scenario (`engine-dump`, in the checks layer) opens the fixture folder, waits until clangd has finished indexing and the run has settled, and writes every fact the engine produces to `data/logs/sweep/part2/<fixture>/<entry>.facts`. It reads the same engine functions the views call (the flow graph, the run, the sequence, and the derivations for rows, cards, links, junctions, grid, chapters, findings, watch, journey, values, configurations, change and repair, folding, step numbers, how often, step facts, moves, sentences, code rows, the walk's link and walkthrough, how programs connect, the graph and its status, preview cards, go-to-definition answers, unsaved-change marks and the shared helpers). It does not read the page, except for the facts of P2.0.8, which no engine function returns. Format: one fact per line; the fact kind, then that kind's fields in the order of P2.0.3; lines sorted by kind, file, line, column, then text. The scenario writes nothing else and changes nothing.

### P2.0.5 Units generated per fixture
For every fixture and every fact kind it checks:
- **e-units:** one unit per expected fact. Pass: a produced fact equal to it by its equality rule exists.
- **x-units:** one unit per produced fact of that kind. Pass: it equals an expected fact. A produced fact with no expected counterpart fails: the engine stated something not in the truth.
- **c-unit:** one unit per (fixture, fact kind). Pass: every e-unit and every x-unit of that pair passed.

A fact kind whose truth is not available for a fixture gives "not checked" for all its units there, never pass.

**Severity of Part 2 fails:** S1 for every fact kind, because every fact is shown to the user, with one exception: a produced fact that is true on every run but weaker than the contract requires (for example `at most 4 times` where the contract proves `once`) is S3. S2 when the engine stops, hangs or throws while producing the dump.

### P2.0.6 Fixture rules
1. Every fixture lives in `samples/engine-traps/<stage>/<trap id>/` and holds its source files, an `answers.facts` file in the dump format, and a `compile_commands.json` when the trap needs a project database.
2. Each fixture shows one trap, in the smallest program that reaches it from its entry.
3. `answers.facts` is written by hand from the trap's description in this part, before the engine is run on the fixture. Its hash is recorded in the Part 2 report when it is created. Any later change to it needs the user's approval and is listed, with its reason, in the report's answer-changes list.
4. Every fixture compiles with T1 with no error, except fixtures of P2.S10 and P2.S2.T31, whose purpose is an error.

### P2.0.7 Test-only hooks (R10)
- `hook.clangdDelay`: delays each clangd reply in the main process by a time from 0 to 50 ms drawn from a given seed.
- `hook.listReverse`: reverses the order in which folder listings are returned.
- `hook.noIndex`: starts clangd with its background index turned off, so the engine runs as it does before an index exists.
- `hook.analyserStamp`: replaces the analyser's version stamp, which the kept picture is checked against, with a given text.
- `hook.clangdFail`: makes the n-th clangd request of a given method fail with an error.

### P2.0.8 Facts computed outside the engine (closed list, from the reading of 2026-11-11)

A fact that a component or an editor command works out itself is returned by no engine function, so the dump of P2.0.4 cannot hold it. For the facts below, and only for them, the unit reads the text the page shows, element by element. Each row is also a directness finding (S3) carried to Part 5: a fact should come from the engine and only be drawn by the view.

| Where it is computed | The fact | Units |
|---|---|---|
| `src/renderer/components/GridView.tsx` | the grid's summary (functions called, callers, calls, share of calls that cross a file, most called); the files grid's numbers; the hover tag of a square; the list of routes; the order of play; the step header | P2.S8.I7, P2.S8.I8, P2.S8.I1, P2.S16.T02, P2.S11.I15, P2.S4.I10 |
| `src/renderer/components/Sequence.tsx` | the header's number, the chapter list's numbers, the find list's "runs at", the tour's caption, the run bar's tip; the note on a row for each kind of frame; a top loop's summary; the words of a way out; the list offered for watching; the unsaved-change note; the order of play | P2.S4.I10, P2.S8.T27, P2.S8.T19, P2.C.3, P2.S8.I9, P2.S3.T29, P2.S8.T15, P2.S8.T28, P2.S9.T14, P2.S11.I15 |
| `src/renderer/components/StepPreview.tsx` | the junction card (its two tracks, what decides it, the ways out of its function); the calling line with the call marked; the step header | P2.S8.T26, P2.S6.T20, P2.S4.I9, P2.S4.I10 |
| `src/renderer/components/Programs.tsx` | each program's name in the list; which program starts which; each shared file with its programs | P2.S1.T14, P2.S12.T01–T06 |
| `src/renderer/components/Card.tsx` | a card's depth statement; the label that a card is standard-library code | P2.S14.T05, P2.S14.T09 |
| `src/renderer/components/SettingChip.tsx` | the macros and values offered, and the flags made from a choice | P2.S8.T17 |
| `src/renderer/components/CompareChip.tsx` | the names given to the two versions compared | P2.C.3 |
| `src/renderer/lib/actions.ts` | the list of references to a name, each with its line's text | P2.S15.T04 |
| `src/main/search.ts` with `src/renderer/components/SearchPanel.tsx` | the totals of a search in the folder | P2.S13.H9 |

## P2.V Truth validation (before any engine unit counts)
- **P2.V.1 Clang and clangd agree.** Instances: one per fixture file. Check: the functions defined in it, by name and line, are the same in T1 and in clangd's document symbols. Pass: same. Otherwise the fixture is void until reviewed. Severity: none (validation).
- **P2.V.2 Answers frozen.** Instances: one per fixture. Check: the hash of `answers.facts` equals the recorded hash, or the change is in the approved answer-changes list. Pass: so. Otherwise the fixture is void.
- **P2.V.3 Matcher proven.** Instances: two fixtures kept in `tools/sweep/fixtures/`: one whose answers are exact, one whose answers have exactly one fact changed. Check: the matcher of P2.0.5 gives zero fails on the first and exactly one fail, on that fact, on the second. Pass: so. Otherwise Part 2 is void.
- **P2.V.4 Dump complete.** Instances: one per fact kind. Check: on the two validation fixtures, the dump contains at least one fact of the kind wherever the answers contain one. Pass: so. Otherwise that fact kind is "not checked" in every fixture.
- **P2.V.5 Hooks absent from the shipped build.** Instances: one per hook of P2.0.7. Check: R10 search. Pass: absent.

## P2.S1 Programs found (F1, F2)

- **P2.S1.T01 main in comments.** Fixture: `a.c` has the text `int main(void)` in a line comment and in a block comment; `b.c` defines `int main(void)` returning 0. Expected: exactly one program, `b.c`, `main`, its line, kind main.
- **P2.S1.T02 main in a string.** Fixture: `a.c` has a string literal containing `void main() {}`; `b.c` defines `main`. Expected: one program, `b.c`.
- **P2.S1.T03 main in disabled code.** Fixture: `a.c` defines `main` inside `#if 0 … #endif`; `b.c` defines `main`. Expected: one program, `b.c`.
- **P2.S1.T04 main written by a macro.** Fixture: `a.c` has `#define ENTRY int main(void)` and then `ENTRY { return 0; }`. Expected: one program, `a.c`, `main`, at the line of `ENTRY {` (T1 gives the expansion location).
- **P2.S1.T05 main split over lines.** Fixture: `a.c` writes `int`, `main`, `(void)` on three lines. Expected: one program at the line of `main`.
- **P2.S1.T06 K&R main.** Fixture: `int main(argc, argv) int argc; char **argv; { return 0; }`. Expected: one program.
- **P2.S1.T07 Declared, not defined.** Fixture: `a.c` declares `int main(void);` only; `b.c` defines `main`. Expected: one program, `b.c`.
- **P2.S1.T08 main in a header.** Fixture: `m.h` defines `int main(void)`; `a.c` includes it; the compile database lists `a.c`. Expected: one program at `m.h`'s line (T1 location).
- **P2.S1.T09 Windows entry names.** Fixture: `w.c` defines `wmain`; `x.c` defines `WinMain` with its usual parameters; `y.c` defines `wWinMain`. Expected: three programs, kind main.
- **P2.S1.T10 Interrupt handlers.** Fixture: `isr.c` defines `SysTick_Handler`, `USART1_IRQHandler`, a function with `__attribute__((interrupt))`, `TIMER0_ISR`, and a function named `helper_ISR_table` that is not an interrupt; `main.c` defines `main`. Expected: programs `main` (kind main) and the four handlers (kind interrupt), listed after `main`; `helper_ISR_table` not listed.
- **P2.S1.T11 Ranking classes.** Fixture: `main` defined in `src/main.c`, `demo/main.c`, `samples/s.c`, `tests/t.c`, `tools/gen/main.c`, `ports/x/main.c`, `build/cmake/main.c`. Expected (F2): every entry of `src/`, `demo/`, `samples/` before every entry of `tests/`, `tools/`, `ports/`, `build/`.
- **P2.S1.T12 AVR interrupt.** Fixture: `#define ISR(v) void v(void) __attribute__((signal, used)); void v(void)` and `ISR(TIMER1_COMPA_vect) { tick(); }`; `main` defined in another file. Expected: a program `TIMER1_COMPA_vect`, kind interrupt, listed after `main` (`docs/FLOW-DESIGN.md` section 10b, AVR `ISR(vector)`).
- **P2.S1.T13 A library without main.** Fixture: `include/lib.h` declares `int lib_open(void);` and `int lib_close(void);`; `src/lib.c` defines both and a `static` helper; no `main` anywhere. Expected: the flow starts from the public API, and that start is exactly `lib_open` and `lib_close`; the helper is not a start (`docs/FLOW-DESIGN.md` section 2, entry points).
- **P2.S1.T14 Program names from build files.** Fixture: `CMakeLists.txt` with `add_executable(server src/a_main.c)` and `add_executable(client src/b_main.c)`; `tools/meson.build` with `executable('tool', 't.c')`; each of the three sources defines `main`. Expected: the three programs named `server`, `client` and `tool`, in the list of programs and in the view of how they connect (`docs/FLOW-DESIGN.md` section 3).
- **P2.S1.T15 A main far down.** Fixture: `main` in a file 13 folders below the root. Expected: the program is listed, or the depth limit of the scan is stated (F30).
- **P2.S1.T16 Objective-C sources.** Fixture: `main` in `app.m` and in `tool.mm`. Expected: both programs listed (`docs/FLOW-DESIGN.md` section 2: every `main`).
- **P2.S1.T17 A main in a folder the scan skips.** Fixture: `main` in `out/gen/main.c`, `external/x/main.c` and `vendor/y/main.c`. Expected: each is listed, ranked last, or the folders left out are stated (F30; `docs/FLOW-DESIGN.md` section 9).
- **P2.S1.T18 Public headers deeper down.** Fixture: no `main`; `libs/core/include/core.h` declares `core_init`, defined in `libs/core/src/core.c`. Expected: `core_init` is among the public API starts (`docs/FLOW-DESIGN.md` section 2).
- **P2.S1.T19 Forms of a build target.** Fixture: `add_executable(app ${SRCS})` with the sources in a variable; `add_executable(${NAME} x.c)`; a target inside a `#` comment; two targets that list the same source. Expected: a commented-out target and a target named by a variable name no program; a source no target lists by name keeps the name its file gives; a source two targets list is not given one target's name as its only name.

## P2.S2 Call graph and definitions (F3, F4, F30)

- **P2.S2.T01 One function, two folders, one built.** Fixture: `main.c` calls `f()`; `lib1/f.c` and `lib2/f.c` both define non-static `f` with different bodies (each calls a different helper); `compile_commands.json` lists `main.c` and `lib1/f.c` only. Expected: the call reaches `lib1/f.c`; the run shows `lib1`'s helper and never `lib2`'s.
- **P2.S2.T02 The same, with the other copy open.** Fixture: P2.S2.T01; the scenario opens `lib2/f.c` in the editor before the build. Expected: as P2.S2.T01.
- **P2.S2.T03 The same, no compile database.** Fixture: P2.S2.T01 without `compile_commands.json`, `main.c` at the root, `lib1/` and `lib2/` beside it. Expected, by the stable-pick rule of `docs/FLOW-DESIGN.md` section 10b (equal shared folders, then the first by path in code-point order): `lib1/f.c`.
- **P2.S2.T04 The entry's own definition first.** Fixture: `app/main.c` defines `main` and non-static `cb`, and calls a kernel function in `kernel/k.c` that calls `cb`; `ports/a/cb.c` also defines `cb`; all three are in the compile database. Expected: `cb` reaches `app/main.c`.
- **P2.S2.T05 Two static functions with one name.** Fixture: `a.c` and `b.c` each define `static int helper(void)` with different bodies; `main.c` calls `run_a()` in `a.c`, which calls `helper`. Expected: `helper` reaches `a.c`, with and without a compile database.
- **P2.S2.T06 Object-like macro that calls.** Fixture: `#define LOCK saved = lock_impl()` used as the statement `LOCK` with no semicolon, followed by `if (x) work();`. Expected: a step `lock_impl` at the line of `LOCK`, its call as written `LOCK` (F13), marked approximate (F30, `docs/FLOW-DESIGN.md` section 2); `work` in an arm `then` of `if (x)`.
- **P2.S2.T07 Function-like macro that calls.** Fixture: `#define POST(s) post_impl(&(s))` used as `POST(sem);`. Expected: a step `post_impl` at that line, call as written `POST(sem)`, marked approximate.
- **P2.S2.T08 Call in disabled code.** Fixture: `#ifdef NEVER_DEFINED g(); #endif` inside `main`. Expected: no step for `g`.
- **P2.S2.T09 Overloads.** Fixture (C++): `f(int)` and `f(double)`; `main` calls `f(1)` then `f(1.0)`. Expected: two steps reaching each overload's definition in that order.
- **P2.S2.T10 Template.** Fixture (C++): a function template `t<T>` called as `t<int>()` and `t<double>()`. Expected: two steps, both reaching the template's definition.
- **P2.S2.T11 Virtual call with overrides elsewhere.** Fixture (C++): `Base` with virtual `m` in `base.h`; `D1 : public Base` in `d1.cpp`; `D2 : public Base` declared inside `struct Outer` in `d2.cpp`; `D3 : public Wrap<int>` where `Wrap<T> : public Base`, in `d3.cpp`; `main` calls `p->m()` on a `Base*`. Expected: an indirect step "one of 4": `Base::m`, `D1::m`, `Outer::D2::m`, `D3::m` (F19, grade possible).
- **P2.S2.T12 Short-circuit.** Fixture: `if (a() && b()) c();`. Expected: steps `a`, `b`, `c` in that order; `b` conditional on `a` (frame arm of `&&`); `c` in arm `then`.
- **P2.S2.T13 Initialisers and default arguments.** Fixture (C++): `int x = f();` and `void g(int v = h());` called as `g();`. Expected: steps `f`, then `h`, then `g`; `h` at the line of `g();`.
- **P2.S2.T14 Constructors and destructors.** Fixture (C++): `{ Guard g; work(); }` where `Guard` has a user-defined constructor and destructor. Expected: steps `Guard::Guard`, `work`, `Guard::~Guard`, the last at the closing brace's line.
- **P2.S2.T15 Operators.** Fixture (C++): `Vec a, b; Vec c = a + b;` with user-defined `operator+`, and `float x = 2.0f * y;`. Expected: one step `operator+`; no step for the built-in multiplication.
- **P2.S2.T16 Recursion.** Fixture: `f` calls `f` once under `if (n > 0)`; `g` calls `h`, `h` calls `g` under a condition. Expected: a reference row for the repeat in each, with the note "calls itself" for `f` (F14).
- **P2.S2.T17 Deeper than the limit.** Fixture: generated chain `f1` → `f2` → … → `f405`. Expected: rows to depth 400 and no deeper; the cut stated, naming the first function not followed (F30).
- **P2.S2.T18 Very wide.** Fixture: one function making 1,200 distinct calls. Expected: 1,200 steps in source order, or a stated limit naming how many were left out (F30).
- **P2.S2.T19 C called from C++.** Fixture: `c_api.c` defines `int c_fn(void)`; `main.cpp` declares it `extern "C"` and calls it. Expected: the call reaches `c_api.c`.
- **P2.S2.T20 K&R definitions.** Fixture: `int add(a, b) int a; int b; { return a + b; }` called from `main`. Expected: the call reaches it.
- **P2.S2.T21 Statement expression.** Fixture (GNU C): `int v = ({ int t = f(); t + 1; });`. Expected: step `f`.
- **P2.S2.T22 Not in the project.** Fixture: `main` calls `ext_fn()`, declared in a header, defined nowhere in the folder. Expected: no step for `ext_fn`; it is named among `main`'s library calls (F35) (`docs/FLOW-DESIGN.md` section 9: library code is hidden unless asked for).
- **P2.S2.T23 Static inline in a header.** Fixture: `util.h` defines `static inline int sq(int)`; `a.c` and `b.c` include it and call it. Expected: both calls reach `util.h`.
- **P2.S2.T24 Two built definitions.** Fixture: `x/f.c` and `y/f.c` both define non-static `f` and both are in the compile database; `x/main.c` calls `f`. Expected, by the stable-pick rule: `x/f.c` (most shared folders with the caller).
- **P2.S2.T25 A definition compiled through an include.** Fixture: `unity.c` holds `#include "impl/f.c"` and `main`, which calls `f()`; `impl/f.c` defines `f`, which calls `helper_impl`; `stub/f.c` also defines non-static `f`, which calls `helper_stub`; `compile_commands.json` lists `unity.c` and `stub/f.c`, not `impl/f.c`. Expected: the call reaches `impl/f.c`, because T1 shows that definition inside the caller's own translation unit; the run shows `helper_impl` and never `helper_stub`.
- **P2.S2.T26 One file built twice.** Fixture: `compile_commands.json` lists `x.c` twice, once with `-DMODE_A` and once with `-DMODE_B`; `main` in `x.c` calls `a()` under `#ifdef MODE_A` and `b()` otherwise. Expected: the facts equal T1 under the command clangd used for `x.c`, read from clangd's log in the test build, and the configuration analysed is stated (`docs/FLOW-DESIGN.md` section 8: show which configuration was analysed).
- **P2.S2.T27 A library function the project also defines.** Fixture: `tests/printf.c` defines `int printf(const char *, ...)`; `main.c` calls `printf`; `compile_commands.json` lists `main.c` only. Expected: `printf` is not followed into `tests/printf.c`: there is no step for it, and it is named among `main`'s library calls (T3: no file the build compiles defines it). Section 10b states following such a definition as a known limit; the exactness rule governs over it (P2.0.1 item 3).
- **P2.S2.T28 A moved compile database.** Fixture: P2.S2.T01 with every `directory` in `compile_commands.json` naming a folder that does not exist. Expected: the database is passed over, and the facts are those of P2.S2.T03 (`docs/FLOW-DESIGN.md` section 10b, moved projects).
- **P2.S2.T29 Pointer to a member function.** Fixture (C++): `struct S { void m(); };`, `void (S::*pm)() = &S::m;` and `(s.*pm)();`. Expected: an indirect step through a member pointer, its target unknown, with `S::m` among its candidates, graded possible (`docs/FLOW-DESIGN.md` sections 2 and 10b).
- **P2.S2.T30 A dependent call.** Fixture (C++): `template <class T> void run(T t) { t.go(); }` called as `run(Obj{})` and then `run(Obj2{})`. Expected: inside `run`, an indirect step marked dependent, its target depending on the types the template is used with (`docs/FLOW-DESIGN.md` section 2); one target for both calls is never stated.
- **P2.S2.T31 An unresolved call.** Fixture (C++): `#include "missing.h"`, a file that does not exist, and a call to `from_missing()`, which only that file would declare. Expected: an indirect step marked unresolved, worded to say the file's build settings should be checked; never a guessed target (`docs/FLOW-DESIGN.md` section 2).
- **P2.S2.T32 A built-in operator the index calls a function.** Fixture (C++): a user-defined `Point operator*(const Point&, float)`; in `main`, `float x = a * b;` with `a` and `b` floats, and `Point q = p * 2.0f;`. Expected: one step `operator*`, at the line of `p * 2.0f`; no step at the line of `a * b`; the count of dropped calls, where the engine states one, is 1 (`docs/FLOW-DESIGN.md` section 2).
- **P2.S2.T33 A function returned as a value.** Fixture: `handler_t pick(int k) { if (k) return on_get; return not_found; }`. Expected: no step for `on_get` or `not_found`; a value row "named, not called" for each, at its line (`docs/FLOW-DESIGN.md` section 2: a function used as a value is not a call).
- **P2.S2.T34 Before an index exists.** Fixture: `main.c` includes `api.h`, which declares `api`; `src/api.c` defines it; `port.h` declares `port_fn`, which both `ports/a/p.c` and `ports/b/p.c` define; no `compile_commands.json`. Run with `hook.noIndex`. Expected: `api` followed to `src/api.c` from the text; `port_fn` stated unresolved (`docs/FLOW-DESIGN.md` section 9).
- **P2.S2.T35 A body written by a macro.** Fixture: `#define BODY { a(); b(); }` and `void f(void) BODY`, called from `main` before `c();`. Expected: `a` then `b` under `f`, marked approximate; `c` after `f`; the run goes on (`docs/FLOW-DESIGN.md` section 9).
- **P2.S2.T36 Read as MSVC.** Fixture: `main` calls `msvc_only()` under `#if defined(_MSC_VER)` and `other()` otherwise. Expected: read as MSVC, `msvc_only`; read as clang or gcc, `other` (`docs/FLOW-DESIGN.md` section 10). A reading the app does not offer on this machine is not checked for that reading; when gcc or MSVC is asked for and not found, the app says it is reading as clang.
- **P2.S2.T37 Two classes with one name.** Fixture (C++): `namespace a { struct Base { virtual void m(); }; }`, `namespace b { struct Base { virtual void m(); }; }`, `struct D : a::Base { void m() override; };`; `main` calls `m` through a `b::Base*`. Expected: the step is `b::Base::m` alone; `D::m` is not among its targets (T1).
- **P2.S2.T38 Calls that are not virtual.** Fixture (C++): `struct Base { void plain(); virtual void v(); }; struct D : Base { void plain(); void v() override; };` and the calls `p->plain()` through a `Base*`, `p->Base::v()`, and `Base b; b.v();`. Expected: each is one step to `Base`'s method, never "one of 2" (T1: no virtual dispatch).
- **P2.S2.T39 Two definitions in C++.** Fixture: P2.S2.T01 with `.cpp` files. Expected: as P2.S2.T01.
- **P2.S2.T40 One rule for what belongs to the project.** Fixture: `main` calls one function defined in each of `third_party/a.c`, `external/b.c`, `vendor/c.c`, `build/d.c` and `out/e.c`, all listed in `compile_commands.json`; the same without `compile_commands.json`. Expected, for each folder: the file scan, the compile database the app writes and the rule for following a call agree. A function is either followed with its file scanned, or hidden and named among `main`'s library calls; never followed without being scanned, and never scanned without being followed.
- **P2.S2.T41 More sources than the scan takes.** Fixture: a generated folder of 20,050 source files, each defining one function; `main` calls the function of the last file by name. Expected: the call is followed, or the limit of the scan is stated (F30).
- **P2.S2.T42 A C definition in an `.inl` file.** Fixture: a C project; `a.c` holds `#include "impl.inl"`, which defines `int twice(int v)` and uses C's implicit conversion from `void *` (`int *p = malloc(4);`); `main` calls `twice`. Expected: the facts of `twice` equal T1 under `a.c`'s translation unit, read as C; no unresolved call.
- **P2.S2.T43 A compiler inside the project.** Fixture: `compile_commands.json` names `./tools/bin/g++`, a script inside the folder that writes a marker file when run. Expected: no marker file (`docs/FLOW-DESIGN.md` section 10: never a program inside the project).
- **P2.S2.T44 A sibling folder with a longer name.** Fixture: the opened folder is `app`; beside it, `app-common/util.c` defines `util` and is listed in `app`'s `compile_commands.json`; `main` calls `util`. Expected: `util` is treated as outside the opened folder (no step, named among library calls), and no path is shown with part of a folder's name cut off.
- **P2.S2.T45 Flags turned into MSVC's.** Instances: one per rule of the flag translation used when the code is read as MSVC: `-I`, `-D`, `-U`, and each `-std=` value it names for C and for C++. Expected: the flag written is the one `cl` documents with the same meaning, or one that asks for a newer standard never an older one (T5).

## P2.S3 Function shape (F5, F6, F7, F17)

- **P2.S3.T01 Condition over three lines.** Fixture: `if (a &&` / `b &&` / `c) { log_it(); return; }` then `work();`. Expected: `log_it` in arm `then` with the condition `a && b && c`; way out `return` early with that condition; `work` under guard `return`; junction kind exit at the line of `if`.
- **P2.S3.T02 Way out by a never-returning call in a multi-line condition.** Fixture: as P2.S3.T01 with `pthread_exit(NULL);` instead of `return;`. Expected: as P2.S3.T01 with way-out kind never-returning call; junction at the line of `if`.
- **P2.S3.T03 else-if chain.** Fixture: `if (a) f1(); else if (b) f2(); else if (c) f3(); else f4();`. Expected: each `fN` in its own arm, the arm's condition text being its own `if` condition (`a`, `b`, `c`) and `else` for `f4`.
- **P2.S3.T04 switch with fall-through.** Fixture: `switch (k) { case 1: f1(); case 2: f2(); break; default: f3(); }`. Expected: `f1` in arm `case 1`; `f2` in arm `case 2`, reached from `case 1` by fall-through, marked so; `f3` in arm `default`; the `break` after `f2` is not a way out (`docs/FLOW-DESIGN.md` section 10b).
- **P2.S3.T05 do … while.** Fixture: `do { a(); } while (b());`. Expected: `a` then `b` inside a loop frame `do` with text `do … while (b())`; loop count depends on data.
- **P2.S3.T06 goto cleanup.** Fixture: `if (!p) goto out; use(p); out: release();`. Expected: way out `goto` early with condition `!p`; `use` under a guard; `release` runs on every path.
- **P2.S3.T07 Endless loop with no exit.** Fixture: `void trap(void) { for (;;) { } }` called from `main` before `after();`. Expected: F7 yes for `trap`; no way out; `after` stated as never running (after the call to `trap`).
- **P2.S3.T08 Endless loop with a break.** Fixture: `while (1) { if (done()) break; step(); }` then `finish();`. Expected: F7 no; way out `break` with condition `done()`; `finish` runs after the loop.
- **P2.S3.T09 continue.** Fixture: `for (i = 0; i < n; i++) { if (skip(i)) continue; use(i); }`. Expected: `use` under guard `continue` with condition `skip(i)`.
- **P2.S3.T10 Nested loops.** Fixture: `for (i …) { a(); while (w()) { b(); } }`. Expected: `a` in loop `for`; `w` and `b` in loop `while` inside loop `for`.
- **P2.S3.T11 Statement macro without a semicolon.** Fixture: `#define RESTORE restore_impl(saved);` then lines `RESTORE` and `if (x) f();`. Expected: `restore_impl` at the `RESTORE` line, approximate; `f` in arm `then` of `if (x)`.
- **P2.S3.T12 Brackets in strings and comments.** Fixture: `if (strcmp(s, "(") == 0 /* ) */) f();`. Expected: `f` in arm `then` with condition text `strcmp(s, "(") == 0 /* ) */`.
- **P2.S3.T13 Line splices.** Fixture: a condition written `if (a \` / `&& b) f();`. Expected: condition text `a && b`.
- **P2.S3.T14 Unconditional return, code after.** Fixture: `f(); return; g();`. Expected: step `f`; no step `g`; `g` stated as never running after the return on its line.
- **P2.S3.T15 try and catch.** Fixture (C++): `try { a(); } catch (const E&) { b(); }`. Expected: `a` runs; `b` in a conditional arm of the catch.
- **P2.S3.T16 Range-for.** Fixture (C++): `for (auto& x : make()) use(x);`. Expected: `make` once before the loop; `use` in loop `for` with text `for each element of make()` or the header as written.
- **P2.S3.T17 Conditional expression.** Fixture: `int v = c ? f() : g();`. Expected: `f` and `g` each in a conditional arm.
- **P2.S3.T18 Unsequenced arguments.** Fixture: `h(a(), b());`. Expected: `a` and `b` both marked unsequenced; `h` after both.
- **P2.S3.T19 Lambda.** Fixture (C++): `auto l = [] { inner(); }; work(); l();`. Expected: `work` then `inner` (at the call `l()`), not at the lambda's definition.
- **P2.S3.T20 Static local initialiser.** Fixture: `static int v = init();` inside a function called twice. Expected: `init` marked as running once.
- **P2.S3.T21 Line directives.** Fixture: `#line 100 "other.c"` before a function that calls `f`. Expected: every Line is the line in the file as it is on disk, not the line the directive names.
- **P2.S3.T22 A condition repeated in a comment.** Fixture: `if (ready) {` / `/* if (ready) was set by the caller */` / `go();` / `}`. Expected: the junction's line is the line of `if (ready) {`, not the comment's (F17).
- **P2.S3.T23 Never returns, by every mark.** Fixture: project functions declared `[[noreturn]]`, `_Noreturn`, `__attribute__((noreturn))`, `__attribute__((format(printf, 1, 2), noreturn))`, and `__declspec(noreturn)` (with `-fdeclspec` in the fixture's compile command), each called in an arm of `main`. Expected: F7 yes for each; each call is a way out of kind never-returning call (`docs/FLOW-DESIGN.md` section 10b).
- **P2.S3.T24 Other ways out.** Fixture: `if (bad) longjmp(env, 1);` in one function; a C++20 coroutine with a minimal promise type and `co_return 1;` in an arm; a lambda inside a function, whose body is `if (v) return 1; return 0;`. Expected: `longjmp` is a never-returning way out; `co_return` is a way out; the lambda's returns are not ways out of the function that holds it (`docs/FLOW-DESIGN.md` section 10b).
- **P2.S3.T25 Operands left unsequenced.** Fixture: `int v = a() + b();` and `use(c() * d());`. Expected: `a` and `b` marked unsequenced; `c` and `d` marked unsequenced. The language fixes no order between the operands of `+` and `*`, and the exactness rule forbids stating one.
- **P2.S3.T26 Orders that only C++17 fixed.** Fixture: in a C file, and in a C++ file built with `-std=c++14`: `arr[idx()] = val();`, and `shl() << shr();` with built-in operands. Expected: each pair marked unsequenced, never one order stated as fact (`docs/FLOW-DESIGN.md` section 2 gives the right-before-left rule for C++17 only).
- **P2.S3.T27 Words and marks inside headers.** Fixture: `do { step(); } while (meanwhile > 0);` and `for (i = first(); /* a; b */ i < last(); i = next(i)) { f(); }`. Expected: the loop's text is `do … while (meanwhile > 0)`; `first` once before the loop, then `last`, `f` and `next` on every pass, in that order.
- **P2.S3.T28 Early exits outside a plain `if`.** Fixture: (a) `switch (k) { case 1: return; default: break; } after_a();` (b) `if (x) { if (y) return; } after_b();` (c) `for (i = 0; i < n; i++) { if (bad(i)) return; } after_c();`. Expected: each `after_…` step is conditional (under a guard, or stated as running at most once), never stated as running once (`docs/FLOW-DESIGN.md` section 2: after an early exit the rest is a guard; the exactness rule).
- **P2.S3.T29 Counts of ways out.** Instances: every fixture of P2.S3. Expected: the number of functions said to be able to leave early, and each function's number of ways out, equal F6's.

## P2.S4 Run invariants (F4, F30)

These units run on the run of every fixture of P2.S1 to P2.S9 and every generated program of P2.G, as invariants. Instances: one per (run, invariant).

- **P2.S4.I1 Caller encloses call.** Every step except the first has a caller step earlier in the run, and the call site's line is inside the caller function's body (T1 extent).
- **P2.S4.I2 Order within a caller.** The steps called from one caller appear in the evaluation order of `docs/FLOW-DESIGN.md` section 2 (T1 positions, T4 or T5 order).
- **P2.S4.I3 References point back.** Every reference row names an earlier step of the same function.
- **P2.S4.I4 Numbers.** Step numbers are 1 to N without gaps; function numbers are given in the order each function first runs.
- **P2.S4.I5 Limits stated.** Whenever a depth, node or count limit is reached, the run states it (F30).
- **P2.S4.I6 Start.** The first step is the entry point.
- **P2.S4.I7 Threads marked.** Every step started by a thread start has a thread frame.
- **P2.S4.I8 Folding.** Every call folded into its caller's row satisfies the rule of F31, and every call that satisfies it is folded.
- **P2.S4.I9 Which call.** Each item states which call of its function it is, counted in item order, and is marked as running again exactly when that count is above 1 (F33). The count's word is right for 1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101 and 111 (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd, 101st, 111th).
- **P2.S4.I10 One step number.** Instances: one per (step, place that states a number for it): the row, the header of each view, the step card, the hover tag of a grid square, the chapter list, the find list, the tour's caption, the run bar's tip, the walkthrough. Check: the number stated as the step's is the same in every place, and a function's number is never shown in the place of a step's number without its `ƒ` mark. Pass: so.

## P2.S5 What functions change (F7, F8, F9, F10, F11, F12)

- **P2.S5.T01 Element of a global array.** Fixture: `static ULONG table[4][8]; void push(void) { table[1][0] = 5; }`. Expected: F9 element of global `table`, at that line; F12 not pure.
- **P2.S5.T02 Through a pointer parameter.** Fixture: `void reset(struct R *r) { r->in_use = 0; }` called as `reset(&pool[i])`. Expected: F9 pointee of parameter `r`; F12 not pure.
- **P2.S5.T03 Inside a macro expansion.** Fixture: `#define CLEAR(x) (x) = 0` and `CLEAR(g);` with `g` global. Expected: F9 global `g`.
- **P2.S5.T04 Through `operator[]`.** Fixture (C++): a member `std::map<int,int> m_;` and `m_[k] = v;`. Expected: F9 member `m_`.
- **P2.S5.T05 Through a library call.** Fixture: `memset(&g, 0, sizeof g);` with `g` global. Expected: F9 global `g`.
- **P2.S5.T06 Compound and increment.** Fixture: `g += 2; ++m_; counter--;` (global, member, global). Expected: three F9 facts.
- **P2.S5.T07 Changed in a callee.** Fixture: `void set(int *p) { *p = 1; }` and `void top(void) { set(&g); }`. Expected: `set` writes pointee of parameter `p`; `top`'s facts include the change of global `g` attributed through `set` (`docs/FLOW-DESIGN.md` section 8, layer 4).
- **P2.S5.T08 Static and thread-local.** Fixture: a function with `static int calls; calls++;` and a `_Thread_local int t; t = 1;`. Expected: F9 static local `calls` and thread-local `t`; F12 not pure.
- **P2.S5.T09 Volatile register.** Fixture: `#define REG (*(volatile unsigned *)0x40000000)` and `REG = 1;`. Expected: F9 global (the register, by its text `REG`); F12 not pure.
- **P2.S5.T10 Pure and not pure.** Fixture: `int sq(int x) { return x * x; }`; `int twice(int x) { return sq(x) + sq(x); }`; `int bump(int x) { g++; return x; }`; `int via(int x) { return bump(x); }`; `void crit(void) { DISABLE; RESTORE; }` where the macros call interrupt-control functions that write a global. Expected: `sq` pure, `twice` pure, `bump` not pure, `via` not pure, `crit` not pure.
- **P2.S5.T11 Never returns, four ways.** Fixture: `void a(void) { for (;;) { } }`; `void b(void) { while (1) { } }`; `void c(void) { exit(1); }`; `_Noreturn void d(void) { abort(); }`; and `void e(void) { while (1) { if (x) break; } }`. Expected: F7 yes for `a`, `b`, `c`, `d`; no for `e`.
- **P2.S5.T12 Throws.** Fixture (C++): `void t() { throw E(); }`; `void n() noexcept { t(); }`. Expected: `t` may throw `E`; `n` is stated as calling something that may throw.
- **P2.S5.T13 Locks.** Fixture: `pthread_mutex_lock(&m); work(); pthread_mutex_unlock(&m);` and, in C++, `std::lock_guard<std::mutex> g(mu); work();`. Expected: F11 lock of `m` held from the line of `pthread_mutex_lock` to the line of `pthread_mutex_unlock`; F11 lock of `mu` held from its line to the end of its scope (`docs/FLOW-DESIGN.md` section 8: holds <mutex> from line A to line B).
- **P2.S5.T14 Allocations.** Fixture: `p = malloc(n); free(p);` and `auto q = std::make_unique<T>();`. Expected: F11 allocation `malloc` at its line; F11 allocation of `T` at the line of `make_unique` (`docs/FLOW-DESIGN.md` section 8: allocates <type>). Whether `p` is freed on every path is judged by P2.S8.T14, not here.
- **P2.S5.T15 Parameters of every shape.** Fixture: one function per parameter shape: a type written through a macro (`NAME_CONST CHAR *name` with `#define NAME_CONST const`); a function pointer `void (*cb)(unsigned long)`; an unnamed parameter; K&R; an array `int a[10]`; `const` and `volatile` pointers; a default value (C++); variadic `...`; a parameter whose name is also a struct tag (`int count` beside `struct count *c`). Expected: F8 name, written type, canonical type and passing mode of each, from T1.
- **P2.S5.T16 Read versus address.** Fixture: `x = g + 1;` (read), `use(&h);` (address only), `y = *(&k);` (read through the address). Expected: F10 read of `g`, address of `h` (not a read), read of `k`.
- **P2.S5.T17 A global pointer to const.** Fixture: global `const char *msg;` and `msg = "ready";` in a function. Expected: F9 global `msg` (the pointer is not const; only what it points to is).
- **P2.S5.T18 A member of a member.** Fixture (C++): `struct In { int x; }; struct C { In m; void set() { m.x = 1; } };`. Expected: F9 member `m`, written by `set`.
- **P2.S5.T19 Purity at its edges.** Fixture: `int g_read(void) { return G; }` with `G` a global that is not const; `int get() const { return m_x; }` in a class; `size_t n(const char *s) { return strlen(s); }`. Expected (F12 as defined in P2.0.3): `g_read` not pure; `get` pure; `n` not known.
- **P2.S5.T20 A return type written through a typedef of void.** Fixture: `typedef void VOID;`, `VOID f(VOID) { }`, and the statement `f();` in `main`. Expected: `f` returns no value; no result thrown away (F13, F24).
- **P2.S5.T21 A function that returns a function pointer.** Fixture: `void (*pick(int k))(int) { return k ? on_a : on_b; }` and the statement `pick(1);`. Expected: `pick` returns a value, and its result is thrown away (F13, F24).
- **P2.S5.T22 A lock through a wrapper.** Fixture: `void guard(void) { pthread_mutex_lock(&m); }`, `void release(void) { pthread_mutex_unlock(&m); }` and `void use(void) { guard(); g++; release(); }`. Expected: `use` locks `m`, attributed through `guard` (`docs/FLOW-DESIGN.md` section 8, layer 4: summaries carried up the call graph).
- **P2.S5.T23 Summaries through recursion.** Fixture: `void a(int n) { if (n) b(n - 1); }` and `void b(int n) { g++; if (n) a(n - 1); }`. Expected: `b` changes global `g`; `a` changes `g` through `b`; both settle (layer 4: recursion settles by repeating until nothing changes).
- **P2.S5.T24 A throw through a callee.** Fixture (C++): P2.S5.T12 and `void mid() { t(); }`. Expected: `mid` may throw `E`, through `t` (`docs/FLOW-DESIGN.md` section 8: a missing `noexcept` on a path to a throw).

## P2.S6 Text shown (F13, F14, F15, F16)

- **P2.S6.T01 Call over several lines.** Fixture: `create(&t,` / `"name",` / `entry, 0);`. Expected: call as written `create(&t, "name", entry, 0)`; passes in four arguments, each bound to its parameter.
- **P2.S6.T02 Nested call.** Fixture: `f(g(x));`. Expected: step `g` with text `g(x)` first, then `f` with text `f(g(x))`; `g`'s result goes into `f`.
- **P2.S6.T03 Chained calls.** Fixture (C++): `a.b().c();`. Expected: `b` then `c`, texts `a.b()` and `a.b().c()`.
- **P2.S6.T04 Returned.** Fixture: `return f(x);`. Expected: `f`'s result is returned.
- **P2.S6.T05 Into a variable.** Fixture: `int v = f();` and `T w{g()};`. Expected: results go to `v` and `w`.
- **P2.S6.T06 Thrown away.** Fixture: `f();` where `f` returns `int`. Expected: result thrown away (F13 and F24).
- **P2.S6.T07 Used in a decision.** Fixture: `if (f() < 0) fail();`. Expected: `f`'s result used in the decision `if (f() < 0)`.
- **P2.S6.T08 Passed on later.** Fixture: `int h = f(); g(h); k(h);`. Expected: `f` gives `h` to `g` and `k` (F16); `g` and `k` take `h` from `f`'s step (F15).
- **P2.S6.T09 Passing modes.** Fixture (C++): `by_val(T v)`, `by_ptr(T *p)`, `by_ref(T &r)`, `by_cref(const T &r)`, `by_view(std::string_view s)`, and one taking a typedef of a reference. Expected: a copy, by pointer, by reference, by reference, a view, by reference.
- **P2.S6.T10 The quoted comment.** Fixture: four functions: one with a `/* summary */` block, one with three `//` lines, one with a ThreadX-style banner (a line of only `/` and `*`, text lines inside, a closing line of only `*` and `/`), one with no comment. Expected: the first three quoted with their text only, never a line of punctuation; the fourth shows its signature.
- **P2.S6.T11 Named, not called, and a name inside another name.** Fixture: `cb = handler;` and, in another function, `handler_active++;`. Expected: one value row "named, not called" for `handler` at the assignment; none at `handler_active++`.
- **P2.S6.T12 Returned in parentheses.** Fixture: `return (f(x));`. Expected: `f`'s result is returned (F13).
- **P2.S6.T13 Thrown away in every statement position.** Fixture: `f` returns `int` and is called as a whole statement in each of: `if (c) f();` without braces; `while (c) f();`; `case 1: f();`; `out: f();`; the increment of `for (i = 0; i < 2; i++, f())`; `f(), v = 1;`; `(void)f();`. Expected: in each, the result is thrown away (F13) and a finding says so (F24) (`docs/FLOW-DESIGN.md` section 10b: a result a statement throws away).
- **P2.S6.T14 Text that is not ASCII before a call.** Fixture: the line `log_text("é漢🙂"); f(1);`. Expected: `f`'s Column by the Column rule (`🙂` counts as 2 UTF-16 units); its call as written `f(1)`.
- **P2.S6.T15 Where a passed value comes from.** Fixture: `int h = f(); h = 5; g(h);` and, in a second function, `int k = f(); if (c) k = m(); n(k);`. Expected: `g` is not said to take `h` from `f`'s step; `n` is not said to take `k` from any one step alone (F15).
- **P2.S6.T16 Decisions that read a result.** Fixture: five functions, each starting `int r = f();` and then one of: `if (r > 0 &&` / `ok) a();` over two lines; `while (r > 0) { b(); break; }`; `for (; r > 0;) { c(); break; }`; `switch (r) { case 1: d(); }`; `if (strcmp(s, "r") == 0) e();`. Expected (F16, by T1's reads of `r` inside conditions): the first four conditions are decisions that use `f`'s result; the `strcmp` condition is not.
- **P2.S6.T17 Signatures as written.** Fixture: in C++, `void f(std::vector<int> v = {}) { }`; in C, a K&R definition whose parameter declarations take three lines. Expected: F35 signature `void f(std::vector<int> v = {})`, and the K&R signature with its parameter lines, by Text.
- **P2.S6.T18 Library calls in a body.** Fixture: a body holding `/* call_me(x) */`, `#if defined(FEATURE)` … `#endif`, a local function pointer called as `cb(x)`, `sizeof(x)`, the cast `(int)(y)`, and `strlen(s)`. Expected: F35 library calls: `strlen` only (T1: calls whose callee is a function defined nowhere in the project; `cb(x)` is an indirect call).
- **P2.S6.T19 Loops in a body.** Fixture: a body holding `do { a(); } while (b());`, a range-for, `/* for (;;) */` and `puts("while (1)");`. Expected: F35 loops: 2 (T1: one do statement and one range-for statement).
- **P2.S6.T20 The call marked in a line.** Fixture: `handle_count = handle(req);`, and `f(f(1));` for its inner and its outer call. Expected: wherever a line is shown with its call marked (the calling line above the code, the calls outlined in the code, the lines of a step card), the marked text starts at the call's own Column (T1): `handle` after the `=`, not inside `handle_count`; the second `f` for the inner call.

**P2.S6.R1 Note rule (applies to every note of every fixture, as units P2.S6.R1.<fixture>.<note>):** a note passes when it is non-empty, is not made only of punctuation, and every identifier and every quoted piece in it appears in the fixture's source. Otherwise fail.

## P2.S7 Pointers and hand-overs (F19, F20)

- **P2.S7.T01 Candidates by type.** Fixture: functions `a1(int)`, `a2(int)` whose addresses are stored in a `void (*)(int)` variable; `b1(void)` returning `int`, stored in an `int (*)(void)` variable; `c1(struct T *, unsigned long)` stored in a struct field of matching type; each pointer is called. Expected: candidates `a1`, `a2` for the first call; `b1` for the second; `c1` for the third; grade possible (`docs/FLOW-DESIGN.md` section 8: possible is the complete set of options, and a function whose type cannot be called through the pointer is not an option).
- **P2.S7.T02 Table of handlers.** Fixture: `handler_t handlers[] = { on_get, on_post };` and `handlers[i](req);`. Expected: candidates `on_get`, `on_post`.
- **P2.S7.T03 Registered callback.** Fixture: `register_cb(&tick);` storing it in a global pointer, later called through that pointer. Expected: F20 hand-over of `tick` at the registration line; the later indirect call has `tick` among its candidates.
- **P2.S7.T04 Thread starts.** Fixture: `std::thread t(worker1);`, `pthread_create(&id, NULL, worker2, NULL);`, `xTaskCreate(worker3, "w3", 128, NULL, 1, NULL);`, and a ThreadX-style `tx_thread_create(&th, "w4", worker4, 0, stack, 1024, 1, 1, 0, 1);` with the API declared in the fixture. Expected: each worker runs as a thread at its creation line (thread frame), and the creating function continues after it (`docs/FLOW-DESIGN.md` section 10b).
- **P2.S7.T05 Address stored by a macro.** Fixture: `#define SETUP(t) (t)->fn = &(expire)` and `SETUP(obj);`. Expected: F20 hand-over of `expire`; no step running `expire` at that line.
- **P2.S7.T06 std::function.** Fixture (C++): `std::function<void()> f = g; f();`. Expected: an indirect step "decided at run time".
- **P2.S7.T07 Hooks stored in a struct.** Fixture: `app.on_error = ErrorHook;` and three more fields. Expected: one hand-over per stored function, not called.
- **P2.S7.T08 A function's address passed as a thread's data.** Fixture: `pthread_create(&id, NULL, worker, (void *)on_done);`. Expected: only `worker` runs as a thread; `on_done` is a value row "named, not called".
- **P2.S7.T09 A variable named like a function.** Fixture: `a.c` defines the function `reset`; in `b.c`, `int reset = 1; set(reset);`; an indirect call in a third file. Expected: `reset` is not a candidate of that call (T1: the name in `b.c` is a variable).
- **P2.S7.T10 Addresses taken through a cast and a choice.** Fixture: `cb = (handler_t)on_raw;` and `cb = fast ? on_fast : on_slow;`, then `cb(x)`. Expected: candidates `on_raw`, `on_fast` and `on_slow`.
- **P2.S7.T11 More candidates than the list holds.** Fixture: 15 functions of one type stored in one table and called through it. Expected: all 15 are candidates, or the number left out is stated (`docs/FLOW-DESIGN.md` section 8: possible is the complete set of options).

## P2.S8 Derived views (F17, F18, F21, F22, F23, F24, F25, F26, F27)

**Invariants on every run of P2.S1 to P2.S9 and P2.G** (instances: one per run and invariant):
- **P2.S8.I1 Grid squares.** The steps in all grid cells together are exactly the steps that have a caller, each once.
- **P2.S8.I2 Junction places.** Every junction's line holds its condition's keyword, and its then line holds its then text (by Text).
- **P2.S8.I3 What-if folds exactly.** For every arm, flipping its condition folds exactly the steps inside that arm and, for an early exit, the guarded steps after it; the count stated equals the number folded.
- **P2.S8.I4 Chapters cover the run.** Chapters start at the entry's own calls and loops and use function names and loop headers exactly. The chapters of the first level cover every row after the entry with no gap and no overlap; the chapters one level down lie inside the chapter they split, with no overlap between them.
- **P2.S8.I5 How often.** F32 holds on every row.
- **P2.S8.I6 Grid rows and columns.** Every function that is called is a row and every function that calls is a column; each row's and column's total equals the steps in its cells; and each of the three orders (by file, by first run, by count) is the order its name says (F22).
- **P2.S8.I7 The grid's summary.** The numbers of functions called, of callers and of calls equal the run's; the share of calls that cross a file equals, as a whole percent, the calls whose caller and called function lie in different files over all calls; the most called are the functions called most, each more than once, at most three (F22).
- **P2.S8.I8 The files grid.** Each block's number equals the calls from the column's file into the row's file, and the blocks together hold every call once (F22).
- **P2.S8.I9 A loop's summary.** For every loop of the entry function, the steps, functions and files stated equal those of the rows inside it.

**Traps:**
- **P2.S8.T01 Fixed and data loop counts.** Fixture: `for (int i = 0; i < 4; ++i) f();` and `while (more()) g();`. Expected: F21 "runs 4 times" for the first; "depends on data" for the second.
- **P2.S8.T02 Race.** Fixture: a global written by `record` on the main thread and read by `flush` on a thread started with `pthread_create`, no lock in either. Expected: F24 race on that global, with both places.
- **P2.S8.T03 No race with a common lock.** Fixture: P2.S8.T02 with the same mutex locked around both accesses. Expected: no race.
- **P2.S8.T04 Watch through a rename.** Fixture: global `running` set in `start`, passed to `loop(int *flag)`, read there through `*flag`. Expected: F25 sets at `start`, passed on as `flag` at the call, reads at `loop`.
- **P2.S8.T05 Journey by copy.** Fixture: `void use(T v) { v.x = 1; }` called as `use(t);`. Expected: F25 passed on as `v`, a copy; setting `v.x` is not said to set `t`.
- **P2.S8.T06 Values settled per call.** Fixture: `draw(bool clear) { if (clear) wipe(); paint(); }` called as `draw(true)` and later `draw(false)`; plus four functions that must not settle: a constant condition, a function with a `goto`, an overflowing signed addition, a parameter that is assigned. Expected: in the first call, the `if (clear)` arm settled true with the reason `clear is true here — passed by draw(true)`; the later call settles nothing (a body is laid out at its first call, `docs/FLOW-DESIGN.md` section 10b); the four others settle nothing.
- **P2.S8.T07 Configurations.** Fixture (C++17): `if constexpr (sizeof(void*) == 8) wide(); else narrow();`. Expected: `wide` runs unconditionally; `narrow` is a ghost "not in this build" and is never walked.
- **P2.S8.T08 Pairs.** Fixture: `lock(m); if (x < 0) return; unlock(m);` and a second function that unlocks on every path. Expected: F24 pair not closed in the first, naming the lock line, the return line and its condition; none in the second.
- **P2.S8.T09 The two tinyhttp findings.** Fixture: `samples/tinyhttp` as it is. Expected: the race on `Metrics::counters_` between `record` and `flush`, and the thrown-away result of `handle(req);` (`docs/FLOW-DESIGN.md` section 8b).
- **P2.S8.T10 How often inside two loops.** Fixture: `while (more()) { for (int i = 0; i < 4; ++i) f(); }`. Expected (F32): `f` runs 4 times per pass of `while (more())`; how many passes depends on the run; graded unknown.
- **P2.S8.T11 A static initializer inside a counted loop.** Fixture: `for (int i = 0; i < 4; ++i) { static int v = init(); use(v); }`. Expected (F32): `init` once (`docs/FLOW-DESIGN.md` section 2: a static local's initializer runs once); `use` 4 times.
- **P2.S8.T12 A race with a lock on one side.** Fixture: P2.S8.T02 with the mutex locked only around the read in `flush`. Expected: F24 race on that global, with both places: the two accesses hold no lock in common (`docs/FLOW-DESIGN.md` section 8b, which governs by the user's decision of 2026-11-12).
- **P2.S8.T13 A race with two different locks.** Fixture: P2.S8.T02 with `record` holding `m1` around the write and `flush` holding `m2` around the read. Expected: F24 race on that global, with both places: `m1` and `m2` are not a lock in common (section 8b, as P2.S8.T12).
- **P2.S8.T14 Pairs, rule by rule.** Fixture: one function per case of `docs/FLOW-DESIGN.md` section 10b: (a) `p = malloc(n); if (!q) return; free(p);`: memory not freed at the return; (b) `fp = fopen(path, "r");` with a return before `fclose(fp)`: file not closed; (c) `d = opendir(path);` with a path that leaves without `closedir(d)`: folder not closed; (d) `buf = malloc(n); use(buf); free(buf);`: no finding; (e) a lock taken and released inside a loop's body on every pass: no finding; (f) a `switch` whose `case 1:` falls through to a `case 2:` that returns before the unlock: not released at that return; (g) a path that leaves through a `goto`: not judged, no finding; (h) a path that leaves through `exit(1)`: not judged, no finding; (i) a path that tests `x < 0` twice before it leaves: the finding says the path may never run. Expected: exactly the findings named, each with its lines and conditions (F24).
- **P2.S8.T15 Watch, rule by rule.** Fixture: (a) member `count_` set in `add` and read in `size`, two methods of one class; (b) `walk(p->next)` with `void walk(Node *n)`; (c) `void bump(int &r) { r++; }` called as `bump(g)`; (d) `int get(void) { return g; }`; (e) three globals used 3 times, 2 times and once. Expected (F25, `docs/FLOW-DESIGN.md` section 10b): (a) both hits; (b) `p->next` passed on as `n`; (c) sets `g` through `r`, not a copy; (d) returns `g`; (e) the names offered for watching in the order 3, 2, 1.
- **P2.S8.T16 Values settled per call, case by case.** Fixture: one function per case of `docs/FLOW-DESIGN.md` section 10b, each called once with constants. Settled: an `if` and `else`; a `switch` with fall-through; a `switch` whose labels are enumerators the compiler evaluated; the rest of the body after an early `return`; `&&`; `||`; `?:`; a `while` that never starts; a value passed through two calls (`frame(false)` calls `paint(clear)`, which tests `if (clear)`), whose reason names both (`passed by paint(clear), from frame(false)`); a comparison on which every choice of `int`, `long` and `char` agrees. Not settled: a constant condition; a function with a `goto` or a label; a signed addition that overflows; a shift of a negative number; a division by zero; a signed conversion out of range; a condition with a call, a member, a float, `sizeof`, or an enumerator passed in; a parameter that is assigned, pointed to, bound to a reference, or hidden by a local of the same name; a comparison on which `int` of 16 or 32 bits, `long` of 32 or 64 bits, or a signed or unsigned `char` disagree. Expected: exactly the settled cases settle, each with its reason (F26); the others settle nothing.
- **P2.S8.T17 Configurations, rule by rule.** Fixture, by the cases of `docs/FLOW-DESIGN.md` section 10b: (a) `if constexpr (std::is_integral_v<T>)` inside a template; (b) a decided `if constexpr` whose discarded side holds a lock with no unlock, a write to a global, an early `return` and a condition on a parameter; (c) two build folders, `build-debug/` and `build-release/`, each with its own `compile_commands.json`; (d) files of the run that test `#ifdef DEBUG` and `#if BOARD == 2`; (e) `init()` called twice from one function, the second call only under `#ifdef DEBUG`. Expected (F27): (a) stays a branch; (b) none of the four appears in pairs, watch, ways out or values; (c) both folders offered; (d) offered: define `DEBUG`, undefine `DEBUG`, and `BOARD` with `2`; (e) with `-DDEBUG`, the second call, not the first, is marked `only with DEBUG`.
- **P2.S8.T18 Chapters split one level down.** Fixture: a run in which one call made by the entry holds more than a quarter of the run's rows. Expected (F23, `docs/FLOW-DESIGN.md` section 4): that chapter is split into its own calls and loops one level down, named exactly.
- **P2.S8.T19 Questions and sentences for every kind of frame.** Fixture: an arm of each kind (`then`, `else`, the right side of `&&`, the right side of `||`, `case`, `default`, `catch`), a guard of each kind (`return`, `continue`, `break`, `throw`, `goto`), a static initializer, a lambda and a thread. Expected: each what-if question asks whether a condition that decides the arm is true or false (for a `case` arm, the switch's controlling expression against that label; never `switch (k) is false`, never `try is false`); each frame sentence and each walkthrough line is true of its rows (the right side of `||` runs only when the left side is false); each passes P2.C.3 (F18, F36, F39).
- **P2.S8.T20 Folding.** Fixture: `int one(void) { return 1; }` called unconditionally, inside an `if`, and inside a loop; a 3-line helper that calls another function; a 4-line helper that calls nothing; a user-defined `operator+` that calls nothing. Expected (F31, `docs/FLOW-DESIGN.md` section 4): `one` folded only where it is called unconditionally, and the operator folded; every other call keeps its row, so no condition is hidden.
- **P2.S8.T21 Loop counts that are not fixed.** Fixture: (a) `for (int i = 5; i != 3; ++i) f();` (b) `#define CHECK(p) if (!(p)) return` and `for (int i = 0; i < 4; ++i) { CHECK(ok(i)); f(); }` (c) `for (int i = 0; i < 4; ++i) { if (bad(i)) die(); f(); }`, where `die` is a project function that never returns. Expected (F21): (a) is not said to run 0 times; (b) and (c) are not said to run 4 times; each says its count depends on the run.
- **P2.S8.T22 One function on two threads.** Fixture: `bump()` writes a global with no lock; `main` calls `bump()` and then starts `worker` with `pthread_create`; `worker` calls `bump()`. Expected: a race on that global between the main thread and the started thread (F24, `docs/FLOW-DESIGN.md` section 8b).
- **P2.S8.T23 Two globals with one name.** Fixture: `a.c` and `b.c` each define `static int state;`; `a.c`'s is written on the main thread, `b.c`'s on a started thread. Expected: no race (T1: two different variables); watching one does not light the steps that touch the other (F25).
- **P2.S8.T24 Pairs that do close.** Fixture: (a) `p = malloc(n); q = p; free(q);` (b) `p = malloc(n); if (!p) return -1; use(p); free(p);` (c) `p = malloc(n); if (p) { use(p); free(p); }` (d) `if (pthread_mutex_lock(&m) != 0) return -1; work(); pthread_mutex_unlock(&m);`. Expected: no finding in any (F24): on every path, nothing that was opened is left open.
- **P2.S8.T25 Values that are pointers.** Fixture: `void show(const char *s) { if (s == NULL) return; put(s); }` called as `show("x")`; `void maybe(int *p) { if (p) use(p); }` called as `maybe(NULL)`. Expected (F26, by the language's rules): where the engine settles either, it rules out the `if (s == NULL)` arm in `show("x")` and the `if (p)` arm in `maybe(NULL)`, each with its reason; it never rules out the opposite arm.
- **P2.S8.T26 The junction card.** Fixture: P2.S3.T01, P2.S3.T03, and a function with `if (cfg.ready) go();` that also holds a local `int ready = check();`. Expected: the steps said not to run on each track equal the steps the run puts there (P2.S8.I3); each name said to decide the condition is a variable the condition reads, with the step that sets it by the rule of P2.S6.T15; the member `ready` of `cfg` is not said to be set by `check`; the ways out listed equal F6's for that function.
- **P2.S8.T27 The tour's caption.** Fixture: P2.S8.T10, and a call inside an `if` outside every loop. Expected: what the tour says about how often a step runs agrees with F32: never "once" for a step under a condition, and the count of every loop around it, not only the innermost.
- **P2.S8.T28 Lists cut short say so.** Fixture: a run with 12 functions whose names hold `get`; a run that touches 15 globals. Expected: the find list for `get` and the list offered for watching show every entry, or state how many are left out (F30).

## P2.S9 Versions and settings (F27, F28)

- **P2.S9.T01 A change of each kind.** Fixture: two versions of one program: version 2 adds a call in `handle`, removes `log_request` from `start`, moves `route` inside a new `if`, and changes two lines of `parse`. Expected: one added step, one removed ghost after the call before it, "now inside" with the new condition, and "changed · 2 lines" for `parse`.
- **P2.S9.T02 Only moved.** Fixture: version 2 reorders the functions in a file and adds blank lines. Expected: no change facts.
- **P2.S9.T03 Renamed.** Fixture: version 2 renames `helper` to `assist`. Expected: `helper` removed and `assist` added (a function is its file, name and parameter types, `docs/FLOW-DESIGN.md` section 10b).
- **P2.S9.T04 A define.** Fixture: `#ifdef DEBUG trace(); #endif` in `main`, read as built and with `-DDEBUG`. Expected: with `-DDEBUG`, `trace` is "only with DEBUG"; as built, nothing.
- **P2.S9.T05 A setting that does not build.** Fixture: `#ifdef BOARD2 #error unsupported #endif`, read with `-DBOARD2`. Expected: nothing shown for the setting, and the reason stated.
- **P2.S9.T06 Overloads changed.** Fixture: version 2 changes the body of `f(int)` only, and turns `g(int)` into `g(long)`. Expected: `f(int)` changed and `f(double)` unchanged; `g(int)` removed and `g(long)` added (`docs/FLOW-DESIGN.md` section 10b: a function is its file, name and parameter types).
- **P2.S9.T07 One of two calls removed.** Fixture: version 1 `log_it(); work(); log_it();`, version 2 `log_it(); work();`. Expected: the second `log_it` removed, its ghost after `work`; the first unchanged.
- **P2.S9.T08 The summary line.** Fixture: P2.S9.T01. Expected: the summary line states exactly its four changes, in the form of `docs/FLOW-DESIGN.md` section 10b (`+ … in handle · − log_request from start · route now inside if (…) · … changed`).
- **P2.S9.T09 Commit against commit.** Fixture: P2.S9.T01 with both versions committed, the older compared with the newer marked "as newer". Expected: the change facts of P2.S9.T01.
- **P2.S9.T10 No history.** Fixture: the fixture copied into a folder that is not a repository; and, once, the app started with no `git` on its path. Expected: each time, the reason stated and no change facts.
- **P2.S9.T11 A change inside a folded call.** Fixture: version 2 adds a call to a one-line helper that folds into `handle`'s row. Expected: `handle`'s row says a call folded into it was added (`docs/FLOW-DESIGN.md` section 10b).
- **P2.S9.T12 Moved out, and nothing changed.** Fixture: version 2 takes `route` out of its `if`; a second pair of versions differs only in a comment outside every function. Expected: `route` is said to be no longer inside `if (…)`; for the second pair, the summary says nothing this run does has changed.
- **P2.S9.T13 A setting with errors.** Fixture: `-DSTRICT` makes one file of the run fail with an undeclared identifier, not an `#error`. Expected: the setting's result states the number of errors in the run's files; no difference is shown without that statement (F30).
- **P2.S9.T14 Unsaved changes.** Fixture: in the editor, not saved: one line changed inside `handle`; a blank line added between two other functions. Expected (F43): `handle`'s steps marked; no other step marked.
- **P2.S9.T15 An older version without the entry.** Fixture: the older commit has no `main` in the entry's file. Expected: the reason stated; no change facts.
- **P2.S9.T16 An older version that needs a file outside the repository.** Fixture: the run's files include `config.h`, which is on disk but ignored by git. Expected: the comparison states that the older version has errors, or shows nothing; it shows no added or removed step that comes from the missing file (the exactness rule).

## P2.S10 Repair engine (F29)

- **P2.S10.T01 The existing suite.** Fixture: every case of `samples/repair`. Expected, per case, from its recorded answer: the suggested edit, the errors it clears, no new error in any file, no cast; for the cases recorded as exact, the code given back exactly.
- **P2.S10.T02 Error inside a macro use.** Fixture: a call to a function-like macro with one argument missing. Expected: a suggestion that edits only the macro use in the open file, or no suggestion; never an edit in a header.
- **P2.S10.T03 Error in an included header.** Fixture: the open file includes a project header with a missing `;`. Expected: no edit outside the open file; the reason stated.
- **P2.S10.T04 One edit clears two errors.** Fixture: a missing `}` that causes two errors. Expected: one suggestion, clearing both.
- **P2.S10.T05 Each entry of the header tables.** Instances: one per (name, header) in the repair engine's C and C++ tables, read from the code and listed in the report. Fixture: a file that uses the name without the header. Expected: the suggestion `#include <header>`, which clears the error (T1 before and after).
- **P2.S10.T06 Where an include goes.** Fixture: files that begin with (a) a comment block and `#pragma once`; (b) an include guard; (c) includes followed by code; (d) includes only inside an inactive `#ifdef` block. Expected: in (a) to (c), the include is placed where it compiles and clears the error; in (d), the same, or no suggestion.
- **P2.S10.T07 `std::` or an include.** Fixture: `vector<int> v;` with `<vector>` included, and without it. Expected: with it, the suggestion `std::`; without it, a suggestion that clears the error; each checked with clangd.
- **P2.S10.T08 Pointers.** Fixture: an `int` passed where an `int *` is wanted, and an `int *` where an `int` is wanted. Expected: the suggestions `&` and `*`, each clearing its error; never a cast (F29).
- **P2.S10.T09 Errors uncovered by a fix.** Fixture: a missing `)` before code that holds a second, unrelated error. Expected: the suggestion clears the first error, and its reason names the error then found, with its line, as not made by the fix.
- **P2.S10.T10 More errors than are checked.** Fixture: a file with 15 independent errors. Expected: the number of errors stated is 15, or the number left unchecked is stated (F30).
- **P2.S10.T11 Errors left untried.** Fixture: a file whose errors need more tries than one check allows. Expected: an error that was not tried is never said to have no fix (F30).

## P2.S11 Stepping (F33, F34, F36, F39)

Instances: every fixture of P2.S1 to P2.S9 whose run has 60 items or fewer; in each, every position reachable from the start by next, another pass and go to step, and from each such position, every move of `docs/FLOW-DESIGN.md` section 7 that changes the position or the passes: next, back, step over, step out, another pass, leave the loop, previous pass, next and previous call here, go to step, Home and End. Truth: the run, checked by P2.S2 to P2.S8, and the rules below, from sections 6 and 7. Severity: S1.

- **P2.S11.I1 Next.** The next item; loops still around it keep their pass, loops entered start at pass 1.
- **P2.S11.I2 Back.** The walk without its last position; at the walk's first position, refused.
- **P2.S11.I3 Step over.** The first item after the current item's own steps; the caption's count equals the steps skipped, or says that nothing runs inside.
- **P2.S11.I4 Step out.** The first item after the caller's steps; at the entry, refused.
- **P2.S11.I5 Another pass.** The innermost loop's first item, its pass one more, the outer loops' passes kept; at the last pass of a stated count, refused.
- **P2.S11.I6 Leave the loop.** The first item after the innermost loop; when its count is known, the caption's number of passes skipped equals the count minus the pass.
- **P2.S11.I7 Previous pass.** The same item, the innermost loop's pass one less; at pass 1, refused.
- **P2.S11.I8 Calls here.** The next or previous item with the same caller, inside the caller's steps; at either end, refused.
- **P2.S11.I9 Go to step.** The item of that step, or the item it is folded into, with a caption naming both; a step that does not exist, refused.
- **P2.S11.I10 Ends.** Home is the first item; End is the end of the run; at the end, every move but back, Home, End and go to step is refused.
- **P2.S11.I11 Ways on.** Every move the step's list of ways on offers is accepted in that position.
- **P2.S11.I12 Embers.** The last four positions walked before the current one, distinct, the most recent first.
- **P2.S11.I13 The walk's link.** The link of any walk, opened on the same run, gives the same positions, the same passes above 1 and the same notes, for notes holding `,`, `:`, `%`, `&`, `=`, a line end and text that is not ASCII. A link with a position past the end, a pass above its loop's count, or a pass for a loop not around its position is refused.
- **P2.S11.I14 The walkthrough.** Every line of the walkthrough is true of its place: its step, file and line, the line it is called from as written, and each loop with its pass, each condition with the side that holds, each guard, each thread, each static initializer and each lambda around it.
- **P2.S11.I15 Playing.** Instances: one per (fixture with a loop, view). Check: in the metro view, play takes one pass of each loop (`docs/FLOW-DESIGN.md` section 7); in the grid view, play goes round a loop with a stated count exactly that many times, and once round a loop whose count is not known, saying so (`docs/FLOW-DESIGN.md` section 3b). Pass: so.

## P2.S12 Programs and how they connect (F1, F30, F37)

- **P2.S12.T01 Started by `system`.** Fixture: program `server` calls `system("./client --once")`; program `client` exists in the folder. Expected: `server` starts `client`.
- **P2.S12.T02 Started by the other calls.** Fixture: `execv("./tool", argv)`, `execlp("tool", "tool", NULL)`, `posix_spawn(&pid, "./tool", NULL, NULL, argv, envp)`, and `CreateProcessA(NULL, "tool.exe", …)` with its Win32 declarations written in the fixture, each in its own program; program `tool` exists. Expected: each of those programs starts `tool`.
- **P2.S12.T03 A string that names no program.** Fixture: `system("ls -l")`. Expected: no link.
- **P2.S12.T04 Shared files.** Fixture: programs `a`, `b` and `c`; `a` and `b` call functions of `common/util.c`; all three call functions of `common/log.c`. Expected: shared files `common/log.c`, used by 3 programs (`a`, `b`, `c`), and `common/util.c`, used by 2 (`a`, `b`), the file used by more programs first; two shared files with one name in different folders are told apart (`docs/FLOW-DESIGN.md` section 3).
- **P2.S12.T05 More than twenty programs.** Fixture: 21 programs. Expected: 20 traced, and the limit stated (`docs/FLOW-DESIGN.md` section 10b: up to 20).
- **P2.S12.T06 A method named `start`.** Fixture: `job.start("client")` on an object that is not a process; program `client` exists. Expected: no link.
- **P2.S12.T07 What the status states.** Fixture: `samples/tinyhttp`, and P2.S1.T13. Expected (F40): the numbers of functions and files stated equal the run's; for the public API start, the number of API functions stated equals the starts.
- **P2.S12.T08 The trace limit.** Fixture: a generated program of 20,050 functions, each called once. Expected: the trace stops at 20,000 functions and says so (F30).
- **P2.S12.I1 One numbering.** Instances: every fixture of P2.S1 to P2.S9. Check: wherever the graph's function numbers, file-to-file lines or loop labels reach the screen, they agree with the run: the same functions, the same order of first run, and no loop labelled with a count the run does not state (F40, F21). Pass: so.

## P2.S13 Shared helpers the editor relies on (F44)

Severity: S1 when the result reaches the screen or a file; S3 otherwise.

- **P2.S13.H1 Search.** Instances: the queries `a.b`, `(x`, `[`, `\`, `é`, `İ`, `ß`, `🙂` and one of 300 characters, on a fixed text that holds each of them and near misses. Expected: every match is the query's own text, ignoring case; no query is read as a pattern; positions are in UTF-16 units; when the matches pass the cap, the cap is stated (F30).
- **P2.S13.H2 Paths and addresses.** Instances: the paths of P1.D2.0.3, and paths holding a space, `%`, `#`, `?` and text that is not ASCII. Expected: a path turned into an address and back is the same path; a file in a folder whose name only begins with the root's name (`/w/app` and `/w/app-old/x.c`) is not inside the root, in every place that asks.
- **P2.S13.H3 Colours.** Instances: every default colour of the settings, and `#000000`, `#ffffff`, `#808080`, `#ff000080`. Expected: to hue, saturation and lightness and back gives the same colour.
- **P2.S13.H4 Settings as defined.** Instances: one per setting. Expected: its default passes its own check, lies between its least and greatest value, is one of its listed values, and its section is listed, so the default file holds it.
- **P2.S13.H5 Settings read.** Instances: the default file; one file per setting holding a wrong value (wrong type, below the least, above the greatest, not in the list, not a colour); a file with an unknown key; one with a retired key; one that is not TOML. Expected: the default file gives every default and no problem; a wrong value gives that setting's default and one problem naming the key and its line; an unknown key gives one problem; a retired key none; an unreadable file gives every default and one problem.
- **P2.S13.H6 Settings written.** Instances: one per setting: a valid value other than its default written into the default file. Expected: reading the file back gives that value; every other line is byte-identical; the line's comment is kept; a value holding `#` inside quotes is kept whole.
- **P2.S13.H7 Symbol names.** Instances: `ns::C::m(int) const`, `operator()(int)`, `a::operator<=>(a const&) const`, `operator<<(std::ostream&, X)`, `vtable for X`, `(anonymous namespace)::f()`, `a<b<c>>::d<e>(f)`, `_GLOBAL__sub_I_x`. Expected: `m` in `ns::C`; `operator()`; `operator<=>` in `a`; `operator<<`; `X`; `f`; `d` in `a`; none.
- **P2.S13.H8 A file's language.** Instances: the names of P1.D2.0.1, and `Makefile`, `CMakeLists.txt`, `x.cmake`, `a.m`, `a.mm`, and a file with no extension under `include/c++/`. Expected: every C, C++ and Objective-C source and header is taken as C-family, and the places that decide this (the file scan, the compile database the app writes, the flow, clangd's opening of files, the editor, the repair check) give the same answer for every name.
- **P2.S13.H9 Search in the folder.** Instances: the queries of P2.S13.H1 on a fixture folder that also holds a file over 4 MB, a binary file, a file inside `build/` and one inside `vendor/`, each with a match, and a line with three matches. Expected: the numbers of matches, of files with a match and of files searched equal a count made by a second, independent scan of the same files; what is called a match is one occurrence, or the count is named for what it is; every file left out (too large, binary, in a skipped folder) is stated; the cap stated is the cap that was reached; the same search run twice lists the same hits in the same order.

## P2.S14 Preview cards (F41)

Contract: the settings' own descriptions of `preview.include_std`, `preview.include_other` and `preview.max_cards`, the exactness rule, and T1. `docs/ARCHITECTURE.md` describes the preview panes in its sections 4 and 24, but `docs/FLOW-DESIGN.md` section 1 calls that document history; one sentence of it is kept here because the settings agree with it: the order of cards is always call order. Severity: S1.

- **P2.S14.T01 Calls and their definitions.** Fixture: a function that calls two project functions, one of them twice, and one standard-library function. Expected: one card per called function, in the order of first call, each with its definition's file, first line and text and all its call sites; the standard call shown when `preview.include_std` is on, and counted as hidden when it is off.
- **P2.S14.T02 The other kinds.** Fixture: a body with a function-like macro, a `static_assert`, a lambda that is called, a call through a function-pointer variable and a call through a pointer parameter. Expected: with `preview.include_other` on, one card of each kind after the function cards; with it off, none.
- **P2.S14.T03 More cards than the limit.** Fixture: 15 calls with `preview.max_cards` at 12; and 15 macro uses. Expected: 12 cards and "+3 more" naming the three; for the macros, the same, or the cut stated (F30).
- **P2.S14.T04 A long definition.** Fixture: a called function 450 lines long. Expected: its card shows the whole body, or says where it stops (F30).
- **P2.S14.T05 Depth.** Fixture: a chain `a` → `b` → `c` → `d`; a diamond `a` → `b`, `c` → `d`; a recursion; and `a` calling `d` then `b`, where `b` calls `d` and `d` calls `e`. Expected: the card states what its own words say, the deepest chain of project calls below the function: the longest chain of calls in which no function repeats (3 levels in the last fixture: `a` → `b` → `d` → `e`), and the functions below it counted once each (T1, T5).
- **P2.S14.T06 One name, two things.** Fixture: `x::log()` called, and a macro `log(...)` used unqualified in the same body. Expected: a card for each.
- **P2.S14.T07 Cards kept across a rebuild.** Fixture: the same function rebuilt with nothing changed; with one called function's text changed; with the cursor in another function. Expected: unchanged cards and the focused card are kept; the changed card is replaced; another function's cards replace all.
- **P2.S14.T08 The function under the cursor.** Fixture: the cursor inside a function written on one line (`int f() { return g(); }`), inside a method defined in its class, and inside a lambda in a function. Expected: the cards are those of that function, of that method, and of the function holding the lambda.
- **P2.S14.T09 Not the standard library.** Fixture: a call into `external/lib/x.c`, a file of the folder that is not part of the C or C++ standard library. Expected: its card, and the count of hidden calls, do not call it standard-library code.
- **P2.S14.I1 Agreement with the run.** Instances: every function of every fixture run of P2.S2. Check: the function cards for project calls equal the run's steps called from that function, in order (F3). Pass: so.

## P2.S15 Go to definition (F42)

Severity: S1.

- **P2.S15.T01 Destinations.** Instances: every call of P2.S2.T01, T05, T09, T19 and T23. Expected: the destination equals T1's definition.
- **P2.S15.T02 Reasons.** Fixture: a keyword; a name inside inactive `#if` code; a name at a compile error; a function declared and defined nowhere; a name in active code below an `#if … #endif` that has closed; a name below a block comment that holds the text `#if DEBUG`. Expected: each reason given is true of its place; it never says a line is inside an `#if` that has closed or that is only text in a comment.
- **P2.S15.T03 The peek.** Fixture: a definition whose opening brace is on the next line; a declaration ending in `;`; a function 60 lines long. Expected: the peek shows the definition from its first line to its end, or says that it is cut (F30).
- **P2.S15.T04 The list of references.** Fixture: a name used in three files, one of them open in the editor with two lines inserted above the use and not saved. Expected: each entry's file and line equal clangd's answer, and the text shown beside it is the text of that line in the version clangd answered about (the unsaved text for the open file).

## P2.S16 What remains of the boxes model

Instances exist only for exports of `src/shared/flowboxes.ts` that product code reaches (P1.D4.1.a). An export nothing reaches has no unit here and is a Part 1 finding. Its layout and geometry exports belong to Part 5. Truth: the run. Severity: S1.

- **P2.S16.T01 Call numbers on a line.** The text equals the step numbers of the calls it stands for, `→n` for a call to a function already run, `×k` for equal ones, and "+N" stating how many are left out after four.
- **P2.S16.T02 Routes between two functions.** The routes equal every chain of calls from the first function to the second in the run, each with the rows where it is taken.
- **P2.S16.T03 How often, in short.** The short form never contradicts F32 for the same row.
- **P2.S16.T04 Neighbourhood.** Exactly the functions within two calls up or down.
- **P2.S16.T05 Frame words.** The loops and guards named around a row equal its frames (F5).

## P2.L Library tables

Severity: S1.

- **P2.L.1 Each entry.** Instances: one per entry of each table the engine uses to recognise library calls: thread starts, lock calls, lock types, allocation calls, the opening and closing calls of pairs (locks, memory, files and folders), calls that never return, and interrupt names. The list is read from the code by both readers of P1.0.5 and written in the report. Fixture: one generated file per entry that declares the call with its documented signature and calls it as its kind needs. Expected: the fact of the table's kind at that call (a thread frame for the function passed, a lock, an allocation, an opening and a closing, a never-returning call, an interrupt program).
- **P2.L.2 Each library the design names.** Instances: one per (library, kind) named in `docs/FLOW-DESIGN.md` sections 2, 8, 8b and 10b: thread starts for the standard library, POSIX, Win32, FreeRTOS, VxWorks, Zephyr, RT-Thread, CMSIS-RTOS, uC/OS and ThreadX with its `_txe_` wrappers; locks and pairs for pthread, C11, Win32, FreeRTOS, VxWorks, Zephyr, CMSIS, ThreadX, uC/OS, RT-Thread and `std::mutex`; allocation for `new`, the malloc family, `make_unique` and `make_shared`; files and folders for `fopen`, `popen` and `opendir`. Check: the tables hold at least one entry for it, and that entry's P2.L.1 unit passed. Pass: so.
- **P2.L.3 Look-alikes.** Instances: one per entry of P2.L.1. Fixture (C++): a project function whose name holds the entry's name inside a longer name (`my_malloc`, `malloc_stats`), and a project function with the entry's exact name inside a namespace, each called once. Expected: no fact of the table's kind for either (T1: the callee is the project's function, not the library's).
- **P2.L.4 Tables of one kind agree.** Instances: one per (kind, entry) where two tables of the engine recognise the same kind: thread starts (`src/shared/flowrun.ts` and `src/shared/flowcore.ts`), locks (`src/shared/flowfacts.ts` and `src/shared/flowpairs.ts`), allocation (`src/shared/flowfacts.ts` and `src/shared/flowpairs.ts`). Check: the entry is in both tables. Pass: so. Otherwise fail: the same call is a thread start, a lock or an allocation in one view and not in another.

## P2.D Same results everywhere

**Test-only hooks:** `hook.clangdDelay` and `hook.listReverse` (P2.0.7).

Instances for every unit below: one per fixture of P2.S1 to P2.S9 and per generated program of P2.G. Check: the fact dumps compared byte for byte (after replacing the folder's root path by a fixed marker). Pass: identical. Severity: S1.

- **P2.D.1 Repeated.** Five dumps in one session and two after fresh starts.
- **P2.D.2 Shuffled timing.** Five dumps with `hook.clangdDelay` and seeds 1 to 5.
- **P2.D.3 System language.** Dumps with the app started under the languages `en-US`, `tr-TR` and `sv-SE`.
- **P2.D.4 Paths.** Dumps with the fixture copied under a folder whose name has spaces and non-ASCII characters, and opened through a symbolic link.
- **P2.D.5 Kept picture.** The dump from the kept picture when reopening equals the dump of a fresh build.
- **P2.D.6 Listing order.** Dumps with and without `hook.listReverse`.

## P2.I Pictures shown before the build settles

Severity: S1.

- **P2.I.1 Without an index.** Instances: one per fixture of P2.S1 to P2.S3, run with `hook.noIndex`. Check: the x-units of P2.0.5 against the fixture's answers, where a missing fact is allowed only when its limit is stated (F30: approximate, unresolved, functions not found). Pass: no x-unit fails.
- **P2.I.2 Once indexing has finished.** Instances: one per fixture of P2.S1 to P2.S9. Check: in a session opened with no index on disk, the dump taken once indexing has finished equals the dump of a session opened with the finished index (`docs/FLOW-DESIGN.md` section 9: facts are cached against the calls clangd reports). Pass: byte-identical.
- **P2.I.3 The kept picture refused when out of date.** Instances: one per (fixture of P2.S1 to P2.S3, condition of `docs/FLOW-DESIGN.md` section 10b): a source file's size changed; a source file's time changed; a header's size or time changed; a file the run reaches in a folder the file scan skips (`vendor/`) changed; the compile database changed; clangd changed (the inbuilt and the system clangd, when both are on the machine; otherwise not checked); the analyser changed (`hook.analyserStamp`); unsaved edits restored. Check: on reopening, the kept picture is not shown. Pass: not shown.
- **P2.I.4 After an edit, before the rebuild.** Instances: one per fixture of P2.S6. In the scenario, a line is inserted above a call in the editor and the facts are read at once, before any rebuild. Check: every text fact (F13, F17, F35) is taken from the text the run was built from, or the picture is marked out of date. Pass: so.
- **P2.I.5 A request clangd fails.** Instances: one per (fixture of P2.S2, kind of request the engine sends: outgoing calls, syntax tree, document symbols, definition, call hierarchy item, workspace symbols), with `hook.clangdFail` failing one request of that kind. Check: the x-units of P2.0.5 against the fixture's answers, where a missing fact is allowed only when the failure is stated. Pass: no x-unit fails; a function whose calls could not be read is never said to call nothing in the project.
- **P2.I.6 The kept picture is tied to all the code that makes it.** Instances: one per engine file of P2.C and per component of P2.0.8. Check, by reading the build configuration and the fingerprint with file and line: a change to that file changes what the kept picture is checked against (the analyser stamp, or the fingerprint). Pass: so. Otherwise fail: a kept picture made by older code can be shown as current.

## P2.M Transformations that must not change facts (T6)

**Closed list of transformations.** Each is applied by a script in `tools/sweep/` to a copy of the fixture; the script also writes the position map from the original to the copy.
- **M1** Reformat white space: indentation, spaces around operators, braces on their own lines.
- **M2** Add a comment line and a blank line before every function.
- **M3** Rename every local variable consistently to a fresh name.
- **M4** Windows line endings.
- **M5** Tabs for indentation.
- **M6** Reorder function definitions in each file, keeping declarations first.
- **M7** Move one called function into a new file added to the compile database.
- **M8** Split every call's argument list over lines.

- **P2.M.a Facts unchanged.** Instances: one per (fixture of P2.S2, P2.S3, P2.S5 or P2.S6, transformation). Check: the copy's dump equals the original's, after positions are mapped and, for M3, names are mapped; texts compared by Text. Pass: equal. Severity: S1.

## P2.G Generated programs (T4)

- **P2.G.1 Generator rules.** Each program is generated from a seed. Sizes: 1 to 8 files, 2 to 60 functions. Each function body is 0 to 12 statements drawn from: a direct call; a call in an `if` with calls in both arms; a `for` with a literal count of 1 to 5; a `while` on a data condition; an early return in an arm; a `switch` with 2 to 4 cases, with and without fall-through; a call through a function-pointer table; a call through an object-like macro; a call through a function-like macro; a nested call in an argument; a result stored and passed to a later call; a write to a global; a write to an element of a global array; a write through a pointer parameter; a thread start with `pthread_create`. Every program also has non-static functions with the same name in a folder the compile database does not list, and static functions with the same name in two built files.
- **P2.G.2 Expected facts.** Computed from the spec by the evaluation rules of `docs/FLOW-DESIGN.md` section 2 and the thread, pointer and ways-out rules of section 10b, for fact kinds F3, F4, F5, F6, F9, F13, F19, F20, F21.
- **P2.G.3 Seeds.** Seeds 1 to 200 at the sizes above, and seeds 1001 to 1005 at 2,000 functions. The seed list is fixed here.
- **P2.G.4 Generator checked by clang.** Instances: one per generated program. Check: it compiles with T1 with no error, and every call edge in the spec equals a call expression in T1, and the other way round. Pass: so. Otherwise the program is void and listed.
- **P2.G.5 Units.** For each program that passed P2.G.4: the e-units, x-units and c-units of P2.0.5 for the kinds of P2.G.2, plus the invariants of P2.S4 and P2.S8.

## P2.X Real code against clang

Instances: every step of the run of `main` in `samples/tinyhttp`, of `samples/demo_threadx.c` in the ThreadX test copy, and of `utility/rtos_compatibility_layers/OSEK/demo_osek.c` there, while that copy is on the machine.

- **P2.X.1 Definition in the build.** For each step that reaches a source file: the definition lies in the caller's own translation unit (T1), or its file is in the compile database (T3). A function that no file the build compiles defines is not followed. Pass: so. This is the regression unit for the ThreadX finding A1.
- **P2.X.2 Call as written.** For each step: F13's call text equals T1's source text at the call's range as written; for a call inside a macro, the macro use's text, and the step is marked approximate. Regression for A2 and A6.
- **P2.X.3 Writes.** For each function in the run: F9 equals T1's assignments, increments, compound assignments and library writes in its body. Regression for A4.
- **P2.X.4 Never returns.** For each function in the run: F7 equals T1's answer (no path reaches the end or a return). Regression for A4.
- **P2.X.5 Parameters.** For each function in the run: F8 equals T1's parameters. Regression for A6.
- **P2.X.6 Candidates.** For each indirect step: F19 equals the address-taken functions of the folder whose canonical type matches the call's (T1). Regression for A5.
- **P2.X.7 Notes.** Every note passes P2.S6.R1. Regression for A7.
- **P2.X.8 Values named.** Every "named, not called" row's name appears at its line as a whole identifier (T1). Regression for A8.
- **P2.X.9 Junction lines.** Every junction's line holds its condition's keyword. Regression for A9.
- **P2.X.10 Results thrown away.** For each function in the run: every call whose value is not used and whose canonical type is not void (T1, in any statement position) is thrown away (F13, F24), and no other call is. Regression for P2.S5.T20, P2.S5.T21 and P2.S6.T13.
- **P2.X.11 How often.** For each step: F32 equals the rule applied to T1's loops, static initializers and conditions around it.
- **P2.X.12 Cards.** For each function in the run: F35's loops and library calls equal T1's.
- **P2.X.13 Loop counts by LLVM.** For each loop with a fixed count stated: the count equals LLVM's own trip count for that loop (scalar evolution on the compiled function), the cross-check named in the testing paragraph of `docs/FLOW-DESIGN.md` section 8. Not checked when LLVM's `opt` is not on the machine.

## P2.C Coverage closure

Completeness is measured, never claimed. These units run after every other unit of Part 2.

**Engine files** (38, listed by command and read in full on 2026-11-10): the 22 files under `src/shared/`; in `src/renderer/lib/`: `flow.ts`, `flowstore.ts`, `seqtext.ts`, `lsp.ts`, `preview.ts`, `goto.ts`, `repair.ts`, `api.ts` and `langs.ts`; `src/renderer/settingworker.ts`; in `src/main/`: `lsp.ts`, `compilers.ts`, `targets.ts`, `files.ts`, `settings.ts` and `main.ts`. Read and left to other parts: `src/renderer/lib/callmarks.ts`, `lines.ts` and `flowlayout.ts` (drawing, Part 5) and `refresh.ts` (clearing caches, Part 3).

- **P2.C.1 Every engine branch reached.** Instances: one per function and per branch arm (as in P1.D4.2.c) in the engine files. Check: it ran during the Part 2 runs, by the coverage of P1.D4.2 in a test build. Pass: ran. Otherwise needs review with the question: which input reaches it. The answer is exactly one of: a trap added to this part with the user's approval, and run; proof that it cannot be reached (fail S3, dead code); or the part that covers it, named (layout, geometry and drawing belong to Part 5).
- **P2.C.2 Every engine output in the dump.** Instances: one per exported function of the engine files whose result reaches a sink of P1.0.6 item 1 or 3. Check: the dump of P2.0.4 holds a fact kind made from it. Pass: so. Otherwise the dump is incomplete, and every unit that needs that output is not checked until the dump is changed, with approval.
- **P2.C.3 Every sentence's template confirmed.** Instances: one per text template, in the engine files and in the files of P2.0.8, that reaches a sink of P1.0.6 item 3. Check: some fixture produces it, and the user has confirmed once that the template, filled with any fact of its kind, states exactly that fact; the confirmation is kept in the report's template list with its date until the template changes. Pass: both. Until it is confirmed: needs review, with the template and one example from a fixture.
- **P2.C.4 Every contract statement mapped.** Instances: one per row of Table P2-2. Check: every unit named exists and has a verdict; for a row marked "built?", its implementation is found and named with file and line, or it is recorded as not built (fail S3 against the design document). Pass: so.

**Table P2-2, the contract mapped to units** (sections of `docs/FLOW-DESIGN.md`).

| Contract | Units |
|---|---|
| §2 evaluation order, guards, unsequenced arguments, static initializers, lambdas | P2.S2.T12–T14, P2.S2.T21, P2.S3, P2.S4.I2, P2.G, P2.M |
| §2 indirect calls: pointer, member pointer, std::function, dependent, unresolved | P2.S7, P2.S2.T29–T31 |
| §2 built-in operators dropped and counted; a function used as a value is not a call | P2.S2.T15, P2.S2.T32, P2.S2.T33, P2.S6.T11 |
| §2 calls inside macros placed at their statement, approximate | P2.S2.T06, P2.S2.T07, P2.S3.T11, P2.S2.T35 |
| §2 folders without a compile database | P2.S2.T03, P2.S2.T28 |
| §2 entry points: every `main`, a library's public API | P2.S1.T01–T09, P2.S1.T13 |
| §3 programs, build-target names, programs that start programs, shared files | P2.S1.T14, P2.S12 |
| §3b the boxes view | not offered: `src/renderer/components/Flow.tsx` shows only the metro and grid views, and no file read imports `src/renderer/components/FlowBoxes.tsx` (read: `main.tsx`, `App.tsx`, the other 23 components, 18 files of `src/renderer/lib/`, and the import lines of `smoke.ts` and `probe.ts`). Of `src/shared/flowboxes.ts`, live code reaches only `routesBetween` and `frameWords` (`GridView.tsx`, `Sequence.tsx`): P2.S16.T02 and P2.S16.T05. `FlowBoxes.tsx` and the rest of `flowboxes.ts` are judged by P1.D4 |
| §3c and §4 folding, numbering, chapters, what-if, compare, the walk's link, the walkthrough | P2.S4.I4, P2.S4.I8, P2.S4.I9, P2.S8.I3, P2.S8.I4, P2.S8.T18–T20, P2.S11 |
| §3c and §4 search and paths, depth skyline, jump letters, read marks, margin notes, magnifier, motion | built?; their drawing and keys are Part 5 |
| §5 detail levels: code rows | F38 on every fixture of P2.S3 and P2.S6 (built?) |
| §5b text never collides | Part 5 |
| §6 stepping and static truth | P2.S11, P2.S8.T01 |
| §7 what each move does | P2.S11; the keys are Part 5 |
| §8 rules 1 to 5 | F36, P2.S6.R1, P2.C.3, the grade rule of P2.0.3 |
| §8 wording table, row by row | P2.S3, P2.S5, P2.S6, P2.S8.T01, P2.S8.T19, P2.X |
| §8 the three grades | the grade rule of P2.0.3, on every fact kind |
| §8 layers 1 to 4: the compiler, generic rules, library tables, summaries up the call graph | P2.S5, P2.S5.T22–T24, P2.L |
| §8 layer 5: project rules (`.skycodex`) | built? |
| §8 the configuration analysed; inactive regions | P2.S1.T03, P2.S2.T08, P2.S2.T26 |
| §8 testing against LLVM's own analysis | P2.X.13 |
| §8b each analysis | P2.S8, P2.S9, P2.S2.T16 |
| §8b the two tinyhttp findings | P2.S8.T09 |
| §9 entries from the text and their ranking, depth and width limits, before the index, a body the analyser cannot follow, facts cached against clangd's calls | P2.S1.T11, P2.S2.T17, P2.S2.T18, P2.S2.T34, P2.S2.T35, P2.I.1, P2.I.2; the measured times are Part 3 |
| §10 C and C++ read as gcc or MSVC | P2.S2.T36, P2.S2.T43 |
| §10 other languages and their packs | editor features only, through language servers (`src/main/main.ts`, handler `lang:start`): Part 5; the flow reads C-family sources only (`src/renderer/lib/flow.ts`, `SOURCE`), so there is no flow fact to check |
| §10b overrides | P2.S2.T11, P2.S2.T37, P2.S2.T38 |
| §10b threads and tasks | P2.S7.T04, P2.S7.T08, P2.S8.T22, P2.L |
| §10b calls through pointers | P2.S7.T01–T03, P2.S7.T09–T11, P2.X.6 |
| §10b interrupt handlers, `extern "C"` | P2.S1.T10, P2.S1.T12, P2.S2.T19 |
| §10b facts per function, findings | P2.S5, P2.S6.T06, P2.S6.T13, P2.S8.T02, P2.S8.T03, P2.S8.T12, P2.S8.T13, P2.X.10 |
| §10b detail levels; around the step | F38; around the step is Part 5 |
| §10b stable picks | P2.S2.T01–T05, P2.S2.T24, P2.S2.T25, P2.S2.T27, P2.S2.T39, P2.S2.T40, P2.S2.T44, P2.X.1 |
| §10b boxes; layout off the window's thread | Part 5 |
| §10b opening a folder again (the kept picture) | P2.D.5, P2.I.3 |
| §10b moved projects | P2.S2.T28 |
| §10b ways out | P2.S3, P2.S3.T23, P2.S3.T24, P2.S5.T11 |
| §10b pairs that don't close | P2.S8.T08, P2.S8.T14, P2.S8.T24 |
| §10b watch a variable, a value's journey | P2.S8.T04, P2.S8.T05, P2.S8.T15, P2.S8.T23 |
| §10b values settled per call | P2.S8.T06, P2.S8.T16, P2.S8.T25 |
| §10b configurations | P2.S8.T07, P2.S8.T17, P2.S9.T04, P2.S9.T05, P2.S9.T13 |
| §10b what a change does | P2.S9 |
| §10b programs: how they connect | P2.S12 |
| Limits of the scan and the trace (20,000 sources, 12 folders deep, 20,000 functions, 2,000 API functions, 12 candidates, 12 errors) | P2.S1.T15, P2.S1.T17, P2.S2.T41, P2.S7.T11, P2.S10.T10, P2.S12.T08 |
| Outside `docs/FLOW-DESIGN.md`: the editor's preview cards, go to definition, repair and shared helpers (contract: the exactness rule, the settings' own descriptions, T1) | P2.S10, P2.S13, P2.S14, P2.S15 |

**What Part 2 cannot decide, and where it is decided.**
1. How facts are drawn, laid out, hidden or cut: Part 5.
2. Speed, memory, crashes, and clangd stopping and restarting: Part 3. Part 2 records only that the engine stopped, hung or threw (S2).
3. Behaviour over long runs: Part 6. The test tools themselves: Part 4.
4. Facts only running the program can give (which branch runs, a pointer's value, a count that depends on data): by the contract these are stated as unknown; Part 2 checks that they are, never their value.
5. A mistake clang and clangd share: T1 and T2 come from the same compiler front end, so P2.V.1 finds where they disagree, not where both are wrong. The checks that do not come from clang's front end are the hand answers (T5), the generator (T4) and LLVM's loop analysis (P2.X.13).
6. Toolchains and codebases that are not on this machine: their units are not checked and are listed by name, never passed.
7. Design statements with no implementation: P2.C.4 records them as not built; there is no engine output to check.
8. How the editor draws clangd's answers and its own state (completion, hover, diagnostics, fonts, packs, the other languages' servers, the settings pages, the windows): Part 5. On 2026-11-11 the 24 components, `App.tsx`, `main.tsx`, `src/main/search.ts`, `src/preload/preload.ts` and the remaining 11 files of `src/renderer/lib/` were read in full, so every file of `src/renderer/lib/` (24) and `src/renderer/components/` (24) has been read; the facts they compute themselves are listed in P2.0.8. On 2026-11-12, for Part 3, the six files of `src/main/` not read before (`datadir.ts`, `fetch-clangd.ts`, `langpacks.ts`, `packs.ts`, `terminal.ts`, `unpack.ts`) and the two of `src/build/` not read before (`check-smoke.mjs`, `make-icon.cjs`) were read in full. None of them computes a fact the flow shows, so nothing is added to P2.0.8. Product code by section 3 is 95 files, `src/build/` included; the count of 91 used before left `src/build/` out. Still not read, 4 files: in `src/renderer/`, `index.html` and `styles.css` (Part 5), and `smoke.ts` and `probe.ts` beyond their import lines (test tools, Part 4). When each is read for its own part, any fact it computes itself is added to P2.0.8.

## P2.Z Part 2 is complete when

1. Every unit of P2.V has passed.
2. Every unit of P2.S1 to P2.S16, P2.L, P2.D, P2.I, P2.M, P2.G, P2.X and P2.C has exactly one verdict, and every needs review of P2.C has been answered.
3. The report gives, per fact kind and per stage, the counts right, wrong, missing, extra and not checked (R12).
4. The report was produced twice on the same state and the two are byte-identical apart from timestamps (R6).
5. The R1 hash is equal before and after.
6. Every fail is in the findings file with its fixture, its fact and both sides.

---

# Part 3: Execution integrity and speed

**Purpose.** Find where SkyCodeX waits for ever, blocks, leaks, loses or corrupts data, leaves processes behind, fails to recover, or runs slower than its contract, and give every later change the run-time half of R2: the same behaviour, no slower.

**What Part 3 is not.** It does not judge whether facts are right (Part 2) or how they are drawn (Part 5), and it does not run for hours (Part 6). It measures the app from outside where it can, and through the hooks of P3.0.7 where it cannot.

## P3.0 Contract, inputs and measurement

### P3.0.1 The contract (closed list)
1. Rule R2 (a change keeps run time) and the definition of S2 in section 7.
2. `docs/ROADMAP.md`, "Next: speed": the goal of everyday use within about 1.2–2× of a native app; item 2, parsing, layout, analysis and searches off the window's thread, so it never waits.
3. `docs/ROADMAP.md`, "Next: smooth, jitter-free animation": its line **Checks**: frame times recorded for play, zoom, stepping and the Tab glide, failing when the slowest 5% exceed 16.7 ms, checked with the GPU on and with it off.
4. `docs/ROADMAP.md`, the ThreadX benchmark "after" (2026-11-03) and the larger-codebase table (LLVM, RTEMS), as the recorded reference.
5. `docs/ROADMAP.md`, the row of 2026-11-08 (code sweep): a failed flow build says why; a clangd that cannot start answers at once; every clangd request has a limit (60 s, initialize 120 s); clangd and the Rust, Python and Go engines restart cleanly, with no file left unopened, and a crashed engine starts again; saving keeps a file dirty when it was edited during the write; a compared commit is kept only when git and tar both succeed; the hidden window for settings and comparisons ends its job when it fails; archives unpack only where their entries land; a full disk or a cancel never hangs a pack install; a damaged pack manifest is skipped; main-process freezes on large trees and session restore corrected.
6. `docs/ROADMAP.md`, the rows of 2026-11-01 and 2026-11-04: the kept picture shown at once while the live build confirms it; recent folders kept in `data/state/recent.json`.
7. The texts the app shows about its own limits and recovery (for example "The changes stay recoverable in data/state until you edit it again", `src/renderer/lib/store.ts:167`): each is a statement the app makes and must hold.

### P3.0.2 File set and what was read
Product code (section 3) is 95 files, listed by command on 2026-11-12, 16,768 lines. Read in full for this part on 2026-11-12, 31 files: all 13 of `src/main/`; `src/preload/preload.ts`; `src/build/check-smoke.mjs` and `make-icon.cjs`; `src/renderer/App.tsx` and `settingworker.ts`; in `src/renderer/lib/`: `flow.ts`, `flowstore.ts`, `goto.ts`, `langlsp.ts`, `lsp.ts`, `motion.ts`, `power.ts`, `preview.ts`, `refresh.ts`, `repair.ts`, `search.ts`, `seqtext.ts`, `store.ts`. The other 64 files are measured from outside. Their contents enter Part 3 only through the instance rules below, which are run over all 95 files. No unit relies on a reading of them.

### P3.0.3 Conditions
Every measured run records: the machine, the OS and its version, the CPU, the memory, the disk and the free space on it, and the versions of Electron, Node, Chromium and clangd. Each condition is named:
- **GPU on / GPU off.** GPU off is a start with `--disable-gpu`.
- **Cold / kept.** Cold: the fixture's clangd index, `data/state/compile-db`, `data/state/flow-kept` and `data/state/changes` are emptied first. Kept: the state the cold run left.
- **Power.** On mains power with the power saver off, unless the unit names the battery case (`SKYCODEX_BATTERY=1`).

### P3.0.4 Timing rules
1. Times in the window come from `performance.now()`, and times in the main process from `process.hrtime.bigint()`.
2. Each measure is taken in 5 runs per condition; its median and its slowest run are recorded.
3. Frame times come from `requestAnimationFrame` deltas during the named animation. A measure with no frames is a fail, never a pass (R5).
4. **Before and after.** For a change under R2, both sides are measured on the same machine, on the same day, under the same conditions. A measure passes when the median after the change is not above the slowest run before it.

### P3.0.5 Fixtures (closed list)
1. `samples/tinyhttp` and `samples/engine-traps/` (Part 2).
2. Eclipse ThreadX, LLVM (`llvm/` and `clang/`) and RTEMS, each fetched only with the user's yes and removed after use (R11). A unit whose codebase is not on the machine is not checked.
3. Generated trees from `tools/sweep/`: 1,000, 5,000, 20,000 and 60,000 source files; folders 12 and 20 levels deep; runs of 100, 1,000 and 10,000 steps.
4. A folder holding a symbolic link to a file, a hard link, a read-only file and a file with extended attributes.
5. A 50 MB disk image used as the data folder or as the project folder for full-disk units.
6. Archives with known checksums, each in zip, tar.gz, tar.zst and gz form, and hostile ones: an entry with `..`, an absolute path, a link pointing outside, a link followed by a file written through it, a hard link to a file outside, and a zip64 archive whose directory size is false.
7. Stand-in programs placed first on `PATH` or named in settings: a clangd that never answers, a clangd that exits on its first request, a clangd that ignores the terminate signal, and a git that never exits. Each forwards to the real program unless its case applies.
8. A server on 127.0.0.1 that serves the archive fixtures, and in its stalled mode accepts connections and never answers.

### P3.0.6 Detectors
The inventories (P3.W.1, P3.B.1, P3.D.1) are found twice, once with the TypeScript compiler interface and once with a plain token scan (P1.0.5). Each detector is validated (R7) in P3.V before its results count.

### P3.0.7 Test-only hooks (R10)
- `hook.eventLoopProbe`: records the main process's event-loop delay, and the time each IPC handler holds the main process.
- `hook.crashAt`: ends the main process abruptly at a named point. Points: after a temporary file is written and before its rename (`src/main/files.ts:21`); during a download; during an unpack; during a commit export; after a kept picture is written.
- `hook.writeDelay`: holds `fs:write` for a given number of milliseconds before it writes.
- `hook.packSource`: sends release lookups and downloads to the server of P3.0.5 item 8.

### P3.0.8 Limits the contract does not set (set by the user on 2026-11-12)
| Limit | Value | Reason |
|---|---|---|
| Tm: the longest a single IPC handler may hold the main process | 100 ms | the usual limit for an answer to feel immediate |
| Tw: the longest task on the window's thread during an animation | 16.7 ms | one frame at 60 fps (P3.0.1 item 3) |
| Tq: the time children have to end after the app quits | 5 s | — |
| Mg: memory growth allowed over 20 repeats of an action | 10% | room for allocator noise |
| Gs: how fast a time may grow with size | ratio ≤ 2 × the ratio of n·log n | separates growth that has a bound from growth that does not |

A change to any of these values needs the user's approval (section 8).

## P3.V Detector validation
- **P3.V.1 Validated.** Instances: one per detector of P3.0.6. Check: run on samples in `tools/sweep/samples/part3/` with known waits, synchronous calls and writes (positives) and look-alikes (negatives: a `Sync` in a comment or a string, a timer that only redraws, a write to a temporary path). Truth: the samples' written answers. Pass: every positive found, no negative found. Severity: S3. A failed detector voids its units (section 5 item 4).

## P3.W Waits and time limits
**Truth (group):** the contract (P3.0.1 item 5), and the clock of P3.0.4. **Record (group):** the wait, the fixture that held it, the time until it ended, and what the window showed. **Severity (group):** S2.
- **P3.W.1 Every wait listed.** Instances: one per place in product code that waits on something outside the app's own code: an IPC call, a child process, a network request, a clangd or language-server request, a hidden window, a timer used as a deadline, a polling loop with an end time. Check: both readers of P3.0.6 list it with its limit (or "none") and what happens at the limit. Pass: both lists are equal. Severity: S3.
- **P3.W.2 Ends.** Instances: one per wait of P3.W.1. Check: the fixture of P3.0.5 item 7 or 8 that never answers is put in its way. Pass: the wait ends within its listed limit. A wait with no limit fails.
- **P3.W.3 Said.** Instances: as P3.W.2. Check: when the wait ends, a visible sink (P1.0.6) states what was waited for and why it stopped. Pass: stated.
- **P3.W.4 Usable after.** Instances: as P3.W.2. Check: once the fixture answers again, the same action is started again. Pass: it succeeds without restarting the app.
- **P3.W.T01 A release list that never comes.** Fixture: `hook.packSource` in stalled mode; open the compiler window and ask for each pack kind's versions. Expected: each request ends with a message. By reading, the lookups have no limit (`src/main/packs.ts:78`, `src/main/langpacks.ts:29`, `34`, `39`).
- **P3.W.T02 A git that never exits.** Fixture: the git stand-in. Actions: open "what a change does" (history), then compare two commits. Expected: each ends with a message. By reading, neither has a limit (`src/main/main.ts:231`, `250–251`).
- **P3.W.T03 The hidden window stops answering.** Fixture: choose another setting, then suspend the hidden window's page process with the stop signal. Expected: the setting ends as failed, with a reason. By reading, `runWorker` has no limit of its own and ends only if the window's process dies or its page fails to load (`src/main/main.ts:192–210`).
- **P3.W.T04 clangd stops answering.** Fixture: suspend clangd with the stop signal, during a flow build, preview cards, go to definition, and start-up. Expected: each request ends after 60 s, initialize after 120 s (`src/main/lsp.ts:10`), and the flow status reads "could not build the flow: …", never "reading each function…" for ever.
- **P3.W.T05 The repair check's clangd stops answering.** Fixture: as P3.W.T04, during a repair check. Expected: the check ends within 45 s for the first reading and 8 s for each try (`src/main/main.ts:404`, `414`), and the note is cleared or says why.
- **P3.W.T06 A language engine that never starts.** Fixture: a pyright, rust-analyzer and gopls stand-in that never answers initialize. Expected: each ends after 120 s, with a status other than "starting".
- **P3.W.T07 A clangd that hangs on `--version`.** Fixture: the stand-in clangd. Expected: the compiler window and the kept picture's fingerprint (`src/main/main.ts:441`) each wait at most 8 s (`main.ts:545`).
- **P3.W.T08 Building gopls.** Fixture: a Go pack install with the module proxy stalled. Expected: cancel ends it at once; without cancel it ends at the 20-minute limit with its message (`src/main/langpacks.ts:178`, `217`).
- **P3.W.T09 The settings reader's long wait.** Fixture: another setting on ThreadX, cold. Expected: while the hidden window waits up to 30 minutes for indexing (`src/renderer/settingworker.ts:23`), the page says what it is waiting for.

## P3.B Blocking the main process and the window
**Truth (group):** `hook.eventLoopProbe` for the main process; long-task records in the checks layer for the window. **Record (group):** the handler or action, the fixture, the longest block, and the call it was in, from a CPU profile (`smoke:profile`). **Severity (group):** S2.
- **P3.B.1 Every synchronous call listed.** Instances: one per call to a synchronous Node interface (`*Sync`, `execFileSync`) in `src/main/`, reachable from an IPC handler, a watcher callback or start-up. Check: both readers list it. Pass: the lists are equal. Severity: S3.
- **P3.B.2 IPC handlers do not freeze the main process.** Instances: one per (IPC handler of `src/main/main.ts`, fixture: tinyhttp, the 20,000- and 60,000-file trees, ThreadX, LLVM). Check: the longest block while the handler runs. Pass: at most Tm (P3.0.8). By reading, these walk, read or wait synchronously: `fs:files`, `fs:sources` and `search:run` (`src/main/files.ts:62–73`); `fs:targets` (`src/main/targets.ts:9–33`); `lsp:start` (`src/main/lsp.ts:71–105`, the scan and the generated compile database); `compiler:info` (`src/main/lsp.ts:31–33`, `src/main/compilers.ts:14`, `32–40`, up to 5 s per program asked); `shell:terminal` on Linux (`src/main/terminal.ts:26`, `31`, up to ten 3-second waits in turn); `packs:remove` (`src/main/packs.ts:184–185`); the end of an install (`packs.ts:130–137`, `168`); `lsp:notify` for a header (`src/main/lsp.ts:352–358`, the whole compile database parsed); `lsp:built` (`src/main/main.ts:330–347`); `fs:read` (`main.ts:135`), called once per source file when programs are found.
- **P3.B.3 The window's thread during animations.** Instances: one per (animation of P3.0.1 item 3, fixture: tinyhttp, ThreadX, RTEMS). Check: long tasks on the window's thread while it runs. Pass: none longer than Tw.
- **P3.B.4 What runs off the window's thread.** Instances: one per capability named in P3.0.1 item 2: parsing, layout, analysis, searches. Check: a CPU profile of the first picture on ThreadX shows which thread runs it. Pass: not the window's thread. A capability the roadmap lists as not yet built is recorded "not checked: not built", with where it runs today. By reading: layout runs in a worker and searches in the main process; parsing (`src/renderer/lib/flow.ts:35`) and analysis (`flow.ts:460`) run on the window's thread.

## P3.P Child processes
**Truth (group):** the OS process list, taken by command, and the app's own messages. **Record (group):** the process, its parent, when it started and ended, and the signal it got. **Severity (group):** S2.
**Instances (group):** one per child kind: the editor's clangd, the settings clangd, the repair clangd, each language engine (rust-analyzer, pyright, gopls), git (log and archive), tar, xcrun, which or where, each compiler asked for its version, vswhere, clangd asked for its version, `go install`, the terminal, and the hidden window's page process.
- **P3.P.1 Gone after quitting.** Check: quit normally while the child runs. Pass: no child of that kind is left after Tq. The terminal is started detached and is excepted (`src/main/terminal.ts:39`).
- **P3.P.2 Gone after a crash of the app.** Check: kill the main process with the kill signal while the child runs. Pass: no child is left after Tq.
- **P3.P.3 Started again after it crashes.** Instances: each engine (the editor's clangd and the three language engines). Check: kill the engine while a file is open. Pass: clangd starts again, twice in a minute at most, with the message of `src/renderer/lib/lsp.ts:51`; a third stop in a minute gives the message of `lsp.ts:54`; after a restart, every file open in the editor is opened in it again (`src/renderer/lib/store.ts:77`); a language engine says "stopped · starts again with the next edit" and does so (`src/renderer/lib/langlsp.ts:71–76`).
- **P3.P.4 A child that ignores the request to stop.** Fixture: the clangd stand-in that ignores the terminate signal. Check: open another folder, then quit. Pass: the old clangd is gone within Tq. By reading, a stop sends the terminate signal once and does not wait or send the kill signal (`src/main/lsp.ts:239`).
- **P3.P.5 Language engines after a pack install.** Fixture: a Python file open with pyright running; install any pack through `hook.packSource`; then edit the file. Expected: diagnostics come again, or the page says the engine stopped. By reading, an install stops every language engine without telling the window (`src/main/main.ts:583`, `src/main/lsp.ts:236`), so the window keeps them as started, its requests fail and its edits are dropped (`main.ts:474`, `477`).
- **P3.P.6 At most three clangd at once.** Check: count clangd processes with a folder open, while another setting is read, during a repair check, during a comparison, and after opening another folder. Pass: at most one each of the editor's, the settings and the repair clangd; none left from the previous folder.
- **P3.P.7 The repair clangd stops when idle.** Check: 95 s after the last repair check. Pass: the repair clangd is gone (`src/main/main.ts:431`).
- **P3.P.8 Many folders in turn.** Check: open 20 folders one after another, then return to the first. Pass: the number of child processes equals the number after the first opening.

## P3.D Data integrity
**Truth (group):** the bytes on disk, compared with the bytes written. **Record (group):** the file, the point of failure, the bytes before and after, and what the window showed. **Severity (group):** S2.
- **P3.D.1 Every durable write listed.** Instances: one per call in product code that writes, renames or removes a file outside the operating system's temporary folder. Check: both readers list it, with the file it writes. Pass: the lists are equal. Severity: S3.
- **P3.D.2 Old or new, never part.** Instances: one per (write of P3.D.1, point of `hook.crashAt`). Check: crash at the point, then start again. Pass: the file holds exactly its old bytes or exactly its new ones; the app starts; no temporary file is listed in the file pane.
- **P3.D.3 A full disk.** Instances: one per write of P3.D.1, with the 50 MB image full. Check: the write is attempted. Pass: it fails with a message naming the file, and the file keeps its old bytes. For a save of the user's file, the file stays marked unsaved and its text stays recoverable.
- **P3.D.4 Links and attributes kept on save.** Instances: saving a file that is a symbolic link, one with a second hard link, a read-only file, and a file with extended attributes. Check: edit and save in the editor. Pass: the file the link names holds the new text and the link is still a link; the other hard link sees the new text; a read-only file is refused with a message; extended attributes are kept. By reading, a save writes a new file and renames it over the old name (`src/main/files.ts:5–26`), which replaces a link with a plain file and leaves the file it named unchanged.
- **P3.D.5 Unsaved edits survive.** Instances (closed list): (a) the window is killed 2 s after the last edit; (b) the app is quit less than 1 s after the last edit; (c) another folder is opened, then this one again through Open Folder, and the file is opened and edited; (d) a file with unsaved edits is closed with "Close anyway", then opened and edited; (e) the file is edited while a save is held by `hook.writeDelay`. Check: start the app again and look at the text. Pass: (a) the edits are restored; (b) the edits are restored, or the quit warns that they are not saved; (c) the edits are shown or offered before the new edit replaces them; (d) as the dialog says (`src/renderer/lib/store.ts:167`); (e) the file stays marked unsaved, and the text after the save is what is restored. By reading: unsaved text is kept only one second after an edit (`store.ts:129–134`) and the window does nothing on closing (`src/renderer/App.tsx:75`), against (b); kept texts are offered back only when the app starts (`App.tsx:51`, `store.ts:199–211`), not when a folder is opened (`store.ts:64–72`), against (c); a save removes the kept text even when the file was edited during the write (`src/main/main.ts:139`), against (e).
- **P3.D.6 Changed on disk while unsaved.** Check: change the file on disk while the editor holds unsaved edits. Pass: the warning of `src/renderer/lib/store.ts:189` is shown, the editor's text is kept, and only a save writes over the disk.
- **P3.D.7 Commit exports.** Instances: (a) `git archive` fails partway; (b) `tar` fails partway; (c) a crash during an export; (d) five comparisons in a row, where only four exports are kept (`src/main/main.ts:270–271`). Check: run the comparison again. Pass: (a) to (c) export again from nothing and never use a part export; (d) no export in use is removed.
- **P3.D.8 Pack installs interrupted.** Instances: cancel during download and during unpack; a crash during each; a full disk; a checksum mismatch; a hostile archive; replacing a pack with a newer one; two copies of the app installing into one packs folder at once. Check: list the packs and use the active one. Pass: no part pack is listed; the pack being replaced works until the new one is complete; `.downloading` and `.unpacking` hold nothing afterwards; each failure is said. By reading: a replace removes the old folder before the rename (`src/main/packs.ts:171–172`), and an install removes the whole `.unpacking` folder at its end (`packs.ts:177`), so a second copy of the app loses its unpack. Within one copy only one install runs at a time (`src/main/main.ts:572`).
- **P3.D.9 A local archive.** Check: which user action makes a release whose address is a local file (`src/main/packs.ts:145`). Pass: none, or that release is checked against a pinned checksum. By reading, a local file is compared only with its own hash (`packs.ts:152`). If no action reaches it, the verdict is needs review, with the question for P1.D4 (unaccounted code).
- **P3.D.10 Archives stay inside.** Instances: one per hostile archive of P3.0.5 item 6, in each form. Check: a listing of every file outside the target folder, before and after. Pass: equal; each refused entry is named in the install's note.
- **P3.D.11 tar.zst can be read.** Instances: one per OS on this machine. Check: the shipped Electron's Node has `zlib.createZstdDecompress` (`src/main/unpack.ts:237`). Pass: present. On macOS and Linux every clang toolchain comes as tar.zst (`src/main/packs.ts:68`). Severity: S2.
- **P3.D.12 Free space checked with a real size.** Instances: one per pack kind whose size comes from a HEAD request (`src/main/langpacks.ts:38–40`, `115`, `130`). Check: the HEAD request fails, and the disk has less room than the pack needs. Pass: the install is refused before it starts, with the free-space message (`src/main/packs.ts:144`). By reading, a failed HEAD request gives a size of 0, and the check then passes.

## P3.M Memory and caches
**Truth (group):** the window's JavaScript heap after a forced collection (DevTools protocol) and the main process's resident memory. **Record (group):** the action, the repeat, and the memory before and after. **Severity (group):** S2, except P3.M.4.
- **P3.M.1 Every long-lived store has a bound.** Instances: the long-lived state of P1.D6.1. Check: run the 60,000-file tree and ThreadX, and count the entries at their peak. Pass: no store grows past its stated bound; a store with no bound is recorded with its peak.
- **P3.M.2 Memory comes back.** Instances (closed list): opening two folders in turn; 1,000 steps forward and back; opening and closing 50 files; preview cards for 100 functions; 50 folder searches; two comparisons; two other settings. Each is repeated 20 times. Check: the memory after the 20th repeat against the memory after the 2nd. Pass: grows by at most Mg.
- **P3.M.3 The texts held for a large tree.** Check: the window's heap after the first picture on the 20,000-file tree and on LLVM. Record: the peak, and how much of it is file texts (a heap snapshot). By reading, the text of every source file read while programs are found is kept (`src/renderer/lib/flow.ts:22–30`, `57–60`). Pass: the heap per source file on the 20,000-file tree is at most (1 + Mg) times the heap per source file on the 1,000-file tree.
- **P3.M.4 Caches follow their triggers at run time.** Instances: every (state item, trigger) left "not checked" by P1.D6.4.b, and these from reading: the symbols of a file, kept by version number (`src/renderer/lib/lsp.ts:212–222`), after clangd restarts (the numbers start again at 1, `lsp.ts:24`) and after a background file is closed and opened again (`lsp.ts:132`) with its text changed on disk in between. Check: fire the trigger, then use the item. Pass: the value is rebuilt from the current text: the preview cards are those of the function under the cursor in the text as it is now. Severity: S1 when the value reaches a sink of P1.0.6 item 1 or 3, S2 otherwise.
- **P3.M.5 Large answers.** Instances: clangd answers of 1, 10 and 50 MB (workspace symbols and syntax trees on LLVM). Check: the time from the first byte to the parsed answer. Pass: grows within Gs of the size. By reading, each piece received is joined to all the bytes before it (`src/main/lsp.ts:281`), so the time grows with the square of the size.

## P3.R Recovery and starting again
**Truth (group):** the app starts, and the state files hold valid content. **Record (group):** the damage, what the app did and what it said. **Severity (group):** S2.
- **P3.R.1 Starts after a crash.** Instances: a kill of the main process during a flow build, a kept-picture write, a settings write, a session write and a pack install. Check: start again. Pass: the app starts, and P3.D.2 holds for every file that was being written.
- **P3.R.2 Damaged state files.** Instances: one per (state file, damage). State files: `session.json`, `recent.json`, `settings.toml`, a kept text, a kept picture, a pack manifest, a generated compile database. Damage: empty, cut short, binary, valid JSON of the wrong shape. Check: start, open the folder, use the feature. Pass: the app starts and the feature works or says why; `settings.toml` problems are shown (`src/renderer/App.tsx:47`).
- **P3.R.3 Two copies of the app.** Check: start a second copy on the same data folder and work in both. Pass: no state file is ever invalid; pack installs as P3.D.8. By reading, no single-instance lock is taken (`src/main/main.ts`, read in full).
- **P3.R.4 A data folder that can't be written.** Instances: the folder beside the app read-only; macOS's quarantine copy. Check: start. Pass: data goes to the fallback and the reason is shown (`src/main/datadir.ts:42–54`, `src/renderer/App.tsx:48`).
- **P3.R.5 The main window's page crashes.** Check: kill the main window's page process. Record: what the user sees and whether unsaved texts are kept. Verdict: needs review. The contract says nothing about this case; by reading, the main process watches only the hidden window's page (`src/main/main.ts:206`).

## P3.F Speed and frames
**Truth (group):** the clock of P3.0.4, and the frame budget of P3.0.1 item 3. **Record (group):** every run's numbers, the conditions, and the reference row of the roadmap.
- **P3.F.1 The benchmark.** Instances: one per (measure, condition) of the roadmap's ThreadX table: first picture, full run once indexed, programs list, preview cards, a step's median and slowest time, and frames for stepping, play, play in the grid, zoom all and the Tab glide; GPU on and off; cold and kept. Check: the same scenario steps, 5 runs each. Pass for frames: P3.F.4. Other measures: recorded beside the roadmap's reference. A median outside the reference's recorded range is needs review, since the contract sets no budget for them. Severity: S3.
- **P3.F.2 Frames were counted.** Instances: one per animation measured in P3.F.1 and P3.F.4. Check: the number of frames. Pass: more than 0. The roadmap records two GPU-off kept runs of play with no frames. Severity: S2.
- **P3.F.3 Compared with a native app.** Instances: the goal of P3.0.1 item 2. Verdict: not checked. There is no native app on this machine to compare against.
- **P3.F.4 The frame budget.** Instances: one per (animation: stepping, play, play in the grid, zoom, the Tab glide; fixture: tinyhttp, ThreadX, RTEMS; GPU on, GPU off). Check: the slowest 5% of frame times. Pass: at most 16.7 ms. Record also the slowest frame. Severity: S3, or S2 when P3.F.5 shows the time growing without bound.
- **P3.F.5 Growth with size.** Instances: one per measure of P3.F.1, on the generated trees and runs of P3.0.5 item 3. Check: the time at each size. Pass: from each size to the next, within Gs. Severity: S2.
- **P3.F.6 The recorded misses at large sizes.** Instances: RTEMS preview cards that did not arrive in 90 s; RTEMS frames of 650–667 ms; LLVM's list stopping at 20,000 sources. Check: run each again. Pass: the cards arrive or say why within the waits of P3.W; frames as P3.F.4; the cap is said where the list is used. Severity: S2.
- **P3.F.7 The run-time half of R2.** Instances: one per later change, for every measure of P3.F.1 and P3.F.4 the change can reach. Check: the before-and-after rule of P3.0.4 item 4, next to the Part 2 dump, which must be byte-identical apart from the fixed defect. Pass: both hold. Severity: S2.

**What Part 3 cannot decide, and where it is decided.**
1. Losing power: a save syncs the file but not its folder (`src/main/files.ts:13`), and whether a rename survives a power cut depends on the disk and the OS. It cannot be tested without cutting the machine's power; recorded as not checked.
2. Windows and Linux when they are not on this machine: their units are not checked and are listed by name.
3. Long runs: Part 6. How results are drawn: Part 5. The test tools: Part 4.
4. Comparison with native apps: P3.F.3.

## P3.Z Part 3 is complete when
1. Every unit of P3.V has passed.
2. Every unit of P3.W, P3.B, P3.P, P3.D, P3.M, P3.R and P3.F has exactly one verdict.
3. The report gives counts per family (R12) and every measure with its conditions.
4. The report was produced twice on the same state and the two are byte-identical, apart from the timestamps and the measured times, which are kept in their own field (R6).
5. The R1 hash is equal before and after.
6. Every codebase fetched for Part 3 has been removed, with the user's yes (R11).

---

# Part 4: Test tools, report and order

**Purpose.** Prove that the tools which run and judge tests give verdicts that can be trusted: every check catches what it claims to catch, nothing passes by default, nothing changes what it tests. Then fix the report and the order in which the whole suite runs.

**What Part 4 is not.** It does not judge the product itself (Parts 1, 2, 3, 5 and 6). It judges the tests and the tools that judge the product.

## P4.0 Scope and inputs

### P4.0.1 Tool set (closed list, listed by command on 2026-11-12)
1. The checks layer: `src/renderer/smoke.ts` (1,488 lines; 21 named scenarios plus the default: compiler, fonts, defs, anyheader, boot, large, engine, programs, folder, colors, revisit, exits, jump, findings, watch, values, configs, change, repair, probe, hold), `src/renderer/probe.ts` (514 lines).
2. `src/build/check-smoke.mjs` (34 lines), the only script that turns a smoke report into a verdict.
3. The unit tests: `src/tests/`, 42 files: 28 test files, the helper `flowrun.fixture.ts`, the recorder `fixtures/record-flow.mjs`, the rule fixture `fixtures/rules/rules.cpp` with its `compile_flags.txt`, and 10 recorded clangd answers (`fixtures/*-flow.json`). Their configuration: the `test` section of `vite.config.ts` (lines 22–26) and `tsconfig.json`.
4. The scripts of `package.json`: `test`, `typecheck`, `smoke`.
5. The CI workflow `.github/workflows/release.yml`.
6. Test support that Parts 1 to 3 name and that does not exist yet: `tools/sweep/` (absent on 2026-11-12), `samples/engine-traps/`, the dump scenario, the hooks of P2.0.7 (5) and P3.0.7 (4).

Read in full on 2026-11-12: items 1, 2, 4 and 5, all 32 code and text files of item 3, and its configuration. Not read: the 10 recorded answer files, which are data. They are checked through their recorder (P4.F).

### P4.0.2 The contract
Sections 1 to 8 of this document (authority, R1 to R14, unit format, running, records, severity, changes), and every place in Parts 1 to 3 that names a tool, a hook or a sample.

## P4.V Every check catches what it claims
- **P4.V.1 Each check is proven on a mutant.** Instances: one per check: each `it` or `test` of `src/tests/`; each `check(…)` of `smoke.ts`; each `rec` of `probe.ts` that has a check; each rule of `check-smoke.mjs`. Check: in a temporary copy of the repository under `tools/sweep/mutants/` (never the working tree, removed afterwards), make the smallest change to product code that breaks what the check names, then run the check; run it again on the unchanged copy. Truth: the mutant is wrong by construction. Pass: the check fails on the mutant and passes on the unchanged copy. Record: the mutant's diff and both results. Severity: S3, or S1 when the check guards a fact (F1 to F44).
- **P4.V.2 The detectors of Parts 1 to 4 are validated first.** Instances: P1.V, P2.V, P3.V and the detectors of this part. Check: run before any unit that uses them (section 5 item 4). Pass: all validated.

## P4.T The unit tests
**Truth (group):** this document and the sources each test reads. **Record (group):** the test's file and line, and what was expected and observed. **Severity (group):** S3, unless the unit says otherwise.
- **P4.T.1 Every test listed.** Instances: one per `it`, `test`, `it.skipIf(…)`, `describe.skipIf(…)` and generated test in `src/tests/`. Check: both readers of P1.0.5 list them, and vitest's JSON report lists them. Pass: the three lists are equal. The plain count of lines matching `it(` or `test(` on 2026-11-12 was 275, which is not a test count (`engine.test.ts` matched 0 because its tests are `it.skipIf(…)(…)`).
- **P4.T.2 No test passes without checking.** Instances: one per test. Check: it runs at least one assertion, or it is reported skipped with its reason. Pass: so. By reading: `exits.test.ts:48–49` returns with no assertion when a folder in an old session's temporary directory is missing, and is then reported as passed; `engine.test.ts:16`, `41`, `compilers.test.ts:137` and `packs.test.ts:143` are skipped when clangd or `LITHO_TEST_CLANGD_ZIP` is missing, and `npm test` still succeeds. Severity: S2. A skipped test counts as not checked, never as pass (R5).
- **P4.T.3 Each test names its truth.** Instances: one per test. Check: its expected values come from a truth source of P2.0.2 (T1 to T6) or a rule of this document. A value copied from the code's own output counts as T5 only when it is frozen by hash with its hand derivation recorded. Pass: the truth is named. Otherwise needs review.
- **P4.T.4 Tests agree with the approved parts.** Instances: one per (test, unit of Parts 1 to 3 about the same fact). Check: the two expect the same. Pass: the same; otherwise needs review, with both texts. By reading: `flowrun.test.ts:103` expects a lambda's step where the lambda is written, and P2.S3.T19 expects it at the call.
- **P4.T.5 Inputs are fixed and present.** Instances: one per file a test reads outside `src/tests/`. Check: its hash is recorded with the test, and a missing input fails loudly. Pass: so. By reading: `exits.test.ts:48` reads a fixed absolute path into an old session's temporary folder (it also writes the user's home-folder name into a public repository); `flowlinks.test.ts:9–17` holds its own copy of `samples/tinyhttp/src/server.cpp`, which can drift from the sample; `colors.test.ts:10` reads `styles.css`.
- **P4.T.6 Tests change nothing outside their temporary folders.** Instances: one per test file. Check: the R1 hash, and the list of entries in the system's temporary folder, before and after. Pass: both unchanged. By reading: `engine.test.ts:12` runs `samples/tinyhttp/build.sh`, which writes into `samples/`; `core.test.ts`, `packs.test.ts` and `langpacks.test.ts` leave their `mkdtemp` folders behind. Severity: S2 for a change under `samples/`, S3 for leftovers.
- **P4.T.7 Tests of unreachable code.** Instances: `flowboxes.test.ts`, `flowlayout.test.ts`. Check: whether the code they test is reachable (P1.D4). Verdict: needs review, decided with P1.D4.4.a: if the code is removed, these tests go with it. Decided by the user on 2026-11-14: the boxes-only code is removed, and P5.S.6 says which tests go (`flowlayout.test.ts` whole; of `flowboxes.test.ts`, only the tests of removed functions).
- **P4.T.8 Run where it ships.** Instances: each test of behaviour that depends on the runtime (for example `packs.test.ts:90`, reading tar.zst through Node's zstd). Check: run it under Electron's Node (`ELECTRON_RUN_AS_NODE=1`) as well as vitest's Node. Pass: the same result. Settles P3.D.11 for this machine.
- **P4.T.9 Repeatable.** Check: the whole test run twice on the same state. Pass: identical results (R6); every random input comes from a fixed seed.

## P4.F Recorded fixtures
- **P4.F.1 Each recording can be made again.** Instances: the 10 recorded answer files. Check: record again with `record-flow.mjs` from the same sample with the same clangd, and compare. Pass: identical. Record: the clangd version. By reading: the recordings store no clangd version (`record-flow.mjs:51`), and the recorder imports `src/concepts/flow/lsp.mjs` (`record-flow.mjs:11`), so it cannot run without the prototypes folder. Severity: S3.
- **P4.F.2 The sample still matches the recording.** Instances: one per (recording, sample file it reads at test time, `flowrun.fixture.ts:15`). Check: the file's hash at recording time is stored and equal now. Pass: stored and equal. By reading, no hash is stored. Severity: S1, since a drifted sample makes recorded positions point at other text.
- **P4.F.3 Comments in test files.** Instances: `record-flow.mjs` (lines 1–6, 45) and `rules.cpp` (its line comments). Check: whether the exception of 2026-11-08 for samples and fixtures (`docs/ROADMAP.md`, the row of that date) covers a recording script, given R9. Verdict: needs review, for the user.

## P4.S The checks layer
**Record (group):** the scenario, the line and what was observed. **Severity (group):** S3, unless the unit says otherwise.
- **P4.S.1 Every scenario ends in a verdict.** Instances: the 22 scenarios of P4.0.1 item 1. Check: a written rule turns its report into pass or fail. Pass: such a rule exists. By reading, only `boot` has one (`check-smoke.mjs`); eight scenarios record failures in `errors` (watch, values, configs, repair, change, exits, jump, revisit), and nothing reads `errors` for them; the others (default, compiler, fonts, defs, anyheader, large, engine, programs, folder, colors, findings, probe, hold) record values with no rule. Severity: S1 for a scenario whose purpose is a fact.
- **P4.S.2 check-smoke reads what boot writes.** Instances: one per rule of `check-smoke.mjs` (lines 9–31) and one per field `bootCheck` writes (`smoke.ts:555–665`). Check: every field a rule reads is written; every field written is judged or listed as recorded only. Pass: so. By reading: `flowBoxes` (line 14) is never written, so the check fails on every run; `boxKeptStep`, `boxCollisions`, `layoutWorker` and `boxRoutes` are never written, so their rules never fire; `gridSquares`, `gridKeptStep`, `gridRoutes` and `gridCollisionsAfterTab` are written and never judged. Severity: S2.
- **P4.S.3 A wait that runs out is a failure.** Instances: one per `until` or `quiet` in `smoke.ts` and `probe.ts` whose result is not used as a verdict. Check: when it returns false, a failure naming what never came is recorded. Pass: so. By reading, the scenarios go on after a wait that ran out (for example `smoke.ts:87`, `254`, `909`, `1461`).
- **P4.S.4 Nothing passes by not throwing.** Instances: each `call(…)` of `probe.ts` with no check (`probe.ts:101`, `102`, `121`, `122`, `123`, `126`, `131`). Check: how its record is counted. Pass: counted as "ran", not as "passed", or given a check (R5).
- **P4.S.5 The tools' limits are the suite's.** Instances: the frame limit of 25 ms (`smoke.ts:36`, `46`), the long-task limit of 250 ms (`probe.ts:58`), and reduced motion for the whole probe (`probe.ts:454`). Check: against P3.0.8 (Tw 16.7 ms) and the roadmap's 16.7 ms p95. Pass: the tools use the suite's values, or only record their own.
- **P4.S.6 Hand answers are frozen.** Instances: each expected text or number written into a scenario's checks (watch, values, configs, repair, change, exits, jump). Check: each is a T5 answer with its hash and hand derivation recorded. Pass: so.
- **P4.S.7 Scenarios leave the samples as they were.** Instances: one per scenario. Check: the R1 hash before and after. Pass: equal. By reading: `revisit` writes `src/server.cpp` with its own text (`smoke.ts:1447`); the default scenario makes `smoke_new.cpp` in the sample (`smoke.ts:320–321`, removed by `src/main/main.ts:635`) and applies a clangd rename (`smoke.ts:199–201`). Whether that rename reaches disk is decided by this unit's run. Severity: S2.
- **P4.S.8 The probe's checks are independent.** Instances: one per kind of `rec` with a check in `probe.ts`. Check: its truth is outside the engine (clangd, T2) or it compares the engine with itself (for example `probe.ts:117–120`). Pass: outside. A check of the engine against itself is not checked (R4); a check that falls back to text patterns (`probe.ts:221–237`) is needs review.

## P4.C The release workflow
**Record (group):** the step and its line in `.github/workflows/release.yml`.
- **P4.C.1 Failing tests stop a release.** Check: `npm test` fails. Pass: the job fails. By reading, the step has `continue-on-error: true` (line 49). Severity: S1, since a release can then carry a wrong fact.
- **P4.C.2 The boot check decides.** Check: run `check-smoke.mjs` on a boot report of the current build. Pass: it passes on a good build and fails on a mutant of P4.V.1. Predicted by P4.S.2 to fail on every build. Severity: S2.
- **P4.C.3 Every shipped system is checked.** Instances: macOS, Windows, Linux. Check: a boot check runs for each before release (in the workflow, or a recorded local run). Pass: so. By reading, the workflow builds Windows and Linux only (lines 25–26). Severity: S3.
- **P4.C.4 The runtime is recorded.** Check: the workflow's Node version for tests (22, line 32) and the shipped Electron's Node are both recorded with the results. Pass: recorded.

## P4.R Report and order
- **P4.R.1 One report writer.** Check: one program in `tools/sweep/` writes every part's report and findings file in the form of section 6, with counts per family (R12) and the separate field of R6. Pass: it exists and its output matches a written schema. Severity: S3.
- **P4.R.2 The order of a full run (closed list).**
  1. Record the state: the commit, uncommitted changes, the R1 hash, and the versions (section 5).
  2. Build test support that is missing (P4.0.1 item 6), only with the user's yes; it changes test-support paths only (R1).
  3. Part 4: P4.V.2, then P4.T, P4.F, P4.S and P4.C. A check that fails P4.V.1 is void, and so are the units that rely on it.
  4. Part 1: P1.V, then its components.
  5. Part 2: P2.V, then its stages.
  6. Part 3: P3.V, then its families.
  7. Part 5, then Part 6, when written and approved.
  8. Each part's report a second time, compared (R6).
  9. The R1 hash again; a difference voids the run.
  10. Remove every fetched codebase, with the user's yes (R11).
- **P4.R.3 Only approved commands.** Check: every command the run used is in the list the user approved for that step (section 1 item 3). Pass: so. Record: the log of commands. Severity: S2.
- **P4.R.4 What must be built first.** Instances: `tools/sweep/` with its samples and detectors; `samples/engine-traps/`; the dump scenario; the hooks `hook.clangdDelay`, `hook.listReverse`, `hook.noIndex`, `hook.analyserStamp`, `hook.clangdFail`, `hook.eventLoopProbe`, `hook.crashAt`, `hook.writeDelay`, `hook.packSource`, `hook.axTree`, `hook.liveCounts`, `hook.storeSizes`. Check: built, listed by name, and absent from the shipped bundle (R10). Pass: so.

**What Part 4 cannot decide.**
1. Whether a hand answer is right: the user confirms each once, as in P2.C.3.
2. The workflow on GitHub's machines: it runs on a tag or by hand, not offline, and the suite does not start it. P4.C reads it and runs its checks locally.

## P4.Z Part 4 is complete when
1. Every unit of P4.V, P4.T, P4.F, P4.S, P4.C and P4.R has exactly one verdict.
2. Every check found void by P4.V.1 is named, with the units of other parts that depended on it.
3. The report was produced twice and is byte-identical apart from the field of R6.
4. The R1 hash is equal before and after, and every mutant copy has been removed.

---

# Part 5: UI rendering

**Purpose.** Check that what the window draws matches the agreed design and states the truth visibly. That covers: text that is never cut without a way to read all of it, never text on text, colours and keys that do what they say, motion that respects the user's choices, and every approved screen present as approved.

**What Part 5 is not.** Whether a fact is right is Part 2; Part 5 checks that the page shows the fact it was given, whole and readable. Speed and frame times are Part 3. Long sessions are Part 6.

## P5.0 Scope and inputs

### P5.0.1 The contract (closed list)
1. `docs/FLOW-DESIGN.md`: §1 (visual language); §3 (programs); §4 (rows and boxes, the magnifier); §5 (detail levels); §5b (rules 1 to 7, text never collides; colour budget; ink density for grades; ember trail; motion grammar; spine; threads); §6 (stepping as shown); §7 (the key table, captions after each move, captions that can be turned off, keys kept in `settings.toml`, focus rings and screen-reader labels); §8 rule 1 (hovering a sentence shows the code it comes from); §8b (the "how it shows" column); §9 (drawing only what is on screen); §10b (the words of ways out, pairs, watch, values, configurations and changes).
2. `docs/FLOW-VIEWS-PLAN.md` §1 (metro; grid; grid refined; shared by both views; editor) and §3 items 4 to 7.
3. `docs/ROADMAP.md`: the rows of 2026-11-04 (start window), 2026-11-05 (the approved UX row), 2026-11-06 (built), and "Next: smooth, jitter-free animation". The rows of 2026-11-09 for the grid's empty cell and middle-shortened file labels are agreed and not built: they are listed in P5.D.2 as not built.
4. The standing rules kept in memory: no silent clipping (ribbons scroll, long lists cap and scroll, cut labels show their full text on hover); the code preview pane is always kept; every text in the editor is derived mechanically, offline and exactly.
5. The approved mock-ups in `docs/mockups/flow/` (7 files: `metro.png`, `grid.png`, `card-divider.png`, `code-preview.png`, `details-link.png`, `hover-fonts-controls.png`, `run-bars.png`). The 5 files in `docs/mockups/flow/ideas/` are counted as approved only if the user says so (P5.D.1). The SkyFlowX mock-ups are out of scope: SkyFlowX is not built.
6. Part 2's hand-over: the facts computed outside the engine (P2.0.8), and boundary items 1 and 8.

### P5.0.2 File set and what was read
Read in full for this part on 2026-11-12: `src/renderer/index.html`; `src/renderer/styles.css`; 23 of the 24 components (all but `FlowBoxes.tsx`); in `src/renderer/lib/`: `actions.ts`, `api.ts`, `callmarks.ts`, `cm.ts`, `fonts.ts`, `hlcode.ts`, `hwheel.ts`, `i18n.ts`, `langs.ts`, `lines.ts`; `src/renderer/main.tsx`; `src/shared/settings-schema.ts`. Read earlier the same day for Part 3: `App.tsx`, `lib/store.ts`, `lib/preview.ts`, `lib/goto.ts`, `lib/repair.ts`, `lib/search.ts`, `lib/motion.ts`, `lib/power.ts`, `lib/seqtext.ts`, `lib/lsp.ts`, `lib/langlsp.ts`. Not read for this part: `FlowBoxes.tsx` and `lib/flowlayout.ts`, which no live file imports (P1.D4.4.a decides them). Whatever they would draw is not drawn.

### P5.0.3 Conditions
Every rendering unit runs on each of these conditions, unless it names fewer:
- **Window sizes:** 760 × 480 (the minimum), 1440 × 900 (the default), 2560 × 1440.
- **Interface scale (`ui.scale`):** 0.75, 1, 2.
- **Code size (`font.size`):** 9, 13, 24.
- **Typefaces:** code in ArX F1 and in one wide installed monospace font; interface in Selawik and in one installed proportional font.
- **Modes:** high contrast on and off; reduced motion on and off; battery saver on (`SKYCODEX_BATTERY=1`); GPU on and off.

Fixtures: `samples/tinyhttp`; `samples/engine-traps/`; ThreadX (with the user's yes; removed after, R11); and a generated sample with identifiers of 200 characters, file paths of 300 characters and calls nested 30 deep.

### P5.0.4 Truth
- The page's own geometry: element boxes, text ranges, `scrollWidth` against `clientWidth`, computed styles.
- The accessibility tree, read through `hook.axTree`.
- Pixels of canvas elements.
- For likeness to a mock-up, the user's confirmation, given once per screen (P5.D.1).

The audits already in the checks layer (`auditSequence`, `auditGrid`, `totalsInSight`) count only after P4.V.1 has proven them.

### P5.0.5 Test-only hook (R10)
- `hook.axTree`: returns the window's accessibility tree, through the DevTools protocol, in a test build only.

### P5.0.6 Limits the contract does not set (set by the user on 2026-11-12)
| Limit | Value | Reason |
|---|---|---|
| Ct: contrast of text against its background with high contrast on | 4.5 : 1 (3 : 1 for text of 18 px and over) | WCAG 2 level AA |
| Fi: animation frames while nothing changes on screen | 0 per second | nothing should redraw when nothing moves |

## P5.T Text
**Record (group):** the element, its full text, the text shown, the condition and a screenshot. **Severity (group):** S3, or S1 when the hidden text is code, a number or a fact (F1 to F44).
- **P5.T.1 No silent cut.** Instances: each element whose text is cut in any state of a walk through every step on each fixture and condition: an ellipsis, a line clamp, a fade mask, or text overflowing a hidden box. Check: the full text appears on hover (a title or a tooltip), or the container scrolls to it. Pass: so. By reading, these cut with nothing to hover:
  - in the metro: the loop text in the header, cut at 34 characters (`Sequence.tsx:651`); the parts of a row: who calls (`875`), the call as written except for indirect calls (`875`), what is around it (`877`), the result (`880`), condition notes (`883`), the words of a watch (`891`) and `uses` (`892`); loop frame labels (`793`); code rows (`859`); the fading end of every row (`styles.css:461`);
  - in the grid: link labels, cut at 64 characters with no hover (`GridView.tsx:182`, `styles.css:841`); the calling line in an open square (`GridView.tsx:437`);
  - elsewhere: the card's call lines (`StepPreview.tsx:220–222`); the preview column titles (`Preview.tsx:266`); search hit lines and the search summary (`styles.css:710`, `715`).
- **P5.T.2 A cut list says so.** Instances: each list or count the window caps. Check: the page says how many are left out, or the list scrolls to them. Pass: so. Said already: preview cards (`Preview.tsx:282`), the file filter (`FilesPane.tsx:74`), search hits (`SearchPanel.tsx:52`), programs and shared files (`Programs.tsx:84–85`, `97`), the compare column (`Sequence.tsx:930`), grid dots (`GridView.tsx:432`). Not said, by reading: the find list at 9 (`Sequence.tsx:416`); the watch list at 12 (`992`); the steps in the ripple note, cut at 6 with "…" (`299`); the palette at 80 and symbols at 60 (`Palette.tsx:18`, `actions.ts:118`); compiler versions at 10 and 8 (`CompilerWindow.tsx:167`, `202`); the mini spine at 40 bars (`Sequence.tsx:906`).
- **P5.T.3 Never text on text.** Instances: every state of a walk through every step, on each fixture and condition, in both views, with each detail level, fold, what-if, junction, watch and route. Check: the audits of P5.0.4, and any line through text (§5b rule 7). Pass: no collision. By reading, label and tag widths are estimated from character counts (`GridView.tsx:183`, `246`; `lib/lines.ts:43`), and when every place collides the first is used anyway (`GridView.tsx:185`, `256`), so other typefaces and sizes can collide. Severity: S1.
- **P5.T.4 Each sentence shows its source.** Instances: each kind of sentence the page shows: the facts in the step's box, row notes, card rows, junction rows and findings. Check: hovering it shows the code range it comes from (§8 rule 1). Pass: so. A kind with no such hover is recorded "not checked: not built".
- **P5.T.5 One number for one step.** Instances: each place a step's number is shown: rows, the metro header, chapters, the find list, the tour, the skyline tip, the grid's header and squares, the card and the right pane. Check: the same step shows the same number everywhere. Pass: so. Part 2 checks the values (P2.S4.I10); this unit checks the page. Severity: S1.
- **P5.T.6 Typefaces and sizes.** Instances: every screen of the default and boot scenarios, under each typeface, code size and interface scale of P5.0.3. Check: P5.T.1 and P5.T.3 on every capture; card headers grow with the preview size (`styles.css:135`). Pass: both hold.
- **P5.T.7 Every area that grows with the codebase scrolls.** Instances: each area whose amount of information depends on the codebase: a ribbon, strip, header, status line, legend, key, list, menu, popup, caption, card or pane, and each canvas picture (the spine, the run bars). Found by running every fixture of P5.0.3, the large generated sample and ThreadX included, through every screen of the default and boot scenarios at the smallest window size. In each state, list every element whose content is larger than its visible box, or which reaches past the window. Check: every part of its content can be brought into view: one-line ribbons scroll sideways by mouse wheel and trackpad; lists and popups have a capped height and scroll; canvas pictures zoom or scroll to every step. A list cut at a limit passes only if the rest can be reached from it. Truth: the page's geometry (P5.0.4), before and after scrolling. Pass: every part reachable. Record: the area, the fixture, the condition, the size of the content and of the visible box, and a screenshot. Severity: S3, or S1 when what is out of reach is a fact (F1 to F44). Known by reading (`docs/READING-FINDINGS.md`): V1 to V7 and V21; the lists of V8 to V17 are checked here too. The rule is the user's (2026-11-12).

## P5.C Colour and visual language
- **P5.C.1 The colour budget.** Instances: each use of colour for files or functions: the metro line colours (`Sequence.tsx:26`, `256–260`), the grid's file bands and outlines (`GridView.tsx:17`, `98`), the card palette (`lib/lines.ts:3`). Check: each file has a colour of its own in the metro's line and the grid's file bands (FLOW-VIEWS-PLAN §1, which governs by the user's decision of 2026-11-12); functions get no colour; amber is "now" only, teal repetition only, red risk only (§5b as corrected). Pass: so. Severity: S3.
- **P5.C.2 Every colour can be set, or is listed as fixed.** Instances: each colour the page draws, from `styles.css`, the components and canvas drawing. Check: set every colour setting to a distinct value and see which colours move. Pass: each colour moves with its setting, or is on a written list of fixed colours. By reading, many are fixed: the selection gold `#e3d6ad` (dozens of rules from `styles.css:547`), the spine (`Sequence.tsx:607–618`), the run bars (`Sequence.tsx:1089`), the dotted link (`StepPreview.tsx:138`), the file palettes, and the font of connector labels (`lib/lines.ts:46`). Severity: S3.
- **P5.C.3 One file, one colour.** Instances: each file in a run, on each fixture. Check: its colour in the metro and in the grid. Pass: the same. By reading, the grid gives colours in the grid's file order (`GridView.tsx:98`) and the metro in the order files first appear in the run (`Sequence.tsx:256–260`), so one file can take two colours. Severity: S1.
- **P5.C.4 Contrast.** Instances: each text element on each screen, with high contrast on. Check: its contrast against what is behind it. Pass: at least Ct. Severity: S3.
- **P5.C.5 Grades by ink.** Instances: each graded fact the page shows. Check: proved full tone; possible 60% with a dotted underline; unknown in ghost tone (§5b), the same in every place a grade appears. Pass: so. Severity: S1.

## P5.L Layout
**Severity (group):** S3, unless the unit says otherwise.
- **P5.L.1 Fits the window.** Instances: each screen and dialog at each window size and interface scale. Check: no control lies outside the window or under another, and nothing scrolls the whole page sideways. Pass: so.
- **P5.L.2 The panes keep their bounds.** Instances: the code preview pane in both flow views (always present, memory rule); the card and code divider (card at least 170 px, never past its content; code at least 110 px); the preview columns (at least 170 px each); the flow's right pane (at least 280 px). Check: drag every divider to both ends, and reopen the app. Pass: the bounds hold, and the sizes are remembered.
- **P5.L.3 Only what is on screen is built.** Instances: the metro, the grid and the preview columns on ThreadX and on a run of 10,000 steps. Check: the number of row elements in the page. Pass: at most what fits on screen plus the stated margin (`Sequence.tsx:229`). Severity: S2.
- **P5.L.4 The magnifier shows what is there.** Check: the lens over the spine, the run bars and a row. Pass: the lens shows each of them. By reading, every canvas is removed from the copy under the lens (`Magnifier.tsx:15`), so the spine and the run bars are missing from it.
- **P5.L.5 The grid's tag and labels.** Check: P5.T.3 for the hover tag and the link labels, and that the tag covers no square (FLOW-VIEWS-PLAN, grid refined). Pass: so. Severity: S1.

## P5.K Keys and accessibility
**Severity (group):** S3.
- **P5.K.1 Each key does what it says.** Instances: the union of the key table of §7, the key list of the metro (`Sequence.tsx:32–39`) and the keys of the grid (`GridView.tsx:314–331`), in each view. Check: press the key and compare with its words. Pass: same. A key the design lists that is not built is recorded "not checked: not built" with its row: by reading, P (pin), ⌥→ and ⌥← (decisions), ↓ (step into an indirect call: the metro only says "known only at run time", `Sequence.tsx:551`), and C and A as the design defines them (the metro uses D, ⇧D and A for "around").
- **P5.K.2 Keys can be changed in settings.toml.** Check: a `[keys]` section exists and is applied (§7). By reading, the settings schema has none (`src/shared/settings-schema.ts:18–36`). Verdict: "not checked: not built".
- **P5.K.3 Captions after each move, and a way to turn them off.** Check: every move shows its caption; a setting turns them off (§7). By reading, no such setting exists. The second half is "not checked: not built".
- **P5.K.4 Rows read aloud.** Instances: each metro row and each grid square. Check: through `hook.axTree`, each has a name stating its number, name, file and state (selected, back, next) (§7). Pass: so. By reading, rows and squares have no accessible name (`Sequence.tsx:866`, `GridView.tsx:426`).
- **P5.K.5 Focus.** Check: the flow canvas takes focus when the page opens and keeps it while stepping; every control shows a visible focus ring (`styles.css:425`). Pass: so.

## P5.M Motion
**Severity (group):** S3, unless the unit says otherwise.
- **P5.M.1 Reduced motion and the battery saver stop every animation.** Instances: each animation: the return route, the Tab glide, the settings page opening and closing, the preview's turnstile, the compiler window, the menu, the code walk, the step box unfolding, the card ring, the scroll-follow. Check: with reduced motion, and separately with the battery saver, no animation or transition runs (Web Animations and computed transition durations). Pass: none runs.
- **P5.M.2 One animation clock.** Check: what drives play and the walk. Recorded, not judged: the roadmap lists one clock as planned, and today play uses a timer (`Sequence.tsx:359`, `GridView.tsx:284`) and the walk uses timeouts (`SeqCode.tsx:61`). Verdict: "not checked: not built".
- **P5.M.3 Play speeds.** Check: the speeds each view allows, by key and by button. Pass: 0.25× to 3× in both (FLOW-VIEWS-PLAN, shared). By reading, the metro's + key goes to 4× (`Sequence.tsx:548`) while the button and the grid stop at 3× (`PlayControls.tsx:1`, `GridView.tsx:319`).
- **P5.M.4 Nothing redraws while nothing changes.** Check: with a run open and no input for 10 s, count animation-frame callbacks. Pass: at most Fi per second. By reading, the dotted link of the right pane is redrawn on every frame for as long as the pane is open (`StepPreview.tsx:128–140`). Severity: S2.

## P5.D The approved screens
- **P5.D.1 Like the mock-ups.** Instances: the 7 approved mock-ups of P5.0.1 item 5, and each file of `ideas/` that the user names as approved. Check: the same state captured from the app, shown beside the mock-up. Verdict: the user's word, given once and recorded (as in P2.C.3). Severity: S3.
- **P5.D.2 Every approved item is present.** Instances: each bullet of FLOW-VIEWS-PLAN §1 and each item of the roadmap rows of P5.0.1 item 3. Check: present on the page as described. Pass: present. By reading, missing:
  - the metro's "▲ steps above / ▼ steps below" indicators;
  - in the chapter summary, the calls through a pointer, results thrown away and "you are here" (`Sequence.tsx:697–704` gives steps, functions and files);
  - repeated loop passes folding, and chapters folding on very long runs.
  The grid's empty cell and the middle-shortened file labels are agreed and not built: "not checked: not built". Severity: S3.
- **P5.D.3 No old name.** Check: the text of every screen, menu, caption and message, for "sequence", "boxes", "Lithograph" and "litho" (FLOW-VIEWS-PLAN §3 item 5). Pass: none. Internal keys (storage names) are excluded and listed.
- **P5.D.4 Every setting works.** Instances: each of the 65 settings of `src/shared/settings-schema.ts`. Check: change it on the settings page or in `settings.toml`, and see its effect. Pass: the effect its words describe. By reading, `editor.autosave = "focus"` ("saves when you leave the window", `settings-schema.ts:53`) has no handler: only `delay` is acted on (`src/renderer/lib/store.ts:136`). Severity: S2 for that one, since unsaved work is not saved as promised; S3 otherwise.
- **P5.D.5 Facts the page computes.** Instances: each row of P2.0.8. Check: whether the fact comes from one shared implementation or is computed in the component. Pass: one shared implementation. Severity: S3. (Part 2 checks their values.)

## P5.R Reliability at every size
The user's goal (2026-11-12): rendering close to 100% reliable, desirably 100%, whatever the size and complexity of the codebase. "Reliable" here means every unit of P5.T, P5.C, P5.L, P5.K, P5.M and P5.D gives the same verdict at every size, in every repeat and in every state reached. **Record (group):** the unit, the fixture, the ladder step or seed, the repeat number, both verdicts, and a screenshot. **Severity (group):** the severity of the unit that changed verdict, or S2 when the change comes from timing alone.
- **P5.R.1 The size ladder.** Instances: one per (unit of P5.T, P5.C, P5.L, P5.K, P5.M or P5.D; step of the ladder). The ladder is generated by `tools/sweep/` with a fixed seed, one dimension changed at a time from the smallest sample:

  | Dimension | Steps |
  |---|---|
  | Source files | 10, 1,000, 5,000, 20,000, 60,000 |
  | Steps in the run | 10, 1,000, 10,000, 100,000 |
  | Length of names and paths | 10, 100, 1,000 characters |
  | Call nesting | 3, 30, 100 levels |
  | Programs (`main`s) | 1, 20, 1,000 |
  | Findings in the run | 0, 50, 5,000 |

  Check: the unit at every step, at the smallest window size of P5.0.3 and the default one. Pass: the unit passes at every step. A unit that passes at a small step and fails at a larger one is a fail at the first step where it fails, and that step is recorded as where rendering stops being size-agnostic.
- **P5.R.2 Repeats.** Instances: one per scenario of the checks layer that draws the flow or the editor (P4.0.1 item 1), on tinyhttp and on the largest ladder step that scenario can open. Check: run it 20 times on the same state, with nothing changed between runs. Pass: all 20 give the same verdict for every unit. Any difference is a fail, recorded with the first run that differed.
- **P5.R.3 Generated states.** Instances: one per (fixture of P5.0.3 and of the ladder; seed). A generator in `tools/sweep/`, with a fixed seed, makes 10,000 states per fixture: random moves through every key of P5.K.1, folds, detail levels, what-ifs, junctions, watches, journeys, routes, view switches, window sizes and interface scales, reduced motion on and off. Check: in each state, P5.T.1, P5.T.3, P5.T.5, P5.T.7, P5.L.1 and P5.L.5, and that no error reaches the window's error handlers. Pass: every state passes. Record also the seed and the moves up to the first failing state, so the state can be reached again.
- **How it is reported (R12).** One table per family: rows are the ladder steps, columns are pass, fail, not checked and needs review; and the same for repeats and generated states. The goal is met when every fail cell is 0. No single percentage is reported.

## P5.S One source for layers and sizes
Added 2026-11-14 for step 1 of `docs/UI-PLAN.md` §3 (phase 2, steps 1 and 3), with the user's decisions recorded there. **Severity (group):** S3, unless the unit says otherwise. P5.S.1, P5.S.3, P5.S.4 and P5.S.6 are unit tests in `src/tests/` that read the files; P5.S.2 and P5.S.5 are a scenario of the checks layer.
- **P5.S.1 Every layer is named.** Instances: each `z-index` declaration in `src/renderer/styles.css` (53 on 2026-11-14) and each `z-index` in an inline style of a shipped renderer file (4 on 2026-11-14: `App.tsx:93`, `App.tsx:103`, `Palette.tsx:33`, `Preview.tsx:263`); `smoke.ts` and `probe.ts` are left out. Check: the value is `var(--z-…)`, and that variable is defined exactly once, in `:root`. Truth: this rule. Pass: every instance. Record: file, line, value.
- **P5.S.2 Naming leaves the stacking as it was.** Instances: each (screen, element kind) on every screen of the default and boot scenarios, at the default window size of P5.0.3, where an element kind is an element's tag-and-class path from the page root, and only elements whose computed `z-index` is not `auto` count. Check: the set of computed `z-index` values of that kind on that screen, in the build before the change and in the build after it. Truth: the capture of the build before the change, which must itself repeat: two runs before the change give the same set for every instance seen in both. Pass: equal for every instance seen both before and after. A kind seen on a screen in only one of the two runs (how many cards or rows a screen shows depends on timing) is "not checked" for that screen and listed. Severity: S1.
- **P5.S.3 Spacing from the scale.** Instances: each `padding`, `margin` or `gap` declaration (with its sides and its row and column forms) holding a length, in `styles.css` and in inline styles of shipped renderer files. Check: every length is `0`, `var(--sp-…)`, or a `calc` of these. Truth: this rule. Pass: every instance. Left out and listed in the report: lengths computed in code (`${…}px`), which are positions for the per-view work of UI-PLAN phase 1.
- **P5.S.4 Type from the scale.** Instances: each font size given in `font-size`, in the `font` shorthand, or in an inline style of a shipped renderer file. Check: the size is `var(--ts-…)`, or is derived from a setting (`--code-size`, `--preview-scale`). Truth: this rule. Pass: every instance.
- **P5.S.5 The scale change, shown first.** Instances: every screen of the default and boot scenarios, at the three window sizes of P5.0.3. Check: a screenshot before the change and one after, shown side by side. Verdict: the user's word, given once per screen and recorded (as in P5.D.1). Also required: every smoke scenario gives the same verdicts as before the change, and the counts of the `overlaps` scenario are listed against the baseline of UI-PLAN §0, with every difference named.
- **P5.S.6 The boxes view is gone, and what remains is reached.** Instances: every product file, and every export of `src/shared/flowboxes.ts`. Check: P1.D4.4.a on every product file and P1.D4.1.a on every export left in `flowboxes.ts`. Truth: the imports of product code. Pass: the product files unreached from an entry are exactly those recorded as findings in `docs/READING-FINDINGS.md` and kept by the user (on 2026-11-14: D31, `src/shared/symname.ts`), each listed in the report; every export left in `flowboxes.ts` is imported by product code; P2.S16.T02 and P2.S16.T05 still exist and pass. A new unreached file, or a recorded one that becomes reached or is removed, is a fail until this list is updated. This unit decides P4.T.7: `flowlayout.test.ts` is removed with `lib/flowlayout.ts`; of `flowboxes.test.ts`, only the tests of functions removed are removed.

**What Part 5 cannot decide.**
1. Taste: likeness to a mock-up is the user's word (P5.D.1).
2. Font rendering on systems that are not on this machine: those units are not checked and are listed.
3. Screen readers themselves: P5.K.4 checks the accessibility tree, not what a given reader says.

## P5.Z Part 5 is complete when
1. Every unit of P5.T, P5.C, P5.L, P5.K, P5.M, P5.D, P5.R and P5.S has exactly one verdict for every condition of P5.0.3 it names, every ladder step of P5.R.1, every repeat of P5.R.2 and every seed of P5.R.3.
2. Every needs review has the user's answer recorded, including P5.C.1 and each mock-up of P5.D.1.
3. The report was produced twice and is byte-identical apart from the field of R6; screenshots are compared by their checks' results, not by pixels.
4. The R1 hash is equal before and after; any fetched codebase has been removed (R11).

---

# Part 6: The 24-hour run, compressed

**Purpose.** Show that a full day of heavy use, run in minutes, leaves SkyCodeX as it started. That means: memory, handles, timers, listeners, child processes and files on disk do not grow without bound; nothing gets slower; the facts and the pictures do not drift; nothing typed is lost or corrupted; and the app stops and starts again cleanly at the end.

**What Part 6 is not.** Part 2 checks whether a fact is right, Part 3 whether one action is robust and fast, and Part 5 how one moment is drawn. Part 6 uses their units as checkpoints during the day and compares the checkpoints with each other.

## P6.0 Scope, inputs and how the day runs

### P6.0.1 The contract (closed list)
1. `docs/ROADMAP.md`, the row of 2026-11-09: part 6 is "the 24-hour run compressed into minutes".
2. Rule R2, and the definition of S2 in section 7: leak, slow down without bound, lose or corrupt data.
3. The Part 6 risk list: every item that P1.D6.3.a or P1.D10.5.a adds to it, and the entries of `docs/READING-FINDINGS.md` that concern long runs: D27, U12, E10, E21 and E22.
4. What the other parts hand over: Part 2's boundary item 3 (behaviour over long runs), Part 3's "does not run for hours" and boundary item 3, Part 5's "long sessions".
5. `docs/ROADMAP.md`, the row of 2026-11-12 (reliability engineering): the same verdicts in every repeat. Here that means the same verdicts at every hour of the day.
6. The user's choice of 2026-11-12: the day is scripted, the app is held open through it, and it runs on a data folder of its own.

### P6.0.2 How the app is run
1. **A copy of its own.** A packaged test build (R10) is placed in `tools/sweep/part6/app/`. A packaged app keeps its data in a `data` folder beside itself (`src/main/datadir.ts:18–25`, `41`), so the copy's data folder is `tools/sweep/part6/app/data/`. An unpackaged build would use the repository's own `data/` (`datadir.ts:19`), so it is never used for Part 6.
2. **Held open.** The copy is started once per day and is not restarted until the end-of-day units (P6.R).
3. **Driven by a script.** A scenario in the checks layer, `day`, reads the day's script and carries out its actions in the window. Measures from outside the window are taken by the run's own commands (P6.0.4).
4. **Compressed.** Each action starts as soon as the one before it has settled: its wait of P3.W has ended, the flow status is settled, and one frame has been drawn. There is no idle time between actions, apart from the idle soaks of P6.0.5.
5. **Work copies.** Every fixture is copied into `tools/sweep/part6/work/` and opened from there, so `samples/` is never changed (R1). For the comparison actions, the tinyhttp work copy is made a git repository with two commits by the set-up script.
6. **Conditions.** GPU on, mains power, the power saver off (P3.0.3). Day A runs a second time with the GPU off, for the units of P6.T only (P3.0.1 item 3).

### P6.0.3 The two days
Each day is 24 rounds, one round standing for one hour. The order of actions inside a round is fixed by a seed, and every round uses the same seed.

- **Day A, the same work every hour.** Every round does the same actions on the same inputs, and returns the work copies to their starting text: every edit is undone by a later edit in the same round, and the result is saved. Round 1 fills every cache once. From the end of round 1, anything that grows is a leak.
- **Day B, new work every hour.** The rounds do the same kinds of actions, but each round uses inputs no earlier round used. Files, functions, names and search words come from its own 1/24 slice of the 60,000-file generated tree (P3.0.5 item 3), and each round opens 4 generated folders not opened before. Day B shows whether stores that grow with new inputs have a bound.

**Table P6-1, one round** (set by the user on 2026-11-12; a change to any value needs the user's approval, section 8).

| Action | Per round | Per day | Day A inputs |
|---|---|---|---|
| Open a folder | 4 | 96 | tinyhttp, one folder of `samples/engine-traps/`, ThreadX, the 20,000-file tree, in that order |
| Open a file | 80 | 1,920 | the same 80 files |
| Close a file | 80 | 1,920 | the same |
| Edit (insert or delete one line) | 800 | 19,200 | 400 edits and the 400 that undo them |
| Save | 80 | 1,920 | the same files |
| Step (each move of P2.S11, in turn) | 2,000 | 48,000 | from the start of each program's run |
| Switch between metro and grid | 40 | 960 | — |
| Switch program | 20 | 480 | the programs of each folder, in turn |
| Move the cursor into another function (preview cards) | 200 | 4,800 | the same functions |
| Go to definition | 80 | 1,920 | the same names |
| Search in the folder | 20 | 480 | the same words |
| Palette and quick open | 40 | 960 | the same queries |
| Turn an analysis on and off (watch, journey, what-if, junction, route) | 80 | 1,920 | the same items |
| Change a setting, then change it back | 8 | 192 | 8 settings of P5.D.4, the same every round |
| Read another configuration (the hidden window) | 1 | 24 | the same macro |
| Compare two commits | 1 | 24 | the two commits of the tinyhttp work copy |
| Repair check | 8 | 192 | the same 8 broken lines |
| Kill clangd | 1 | 24 | never more than 2 in one minute, because a third stop in a minute is not restarted (`src/renderer/lib/lsp.ts:47–54`) |
| Change a file on disk from outside the app | 20 | 480 | the same files, changed and then changed back |
| Resize the window or change the interface scale | 8 | 192 | the sizes and scales of P5.0.3 |
| Play to the end, or for 30 s | 8 | 192 | metro and grid in turn |
| Install and remove a pack (through `hook.packSource`) | 1 in rounds 6, 12, 18 and 24 | 4 | the same pack |

### P6.0.4 Measures, taken at the checkpoint after every round (closed list)
At each checkpoint the same screen is open: the tinyhttp flow tab at its first step, the metro view, and the code preview pane open.
- **M1** The window's JavaScript heap after a forced collection (DevTools protocol).
- **M2** The main process's resident memory and JavaScript heap.
- **M3** Each child process's resident memory, by kind (the kinds of P3.P).
- **M4** Counts in the window: documents, page nodes and event listeners (DevTools protocol); live timers, intervals, animation-frame requests and observers (`hook.liveCounts`).
- **M5** Counts in the main process: open file handles and child processes (OS listing, by command); folder watchers, IPC listeners and pending language-server requests (`hook.liveCounts`).
- **M6** The number of entries in each long-lived store of P1.D6.1 (`hook.storeSizes`).
- **M7** Disk: the number and size of files in each subfolder of the copy's data folder (`themes`, `state`, `state/buffers`, `state/chromium`, `notes`, `logs`, from `src/main/datadir.ts:57`), in the work copies, in clangd's index for each work copy, and the entries the app made in the system's temporary folder.
- **M8** Time: the measures of P3.F.1 that the round contains, frame times during the round's play (P3.F.4), and the longest block of the main process (`hook.eventLoopProbe`).
- **M9** The app log: lines written in the round, and each line that reports an error.

### P6.0.5 Idle soaks: the part that runs on the clock
Some behaviour depends on elapsed time, so running faster cannot reach it without changing the app's clock, and changing the clock would change what is under test (R2). Two kinds are known:
- timers: toasts cleared after 3.2 s (`src/renderer/lib/store.ts:59–62`); unsaved text written 1 s after an edit (`store.ts:129–134`); clangd stops counted per minute (`src/renderer/lib/lsp.ts:47–49`); request limits of 60 s and 120 s (`src/main/lsp.ts:262–268`); the repair clangd stopping when idle (P3.P.7);
- work done while nothing changes: the dotted link of the right pane asks for a new frame on every frame while the pane is open (`src/renderer/components/StepPreview.tsx:128–140`, entry U12).

So the day also holds three soaks of real time: after rounds 1, 12 and 24, a run is left open and nothing is touched for Ti (P6.0.7). The full list of timers is found by the instance rule of P6.T.5.

### P6.0.6 Test-only hooks (R10)
- `hook.liveCounts`: returns, in a test build only, the counts of M4 and M5 that the DevTools protocol and the OS do not give.
- `hook.storeSizes`: returns, in a test build only, the number of entries in each long-lived store of P1.D6.1, by name.

### P6.0.7 Limits the contract does not set (set by the user on 2026-11-12)
| Limit | Value | Reason |
|---|---|---|
| Md: memory growth allowed from the end of round 1 to the end of round 24 | 10% | the same room for allocator noise as Mg (P3.0.8) |
| Ti: the length of each idle soak | 30 min | long enough for every timer in the list of P6.0.5 to fire many times |
| Ci: CPU allowed per process while idle, averaged over 60 s | 1% of one core | while nothing moves, nothing should work (P5.0.6, Fi) |

A change to any of these values needs the user's approval (section 8). Counts (M4, M5, M6) have no room: in Day A they must be equal. Times reuse the before-and-after rule of P3.0.4 item 4. Frames reuse Tw and Fi.

## P6.V Validation
- **P6.V.1 Every kind of growth is caught.** Instances: four mutants, each in a temporary copy under `tools/sweep/mutants/` (as in P4.V.1, never the working tree, removed afterwards): a store that gains one entry per round; a window listener added in every round and never removed; a child process started in every round and never stopped; a file written into the data folder in every round and never removed. Check: run 4 rounds of Day A on each mutant and on the unchanged copy. Truth: each mutant is wrong by construction. Pass: the units of P6.G, P6.P and P6.D flag each mutant, and flag nothing on the unchanged copy. Otherwise every unit that failed to catch its mutant is void (R7).
- **P6.V.2 Measures repeat.** Check: 4 rounds of Day A, run twice on the unchanged copy. Pass: M4, M5 and M6 are identical between the two runs, and M1 to M3 differ by at most Md. Otherwise Part 6 is void until the cause is found.
- **P6.V.3 Hooks absent from the shipped build.** Instances: `hook.liveCounts`, `hook.storeSizes`. Check: R10's search. Pass: absent.

## P6.S Set-up and isolation
**Severity (group):** S2. A fail of P6.S.1, P6.S.4 or P6.S.5 also voids the day.
- **P6.S.1 Its own data folder.** Check: the data folder the copy reports, and whether it fell back (`src/main/datadir.ts:49–54`). Pass: `tools/sweep/part6/app/data/`, with no fallback. With a fallback, the copy would write into the system's app-data folder, which may be the user's.
- **P6.S.2 The user's data untouched.** Instances: every other SkyCodeX data folder on the machine, found by the rule of `datadir.ts`: the repository's `data/` (leaving out `data/logs/sweep/`, where reports go), the `data` folder beside every other SkyCodeX app found, and the system app-data `SkyCodeX` folder. Check: a content hash of each, before the day and after it. Pass: equal.
- **P6.S.3 Samples untouched.** Check: the R1 hash before and after. Pass: equal.
- **P6.S.4 The day as written.** Check: the log of actions the `day` scenario writes, against Table P6-1 and the seed. Pass: every action of every round was carried out, in the seeded order. An action that could not be carried out is recorded with its reason, and is never skipped silently (R5).
- **P6.S.5 One start for the whole day.** Check: the process IDs of the main process and of the main window's page process, from the start to the end of round 24. Pass: unchanged. A hidden restart, or a page reloaded after a crash (entry E24), would hide growth.

## P6.G Growth in memory and in counts
**Truth (group):** the measures of P6.0.4. **Record (group):** the measure, all 24 values, and for a store its name and its peak. **Severity (group):** S2.
- **P6.G.1 The window's memory.** Instances: Day A. Check: M1 at the end of round 24 against the end of round 1, and the least-squares slope over rounds 2 to 24. Pass: the growth is at most Md, and the slope projected over 24 more rounds is also at most Md.
- **P6.G.2 The main process's memory.** As P6.G.1, for M2.
- **P6.G.3 Each child's memory.** Instances: one per child kind of P3.P that is alive at both checkpoints. As P6.G.1, for M3.
- **P6.G.4 Counts in the window.** Instances: one per count of M4. Check: Day A, the end of round 24 against the end of round 1, with the same screen open. Pass: equal.
- **P6.G.5 Counts in the main process.** Instances: one per count of M5. As P6.G.4.
- **P6.G.6 Stores in Day A.** Instances: one per store of P1.D6.1. Check: M6 at the end of round 24 against the end of round 1. Pass: equal.
- **P6.G.7 Stores in Day B.** Instances: one per store of P1.D6.1. Check: M6 at the end of every round. Pass: the store never holds more than its stated bound. A store with no stated bound that grows from round to round fails, with its growth per round. Known by reading on 2026-11-12, with no size limit where they are declared: `texts`, `flowCache` and `candidates` in `src/renderer/lib/flow.ts` (`22`, `437`, `488`), which are emptied only by `clearFlowCaches` (`438`) or, for `texts`, one file at a time (`31`); the text of every source file read while programs are found is kept in `texts` (`flow.ts:57–60`); `textCache`, `depthCache` and `depthItems` in `src/renderer/lib/preview.ts` (`36`, `291`, `305`); `texts` in `src/renderer/lib/seqtext.ts:6`, emptied by `clearSeqTexts` (`9`); `versions` in `src/main/main.ts:542`. Two stores are emptied by an event: `cache` in `src/renderer/lib/goto.ts:59` when indexing ends (`62`), and `found` in `main.ts:503` each time the compiler window asks (`549`). `bufferTimers` and `autosaveTimers` in `src/renderer/lib/store.ts` (`120`, `141`) keep one entry for each file edited, with no removal in `store.ts:120–141`.
- **P6.G.8 Memory in Day B.** Instances: M1, M2. Check: the growth from the end of round 12 to the end of round 24. Pass: at most Md. Otherwise needs review, with a heap snapshot naming what holds the growth: growth held by stores still under their stated bounds is answered as bounded; any other growth is a fail.

## P6.P Processes and handles
**Truth (group):** the OS process and handle listings, taken by command, and `hook.liveCounts`. **Record (group):** the process or handle, its parent, and the round in which it first appeared. **Severity (group):** S2, except P6.P.3.
- **P6.P.1 The same children every hour.** Instances: one per child kind of P3.P. Check: Day A, the number alive at the end of every round. Pass: equal to the end of round 1. This is P3.P.8 at the scale of a day: 96 folders opened, and no clangd left from a folder that was closed.
- **P6.P.2 No child without a parent.** Check: at every checkpoint, every process started by the copy or by its children. Pass: each has a living parent in the app's tree. The terminal, which is started detached (P3.P.1), is the only exception.
- **P6.P.3 Every clangd restart recovers.** Instances: the 24 kills of each day. Check: after each kill, clangd runs again, every open file is opened in it again (`src/renderer/lib/store.ts:74–78`), and the preview cards and the function under the cursor come from the current text (entry E21, P3.M.4). Pass: so, for all 24. Severity: S1 when the cards or the function are wrong, S2 otherwise.
- **P6.P.4 Requests drain.** Check: at every checkpoint, after the flow has settled, the pending requests of each language server (`src/main/lsp.ts:246–248`, `270`, counted by `hook.liveCounts`). Pass: 0.
- **P6.P.5 Handles and watchers.** Check: Day A, open file handles and folder watchers at the end of every round. Pass: equal to the end of round 1. Each folder opened starts a watcher (`src/renderer/lib/store.ts:68`).

## P6.D Disk and data
**Truth (group):** listings and hashes of the files of M7, taken by command. **Record (group):** the file, its size at each checkpoint, and the round in which it first appeared. **Severity (group):** S2.
- **P6.D.1 Every file written is listed.** Check: the listing of M7 before the day, after round 1 and after round 24, set against P3.D.1's list of durable writes. Pass: every file that appears belongs to a write of P3.D.1. Otherwise fail, with the file. Severity: S3.
- **P6.D.2 Day A leaves the same files.** Check: the listing after round 24 against the listing after round 1, leaving out the log (P6.D.3). Pass: the same files with the same sizes.
- **P6.D.3 The log has a bound.** Check: the app's log files in `data/logs/` after each day, and how the code limits them. Pass: a size limit or a rotation exists, with its file and line, and the logs stay within it. Otherwise fail, with the growth per round.
- **P6.D.4 Kept files have bounds.** Instances: one per kind of file the app keeps: kept pictures, generated compile databases, kept texts, commit exports (four are kept, P3.D.7), recent folders, and Chromium's own files in `state/chromium`. Check: Day B, the count and the size after every round. Pass: each kind stays within a stated bound. A kind with no stated bound that grows fails, with its growth per round.
- **P6.D.5 Nothing temporary is left.** Check: at the end of each day, the entries the app made in the system's temporary folder, and the `.downloading` and `.unpacking` folders of the packs. Pass: none left.
- **P6.D.6 What was typed is what was saved.** Instances: the rounds of Day A. Check: at the end of each round, a hash of the work copies against their hash at the start of the day. Pass: equal. After 1,920 saves of edits and their undoing, any difference is data corrupted between the editor and the disk.
- **P6.D.7 Unsaved text kept exactly.** Instances: every checkpoint at which a file holds unsaved edits. Check: 1 s after the last edit (`src/renderer/lib/store.ts:129–134`), the kept text in `state/buffers` against the editor's text. Pass: byte-identical.

## P6.T No slowing, and quiet when idle
**Truth (group):** the clock of P3.0.4 and the frame budget of P3.0.1 item 3. **Record (group):** every value of every round.
- **P6.T.1 Actions as fast at the end.** Instances: one per measure of M8 that is a time, in each day. Check: the before-and-after rule of P3.0.4 item 4, with round 1 as before and round 24 as after. Pass: the median at round 24 is not above the slowest of round 1. Severity: S2.
- **P6.T.2 Frames at the end.** Instances: one per animation of P3.F.4 that the rounds play, GPU on and GPU off. Check: P3.F.4 at rounds 1, 12 and 24. Pass: it holds at all three. Severity: as P3.F.4.
- **P6.T.3 The main process stays free.** Check: the longest block of M8 in every round. Pass: at most Tm in every round (P3.0.8). Severity: S2.
- **P6.T.4 Quiet while idle.** Instances: the three soaks of each day. Check: animation frames per second, CPU per process averaged over each minute, and M1 to M6 at the start and the end of the soak. Pass: at most Fi frames per second (P5.0.6), at most Ci CPU, and M4 to M6 unchanged, M1 to M3 within Md. By reading, the dotted link asks for a frame on every frame and reads the page's geometry each time (`src/renderer/components/StepPreview.tsx:128–140`), so the frame part is predicted to fail (entry U12). Severity: S2.
- **P6.T.5 Timers behave the same at the end.** Instances: one per timer in product code (every timeout, interval and animation-frame request), found by both readers of P1.0.5, each with its period. Check: what the timer does, in round 1 and in round 24 (for example: a toast is cleared after its time, the unsaved text is written 1 s after an edit, the repair clangd stops when idle). Pass: the same. A timer whose period is longer than Ti is not checked, and is listed with its period. Severity: S2.

## P6.F Facts and pictures do not drift
**Severity (group):** S1.
- **P6.F.1 The same facts at the end.** Instances: one per (folder of Day A, program). Check: the fact dump of P2.0.4 at the end of round 24 against the end of round 1, with the work copies back at their starting text (P6.D.6). Pass: byte-identical, after the root path is replaced by a fixed marker (as P2.D).
- **P6.F.2 The same pictures at the end.** Instances: one per (unit of P5.T.1, P5.T.3, P5.T.5, P5.T.7, P5.L.1 or P5.L.5; screen of the default and boot scenarios). Check: the unit at rounds 1, 12 and 24, at the default window size. Pass: the same verdict at all three. The unit's own verdict is Part 5's; this unit judges only that it does not change with the hours (P6.0.1 item 5).
- **P6.F.3 The kept picture after a day.** Instances: one per folder of Day A. Check: after the day, reopen the folder: the kept picture's dump against a fresh build's (as P2.D.5), and P2.I.3 for one condition (a source file changed). Pass: equal; not shown when out of date.
- **P6.F.4 No error during the day.** Check: the window's error handlers and the main process's last-resort handlers (P1.D7.5) through the whole day, and every error line of M9. Pass: no uncaught error and no unhandled rejection. Every error line belongs to a failure the script caused on purpose (a clangd kill, a stalled pack server), and names it. Severity: S2.

## P6.R The end of the day
**Severity (group):** S2.
- **P6.R.1 Quit, and start where you were.** Check: after round 24, quit. Then: every child gone within Tq (P3.P.1); every state file of P3.R.2 holds valid content of the right shape; on the next start, the session opens the same folder and files; the recent folders are the last five opened, the most recent first (`docs/ROADMAP.md`, row of 2026-11-04). Pass: all hold.
- **P6.R.2 Fifty starts in a row.** Check: with the last folder open, quit and start 50 times. Pass: every start shows the kept picture; the median start time of the last 10 is not above the slowest of the first 10 (P3.0.4 item 4); the listing of M7 after the 50th start equals the listing after the 1st, apart from the log (P6.D.3).

**How it is reported (R12).** For each day, the counts per family as in R12. For each measure, its 24 values (and the soaks' values) are written to the separate field of R6, since they are measured values. The goal is met when every fail count is 0. No single percentage is reported.

**What Part 6 cannot decide.**
1. Real time beyond the soaks: behaviour that needs more than Ti between two events (anything that happens once an hour or once a day) is not reached. P6.T.5 lists it with its period, as not checked.
2. Sleep and wake, and displays added or removed (a laptop closed overnight): driving them needs changes to system settings. Not checked; listed.
3. Months of use: Part 6 checks that growth is bounded, which decides this; it never projects disk or memory use past the day it ran.
4. Windows and Linux when they are not on this machine: their units are not checked and are listed by name.
5. The variety of real use: the day is a fixed script. Variety at one moment is P5.R.3.

## P6.Z Part 6 is complete when
1. Every unit of P6.V has passed.
2. Every unit of P6.S, P6.G, P6.P, P6.D, P6.T, P6.F and P6.R has exactly one verdict, for each day it names.
3. The report was produced twice on the same state (two runs of each day) and the verdicts are byte-identical, apart from the field of R6 (timestamps, measured times and measured values).
4. The R1 hash is equal before and after, and P6.S.2 passed.
5. With the user's yes: ThreadX has been removed (R11), and so have the packaged copy, its data folder, the work copies and the mutant copies.

---

# Change log

| Date | Change | Why |
|---|---|---|
| 2026-11-09 | Created: authority, integrity rules, terms, unit format, running, records, severity, change rules, and Part 1 in full. | The user asked for one source of testing truth, written part by part, starting with Part 1. |
| 2026-11-09 | Part 1 approved by the user. | — |
| 2026-11-09 | R1 now allows test-support files (`tools/sweep/`, `samples/engine-traps/`, `src/tests/`, the checks layer, test-only hooks) and leaves them out of its hash; R10 now names the test-build switch `SKYCODEX_TEST_BUILD` and requires each hook to be listed by name. | Part 2 needs a dump scenario in the checks layer, trap fixtures and two hooks; without this change R1 would forbid them. Waiting for the user's approval with Part 2. |
| 2026-11-09 | Part 2 written: contract, truth sources, 30 fact kinds with equality rules, fact dump, scoring, fixture rules, truth validation, traps for ten engine stages, run invariants, same results everywhere, transformations, generated programs, real code against clang, completion. | The user approved Part 1 and asked for Part 2. |
| 2026-11-09 | Part 2 approved by the user, with the change to R1 and R10. | — |
| 2026-11-09 | Coverage audit of Part 2. Contract widened to sections 3, 3c, 4, 5, 7 and 10, with a rule for sections that disagree (P2.0.1 item 4). F1, F11 and F12 corrected to the wording of section 8; a grade rule on every fact; fact kinds F31 to F39; severity S3 for a fact true on every run but weaker than the contract. Hooks gathered in P2.0.7, adding `hook.noIndex` and `hook.analyserStamp`; fixture rule 4 now excepts P2.S2.T31. New traps: P2.S1.T12–T14, P2.S2.T25–T36, P2.S3.T21–T24, P2.S5.T17–T24, P2.S6.T12–T19, P2.S8.T10–T20, P2.S9.T06–T11. New invariants P2.S4.I8, P2.S4.I9 and P2.S8.I5; P2.S8.I4 now exact per level. P2.S5.T13 and P2.S5.T14 expectations corrected to section 8. New stages P2.S11 (stepping) and P2.S12 (programs); new families P2.L (library tables) and P2.I (pictures before the build settles); P2.X.10 to P2.X.13 added; P2.X.1 corrected for definitions compiled through an include. P2.C (coverage closure) added with Table P2-2 and the limits of Part 2. P2.Z updated. | The user asked, when approving Part 2, for confirmation that it covers everything that can be covered. Reading the contract and the engine's code against Part 2 found gaps; P2.C makes completeness measured instead of claimed. Waiting for the user's approval. |
| 2026-11-10 | Second coverage audit of Part 2, from a listing of the source folders (67 files listed, 42 read in full: the 38 engine files and 4 left to Parts 3 and 5). Corrected: P2.S2.T22 and P2.S2.T27 (a library call has no step; it is named among the caller's library calls), P2.S1.T13 and F1 (a folder with no `main` starts from its public API as one start), P2.S1.T14 (file names that differ from target names), Table P2-2 rows for the boxes view and other languages. Added: fact kinds F40 to F44; `hook.clangdFail`; traps P2.S1.T15–T19, P2.S2.T37–T45, P2.S3.T25–T29, P2.S7.T08–T11, P2.S8.T21–T25, P2.S9.T12–T16, P2.S10.T05–T11, P2.S12.T06–T08 and P2.S12.I1; invariant P2.S8.I6 and the count words in P2.S4.I9; stages P2.S13 (shared helpers), P2.S14 (preview cards), P2.S15 (go to definition), P2.S16 (what remains of the boxes model); P2.L.4; P2.I.4 and P2.I.5, and two more conditions in P2.I.3; the engine file list of P2.C by name; the files not read and the part that will read them. | The user asked for Part 2 to be completed. The first audit had read 7 engine files; this one read every engine file. Waiting for the user's approval. |
| 2026-11-11 | Third coverage audit of Part 2: the view layer. Read in full: the 24 files of `src/renderer/components/`, `App.tsx`, `main.tsx`, `src/main/search.ts`, `src/preload/preload.ts`, the remaining 11 files of `src/renderer/lib/` and `docs/ARCHITECTURE.md`; also `package.json`, `vite.config.ts` and two build scripts. Added: P2.0.8, the closed list of facts computed outside the engine, with the rule that their units read the page's text and that each is a directness finding for Part 5; units P2.S4.I10, P2.S6.T20, P2.S8.I7 to I9, P2.S8.T26 to T28, P2.S11.I15, P2.S13.H9, P2.S14.T09, P2.S15.T04, P2.I.6. Corrected: F37 and P2.S12.T04 (a shared file is shown with the programs that use it), P2.S14.T05 (the card claims the deepest chain), P2.S13.H8 (the repair check is a sixth place that decides a file's language), P2.C.3 (templates in the files of P2.0.8 count too), the boxes row of Table P2-2 and the list of files not read. | The user asked for the remaining files to be read. 10 files of `src/` outside the engine, and the test and concept folders, are still unread and named in the document. Waiting for the user's approval. |
| 2026-11-12 | The race rule decided under P2.0.1 item 4: section 8b ("no lock in common") governs over section 10b ("no lock in either function"). P2.S8.T12 and P2.S8.T13 now expect a race; P2.S8.T13's fixture states where each lock is held. Section 10b of `docs/FLOW-DESIGN.md` corrected to state the rule of section 8b and to say that the built check differs from it; the S3 finding against the design document is recorded as entry 49 of `docs/READING-FINDINGS.md`. | The user approved section 8b on 2026-11-12. The other additions of the three audits are still waiting for approval. |
| 2026-11-12 | The additions and corrections of the three coverage audits of Part 2 (2026-11-09, 2026-11-10, 2026-11-11) approved by the user, as written. | — |
| 2026-11-12 | Part 3 written: contract, file set, conditions, timing rules, fixtures, detectors, four hooks (`hook.eventLoopProbe`, `hook.crashAt`, `hook.writeDelay`, `hook.packSource`), five limits for the user to set (P3.0.8), detector validation (P3.V), and the families P3.W (waits), P3.B (blocking), P3.P (child processes), P3.D (data integrity), P3.M (memory and caches), P3.R (recovery) and P3.F (speed and frames), with P3.Z. Part 2's boundary item 8 corrected: the eight files read for Part 3, and the count of product files (95, not 91). Proposed, not yet made: R6 to keep measured times in their own field, as it keeps timestamps (P3.Z item 4). | The user approved Part 2 and asked for Part 3. Waiting for the user's approval, the five limits, and a yes or no on the R6 change. |
| 2026-11-12 | Part 3 approved by the user as written, with the five limits of P3.0.8 at the values proposed (Tm 100 ms, Tw 16.7 ms, Tq 5 s, Mg 10%, Gs 2 × the n·log n ratio). R6 changed: measured times are kept in a separate field, as timestamps are. P3.0.8 and P3.Z items 2 and 4 updated to match. | The user approved Part 3 as proposed. |
| 2026-11-12 | Part 4 written: tool set (closed list), contract, and the families P4.V (every check proven on a mutant in a temporary copy), P4.T (unit tests), P4.F (recorded fixtures), P4.S (the checks layer), P4.C (the release workflow) and P4.R (report writer, the order of a full run, approved commands, what must be built first), with P4.Z. | The user approved Part 3 and asked for Part 4. Read for it in full: `smoke.ts`, `probe.ts`, `check-smoke.mjs`, 32 files of `src/tests/`, the test configuration and `.github/workflows/release.yml`. Waiting for the user's approval. |
| 2026-11-12 | Part 4 approved by the user as written. | — |
| 2026-11-12 | Part 5 written: contract, file set, conditions, truth, one hook (`hook.axTree`), two limits for the user (P5.0.6), and the families P5.T (text), P5.C (colour), P5.L (layout), P5.K (keys and accessibility), P5.M (motion) and P5.D (the approved screens), with P5.Z. | The user approved Part 4 and asked for Part 5. Read for it in full: `index.html`, `styles.css`, 23 of the 24 components, 11 library files, `main.tsx`, the settings schema, `docs/FLOW-DESIGN.md`, `docs/FLOW-VIEWS-PLAN.md`. Waiting for the user's approval and the two limits. |
| 2026-11-12 | Part 5 approved by the user as written, with the limits of P5.0.6 at the values proposed (Ct 4.5 : 1, 3 : 1 for text of 18 px and over; Fi 0 per second). Still open, for the user: which text governs the colour of files (P5.C.1), and whether the mock-ups in `docs/mockups/flow/ideas/` count as approved (P5.D.1). | The user approved Part 5 as proposed. |
| 2026-11-12 | File colours decided under P2.0.1 item 4: FLOW-VIEWS-PLAN §1 (each file a colour in the metro and the grid) governs over FLOW-DESIGN §5b ("files and functions get no colour"). P5.C.1 now checks the plan's rule; §5b of `docs/FLOW-DESIGN.md` corrected; the S3 finding against the design document is entry U14 of `docs/READING-FINDINGS.md`. Still open: whether `docs/mockups/flow/ideas/` count as approved (P5.D.1). | The user chose the plan on 2026-11-12. |
| 2026-11-12 | Unit P5.T.7 added: every area whose information grows with the codebase can be scrolled to every part. | The user restated the rule on 2026-11-12 and approved adding the unit. |
| 2026-11-12 | Family P5.R added: P5.R.1 (every Part 5 unit at every step of a generated size ladder), P5.R.2 (20 repeats of each scenario on the same state), P5.R.3 (10,000 generated states per fixture, by fixed seed), and how they are reported. P5.Z item 1 extended to them. | The user set the goal of rendering reliable at every codebase size and approved the three units. |
| 2026-11-12 | Part 6 written: contract, how the app is run (a packaged test build in a folder of its own, held open, driven by a `day` scenario, on work copies), the two days (Day A, the same work every hour; Day B, new work every hour), Table P6-1 (one round, for the user to set), the measures M1 to M9, idle soaks, two hooks (`hook.liveCounts`, `hook.storeSizes`), three limits for the user (P6.0.7), and the families P6.V, P6.S, P6.G, P6.P, P6.D, P6.T, P6.F and P6.R, with P6.Z. Proposed, not yet made: (1) R6 to keep measured values (memory, counts, sizes) in its separate field, as it keeps measured times (P6.Z item 3); (2) P4.R.4 to list `hook.axTree` (P5.0.5), `hook.liveCounts` and `hook.storeSizes` among what must be built first: it lists only the nine hooks of Parts 2 and 3. | The user asked for Part 6 and chose a scripted day with the app held open on its own data folder. Read for it in full: this document, `docs/ROADMAP.md`, `docs/READING-FINDINGS.md`, `src/main/datadir.ts` and `src/renderer/lib/seqtext.ts`; and, to check the long-run entries against the code, parts of `src/renderer/lib/flow.ts`, `preview.ts`, `goto.ts`, `lsp.ts`, `store.ts`, `src/main/main.ts`, `src/main/lsp.ts` and `src/renderer/components/StepPreview.tsx`. Waiting for the user's approval. |
| 2026-11-12 | Part 6 approved by the user as written, with Table P6-1 and the limits of P6.0.7 at the values proposed (Md 10%, Ti 30 min, Ci 1% of one core). Both proposed changes made: R6 now keeps measured values (memory, counts and sizes) in its separate field, with timestamps and measured times; P4.R.4 now also lists `hook.axTree`, `hook.liveCounts` and `hook.storeSizes`. Table P6-1 and P6.0.7 now say their values were set by the user. | The user approved Part 6 as proposed. |
| 2026-11-13 | R13 extended: a fix approved by the user by name may come before the full run, with its own test shown failing before the change and passing after; the full suite still runs afterwards, unchanged. | The user chose fixes first, with integrity, and all of the tests after them. |
| 2026-11-14 | Family P5.S added: P5.S.1 (every layer named), P5.S.2 (naming leaves the stacking as it was), P5.S.3 (spacing from the scale), P5.S.4 (type from the scale), P5.S.5 (the scale change shown first), P5.S.6 (the boxes view gone, what remains reached). P4.T.7 decided by P5.S.6. P5.Z item 1 extended to P5.S. | Step 1 of `docs/UI-PLAN.md` §3 needs checks no unit had (§1.2). The user approved the six units as drafted on 2026-11-14. |
| 2026-11-14 | P5.S.2 changed: it compares, per screen, the set of layer values of each element kind (tag-and-class path), not every element; a kind seen in only one run is "not checked" and listed. | Two runs of the default scenario before any change differed in how many preview cards screens `10c-card-search` and `10d-play-controls` showed (26 differences in element counts), while no element kind changed its layer value (76 kinds seen in both runs, 0 different), so the unit as written could not be decided (§8). The user approved the change on 2026-11-14. |
| 2026-11-14 | P5.S.6 changed: unreached product files recorded as findings and kept by the user are listed, not failed; the list is exact (D31, `src/shared/symname.ts`). | Running P5.S.6 after the boxes view was removed found one more unreached file, `symname.ts`, imported only by a test; the user chose to record it as a finding (READING-FINDINGS D31) on 2026-11-14. |
