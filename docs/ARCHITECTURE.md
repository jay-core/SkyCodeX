# Lithograph — architecture

A portable, offline, C/C++-focused code editor for macOS, Windows and Linux.
Charcoal, borderless, Metro-style typography; ArX F1 for code, Selawik for UI.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| App shell | **Electron** (bundled Chromium + Node) | Identical rendering on all three OSes; no system web-view differences |
| UI | **TypeScript + Solid.js** | Fine-grained updates, tiny runtime, no virtual-DOM churn while typing |
| Editor | **CodeMirror 6** | Cheap to run many editors at once (main pane + every preview card) |
| Terminal | **xterm.js + node-pty** | Real shell; ConPTY on Windows, pty on macOS/Linux |
| Live intelligence + code facts | **lithograph-clangd**: one binary = clangd + our fact extractor (bundled, LSP over stdio) → **SQLite** | One copy of the Clang engine and one parse per file feed both the live features and the whole-project facts |
| Database | `node:sqlite` (built into Node / Electron) | No native module to ship |
| History | **git** CLI (if installed) | Blame, log, diffs |
| Build / ASM / deep analysis | System compiler (clang, gcc, MSVC) + `clang --analyze` | Detected, never bundled |
| Fonts | ArX F1 (code), Selawik (UI) | Bundled in `assets/fonts/`, both SIL OFL 1.1 |

## 2. Processes

