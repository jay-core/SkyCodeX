<img src="assets/icon/skycodex-1024.png" width="112" alt="SkyCodeX icon">

# SkyCodeX

**See how your C and C++ program actually runs.** Other editors show you files and symbols. SkyCodeX opens a project and draws the program's run: from `main` down through every call, in the order it happens, for codebases of any size. It runs fully offline, from one folder, with nothing to install.

Copyright (c) 2026 Jatin Aggarwal. See [LICENSE](LICENSE). (Formerly called Lithograph.)

---

## What only SkyCodeX does

**1. The flow of the whole program, not just the file you're in**
- Pick a program (SkyCodeX finds every `main` and suggests the likely one) and see its run two ways, switched with **Tab**:
  - **Sequence:** one row per call, in execution order. Step through calls, returns and loop passes with the keyboard.
  - **Boxes:** files as boxes, the functions that run as rows, and a numbered line from every caller to every callee. Readable from "whole project" down to 100%.
- Press **Space** and a marker plays the run along the lines.
- It follows calls through virtual methods, function pointers, interrupt handlers, threads and RTOS tasks (std::thread, pthread, FreeRTOS, ThreadX, Zephyr, CMSIS…).

**2. Analyses on that run, graded honestly**
Each result is marked *proved*, *possible* or *can't tell*. Nothing is guessed.
- **Ways out:** every early `return`, `throw` and `break`, and what leads to it.
- **Pairs that don't close:** a `lock` without its `unlock` (or `malloc`/`free`, `open`/`close`) on some path.
- **Watch a variable:** every step that reads or sets it, even through renames.
- **A value's journey:** one value followed across calls.
- **Values settled per call:** `draw(true)` makes `if (clear)` true there, and the branch that can't happen fades out.
- **Findings:** state two threads touch without a lock, and results thrown away.

**3. What a build setting or a change does**
- **Configurations:** read the same program with `DEBUG` defined (or another build folder) and see which steps only run with it.
- **What a change does:** compare your files, or any commit, with an older commit. Added steps show in green, removed ones in faded red, with a one-line summary.

**4. Fixes that are checked before you see them**
- Under each C/C++ error, SkyCodeX offers only fixes a second, hidden clangd has confirmed: with the fix in, the error is gone and no new one appears.
- Each fix is one edit (a bracket, `;`, `std::`, an `#include`, `*` or `&`). Casts are never suggested.
- Nothing changes until you click ✓.

**5. Fast on big codebases**
- Eclipse ThreadX (3,400 files, 278 programs): the first picture in **5.4 s** on a first open, and in **about half a second** after that. Animations hold 60 fps, with or without a GPU.
- Only the program on screen is traced, so size doesn't slow everything down.

**6. A good editor too**
- ⌘/Ctrl-click to any definition, standard headers included.
- Errors, completion, hover, rename (F2), refactorings (⌘/Ctrl .) and references (⇧F12), from the inbuilt clangd.
- **Preview cards** show the bodies of the functions called under your cursor, two levels deep.
- Search a file, the open file, or the whole folder.
- Saves are atomic, and unsaved edits survive a crash.
- Syntax colouring for Rust, Python, Go, CMake, JSON, YAML and Markdown, with their language engines from optional packs.

**7. Yours, offline and portable**
- One folder, no installer. Settings, session and logs live in `data/` beside the app.
- Nothing is sent over the network. Optional language packs are the only download, and each is checked against its published checksum.
- Every colour in the interface is adjustable, live. High contrast, interface scale, reduced motion, screen-reader labels and keyboard focus are all supported.

---

## Download and start

