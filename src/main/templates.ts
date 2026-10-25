// New projects from a template: a handful of small, buildable starting points. Nothing is overwritten.
import fs from 'node:fs';
import path from 'node:path';

export interface Template { id: string; title: string; note: string; files: (name: string) => Record<string, string> }

const ident = (name: string) => name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'app';
const gitignore = (extra: string[] = []) => ['build/', '.cache/', ...extra].join('\n') + '\n';

export const TEMPLATES: Template[] = [
  {
    id: 'cpp-console', title: 'C++ console program', note: 'one main.cpp · build with one command, no build system',
    files: (name) => ({
      'main.cpp': `#include <iostream>\n#include <string>\n\nint main(int argc, char** argv) {\n    std::string who = argc > 1 ? argv[1] : "world";\n    std::cout << "Hello, " << who << "!\\n";\n    return 0;\n}\n`,
      'compile_flags.txt': '-std=c++20\n-Wall\n-Wextra\n',
      'README.md': `# ${name}\n\nBuild and run in Lithograph's terminal:\n\n    c++ -std=c++20 -Wall -Wextra -g main.cpp -o ${ident(name)}\n    ./${ident(name)}\n`,
      '.gitignore': gitignore([ident(name), `${ident(name)}.exe`]),
    }),
  },
  {
    id: 'c-console', title: 'C console program', note: 'one main.c',
    files: (name) => ({
      'main.c': `#include <stdio.h>\n\nint main(int argc, char **argv) {\n    const char *who = argc > 1 ? argv[1] : "world";\n    printf("Hello, %s!\\n", who);\n    return 0;\n}\n`,
      'compile_flags.txt': '-std=c17\n-Wall\n-Wextra\n',
      'README.md': `# ${name}\n\n    cc -std=c17 -Wall -Wextra -g main.c -o ${ident(name)}\n    ./${ident(name)}\n`,
      '.gitignore': gitignore([ident(name), `${ident(name)}.exe`]),
    }),
  },
  {
    id: 'cmake', title: 'CMake: program, library and tests', note: 'src/, include/, tests/ · compile_commands.json for clangd',
    files: (name) => {
      const id = ident(name);
      return {
        'CMakeLists.txt': `cmake_minimum_required(VERSION 3.20)\nproject(${id} LANGUAGES CXX)\n\nset(CMAKE_CXX_STANDARD 20)\nset(CMAKE_CXX_STANDARD_REQUIRED ON)\nset(CMAKE_EXPORT_COMPILE_COMMANDS ON)   # lets Lithograph's language engine see the build settings\n\nadd_library(${id}_core src/greet.cpp)\ntarget_include_directories(${id}_core PUBLIC include)\n\nadd_executable(${id} src/main.cpp)\ntarget_link_libraries(${id} PRIVATE ${id}_core)\n\nenable_testing()\nadd_executable(${id}_tests tests/test_greet.cpp)\ntarget_link_libraries(${id}_tests PRIVATE ${id}_core)\nadd_test(NAME greet COMMAND ${id}_tests)\n`,
        'include/greet.hpp': `#pragma once\n#include <string>\n\n/// A greeting for \`who\`.\nstd::string greet(const std::string& who);\n`,
        'src/greet.cpp': `#include "greet.hpp"\n\nstd::string greet(const std::string& who) {\n    return "Hello, " + who + "!";\n}\n`,
        'src/main.cpp': `#include <iostream>\n#include "greet.hpp"\n\nint main(int argc, char** argv) {\n    std::cout << greet(argc > 1 ? argv[1] : "world") << '\\n';\n}\n`,
        'tests/test_greet.cpp': `#include <cstdio>\n#include "greet.hpp"\n\nint main() {\n    if (greet("test") != "Hello, test!") { std::puts("greet: wrong text"); return 1; }\n    std::puts("all tests passed");\n    return 0;\n}\n`,
        'README.md': `# ${name}\n\n    cmake -S . -B build\n    cmake --build build\n    ./build/${id}\n    ctest --test-dir build\n`,
        '.gitignore': gitignore(),
      };
    },
  },
  {
    id: 'rust', title: 'Rust program (Cargo)', note: 'needs the Rust pack, or Rust on this computer',
    files: (name) => ({
      'Cargo.toml': `[package]\nname = "${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`,
      'src/main.rs': `fn main() {\n    let who = std::env::args().nth(1).unwrap_or_else(|| "world".to_string());\n    println!("Hello, {who}!");\n}\n`,
      '.gitignore': '/target\n',
    }),
  },
  {
    id: 'python', title: 'Python program', note: 'needs the Python pack, or Python on this computer',
    files: (name) => ({
      'main.py': `import sys\n\n\ndef greet(who: str) -> str:\n    return f"Hello, {who}!"\n\n\nif __name__ == "__main__":\n    print(greet(sys.argv[1] if len(sys.argv) > 1 else "world"))\n`,
      'README.md': `# ${name}\n\n    python3 main.py\n`,
      '.gitignore': '__pycache__/\n.venv/\n',
    }),
  },
  {
    id: 'go', title: 'Go module', note: 'needs the Go pack, or Go on this computer',
    files: (name) => ({
      'go.mod': `module ${name.toLowerCase().replace(/[^a-z0-9._/-]/g, '-')}\n\ngo 1.22\n`,
      'main.go': `package main\n\nimport (\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\twho := "world"\n\tif len(os.Args) > 1 {\n\t\twho = os.Args[1]\n\t}\n\tfmt.Printf("Hello, %s!\\n", who)\n}\n`,
      '.gitignore': `/${ident(name)}\n`,
    }),
  },
];

/** Creates parent/name from a template. Refuses a name that already exists, so nothing is ever overwritten. */
export function createProject(parent: string, name: string, id: string): { ok: true; dir: string; open: string } | { ok: false; message: string } {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return { ok: false, message: 'no such template' };
  const clean = name.trim();
  if (!clean || /[\\/:*?"<>|]/.test(clean) || clean === '.' || clean === '..') return { ok: false, message: 'choose a folder name without / \\ : * ? " < > |' };
  const dir = path.join(parent, clean);
  if (fs.existsSync(dir)) return { ok: false, message: `${dir} already exists` };
  const files = t.files(clean);
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, { flag: 'wx' });
  }
  const open = Object.keys(files).find((f) => /(^|\/)main\.(cpp|c|rs|py|go)$/.test(f)) ?? Object.keys(files)[0];
  return { ok: true, dir, open: path.join(dir, open) };
}