```
┌──────────────────────────── Electron main (Node) ────────────────────────────┐
│ window · portable data dir · settings (TOML) · file watcher · process manager │
│ LSP client ─── lithograph-clangd (clangd + fact extractor → SQLite)          │
│ git worker      search worker (fuzzy, in memory)      pty ─── shell           │
└───────────────────────────────▲──────────────────────────────────────────────┘
                                │ typed IPC (contextBridge; renderer has no Node)
┌───────────────────────────────┴───────────── renderer (UI) ──────────────────┐
│ layout · CodeMirror views · preview engine · overlays (SVG lines)            │
│ atlas · book · board · notes · theme engine · animation                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **One document per file, many views.** Every open file has one shared document model; the main pane and any preview card showing that file are views of it, so edits sync instantly.
- **Renderer is sandboxed**: context isolation on, no remote content, strict CSP, no network.

## 3. The two code engines

**clangd** — everything that must react per keystroke.

**Fact extractor** (inside lithograph-clangd) — everything that needs facts about the whole project. Hooks clangd’s background index, so each translation unit from `compile_commands.json` is parsed once, and writes:

| Table | Contents |
|---|---|
| `files` | path, content hash, line count |
| `symbols` | USR, name, kind, file, range, signature |
| `calls` | caller → callee, call-site range, kind (direct / virtual / pointer / macro) |
| `refs` | symbol, range, access (read / write / read-write / may-write via ref or pointer) |
| `macros` | expansion text per use |
| `records` | size, alignment, field offsets, padding |
| `func_hash` | normalised body hash (for “changed since you read it”) |

Incremental by file hash, parallel per translation unit, stored in `data/index/<project>.db`.

## 4. Feature → data source

| Feature | Built on |
|---|---|
| Preview panes, shift preview, callers | enclosing function (clangd symbols) + `calls` |
| Connector lines | DOM geometry → one SVG overlay, redrawn on layout change |
| Value story | `refs` access kinds + callee parameter types |
| Signal mode | semantic tokens + shape rules from `settings.toml` |
| Atlas | `files` (treemap), `calls` (paths), read state, git churn |
| Book mode | `calls` walked from `main()`; fan-in ≥ 4 → appendix |
| Structural zoom | clangd folding ranges + symbols + `calls` |
| Ariadne’s thread, tours | navigation events → tree in `data/state` |
| Investigation board | stack-trace parsers (ASan, lldb, gdb, MSVC) → live cards |
| Unread changes, line origins, age tint | `func_hash` + git log / blame |
| History scrubber | compressed snapshots on save |
| Notes, live excerpts | symbol index by USR |
| Struct layout | `records` (or clangd hover) |
| Assembly view | single-TU `-S -g` compile, `.loc` line mapping |
| Static analysis | compiler diagnostics · clang-tidy (in clangd) · `clang --analyze` → SARIF |
| Search, query bar | in-memory fuzzy index + SQL over the index |

## 5. Portable data

```
Lithograph/
├─ lithograph(.exe | .app | linux binary)
├─ data/                created on first run, next to the executable
│  ├─ settings.toml     every option, commented, live-reloaded
│  ├─ keys.toml
│  ├─ themes/           TOML themes (VS Code / .vsix import)
│  ├─ state/            layout, thread, history snapshots, Chromium profile
│  ├─ index/            SQLite fact databases
│  ├─ notes/  boards/  tours/  logs/
└─ tools/  lithograph-clangd                (per OS / arch)
```

- Data dir = folder of the executable (macOS: beside `Lithograph.app`).
- Chromium’s own profile is redirected into `data/state` so nothing is written elsewhere.
- Not writable (Program Files, read-only drive, macOS App Translocation) → say so once, offer to move or fall back to the OS app-data folder.
- Bad setting → squiggle in the file, default used, never a crash.

## 6. UI and motion

- **Chrome:** none. Pivot header of open files; window buttons appear as faint glyphs only in the top-right corner (or native, by setting).
- **Theme:** TOML → CSS variables. Contrast computed against the real background; syntax colours kept in a narrow 5.5–6.5 : 1 band, comments ≈ 3 : 1.
- **Animation:** 60 fps target. Only `transform` and `opacity` animate (compositor-only, no layout during motion), via the Web Animations API. Windows Phone vocabulary: turnstile-feather exit, staggered slide-in, slower-moving headers. Connector lines fade out before motion and redraw after. Reduced-motion setting honoured.
- **Zero-lag rules:**
  - The key or click starts the animation in the same frame (< 16 ms); nothing waits on clangd or the index.
  - The next preview level is fetched and rendered off-screen as soon as the cursor settles, so a shift only moves elements that already exist.
  - All positions are measured before motion starts; no layout reads or writes during an animation.
  - `will-change` is set just before an animation and removed after, so GPU layers don't pile up.
  - Animations can be interrupted and retargeted: pressing shift three times quickly lands on level 4 without waiting for each animation to finish.
  - Connector lines are recomputed once per settled layout, never per animation frame.

## 7. Performance budgets

| Metric | Target |
|---|---|
| Keystroke → paint | < 16 ms |
| Preview refresh after cursor settles | ~100 ms |
| Animations | 60 fps, no dropped frames |
| Fuzzy search, 60k symbols | < 15 ms |
| Files > 50 MB | read-only, streamed |
| First index | background, resumable; incremental afterwards |

## 8. Packaging

electron-builder per OS: Windows zip folder, macOS `.app` in a zip (ad-hoc signed — free — not notarised), Linux plain folder in a `.tar.gz` (no AppImage, so no FUSE dependency). CI builds lithograph-clangd for win-x64, mac-arm64, mac-x64, linux-x64 and linux-arm64.

### Size budget (no loss of speed or quality)

| Cut | Saves (approx.) |
|---|---|
| Merge the indexer into clangd — one Clang engine instead of two | 50–80 MB |
| One download per OS *and* CPU, never “universal” binaries | up to half on macOS |
| Ship only the English Chromium locale | ~40 MB |
| Strip debug symbols from native binaries (still built `-O2`) | large share of binary size |
| `node:sqlite` instead of a native SQLite module; tree-shaken CodeMirror; Solid.js | a few MB |
| Not done: UPX-style executable packing — slows start-up and breaks macOS signing | — |

Target: ≈ 150–180 MB on disk, ≈ 60–80 MB download. The floor is the Clang engine itself — the price of exact C++ understanding. A native UI instead of Electron could reach ≈ 80 MB, at a much higher build cost; not planned.


## 9. Build order

1. Shell, layout, fonts, theme, settings, portable data dir, first-run screen.
2. Files and safety: open / save / autosave, atomic writes, hot exit, persistent undo, external-change reload, trash-safe delete, session restore.
3. Editor basics: find & replace, multi-cursor, go to line / symbol, folding, command palette, split view, keymap presets.
4. clangd: diagnostics, completion, hover, go-to-definition, fix-its, all refactor tweaks.
5. Fact extractor + preview L1/L2, connector lines, shift preview with animation.
6. Terminal with command blocks; build view; build & test integration.
7. Debugger (lldb-dap / gdb).
8. Thread, signal mode, value story, structural zoom, callers.
9. Deep analysis, assembly view, struct layout, memory view, MISRA engine.
10. Git write operations, diff view, merge conflicts.
11. Atlas, book mode, board, notes, unread changes, history.
12. Flow view (bird’s-eye execution tree).
13. Help system and first-run tour; localisation; accessibility pass; extras (§35).
14. Language packs (the only online feature); DO-178C and AADL packs.
15. Profiler, concurrency checks, touch and pen, power awareness, problem reports (§30–34).
16. Packaging and per-OS polish.

**After version 1**: embedded workflow (§36).

## 10. Settings UI

- A small gear in a square outline at the top right of the header (Windows Phone app-bar style) — also ⌘/Ctrl , .
- Opens a full-page Metro settings view with a turnstile transition: big pivot headers *appearance · editor · preview · clangd · keys · files*.
- Controls: square-bordered pickers, thin sliders with a rectangular thumb, rectangular toggles; a live code preview on the right.
- Every control reads and writes `data/settings.toml` directly — the UI and the file are the same settings, and either can be edited.

## 11. Files and safety

- New / open file or folder, save, save as, save all; autosave (off · on focus change · after delay).
- Atomic saves: write a temporary file, then rename over the original.
- Hot exit: unsaved buffers are mirrored to `data/state/buffers` continuously; after a crash everything comes back.
- Undo history persists across restarts.
- External changes: silent reload when clean; three-way merge view when you have unsaved edits.
- Files pane: create, rename, move (drag), delete → OS trash, never permanent.
- Session restore, recent projects, reopen closed file. Encodings and line endings kept as found and switchable.

## 12. Editing, search and refactoring

- Find & replace in file and across the project: regex, case, whole word, in-selection; project replace shows a preview first.
- Multi-cursor, column selection, go to line, go to symbol in file, comment toggle, folding, word wrap, whitespace, snippets.
- Command palette (⌘/Ctrl ⇧ P) for every action. Split view; compare two files.
- Keymap presets: Lithograph (default), VS Code, optional Vim mode.
- Refactors (⌘/Ctrl .): rename, extract variable, extract function, move body header ⇄ source, expand auto, expand macro, populate switch, swap if/else, add using, generate constructors / special members, add missing and remove unused includes.

## 13. Debugger

- Debug Adapter Protocol. **lldb-dap** bundled (part of LLVM, all three OSes); gdb used when present.
- Breakpoints (conditional, logpoints), step, variables, watches, data breakpoints.
- Values ghosted beside lines; the live call stack is shown in the preview panes as cards with connector lines; one click sends the stack to an investigation board.

## 14. Git, build and test

- Git: diff view, stage, commit, switch branch, merge-conflict helper (plus the read features above).
- Build: CMake presets and targets, run configurations; tests discovered through CTest (GoogleTest, Catch2, doctest) with run / debug buttons.
- compile_commands.json: detected; for CMake, Lithograph offers to re-configure with export on; otherwise guessed flags with a visible note.
- Trust: a newly opened project can read and navigate, but cannot run build, run or task commands until you mark it trusted.

## 15. Terminal and build view

**Terminal**
- Borderless, a shade darker than the editor; sessions as lowercase pivot names (*zsh · tests*); split side by side; drag to resize; double-click the divider to maximise.
- Shell integration (prompt markers for zsh, bash, fish, PowerShell) turns output into **command blocks**: a gutter dot shows success or failure, duration on the right, ⌘/Ctrl ↑ ↓ jumps between commands, the running command’s line stays pinned while output scrolls, one key copies a block’s output.
- `file:line:col` anywhere in output is clickable. Search inside output.

**Build view** — a dedicated, calm view of every compile
- A dedicated view for compiling. You still type every command yourself in the input line at the bottom; the build view reads the output of known tools (cmake, ninja, make, msbuild, clang, gcc, cl) and lays it out:
  - **Timeline**: one lane per parallel job, one bar per file, filled as it compiles. Parallelism and slow files are obvious.
  - **Error cards**: grouped by file, live editable code excerpt with the caret, clang’s notes folded into a trail, fix-it button.
  - **Cascade folding**: errors that follow the first one in the same file are dimmed as probable consequences.
  - **Readable templates**: long types collapsed to their aliases (`std::basic_string<char, …>` → `std::string`); system-header notes hidden until asked for.
  - **Since last build**: new warnings highlighted, fixed ones listed, persistent ones dimmed.
  - **Cost**: per-file compile time against the previous build; with clang, `-ftime-trace` explains *why* (an include, a template).
  - **Result**: total time, output binary size and its change since last build.
- Raw output is always one key away (*build ⇄ raw*). ⌘/Ctrl R re-runs the last command; errors fixed in the editor fade from the build view before you rebuild.

## 16. Help

- A `?` in a square beside the gear (or F1) opens a Metro help page: one section per feature, a short animated loop, its shortcuts.
- Searchable from the command palette; bundled, fully offline.
- The settings reference is generated from the same schema the app reads, so it can’t go stale.
- First-run tour built on the tours engine. Hold ⌘/Ctrl for a second to see the shortcuts available right now.

## 17. Languages

**Programming languages**
- C and C++ are first-class (clangd, fact extractor, debugger, build view).
- Syntax colouring and basic editing for CMake, Python, JSON, TOML, YAML, Markdown, shell, Rust, Go, JavaScript/TypeScript via Lezer grammars (a few hundred KB).
- Any language server can be plugged in by path in `settings.toml` (rust-analyzer, pyright, gopls …): completion, diagnostics, go-to-definition and rename then work for that language. Not bundled, so no size cost. C++-only features (previews from the fact database, value story, layout) stay C/C++; previews fall back to the language server’s call hierarchy where it has one.

**Interface languages**
- All UI text lives in small TOML locale files (`locales/en.toml`, …), a few KB each; community translations can be dropped into `data/locales/`.
- Right-to-left layouts for Arabic and Hebrew mirror the chrome; code stays left-to-right.
- Typing: full IME support (Chinese, Japanese, Korean) in editor and terminal; bidirectional text in comments and strings.
- Fonts: ArX F1 and Selawik cover Latin; other scripts fall back to the OS (Segoe UI / SF / Noto). Chromium’s own locale pack is shipped only for the languages Lithograph ships.

## 18. Accessibility, updates, testing

- Screen-reader support, complete keyboard navigation, high-contrast theme option, UI scaling, preview lines distinguishable by pattern as well as colour.
- Updates: replace the executable; `data/` carries a format version and is migrated on first launch (old copy kept in `data/backup/`). No network checks.
- Tests: golden tests for the fact extractor on sample projects, unit tests for ordering and parsers, Playwright-driven UI tests, per-OS smoke tests in CI.

## 19. No installation — what “setup” means

1. Unzip `Lithograph/` anywhere. Run it. No installer, no admin rights, no registry, nothing in the user profile.
2. First launch creates `data/` beside the executable with `settings.toml` (every option, commented), `keys.toml`, `themes/charcoal.toml`, `state/`, `logs/`. Chromium’s profile, caches, crash dumps and temp files are redirected into `data/` too.
3. One welcome screen: pick a project folder. Lithograph reports what it found — compile_commands.json, compiler, git, debugger — and offers to import a VS Code theme. Done.

Honest caveats:
- **First launch warnings** (no paid signing, by choice): Windows SmartScreen → *More info → Run anyway*. macOS → *System Settings → Privacy & Security → Open Anyway* (or `xattr -dr com.apple.quarantine Lithograph.app`). Once per machine. The README and the download page say this up front.
- **macOS quarantine**: an app run straight from Downloads may be launched from a read-only copy; moving the folder with Finder fixes it, and Lithograph detects and explains it.
- **Linux**: needs a normal desktop (GTK 3, NSS) — present on mainstream distros.
- **Compiler**: building, running, assembly view and deep analysis use the compiler already on the machine (Xcode Command Line Tools, Visual Studio Build Tools / LLVM, gcc or clang). Editing, navigation, previews and every reading feature work without one. Optional on Windows: a portable **llvm-mingw toolchain pack** dropped into `tools/` gives compile-and-run with no install at all (~200 MB, separate download). macOS SDKs and MSVC libraries can’t legally be bundled.
- The OS may keep its own tiny bookkeeping (recent-items lists, jump lists); Lithograph disables what it can.

## 20. Language packs — the only feature that uses the internet

- **Settings → languages**: a grid of square Metro tiles, one per language. Green = ready, amber = partly there (e.g. compiler found, language server missing), grey = not installed. Detection probes PATH and `tools/lang/` (`rustc --version`, `rust-analyzer --version`, `go version`, `python3 --version`, …).
- **Install** on a tile shows the plan first — exact commands, download sources, sizes, whether admin rights are needed — then runs it in a visible terminal session (*install · rust*) as command blocks.
- **Portable first** (default): toolchains and servers go into `tools/lang/<language>/`, need no admin rights and travel with the folder.
  - Node-based servers (pyright, TypeScript, bash, YAML) run on Electron’s built-in Node — no system Node needed.
  - Rust via rustup with its homes pointed into `tools/lang/rust`; Go, Node, a JDK and standalone Python builds as official archives extracted in place; rust-analyzer and similar as single binaries.
- **System mode** (opt-in per language): winget / scoop on Windows, Homebrew on macOS, apt / dnf / pacman / zypper on Linux.
- **Recipes** are small declarative TOML files (`recipes/<language>.toml`): detection commands, official HTTPS URLs with SHA-256 checksums, package-manager commands per OS, a verification step. Replacing the files updates them. Nothing is ever piped from the network straight into a shell.
- **Permissions**: Lithograph never sees or stores a password. It asks the OS: the native macOS administrator dialog, Windows UAC, or polkit (`pkexec`) on Linux. Where none exists, `sudo` runs in the visible terminal and Lithograph moves focus there with a small in-UI note; the password goes straight to the terminal, is never echoed, logged or kept in command history.
- **Uninstall**: portable packs are a folder delete; system installs show the matching remove command.
- **Control**: `network.allow` in settings (default: only when you press install). Offline machines can install a pack from a downloaded archive.
- Platform limits: the macOS C/C++ toolchain comes from Xcode Command Line Tools (Apple’s own installer prompt); MSVC can’t be fetched silently — Lithograph offers llvm-mingw (portable) instead.

## 21. Tool views

Build, memory and MISRA are pivot pages of one tool pane (*build · memory · misra · terminal*). MISRA is off until enabled in settings; when off, its page doesn’t exist.

## 22. Memory view

**Budgets** per region — storage (flash / disk image) and RAM, plus any named linker region (CCM, external SDRAM, …), each task stack and the heap. Thresholds: amber at 90 % (configurable), red over 100 %. The header shows a tiny `RAM 104 %` when anything is over; the build view marks the build; `lithograph check --memory` fails CI.

**Largest first** — one list per region, descending, every entry with size, kind, file:line and change since last build. When a budget is exceeded, the message names the overflow and the entries that caused it (*RAM over by 5.4 KB — log_buffer, 8.0 KB, new in log.c:22, is the largest change*).

**Where the numbers come from** (exact after a build; estimates before one are labelled *estimate*)

| Case | Handling |
|---|---|
| ELF (Linux, embedded), Mach-O (macOS), PE/COFF (Windows) | Read with LLVM’s object library inside lithograph-clangd — one engine for all three |
| Embedded regions | Linker script `MEMORY` regions and the linker’s own `--print-memory-usage`; map file when present |
| `.data` | Counted twice, correctly: its initial image in storage and its live copy in RAM |
| Heap and stack reserves | Read from linker symbols (`_Min_Heap_Size`, `_Min_Stack_Size`, …) and counted as RAM |
| Per-symbol sizes | ELF symbol sizes; Mach-O has none, so sizes come from address gaps; PE from the linker map / PDB. DWARF used when present for file:line |
| Inlining and templates | Code is attributed to the function it ended up in, with *includes inlined …*; each template instantiation listed separately |
| `--gc-sections`, LTO, static vs dynamic linking | Always measured on the final linked output; shared libraries reported separately, not counted |
| Debug vs release | Budgets bind to a chosen configuration; measuring Debug shows a warning |
| Several images (bootloader + app, multiple targets) | Each target has its own budgets |
| Before the first build | Globals and static arrays sized from record layouts → *estimate* |

**Stack**
- Frame sizes from `-fstack-usage` (GCC, Clang, clang-cl); MSVC builds use clang-cl for this view.
- Worst-case depth = frame sizes along the call graph from each entry point: `main`, each interrupt handler (added on top of the stack it interrupts), each RTOS task with its own configured stack size.
- Calls through function pointers resolve to every address-taken function with a matching type — conservative, never under-counted. Recursion is *unbounded* unless annotated (`// lithograph: max-depth 8`). `alloca` / VLAs flagged *dynamic*.