Get the file for your system from [Releases](https://github.com/jay-core/SkyCodeX/releases):

| System | File |
|---|---|
| macOS 13+, Apple silicon | `SkyCodeX-1.0.0-mac-arm64.zip` |
| Windows 10/11, x64 | `SkyCodeX-1.0.0-win-x64.zip` |
| Linux x64 (Ubuntu 22.04 or newer) | `SkyCodeX-1.0.0-linux-x64.tar.gz` |

Unpack it and put the folder anywhere: a projects folder or a USB drive.

- **macOS:** open `SkyCodeX.app`. The first time, macOS may block it because it isn't signed with a paid certificate. Go to *System Settings → Privacy & Security → Open Anyway*, or right-click the app and choose *Open*. Don't run it from Downloads while it's still quarantined. For the C/C++ standard headers, run `xcode-select --install`.
- **Windows:** open `SkyCodeX.exe`. If SmartScreen warns, choose *More info → Run anyway*. For the standard headers, install the llvm-mingw pack from the compiler window, or use Visual Studio's.
- **Linux:** run `./skycodex`. If it stops with a "SUID sandbox helper" message (Ubuntu 24.04+), run `sudo chown root:root chrome-sandbox && sudo chmod 4755 chrome-sandbox` once, or start it with `./skycodex --no-sandbox`. For the standard headers, install `build-essential` or your distribution's equivalent.

## Using it

1. **Open a folder.** It doesn't need to be built: without a `compile_commands.json`, SkyCodeX writes one into its own data folder, never into your project.
2. **Pick a program** from the list, or let SkyCodeX open the likely one. Backspace goes back to the list.
3. **Read the run.** **Tab** switches sequence and boxes, **Space** plays, and the step buttons (or the keyboard) move one call at a time.

| Key | Does |
|---|---|
| Tab | Switch sequence ↔ boxes, keeping your place |
| Space | Play / pause the run |
| ⇧-click two functions | Every route between them |
| D / ⇧D | More code for this function / everywhere |
| A | Focus on the current step and its neighbours |
| M | Magnifier |
| ⌘/Ctrl-click | Go to definition |
| ⌘/Ctrl ⇧ F | Search the whole folder |
| F2 | Rename |
| ⌘/Ctrl . | Fixes and refactorings |

**Refresh** (bottom right) re-reads every file and rebuilds the picture. The **compiler** button (bottom left) chooses the clangd and installs language packs.

## Build from source

Needs Node.js 22+.

```bash
npm install
node node_modules/electron/install.js   # the Electron binary
npm run fetch-clangd                    # the inbuilt clangd, checked against its pinned SHA-256
npm start
```

- **Tests:** `npm test` runs the unit and integration tests.
- **Smoke run:** `npm run smoke` drives the real app on `samples/tinyhttp`. Add `-- --scenario <name>` to run one scenario (for example `boot`, `large`, `repair`); they're all listed in `src/renderer/smoke.ts`.

### Making a release

```bash
npm run package    # builds and packs release/SkyCodeX-<version>-<os>-<arch> for this system
```

- **macOS:** built on a Mac, signed ad hoc, zipped.
- **Windows and Linux:** built by GitHub Actions on each system when a `v…` tag is pushed ([`release.yml`](.github/workflows/release.yml)). Each build is started once with a boot check before it's attached to the release.

## Project layout

| Path | Contents |
|---|---|
| `src/main/` | Electron main process: files, settings, clangd, language packs |
| `src/renderer/` | The interface (Solid + CodeMirror): flow, previews, editor |
| `src/shared/` | The flow engine and its analyses, the repair engine |
| `src/tests/`, `samples/` | Tests and the sample projects they use |
| `docs/` | Flow design, roadmap, architecture |

## Licence

The SkyCodeX License: MIT, with three conditions that come first.

- **No selling** SkyCodeX, or paid products based on it. Using it for paid work is fine.
- **Credit:** copies show *Based on SkyCodeX by Jatin Aggarwal*, and changed versions say they're changed.
- **Name:** changed versions use another name.

SkyCodeX is source-available, not open source. Bundled third-party parts keep their own licences ([THIRD_PARTY.md](THIRD_PARTY.md)).
