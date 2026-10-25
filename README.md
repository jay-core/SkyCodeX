# Lithograph

A portable, offline code editor for C and C++ — charcoal, borderless, Metro-style, built for reading and understanding code as much as writing it.

Copyright (c) 2026 Jatin Aggarwal. All rights reserved except as granted in [LICENSE](LICENSE).

## Status

**First working prototype** (macOS tested; Windows and Linux are designed for but not yet tested). The full design is in [ARCHITECTURE.md](ARCHITECTURE.md); concept images and animations are in [`concepts/`](concepts/).

Working now:
- Portable `data/` folder, `settings.toml` with live reload and a settings page (gear at the bottom right, or ⌘/Ctrl ,)
- C/C++ editing with clangd: errors, completion, hover, ⌘/Ctrl-click to definition, rename (F2), fixes and refactorings (⌘/Ctrl .), references (⇧F12)
- Quick open (⌘/Ctrl P), symbol search (⌘/Ctrl T), command palette (⌘/Ctrl ⇧ P), save (⌘/Ctrl S), save all (⌘/Ctrl ⌥ S), atomic saves, unsaved edits survive crashes
- Preview panes: calls of the function under the cursor, two levels, *shift preview* (⌥/Alt →, ⌥/Alt ←), a call index column (call → name → card), off-screen markers, cursor-follow highlight, standard-library cards with *show source*
- Flow view: box-and-arrow overview from every `main`, execution-order numbers per entry point, loops, threads, unreached files (also hoverable and selectable), hover and click to preview
- Memory view: finds built programs anywhere in the folder (or browse), RAM and storage (ELF, Mach-O, PE), budgets, largest first, stack usage from `-fstack-usage`, heap call sites
- Integrated terminal that follows the opened folder; *options* menu (new / open file / open folder / save as / close …) and the macOS menu bar; closable tabs

Not built yet: build view, debugger, git, atlas / book / board, compliance packs, packaging into a download.

## Running from source

Needs Node.js 22+.

```
npm install
node node_modules/electron/install.js   # fetches the Electron binary (npm blocks install scripts by default)
npm run fetch-clangd                    # the inbuilt clangd for this platform, checked against its pinned SHA-256
npm start
```

The inbuilt clangd lives in `tools/clangd/` (kept out of git: its binary is larger than GitHub allows). Without it, Lithograph uses the system's clangd.

### Compiler toolchains and language packs

The **compiler** button (bottom left) opens a window to choose the clangd in use and to install, update or remove packs such as the full LLVM toolchain (llvm-mingw on Windows). Packs go into `language_packs/` beside the app — created empty on first run — and nowhere else:

- files come from the official GitHub releases and are checked against the SHA-256 GitHub publishes; only `.zip` and `.tar.zst` are offered, both unpacked by Lithograph itself (no installer or script runs, and entries that would land outside the folder are refused);
- an installed toolchain comes first on `PATH` in Lithograph's own terminals only, through start-up files kept in `data/state/shell-init/` that load your usual shell configuration first. Your shell files, system `PATH` and other terminals are never changed;
- the standard C/C++ headers still come from the system (Xcode Command Line Tools on macOS, the distribution's development packages on Linux); on Windows the llvm-mingw pack brings its own.

`npm test` runs the unit and clangd integration tests. `npm run smoke` drives the real app against `samples/tinyhttp` (build it first with `samples/tinyhttp/build.sh`) and writes screenshots to `data/logs/`.

## What it is

- **Portable** — one folder, no installer; settings and data live in `data/` beside the executable.
- **Offline** — everything works without a network; language packs are the only optional online feature.
- **Previews** — the bodies of every function called from where your cursor is, two levels deep, shiftable further.
- **Flow** — a box-and-arrow overview of how the program runs, numbered in execution order.
- **Build, memory, MISRA, DO-178C, AADL** — dedicated, calm views for compiling, memory budgets and compliance work.

## Repository layout

| Path | Contents |
|---|---|
| `ARCHITECTURE.md` | The complete design |
| `concepts/` | Concept images and videos; `concepts/source/` holds the pages they were rendered from |
| `fonts/` | ArX F1 (code) and Selawik (interface), each under its own licence |
| `LICENSE` | The Lithograph License |

## Licence

The Lithograph License: MIT, plus conditions that take precedence —

- **No selling** Lithograph, or paid products and services based on it. Using it for paid work is fine.
- **Credit**: every distributed copy shows *Based on Lithograph by Jatin Aggarwal* and keeps the licence unchanged; modified versions are marked as modified.
- **Name**: modified versions use a different name.

Lithograph is source-available, not open source. Bundled third-party components keep their own licences.

## First launch (unsigned builds)

Releases are not code-signed, to keep the project free of cost.

- **Windows**: SmartScreen → *More info* → *Run anyway*.
- **macOS**: *System Settings → Privacy & Security → Open Anyway*.