**Heap**
- Every allocation site: `malloc` / `calloc` / `realloc` / `free`, `new` / `delete`, allocating standard containers, smart-pointer factories, plus functions that allocate through callees.
- Constant sizes are summed per path; sizes in loops or from containers are marked *unbounded* rather than guessed.
- *No dynamic allocation* mode turns every site into a warning. An optional memory run measures real current / peak heap and leaks and compares them with the budget.

## 23. MISRA engine

**Goal**: catch as much as possible while you type, so a later LDRA / Helix QAC / Polyspace run finds as little as possible.

- **Coverage plan** — every guideline in the selected standard (MISRA C:2012 with amendments / C:2023, MISRA C++:2023) is classified:
  1. *Decidable, from the AST* — implemented as AST checks in the fact extractor, run live.
  2. *Needs data or control flow* (uninitialised reads, dead code, invariant conditions, pointer ranges) — Clang Static Analyzer plus our own path checks, run on save.
  3. *Whole-program* (unique identifiers, unused declarations across files, external linkage) — run over the fact database after indexing.
  4. *Not mechanically checkable* (directives about documentation and process) — listed as manual checklist items with their status.
- **Essential type model**: implemented once and shared, since a large family of rules depends on it.
- **Precise messages**: rule number and category (mandatory / required / advisory); a one-line summary in our own words; *what in this line* violates it (the operand, the types, the path); and the smallest compliant fix, as a fix-it when it’s safe. Example: *Rule 10.4 · required — `count` is essentially unsigned and `-1` essentially signed; write `count > 0u` or cast explicitly.*
- **Licensing**: Lithograph ships numbers and its own summaries; official headlines load locally from the user’s licensed copy (`data/`, never redistributed).
- **Deviations**: `// misra-deviation <rule>: <reason>` or `deviations.toml`; deviated findings are kept and counted, not hidden.
- **Report**: per-guideline compliance summary (violations, deviations, not-applicable, manual) as HTML / CSV, laid out the way compliance matrices usually are.
- **Quality bar**: every check has passing and failing test cases; false positives are treated as bugs; the engine is not a qualified tool and says so in the report.
- **Mapping work**: from the user’s licensed copy, a table *guideline → class (1–4) → existing clang / clang-tidy coverage → implementation*. Only our own summaries go into the product.

