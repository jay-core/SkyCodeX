# Third-party software

## clangd (LLVM)

Lithograph ships the official clangd release (`npm run fetch-clangd` places it in `tools/clangd/`) as its inbuilt C/C++ language engine.
clangd is part of the LLVM Project and is licensed under the **Apache License v2.0 with LLVM Exceptions**; its full licence text
travels with the binary as `tools/clangd/LICENSE.TXT`. See https://llvm.org/LICENSE.txt.

Toolchains installed from the compiler window keep their own licence files inside their folder in `language_packs/`.

## Fonts

- Selawik — SIL Open Font License, see `fonts/Selawik/LICENSE.txt`.
- ArX F1 — no licence file came with these fonts. The earlier ARX F1 builds were derived from Audi Type, whose licence allows private use only; confirm ArX F1's terms before sharing Lithograph with it.
