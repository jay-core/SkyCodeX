// The single source of truth for every setting: its default, type, limits and the
// comment written into settings.toml. The settings page and the file are generated from it.

import { isColor } from './color';

export type SettingType = 'string' | 'number' | 'boolean' | 'enum' | 'string[]' | 'color';

export interface SettingDef {
  key: string;            // "section.name"
  type: SettingType;
  default: unknown;
  doc: string;
  min?: number;
  max?: number;
  values?: string[];      // for enums
  unit?: string;          // shown beside a number
  css?: string;           // colours: the CSS variable it sets
  label?: string;         // the name on the settings page, when the key's own name is not clear enough
}

export const SECTIONS: { name: string; doc: string }[] = [
  { name: 'font', doc: 'Code font. Every installed font can be used.' },
  { name: 'font.ui', doc: 'Interface font.' },
  { name: 'font.preview', doc: 'Preview panes inherit the code font, then apply these.' },
  { name: 'theme', doc: 'Appearance.' },
  { name: 'ui', doc: 'Accessibility.' },
  { name: 'editor', doc: 'Editing behaviour.' },
  { name: 'preview', doc: 'Preview panes.' },
  { name: 'window', doc: 'Window frame.' },
  { name: 'clangd', doc: 'C/C++ language engine.' },
  { name: 'compiler', doc: 'Toolchains, the compiler the code is read as, and language packs (the compiler window).' },
  { name: 'motion', doc: 'Animation.' },
  { name: 'colors.editor', doc: 'Colours of the whole window: backgrounds, text, gutter, selection.' },
  { name: 'colors.code', doc: 'Colours of code, in the editor and in every preview card.' },
  { name: 'colors.diagnostics', doc: 'Errors, warnings and notes from clangd.' },
  { name: 'colors.cards', doc: 'Preview cards take these in turn; each call is outlined in its card’s colour.' },
  { name: 'colors.flow', doc: 'The flow views: the step you are on, repetition, risk.' },
  { name: 'power', doc: 'Running on battery.' },
];