## 24. Preview scrolling, std functions and the assembly view

**When calls don’t fit**
- Each preview column scrolls on its own (wheel, trackpad, or ⌥/Alt ↓ ↑ card by card) with eased, frame-locked scrolling. Connector lines follow every frame — only the visible lines’ paths are updated, nothing is re-laid out.
- A call whose card is above or below the visible part keeps its line, ending in a dashed arrow at that edge with the function’s name (*↑ parse_headers*, *↓ record*). Clicking the arrow scrolls to the card.
- Moving the cursor onto a call in the code glides its card into view and marks it briefly. Order is always call order.

**Standard-library functions** (shown when the *std* chip is on)
- A **summary card**, never the raw implementation: the declaration, which instantiation is used here (*sort&lt;Cookie*&gt;*), the library (libc++, libstdc++, MSVC STL), a one-line behaviour note (*introsort · O(n log n)*), and *open read-only ›* for the real source in a side view with signal mode on and reserved names (`__x`) prettified.

**Assembly view**
- Default ISA = the project’s target triple from compile_commands.json, else the machine’s own (arm64 on Apple silicon, x86-64 on most PCs). Switchable to any target the bundled clang supports (x86-64, AArch64, ARM Thumb-2 for Cortex-M, RISC-V); cross-targets use the project’s headers and say so. Optimisation level and standard library are shown beside the ISA.
- Each instruction carries a colour bar for its source line; lines link source to the first instruction of each group.
- **Inlined std code** collapses into one row — *inlined · std::vector&lt;int&gt;::push_back · fast path · 5 instructions* — expanded on click. Detected from debug line info pointing into system headers.
- **Out-of-line std calls** show a readable name instead of the mangled one (*std::sort → __sort&lt;int*&gt;*, *vector&lt;int&gt; · grow on push_back*) with their size and *open ›* to view that function’s own assembly.
- Loops get an optional throughput estimate from llvm-mca (*≈ 1.0 cycles / iteration*), labelled as an estimate for the selected CPU.
- Switching ISA swaps the listing with the turnstile animation; groups and links keep their colours so the two can be compared.

