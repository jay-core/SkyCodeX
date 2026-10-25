# Third-party software

## clangd (LLVM)

SkyCodeX ships the official clangd release (`npm run fetch-clangd` places it in `tools/clangd/`) as its inbuilt C/C++ language engine.
clangd is part of the LLVM Project and is licensed under the **Apache License v2.0 with LLVM Exceptions**; its full licence text
travels with the binary as `tools/clangd/LICENSE.TXT`. See https://llvm.org/LICENSE.txt.

## Fonts

- **ArX F1** (the code font, embedded) — SIL Open Font License 1.1, as stated in the fonts' own copyright and licence fields. Licence text: `assets/fonts/ArXF1/OFL.txt`.
- **Selawik** (the interface font) — SIL Open Font License 1.1, see `assets/fonts/Selawik/LICENSE.txt`.

The fonts stay under the OFL, separately from SkyCodeX's own licence. They may be embedded and redistributed with SkyCodeX, but not sold on their own.

## Syntax colouring

CodeMirror and its Lezer grammars (`@codemirror/*`, `@lezer/*`) are MIT licensed. Their licence notices are kept in the bundled code.

## Language packs and the C++ reference

Packs installed from the compiler window keep their own licence files inside their folder in `language_packs/`:
- Rust: MIT / Apache-2.0
- Python: PSF License
- Go: BSD-3-Clause
- Pyright: MIT
- rust-analyzer: MIT / Apache-2.0
- the C++ reference (cppreference.com): CC-BY-SA 3.0 and GFDL

None of these are part of SkyCodeX itself.