export const SETTINGS: SettingDef[] = [
  { key: 'font.family', type: 'string', default: 'ArX F1', doc: 'any installed font' },
  { key: 'font.size', type: 'number', default: 13, min: 6, max: 72, doc: 'code text size', unit: 'px' },
  { key: 'font.letter_spacing', type: 'number', default: 0, min: -2, max: 6, doc: 'space between letters', unit: 'px' },
  { key: 'font.weight', type: 'number', default: 400, min: 100, max: 900, doc: 'code text weight' },
  { key: 'font.line_height', type: 'number', default: 1.6, min: 1, max: 3, doc: 'line height', unit: '× size' },
  { key: 'font.ligatures', type: 'boolean', default: false, doc: 'true | false' },
  { key: 'font.ui.family', type: 'string', default: 'Selawik', doc: 'interface text' },
  { key: 'font.preview.scale', type: 'number', default: 0.9, min: 0.5, max: 1.5, doc: 'preview text size', unit: '× code size' },
  { key: 'theme.name', type: 'enum', default: 'charcoal', values: ['charcoal'], doc: 'charcoal' },
  { key: 'ui.scale', type: 'number', default: 1, min: 0.75, max: 2, doc: 'size of the whole interface', unit: '×' },
  { key: 'ui.high_contrast', type: 'boolean', default: false, doc: 'brighter text and borders' },
  { key: 'theme.focus_dimming', type: 'boolean', default: true, doc: 'fade code outside the current function' },
  { key: 'editor.tab_size', type: 'number', default: 4, min: 1, max: 16, doc: 'indent width', unit: 'spaces' },
  { key: 'editor.word_wrap', type: 'boolean', default: false, doc: 'true | false' },
  { key: 'editor.autosave', type: 'enum', default: 'off', values: ['off', 'focus', 'delay'], doc: 'focus saves when you leave the window; delay saves after a pause' },
  { key: 'editor.autosave_delay_ms', type: 'number', default: 1000, min: 200, max: 60000, doc: 'for autosave = "delay"', unit: 'ms' },
  { key: 'preview.enabled', type: 'boolean', default: true, doc: 'true | false' },
  { key: 'preview.include_std', type: 'boolean', default: true, doc: 'show standard-library and system calls' },
  { key: 'preview.include_other', type: 'boolean', default: true, doc: 'after the functions: macros, static_assert, lambdas and calls through pointers' },
  { key: 'preview.max_cards', type: 'number', default: 12, min: 1, max: 100, doc: 'per level; the rest fold into "+N more"', unit: 'cards' },
  { key: 'window.chrome', type: 'enum', default: 'minimal', values: ['minimal', 'native'], doc: 'native uses the system title bar · restart to apply' },
  { key: 'clangd.path', type: 'string', default: 'auto', doc: '"auto" (inbuilt, else the system\'s), "inbuilt", "system", "pack:<id>" or a path' },
  { key: 'compiler.toolchain', type: 'string', default: 'auto', doc: 'its standard headers are indexed with the project: "auto" (newest pack), "none" or a pack id' },
  { key: 'compiler.read_as', type: 'enum', default: 'clang', values: ['clang', 'gcc', 'msvc'], doc: 'the compiler the code is read as, with its headers and macros: "gcc" asks g++, "msvc" uses Visual Studio\'s cl.exe · a project\'s own compile_commands.json keeps its compilers' },
  { key: 'compiler.path', type: 'string', default: '', doc: 'the g++ or cl.exe to read as; empty finds one' },
  { key: 'clangd.args', type: 'string[]', default: [], doc: 'extra arguments, e.g. ["--clang-tidy"]' },
  { key: 'motion.reduce', type: 'boolean', default: false, doc: 'true turns animations into instant changes' },
  ...colors(),
  { key: 'power.saver', type: 'enum', default: 'auto', values: ['auto', 'always', 'never'], doc: '"auto" calms animations and background work while on battery' },
];

/** The colour settings, with the CSS variable each one sets. The defaults are the charcoal theme (styles.css :root). */
function colors(): SettingDef[] {
  const c = (key: string, css: string, def: string, doc: string, label?: string): SettingDef => ({ key: `colors.${key}`, type: 'color', default: def, doc, css, label });
  return [
    c('editor.background', '--bg', '#171817', 'the editor and the page behind everything'),
    c('editor.side', '--side', '#141514', 'the files pane'),
    c('editor.preview', '--prev', '#151615', 'the preview panes'),
    c('editor.card', '--card', '#1b1c1b', 'a preview card'),
    c('editor.card_focused', '--card-hi', '#1e1f1e', 'the card holding the preview cursor', 'focused card'),
    c('editor.popup', '--pop', '#202220', 'menus, lists, tooltips'),
    c('editor.text', '--fg', '#9ea39b', 'most text'),
    c('editor.text_bright', '--bright', '#a3a8a0', 'titles and the text that matters most', 'bright text'),
    c('editor.text_dim', '--dim', '#5f665f', 'secondary text', 'dim text'),
    c('editor.text_faint', '--faint', '#3f453f', 'hints and quiet labels', 'faint text'),
    c('editor.text_ghost', '--ghost', '#2f332f', 'empty-state text, the quietest', 'ghost text'),
    c('editor.gutter', '--gut', '#373b37', 'line numbers'),
    c('editor.selection', '--sel', '#73969642', 'selected text (the last two digits are its transparency)'),
    c('editor.accent', '--accent', '#ad9b6f', 'the cursor, focus and active controls'),
    c('editor.link', '--link', '#7fa3a3', 'links'),
    c('code.keyword', '--kw', '#739696', 'if, for, return, class, …'),
    c('code.function', '--fn', '#ad9b6f', 'function and macro names'),
    c('code.type', '--ty', '#7f9e82', 'types and classes'),
    c('code.variable', '--var', '#a8929e', 'variables, numbers, true and false'),
    c('code.parameter', '--par', '#b0857a', 'parameters'),
    c('code.string', '--str', '#ab9070', 'strings and characters'),
    c('code.comment', '--cm', '#5f665f', 'comments'),
    c('diagnostics.error', '--err', '#b8766b', 'errors'),
    c('diagnostics.warning', '--warn', '#ab9070', 'warnings'),
    c('diagnostics.info', '--info', '#739696', 'notes and hints'),
    ...['#86a8e7', '#79c9ae', '#bc9fe6', '#d4c26a', '#6fc0dc', '#a6cf82', '#e2dccb', '#9c96f0'].map((d, i) => c(`cards.card_${i + 1}`, '', d, `card ${i + 1}, ${i + 9}, … and its calls' outlines and connectors`, `card ${i + 1}`)),
    c('flow.now', '--flow-now', '#ad9b6f', 'the step you are on'),
    c('flow.repetition', '--flow-rep', '#6f9e9e', 'loops and passes'),
    c('flow.risk', '--flow-risk', '#b8605a', 'races and other risks'),
    c('flow.return', '--flow-return', '#62d6ff', 'the line drawn back to the caller when a call returns'),
  ];
}