## 25. Flow — the bird’s-eye view of execution

*Atlas* shows **where** code lives, *book* gives a **reading order**, *flow* shows **how the program runs**. It is the landing page when a folder is opened (unless a session is being restored).

**Starts immediately**
1. *Instant (≈ 1 s)* — a fast parse without compile flags finds entry points and call names; a rough tree appears, drawn faintly.
2. *Precise* — the fact extractor indexes files in order of reachability from `main`, so the tree firms up top-down within seconds, each node settling in place.
3. *Loop counts* — trip counts from LLVM’s loop analysis on the compiled IR, mapped back by debug info, arrive last.

**Entry points** (one lane each, in this order): every `main` / `wmain` / `WinMain` (one tree per executable target) · threads and RTOS tasks (`std::thread`, `pthread_create`, `xTaskCreate`, …) · interrupt handlers (vector table, `*_IRQHandler`, interrupt attributes) · registered callbacks (signal handlers, `atexit`) · tests (one collapsed group) · for libraries without `main`, the public API.

**What a node shows** — the function name, nothing else. File and line on hover; a preview card on longer hover; click opens it.

**Execution structure**, drawn sparingly
- Children top to bottom in **call order**; depth goes right. Reading down = reading the program’s time line.
- **Loops**: a thin bracket around the calls inside it, with a ↻ and its count — `×16` (constant), `×n · v.size()` (data-dependent), `until !running_` (condition), `×?` (unknown). Nested loops nest their brackets; the product appears on hover (`×16 × 8 = 128`).
- **Conditions**: calls on a branch hang from a dashed edge with the condition in small text (`if headers.empty()`); error-only branches are dimmed, as in signal mode.
- **Recursion**: ↺ on the node. **Indirect calls** (virtual, function pointers, `std::function`): ⇢ with the number of candidates.
- Standard-library and system calls are hidden unless the *std* chip is on.

