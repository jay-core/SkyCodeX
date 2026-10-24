# Lithograph

A portable, offline code editor for C and C++ — charcoal, borderless, Metro-style, built for reading and understanding code as much as writing it.

Copyright (c) 2026 Jatin Aggarwal. All rights reserved except as granted in [LICENSE](LICENSE).

## Status

Design phase. The full design is in [ARCHITECTURE.md](ARCHITECTURE.md); concept images and animations are in [`concepts/`](concepts/).

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
| `fonts/` | ARX F1 (code) and Selawik (interface), each under its own licence |
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