/** Settings of features that were removed: still found in older settings.toml files, and skipped without a warning. */
export const RETIRED = /^(terminal\.|memory\.)|^(ui\.language|editor\.spellcheck|editor\.todo_words)$/;

export type Settings = Record<string, unknown>;

export function defaults(): Settings {
  const s: Settings = {};
  for (const d of SETTINGS) s[d.key] = structuredClone(d.default);
  return s;
}

function tomlValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => JSON.stringify(x)).join(', ') + ']';
  return String(v);
}

/** The settings.toml written on first run: every option, with its default and a comment. */
export function defaultFileText(): string {
  const lines = [
    '# SkyCodeX settings — save to apply. Delete a line to get its default back.',
    '# Every option is listed here with its default value.',
  ];
  for (const sec of SECTIONS) {
    const defs = SETTINGS.filter((d) => d.key.slice(0, d.key.lastIndexOf('.')) === sec.name);
    if (!defs.length) continue;
    lines.push('', `[${sec.name}]`.padEnd(36) + `# ${sec.doc}`);
    for (const d of defs) {
      const name = d.key.slice(d.key.lastIndexOf('.') + 1);
      lines.push(`${name.padEnd(18)}= ${tomlValue(d.default).padEnd(14)} # ${d.doc}`);
    }
  }
  return lines.join('\n') + '\n';
}

export interface SettingProblem {
  key: string;
  line: number;           // 1-based, 0 when unknown
  message: string;
}

/** Validates one raw value; returns the accepted value or a problem message. */
export function validate(def: SettingDef, raw: unknown): { ok: true; value: unknown } | { ok: false; message: string } {
  switch (def.type) {
    case 'string':
      return typeof raw === 'string' ? { ok: true, value: raw } : { ok: false, message: 'must be text in quotes' };
    case 'boolean':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, message: 'must be true or false' };
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, message: 'must be a number' };
      if ((def.min !== undefined && raw < def.min) || (def.max !== undefined && raw > def.max))
        return { ok: false, message: `must be ${def.min}–${def.max}` };
      return { ok: true, value: raw };
    }
    case 'enum':
      return typeof raw === 'string' && def.values!.includes(raw)
        ? { ok: true, value: raw }
        : { ok: false, message: `must be one of: ${def.values!.join(', ')}` };
    case 'color':
      return isColor(raw) ? { ok: true, value: raw.toLowerCase() } : { ok: false, message: 'must be a colour like "#ad9b6f" (or "#ad9b6f80" with transparency)' };
    case 'string[]':
      return Array.isArray(raw) && raw.every((x) => typeof x === 'string')
        ? { ok: true, value: raw }
        : { ok: false, message: 'must be a list of quoted strings' };
  }
}