**Cognitive budget — the gist first**
- About 7 children per node are shown; the rest fold into `+N`.
- Small leaf helpers called from many places (fan-in ≥ 4) fold into a line on their parent: `uses trim, split, hash +3`.
- A subtree that appears again is not redrawn: `→ parse_headers ↑` jumps to the first one.
- Default depth grows until about 40 nodes are visible; every node expands and collapses on click.

**Not reached** — a quiet shelf at the bottom lists files and functions with no path from any entry point, each with the likely reason: *only called from tests*, *no callers*, *called through a pointer we couldn’t resolve*, *belongs to another target*. Files with no connection at all appear there as plain names, with no connectors.

**Box-and-arrow form** (default; the tree above is the alternative *outline* form, one key apart)
- One box per file (or per class / module, selectable); boxes laid out left to right in the order execution first reaches them. The entry box carries *start ▸*; thread and interrupt entries are labelled.
- Box shows its name and *N functions · M run*. Files no entry point reaches sit greyed in a *not reached* group, without arrows.
- **Arrows** go from caller box to callee box, labelled with the execution-order numbers of the calls they carry (`4 · 14`). Thread spawns are dashed. Calls within one box don’t get arrows; repeated regions are marked on the box (*↻ 5–13 repeat until !running_*).
- **Hover a box**: a list of its functions, each with its execution-order number on the left; functions that don’t run in this flow have no number and are dimmed. The box’s own arrows brighten, the rest fade.
- **Click a box**: its functions open in the preview pane on the right as cards, in execution order, numbers in the card headers; functions that don’t run are listed below. Cards behave like all preview cards (scroll, ⌘/Ctrl-click, edit).
- Numbering comes from a depth-first walk of the call graph from each entry point in call-site order; loop bodies are numbered once and marked as repeating; threads number separately (`t1, t2 …`).

