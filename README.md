<img src="assets/icon/skycodex-1024.png" width="112" alt="SkyCodeX icon">

# SkyCodeX

A portable, offline tool for reading and understanding codebases of any size: a bird's-eye view of how the program runs, from every entry point down to each call, with the compiler's own index behind it so every name and header opens with ⌘/Ctrl-click. Code can still be edited and saved. Charcoal, borderless, Metro-style.

Formerly called Lithograph (version 1.0.0 was released under that name).

Copyright (c) 2026 Jatin Aggarwal. All rights reserved except as granted in [LICENSE](LICENSE).

## Status

**Version 1.0** for macOS (Apple silicon), Windows (x64) and Linux (x64): portable apps, downloadable from the repository's [Releases](https://github.com/jay-core/lithograph-editor/releases) page. Each build is checked by opening the packaged app on its own system before it is published. Since 1.0 the editor extras have been removed so the project can focus on the flow view, and the interface and the flow view are being reworked next. The full design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Concept images and animations are in [`docs/concepts/`](docs/concepts/).

Working now:
- **Flow view:** how the program runs, from one entry point at a time — the `main` picked last time in that folder, else the most likely one (a sample, demo or the project's own `main` before tests, tools and ports); others from a chip, or a searchable list when there are more than six (a library without `main` starts from its public API, `inc/`, `include/`) — as two views of the same run (Tab switches, keeping the step). A project with several opens on the list of them (most likely first, then by folder, searchable); "← all programs" or Backspace returns to it. Restart, play/pause, one step and speed buttons in both views:
  - **sequence:** one row per call in execution order, stepping with the keyboard through calls, returns and loop passes; the lines around each call, the whole call chain as links, chapters on the spine, folding a big call, finding a function and walking one of its paths, a tour, and walks shared as a link or saved as a walkthrough
  - **boxes:** files as boxes, the functions that run as rows in step order, a line from each caller's row to each callee's row with the calls' step numbers — readable at every zoom (fit width, fit all, 100%, 150%, any scale, with scrolling and a minimap; zoomed out it is drawn as files, then folders)
  - every route between two functions (shift-click), a marker that plays the run along the lines (Space), focus, how often each function runs, SVG or PNG export, a step that glides between the two views; very large diagrams draw only what is in view, and a file called from many others keeps its lines for when they matter
  - what the engine follows: calls through virtual methods to each override (`area · one of 3`), threads and RTOS tasks (std::thread, pthread, FreeRTOS, ThreadX, Zephyr, CMSIS…), calls through pointers with the functions they could reach, interrupt handlers as entry points
  - more code when wanted: calls only, with decisions, or all code, everywhere (⇧D) or per function (D); around the step (A): its callers and two levels of calls, the rest folded (on by itself for very long runs)
  - findings, without running anything: a result thrown away (proved), state two threads touch with no lock (possible); each step's box says what it changes, locks, allocates and throws
  - programs: "how they connect" shows which program starts which and the files they share
  - in both: a magnifier that follows the pointer at any zoom (M), what-if (fold away what a condition would skip and compare), a depth skyline to scrub, jump letters, what you've read, notes on steps, and the functions you have edited and not saved marked with every call that reaches them
  - the call graph comes from clangd's index, many requests at a time, and only the program shown is traced, so large projects build in seconds (thorvg: about 1,000 calls in under a second; Eclipse ThreadX, 3,400 files and 278 `main`s: about 70 functions on screen in 11 s, before clangd has finished indexing — calls the index cannot place yet are followed to their only definition in the source text — and the full run once it has)
- **Any project, built or not:** a folder without `compile_commands.json` (Meson or Make projects not yet built, plain source folders) gets one written into SkyCodeX's own data folder, never into the project, so clangd indexes everything and the project's own `#include`s resolve.
- **Preview panes:**
  - calls of the function under the cursor as cards, two levels, shiftable
  - every call in the source (the editor for pane 1, pane 1's card for pane 2, and so on) outlined in its card's colour; hover shows its connector, a click brings its card into view, lit, keeps the connector until something else is selected, and shows how many levels deep the call goes
  - standard-library cards; macros, `static_assert`, lambdas and indirect calls listed after a divider
- **Colours:** Settings → appearance has a hue, saturation and lightness slider for every colour — the whole editor, code, diagnostics, preview cards, the flow views — previewed live, written to `settings.toml`.
- **Refresh** (bottom right, and in the flow view): reads every file again — new files, functions and entry points — and rebuilds the previews, the flow and its views; when a build has written or rewritten the project's `compile_commands.json`, clangd starts again on it.
- **Searches, all case-free:** a file by name or path (the box at the top of the folder tab); text inside a file (⌘/Ctrl F in the editor, a preview card or the flow's step preview); text in every file of the folder (⌘/Ctrl ⇧ F: matches grouped by file as they are found, a click opens the line).
- **Folder tab:** new file and new folder (in the folder last clicked, else the open file's), and a button that opens the system's own terminal in that folder (Terminal on macOS; Windows Terminal or Command Prompt; the desktop's terminal on Linux) — a separate window, not part of SkyCodeX.
- **Reading and editing with the inbuilt clangd:**
  - ⌘/Ctrl-click to the definition, into any header, standard ones included
  - errors, completion, hover, rename (F2), fixes and refactorings (⌘/Ctrl .), references (⇧F12)
  - atomic saves; unsaved edits survive crashes
- **Other languages:** syntax colouring for Rust, Python, Go, CMake, JSON, YAML and Markdown, and language engines for Rust (rust-analyzer), Python (Pyright) and Go (gopls) from language packs or the system.
- **Compiler window and language packs:** choose the clangd in use; install, update or remove LLVM / llvm-mingw (whose standard headers are then indexed with the project), Rust, rust-analyzer, Python, Pyright and Go.
- **Portable and offline:** a `data/` folder beside the app holds `settings.toml` (live reload) and the session.
- **Access:** keyboard focus rings and screen-reader labels; high contrast, interface scale, reduced motion, battery saver, touch and pen.

Next:
- the flow view and its interface, reworked for any size of codebase
- one view per program when a project has several `main`s, with what connects them (today the flow shows one program at a time)
- calls through virtual methods followed to their overrides
- more entry points: threads and RTOS tasks, interrupt handlers, callbacks
- flow for more languages

Removed since 1.0: the memory view, run with checks and the profiler, the terminal, project templates, the C++ reference, the to-do list, spell-check, code style and formatting, problem reports, interface translations, help pages and the tour.

## Using the release

Download the file for your system from [Releases](https://github.com/jay-core/lithograph-editor/releases). Version 1.0.0 was published before the rename, so its files, app and program carry the name Lithograph (`Lithograph.app`, `Lithograph.exe`, `./lithograph`).

| System | File | Download |
|---|---|---|
| macOS 13+, Apple silicon | `Lithograph-1.0.0-mac-arm64.zip` | 224 MB |
| Windows 10/11, x64 | `Lithograph-1.0.0-win-x64.zip` | 191 MB |
| Linux x64 (built on Ubuntu 22.04; needs a distribution of that age or newer) | `Lithograph-1.0.0-linux-x64.tar.gz` | 244 MB |

Unpack it and move the folder wherever you like: a projects folder, or a USB drive. Nothing is installed anywhere else. SkyCodeX creates `data/` (settings, session, logs) and `language_packs/` beside the app on first run, and sends nothing over the network. Unpacked, the macOS app is 630 MB, most of it Electron plus the inbuilt clangd.

- **macOS**: open `SkyCodeX.app`. While macOS still has the folder quarantined, don't run it from Downloads; it would run as a read-only copy. For the C/C++ standard headers, install the Xcode Command Line Tools (`xcode-select --install`).
- **Windows**: open `SkyCodeX.exe`. For the C/C++ standard headers, install the llvm-mingw pack from the compiler window, or use Visual Studio's.
- **Linux**: run `./skycodex` from the folder. If it stops at once with a message about the "SUID sandbox helper" (Ubuntu 24.04 and later restrict Chromium's sandbox), give the helper its rights once with `sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox`, or start it with `./skycodex --no-sandbox`. For the C/C++ standard headers, install your distribution's development packages (for example `build-essential`).

On first launch, see *First launch* below.

## Building a release

```
npm run fetch-clangd   # once: the inbuilt clangd, checked against its pinned SHA-256
npm run package        # builds, assembles release/SkyCodeX-<version>-<os>-<arch>/ and packs it
```

`npm run package` builds for the system it runs on. `src/build/package.mjs` renames Electron's own app and adds SkyCodeX's built files and the inbuilt clangd (in `resources/tools/`, or `Contents/Resources/tools/` on macOS):

- **macOS**: the app bundle and its helpers are renamed and signed ad hoc, which is free; zipped.
- **Windows**: `SkyCodeX.exe` gets its icon and version details from `rcedit` (install it for the build only: `npm install --no-save rcedit@5.0.2`); zipped.
- **Linux**: the program is `skycodex`; packed as `.tar.gz`.

The Windows and Linux releases are built by GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) on each system. It runs the tests, packages, then opens the packaged app with `--smoke … --scenario boot` and fails unless the inbuilt clangd, preview cards, go-to-definition and the flow view all work (`src/build/check-smoke.mjs`). Pushing a `v…` tag attaches the builds to that tag's release; the macOS zip is built on a Mac and added to the same release. The icon is made from `assets/icon/skycodex-1024.png` (any 1024 × 1024 PNG); `npm run icon` renders it from `assets/icon/skycodex.svg`. Output goes to `release/`, which git ignores.

## Running from source

Needs Node.js 22+.

```
npm install
node node_modules/electron/install.js   # fetches the Electron binary (npm blocks install scripts by default)
npm run fetch-clangd                    # the inbuilt clangd for this platform, checked against its pinned SHA-256
npm start
```

The inbuilt clangd lives in `tools/clangd/` (kept out of git: its binary is larger than GitHub allows). Without it, SkyCodeX uses the system's clangd.

### Compiler toolchains and language packs

The **compiler** button (bottom left) opens a window to choose the clangd in use and to install, update or remove packs such as the full LLVM toolchain (llvm-mingw on Windows). Packs go into `language_packs/` beside the app — created empty on first run — and nowhere else:

- each pack comes from its project's official releases: GitHub (LLVM, llvm-mingw, clangd, rust-analyzer, Python builds), static.rust-lang.org, go.dev, or the npm registry (Pyright);
- every download is checked against the checksum its source publishes (SHA-256, or npm's SHA-512) and unpacked by SkyCodeX itself (`.zip`, `.tar.zst`, `.tar.gz`, `.gz`). No installer or script runs, and entries that would land outside the folder are refused. The Go pack then builds gopls with its own `go`; modules are verified by Go's checksum database;
- the language engines keep Cargo's registry, Go's module cache and pip's cache inside their packs;
- the standard C/C++ headers come from the system (Xcode Command Line Tools on macOS, the distribution's development packages on Linux); an installed toolchain pack's headers are used instead, and on Windows the llvm-mingw pack brings its own.
- **read the code as** clang, **gcc** or **MSVC**: the same analysis and views, with that compiler's headers, macros and language rules. gcc is the real g++ found on the PATH (or `compiler.path`), asked for its headers and macros; MSVC is Visual Studio's or the Build Tools' `cl.exe` (Windows), which puts clangd into its MSVC-compatible mode. A project's own `compile_commands.json` keeps the compilers it names.

`npm test` runs the unit and integration tests in `src/tests/`. `npm run smoke` drives the real app against `samples/tinyhttp` (build it first with `samples/tinyhttp/build.sh`) and writes screenshots to `data/logs/`. Add `-- --scenario compiler|fonts|defs|boot|large` after the folder for one part only (`large` times each stage on a big project, such as thorvg).

## What it is

- **Portable** — one folder, no installer; settings and data live in `data/` beside the executable.
- **Offline** — everything works without a network; language packs are the only optional online feature.
- **Flow** — a bird's-eye view of how the program runs, numbered in execution order, for any size of codebase.
- **Previews** — the bodies of every function called from where your cursor is, two levels deep, shiftable further.
- **Exact** — the compiler's own index (clangd) behind every name, so ⌘/Ctrl-click reaches any definition and any header.

## Repository layout

| Path | Contents |
|---|---|
| `src/` | All source code |
| `src/main/` | Electron main process: files, settings, clangd and other language servers, the generated compile database, build targets, language packs |
| `src/preload/` | The bridge between the interface and the main process |
| `src/renderer/` | The interface (Solid + CodeMirror): flow, previews, editor, windows |
| `src/shared/` | Code used by both sides: settings schema, C++ parsing helpers |
| `src/build/` | Build scripts: main process and preload, the release package, the icon |
| `src/tests/` | Unit and integration tests (vitest) |
| `src/concepts/` | The pages and scripts the concept images were rendered from |
| `assets/fonts/` | ArX F1 (code) and Selawik (interface), each with its licence |
| `assets/icon/` | The app icon: its source drawing and the 1024 px image the platform icons are made from |
| `docs/` | `ARCHITECTURE.md` (the complete design) and `concepts/` (images and videos) |
| `samples/` | Sample C++ projects used by the tests and the smoke run |
| `LICENSE`, `THIRD_PARTY.md` | The SkyCodeX License, and third-party notices |

Created at run time and kept out of git: `data/` (settings and state), `tools/clangd/` (the inbuilt engine), `language_packs/`, `dist/`, `release/`.

## Licence

The SkyCodeX License: MIT, plus conditions that take precedence —

- **No selling** SkyCodeX, or paid products and services based on it. Using it for paid work is fine.
- **Credit**: every distributed copy shows *Based on SkyCodeX by Jatin Aggarwal* and keeps the licence unchanged; modified versions are marked as modified.
- **Name**: modified versions use a different name.

SkyCodeX is source-available, not open source. Bundled third-party components keep their own licences.

## First launch (unsigned builds)

Releases are not code-signed, to keep the project free of cost.

- **Windows**: SmartScreen → *More info* → *Run anyway*.
- **macOS**: *System Settings → Privacy & Security → Open Anyway*.
