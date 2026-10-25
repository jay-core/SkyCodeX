// Help pages, written for the person using Lithograph. F1 opens the page for whatever is under the pointer.
// Markup: "# " a heading, "- " a list item, "|a|b" a two-column row, `x` a key or a name; anything else is a paragraph.
export interface HelpTopic { id: string; title: string; words: string; body: string }

const mac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');
const M = mac ? '⌘' : 'Ctrl', S = mac ? '⇧' : 'Shift', A = mac ? '⌥' : 'Alt';

export const HELP: HelpTopic[] = [
  {
    id: 'start', title: 'getting started', words: 'open folder project begin first files tabs',
    body: `
Lithograph is a code editor for C and C++ that runs entirely from its own folder. It needs no installation and no internet connection.
# open your code
- Open a folder with \`${M} O\`. Its files are listed on the right.
- Click a file to open it. Open files appear as tabs along the top.
- \`${M} P\` finds any file in the folder by typing part of its name.
# the four places
- **editor**: your code, with the preview panes beside it.
- **flow**: how the program runs, from \`main\` onwards, one box per file.
- **memory**: what the built program puts in RAM and in storage.
- **terminal**: your own shell, at the bottom (\`⌃ {bq}\`).
The bar at the bottom left holds options, settings, the terminal, the compiler window and the preview switch.
# nothing is lost
Unsaved changes are copied into Lithograph's data folder as you type. If the computer stops suddenly, they are there the next time you open Lithograph.`,
  },
  {
    id: 'editor', title: 'editing', words: 'complete error hover definition rename fix references find symbol save',
    body: `
The language engine (clangd) reads your code as you type and checks it.
# while you type
- Suggestions appear as you type. \`Enter\` or \`Tab\` accepts one.
- Errors and warnings are underlined. Hover over one to read it.
- Hover over a name to see what it is and where it comes from.
# moving around
- \`${M}\`-click a name to go to where it is defined.
- \`${M} T\` finds any function, class or variable in the project.
- \`${S} F12\` lists every place a name is used.
- \`${M} F\` searches in the current file.
# changing code
- \`F2\` renames a name everywhere it is used. The changed files stay unsaved so you can check them first.
- \`${M} .\` offers fixes for the error under the cursor, plus refactorings such as extracting a function.
- \`${M} S\` saves, and \`${M} ${A} S\` saves every open file.
# everything else
\`${M} ${S} P\` lists every command, with its keys.`,
  },
  {
    id: 'preview', title: 'preview panes', words: 'cards calls thin column squares highlight std macro lambda pane connector',
    body: `
The preview panes show what the code at your cursor calls, as cards you can read without leaving your place.
# pane 1
- Put the cursor inside a function. Every function it calls appears as a card, in the order of the calls.
- A coloured line joins each call in your code to its card. The thin column of squares on the left of the pane holds one square per card, in the same colour.
- Hover over a square to see the function's name. Click it to scroll to the card. The highlight stays until you click somewhere else.
- Put the cursor on a call and its square, card and line light up.
# pane 2
Click inside a card in pane 1 and pane 2 shows what that function calls, with its own thin column. The cursor in your code stays where it was.
# other call-like things
After the functions, below a faint divider, come things that look like calls but are not ordinary functions: \`static_assert\`, macros, lambdas and calls through pointers. **hide non-functions** hides them.
# standard library
Calls into the standard library show as cards too, taken from the library's own headers. **hide std calls** hides them.
# layout
- Drag the edges between the panes to resize them.
- Scroll a card sideways to read long lines.
- **hide preview** in the bottom bar (\`${M} ${S} E\`) hides both panes.`,
  },
  {
    id: 'flow', title: 'flow view', words: 'flow boxes arrows main order loop thread pin group folder zoom',
    body: `
The flow view follows your program from \`main\` and draws each file it reaches as a box.
# reading it
- Numbers show the order in which functions run: 1 runs first, then 2, and so on.
- Arrows join files that call each other, labelled with the numbers that cross them.
- **↻** marks numbers that repeat inside a loop.
- Dashed arrows start a new thread. Those numbers start with **t**.
- With more than one \`main\`, each gets a letter: A1, A2… B1…
- Grey boxes at the bottom are files no \`main\` reaches.
# working with it
- Click a box to see its functions as cards, in the order they run.
- Drag a box to move it. It stays where you put it, marked **pinned**. Click **pinned ×** to let the layout place it again, or **unpin all** for every box.
- **group by folder** draws a frame around the files of each folder.
- Drag the background to pan. ${M} + scroll zooms. **fit** brings everything into view.`,
  },
  {
    id: 'memory', title: 'memory view', words: 'ram flash storage binary size section symbol stack',
    body: `
The memory view shows what your built program puts in memory, read from the program file itself.
# using it
- Build your program, then open **memory**. Lithograph finds the newest program in the folder, or you can pick one.
- **storage** holds what is saved in the program file: code and fixed data.
- **RAM** holds what exists while it runs: variables, plus the stack when the build records stack sizes (\`-fstack-usage\`).
- Hover over a part to see what it is, its size and the line of source it comes from.
- Click a part to go to that exact line.`,
  },
  {
    id: 'terminal', title: 'terminal', words: 'shell terminal path command console',
    body: `
The terminal at the bottom is your usual shell, started in the open folder. \`⌃ {bq}\` shows or hides it.
- The shell is chosen in settings (**terminal shell**). It starts with your own start-up files.
- Toolchains installed from the compiler window come first on PATH, **in Lithograph's terminals only**. Your other terminals and your system settings are never changed.
- Font, size, weights and line height have their own settings.`,
  },
  {
    id: 'compiler', title: 'compiler and language packs', words: 'clang clangd toolchain pack install update remove language rust python go',
    body: `
The compiler window (**compiler** in the bottom bar) chooses the language engine and installs toolchains.
# language engine
- Lithograph carries its own clangd, marked **inbuilt**. It works with nothing else installed.
- **automatic** uses the newest clangd it finds: a pack, the inbuilt one, or one on your system.
- **check for clangd updates** lists newer versions to install as packs.
# language packs
- A pack is a compiler, language server or reference installed into the \`language_packs\` folder beside Lithograph.
- Installing downloads an official release, checks its published checksum, and unpacks it inside that folder. Nothing is installed anywhere else, and no system setting or environment variable changes.
- Every download is listed with its size and source before it starts, and can be cancelled.
- **update to …** installs the newer version beside the old one, then removes the old one.
- **remove** deletes a pack's folder and nothing else.
- Packs are available for C and C++ (clang), Rust, Python and Go, plus the offline C++ reference. Python and Go builds publish their checksums on go.dev and GitHub, and Pyright's on the npm registry. The C++ reference publishes none, so it installs from a file you download yourself.`,
  },
  {
    id: 'languages', title: 'other languages', words: 'rust python go cmake json yaml markdown syntax engine analyzer pyright gopls',
    body: `
Lithograph is made for C and C++, and also reads other languages.
# colouring, built in
Rust, Python, Go, CMake, JSON, YAML and Markdown files are coloured with no setup.
# language engines, from packs
- **Rust:** rust-analyzer. Install the **Rust** pack for the compiler and Cargo, and the **rust-analyzer** pack for the engine.
- **Python:** Pyright, run by the Node.js inside Lithograph. The **Python** pack gives a full interpreter with pip, and Pyright uses it.
- **Go:** the **Go** pack. It builds gopls, Go's engine, while it installs.
- An engine found on the system is used when no pack is installed.
# staying inside the folder
In Lithograph's terminals, Cargo's registry (\`CARGO_HOME\`), Go's modules and caches (\`GOPATH\`, \`GOMODCACHE\`, \`GOCACHE\`) and pip's cache all point inside their packs. Go never downloads another Go by itself (\`GOTOOLCHAIN=local\`). Your own shell settings outside Lithograph are not changed.`,
  },
  {
    id: 'tools', title: 'tools', words: 'template new project todo fixme format clang-format style reference cppreference spelling spell',
    body: `
# new project
**new project…** (options menu or command palette) makes a small project you can build at once: a C++ or C console program, CMake with a library and tests, Rust, Python or Go. A folder that already exists is never overwritten.
# to-do list
**to-do list** collects \`TODO\`, \`FIXME\`, \`HACK\`, \`XXX\` and \`BUG\` notes from comments in every source file, including unsaved changes. Click a note to go to it. The words are set in **editor todo words**.
# formatting and code style
- \`${S} ${A} F\` formats the file with the language engine.
- **code style** edits the project's \`.clang-format\`. Pick options and a sample is re-formatted as you go. Nothing is written until **save to the project**, and lines it does not manage are kept.
# C++ reference
Install the reference pack from the compiler window, from the \`html-book-….zip\` you download from github.com/PeterFeicht/cppreference-doc. Then \`${S} F1\` on a name such as \`std::vector\` opens its page beside the code. The pages run no scripts and never reach the network.
# spelling
Words in comments, strings and Markdown are checked by the system's own spelling checker. Misspelt words get a wavy underline. Right-click one for suggestions, or to ignore it from then on. **editor spellcheck** turns this off.`,
  },
  {
    id: 'checks', title: 'checks and profile', words: 'sanitizer address thread race leak undefined behaviour profile coverage counts run',
    body: `
**run with checks** builds the open folder with the compiler's built-in checks, runs it once, and lists what went wrong, linked to your source.
- **memory:** use after free, buffer overflows and leaks (AddressSanitizer).
- **threads:** data races and lock-order problems (ThreadSanitizer).
- **undefined behaviour:** overflow, bad shifts, null use (UBSan).
- **profile:** how many times each function and line ran. Lines are shaded in the editor with counts in the margin. These are counts, not time.
# how it builds
It builds in Lithograph's own state folder, never in your project, with the toolchain pack in use or the system's clang. It builds simple projects: one program, its sources outside \`tests/\` and build folders, plus \`compile_flags.txt\` if there is one. For other builds, the window shows the flags to add to your own.
The program runs for at most 60 seconds.`,
  },
  {
    id: 'interface', title: 'interface and access', words: 'language translation scale zoom contrast keyboard screen reader motion battery power touch pen',
    body: `
Under settings → **interface**:
- **ui language:** English, हिन्दी, Español, Français, Deutsch, Português, 日本語 or 简体中文. **auto** follows the system. Help pages stay in English for now.
- **ui scale** makes the whole interface larger or smaller.
- **ui high contrast** gives brighter text and borders.
- **power saver:** on **auto**, Lithograph turns animations off and spaces out background work while on battery. The status bar shows **battery saver** when it is on.
# keyboard and screen readers
- \`Tab\` moves through buttons. The focused one gets a ring. Squares in the thin columns and boxes in the flow view take \`Enter\` too.
- Buttons, dialogs and status messages are labelled for screen readers.
- The system's reduced-motion setting is followed, as well as **motion reduce**.
# touch and pen
Dividers, the flow view (pinch to zoom) and every window can be used with a finger or a pen. Targets grow on touch screens.`,
  },
  {
    id: 'problems', title: 'problem reports', words: 'crash report bug log problem',
    body: `
**write a problem report** (help menu or command palette) collects what someone helping you needs: versions, system, settings, the end of Lithograph's log and a list of crash dumps.
- It is saved in \`data/logs\` and opened for you to read. **Nothing is sent anywhere.**
- Your home folder is shortened to \`~\` and your account name is removed.
- Crash dumps stay in \`data/logs/crashes\`. Share them only if asked.`,
  },
  {
    id: 'settings', title: 'settings', words: 'settings toml font weight line height theme motion',
    body: `
Settings (\`${M} ,\`) are saved in \`settings.toml\` in Lithograph's data folder. You can edit that file too, and changes apply as soon as it is saved.
- Fonts can be any font installed on the computer. The code font is ArX F1 unless you change it.
- Each font has its own weight and line height for the editor and the terminal.
- **motion reduce** turns off movement in the interface.
- **reset** beside a setting puts its default back.`,
  },
  {
    id: 'portable', title: 'where things are kept', words: 'portable data folder state packs usb',
    body: `
Everything Lithograph keeps is beside the app, so the folder can move to another drive or computer.
|\`data/settings.toml\`|your settings
|\`data/state\`|open files, unsaved changes, window layout
|\`language_packs\`|toolchains and other packs you installed
|\`tools/clangd\`|the inbuilt language engine
If the app's folder can't be written (for example, on a read-only drive), Lithograph tells you and uses your user data folder instead.`,
  },
  {
    id: 'keys', title: 'keyboard', words: 'keys shortcuts keyboard',
    body: `
|\`F1\`|help for what is under the pointer
|\`${S} F1\`|C++ reference for the name under the cursor
|\`${S} ${A} F\`|format the file
|\`${M} O\`|open a folder
|\`${M} ${S} O\`|open a file
|\`${M} N\`|new file
|\`${M} S\`|save
|\`${M} ${A} S\`|save all
|\`${M} W\`|close the file
|\`${M} P\`|find a file
|\`${M} T\`|find a symbol
|\`${M} ${S} P\`|every command
|\`F2\`|rename
|\`${M} .\`|fixes and refactorings
|\`${S} F12\`|find references
|\`${M} F\`|search in the file
|\`${M} ,\`|settings
|\`⌃ {bq}\`|show or hide the terminal
|\`${M} ${S} E\`|show or hide the preview panes`,
  },
];