**Overlays** (off by default): *you are here* (the path from `main` to the function under the cursor) · *measured* counts from a coverage / profile run (`×1,204 measured` instead of estimates) · unread / changed since last read.

## 26. DO-178C support pack (optional)

MISRA covers only part of DO-178C: the objective that source code conforms to a coding standard. DO-178C is a process standard; most of its objectives — plans, requirements, traceability, structural coverage, configuration management, quality assurance, tool qualification — are outside any coding standard. The pack helps where an editor can:

| DO-178C need | Lithograph support |
|---|---|
| Source code conforms to standards | MISRA engine + project-specific rules |
| Traceability (requirements ↔ code ↔ tests) | `@req HLR-104` tags in comments, requirement import (CSV / ReqIF), trace matrix, untraced code flagged |
| Structural coverage — statement, decision, MC/DC by level | clang source-based coverage including MC/DC, shown inline and as a report |
| Data and control coupling | from the fact database: who calls whom, who reads / writes which globals |
| Dead / deactivated code | flow view’s *not reached* shelf |
| Stack usage | memory view |
| Level A source ↔ object code traceability | assembly view’s line mapping |

Not a qualified tool (DO-330); its output is evidence to support, not certification credit. RTCA’s text is copyrighted: objective identifiers and our own summaries only; a licensed copy can be loaded locally.

## 27. AADL support pack (optional, SAE AS5506D)

- **Editing**: AADL syntax colouring, outline, go-to-definition across packages, error checking — Lithograph’s own parser (no maintained AADL language server exists).
- **From code to model**: a draft AADL model generated from the fact database and known RTOS APIs (FreeRTOS, Zephyr, POSIX threads, ARINC 653): tasks → threads (period and priority from creation calls), queues → event data ports and connections, mutex-guarded globals → shared data access, interrupt handlers → aperiodic threads / devices, functions → subprograms with `Source_Name` / `Source_Text` properties pointing back at the code. The draft is reviewed by the user; nothing is presented as authoritative.
- **Consistency**: model vs code (*model says 10 ms period, code waits 20 ms*).
- **Interop**: open the model in OSATE when installed; generate code from AADL with Ocarina as an optional external tool.
- No mature open-source C-to-AADL translator exists today; published research (C2AADL_Reverse) informs the mapping.

## 28. Licence and distribution

- **Lithograph’s own code: the Lithograph License** (`LICENSE`) — © 2026 Jatin Aggarwal. MIT as the base, with additional conditions that take precedence:
  - **No selling** (Commons Clause): no selling Lithograph, or paid hosting / support / products whose value comes substantially from it. Using it for paid work is allowed.
  - **Origin and credit**: no one may claim to have written it; modified versions must be marked as modified; every distributed copy shows *Based on Lithograph by Jatin Aggarwal* in its About screen and docs and ships the licence unchanged.
  - **Name**: modified versions must use a different name; unmodified copies may keep “Lithograph”.
  - **Terms stick**: the conditions can’t be removed or weakened by sublicensing.
  - Selling is restricted, so it is *source-available*, not OSI “open source”.
- The copyright line and the licence are shown in *about*, in `--version`, and at the top of `THIRD_PARTY_NOTICES`.
- **Bundled third-party parts keep their own licences**, listed in `THIRD_PARTY_NOTICES` and in *about*: Electron, CodeMirror, xterm.js, node-pty (MIT) · clangd, lldb-dap and LLVM libraries (Apache-2.0 with LLVM exception) · elkjs (EPL-2.0, used unmodified) · Selawik (SIL OFL 1.1) · ArX F1 (its own open licence) · SQLite (public domain). Their notices must travel with every copy — the only obligation they impose.
- **Nothing GPL is bundled**: cppcheck, Ocarina, gdb, Valgrind and heaptrack are used only when already installed, as separate programs.
- **Zero cost**: no paid signing certificates, no Apple Developer account, no servers. macOS builds are ad-hoc signed (free, required for Apple silicon) but not notarised. Releases are plain archives.

## 29. Flow and atlas at scale

- **Grouping**: directories become group boxes that open on click; a monorepo first appears as about ten boxes. Grouping can switch to targets, namespaces or classes.
- **Layout**: elkjs layered layout — left to right in execution order, orthogonal arrow routing, minimal crossings; runs in a worker so the UI never waits.
- **Stable and pinnable**: positions are kept between sessions in `data/state`; a box the user drags stays pinned; a small code change never reshuffles the whole picture.
- **Level of detail**: past ~60 visible boxes, arrow labels collapse to counts until you zoom in.

## 30. Profiler

- *Profile run* from the build view samples the program with the OS’s own profiler — `perf` on Linux, `sample` / `xctrace` on macOS, ETW (`wpr`) on Windows — no bundled profiler.
- Results: a flame graph in the tool pane; hot lines tinted in the editor; real call counts and time in the flow view’s *measured* overlay.

## 31. Concurrency checks

- Clang thread-safety analysis (`-Wthread-safety`) with annotation help: Lithograph suggests `GUARDED_BY` / `REQUIRES` from observed lock usage.
- Lock-order graph from the fact database: possible lock inversions flagged.
- ThreadSanitizer, AddressSanitizer and UndefinedBehaviorSanitizer as one-click toggles in the build view; findings appear as normal diagnostics and can be sent to an investigation board.

## 32. Touch and pen (additive only)

- Enabled only when a touch or pen device is present; mouse and keyboard behaviour never changes.
- Swipe between pivot pages and preview levels; pinch-zoom in flow, atlas and structural zoom; long-press = hover (lists, previews); pen hover = mouse hover.
- Hit targets grow to 40 px only for touch input.

## 33. Power awareness

- On battery or OS low-power mode: indexing and background compiles drop to one low-priority worker; animations keep 60 fps but nothing runs speculatively.
- `performance.max_cpu` caps background CPU use at any time.

## 34. Problem reports (offline)

- *Help → Create problem report* writes a zip into `data/reports/`: logs, settings, versions, OS details; file paths and project names can be replaced with placeholders.
- Lithograph never sends it anywhere; the user decides where it goes.

## 35. Extras

- **Templates**: new CMake application, library, or app with tests (GoogleTest / Catch2 / doctest); file templates for headers (guards or `#pragma once`), class skeletons, test files.
- **Offline C++ reference**: optional cppreference pack (installed like a language pack); hover shows the entry for standard-library names.
- **Spell-check** limited to comments and string literals; Hunspell dictionaries, project word list in `data/`.
- **TODO / FIXME list** across the project, in the tool pane, with the author and age from git.
- **`.clang-format` editor**: every option with a live before/after preview on your own code.

## 36. After version 1 — embedded workflow

- Serial monitor and plotter.
- Flashing and on-chip debugging through probe-rs or OpenOCD.
- Peripheral register view in the debugger from vendor SVD files.
- Cross toolchains (e.g. `arm-none-eabi-gcc`) as language packs.