/** Topics whose title, words or text contain every word typed. */
export function searchHelp(q: string): HelpTopic[] {
  const ws = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!ws.length) return HELP;
  return HELP
    .map((t) => ({ t, hay: `${t.title} ${t.words} ${t.body}`.toLowerCase(), head: `${t.title} ${t.words}`.toLowerCase() }))
    .filter((x) => ws.every((w) => x.hay.includes(w)))
    .sort((a, b) => ws.filter((w) => b.head.includes(w)).length - ws.filter((w) => a.head.includes(w)).length)
    .map((x) => x.t);
}

export type HelpBlock = { k: 'h' | 'p' | 'li'; text: string } | { k: 'row'; a: string; b: string };
export function parseHelp(body: string): HelpBlock[] {
  return body.trim().split('\n').filter((l) => l.trim()).map((l): HelpBlock => {
    if (l.startsWith('# ')) return { k: 'h', text: l.slice(2) };
    if (l.startsWith('- ')) return { k: 'li', text: l.slice(2) };
    if (l.startsWith('|')) { const [, a, b] = l.split('|'); return { k: 'row', a, b: b ?? '' }; }
    return { k: 'p', text: l };
  });
}

/** Inline pieces: `code` and **strong**. */
export function inline(text: string): { k: 'code' | 'b' | 't'; s: string }[] {
  const out: { k: 'code' | 'b' | 't'; s: string }[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) out.push({ k: 't', s: text.slice(at, m.index) });
    out.push(m[1] !== undefined ? { k: 'code', s: m[1].replace(/\{bq\}/g, '`') } : { k: 'b', s: m[2] });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ k: 't', s: text.slice(at) });
  return out;
}

/** The help page for a place in the window, found from the nearest element marked data-help. */
export function topicFor(el: Element | null): string {
  return (el?.closest('[data-help]') as HTMLElement | null)?.dataset.help ?? 'start';
}
