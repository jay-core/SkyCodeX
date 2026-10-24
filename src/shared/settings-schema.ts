// The single source of truth for every setting: its default, type, limits and the
// comment written into settings.toml. The settings page and the file are generated from it.

export type SettingType = 'string' | 'number' | 'boolean' | 'enum' | 'string[]';

export interface SettingDef {
  key: string;            // "section.name"
  type: SettingType;
  default: unknown;
  doc: string;
  min?: number;
  max?: number;
  values?: string[];      // for enums
}

export const SECTIONS: { name: string; doc: string }[] = [
  { name: 'font', doc: 'Code font. Every installed font can be used.' },
  { name: 'font.ui', doc: 'Interface font.' },
  { name: 'font.preview', doc: 'Preview panes inherit the code font, then apply these.' },
  { name: 'theme', doc: 'Appearance.' },
  { name: 'editor', doc: 'Editing behaviour.' },
  { name: 'preview', doc: 'Preview panes.' },
  { name: 'window', doc: 'Window frame.' },
  { name: 'clangd', doc: 'C/C++ language engine.' },
  { name: 'terminal', doc: 'Integrated terminal.' },
  { name: 'memory', doc: 'Memory view budgets (0 = no budget).' },
  { name: 'motion', doc: 'Animation.' },
];

export const SETTINGS: SettingDef[] = [
  { key: 'font.family', type: 'string', default: 'ARX F1', doc: 'any installed font' },
  { key: 'font.size', type: 'number', default: 13, min: 6, max: 72, doc: 'pt' },
  { key: 'font.letter_spacing', type: 'number', default: 0, min: -2, max: 6, doc: 'px' },
  { key: 'font.line_height', type: 'number', default: 1.6, min: 1, max: 3, doc: '× size' },
  { key: 'font.ligatures', type: 'boolean', default: false, doc: 'true | false' },
  { key: 'font.ui.family', type: 'string', default: 'Selawik', doc: 'interface text' },
  { key: 'font.preview.scale', type: 'number', default: 0.9, min: 0.5, max: 1.5, doc: '× code size' },
  { key: 'theme.name', type: 'enum', default: 'charcoal', values: ['charcoal'], doc: 'charcoal' },
  { key: 'theme.focus_dimming', type: 'boolean', default: true, doc: 'fade code outside the current function' },
  { key: 'editor.tab_size', type: 'number', default: 4, min: 1, max: 16, doc: 'spaces' },
  { key: 'editor.word_wrap', type: 'boolean', default: false, doc: 'true | false' },
  { key: 'editor.autosave', type: 'enum', default: 'off', values: ['off', 'focus', 'delay'], doc: 'off | focus | delay' },
  { key: 'editor.autosave_delay_ms', type: 'number', default: 1000, min: 200, max: 60000, doc: 'for autosave = "delay"' },
  { key: 'preview.enabled', type: 'boolean', default: true, doc: 'true | false' },
  { key: 'preview.include_std', type: 'boolean', default: false, doc: 'show standard-library and system calls' },
  { key: 'preview.max_cards', type: 'number', default: 12, min: 1, max: 100, doc: 'per level; the rest fold into "+N more"' },
  { key: 'window.chrome', type: 'enum', default: 'minimal', values: ['minimal', 'native'], doc: 'minimal | native (restart to apply)' },
  { key: 'clangd.path', type: 'string', default: 'auto', doc: '"auto" or a path to any clangd' },
  { key: 'clangd.args', type: 'string[]', default: [], doc: 'extra arguments, e.g. ["--clang-tidy"]' },
  { key: 'terminal.shell', type: 'string', default: 'auto', doc: '"auto" uses your login shell' },
  { key: 'terminal.font_size', type: 'number', default: 12.5, min: 6, max: 40, doc: 'pt' },
  { key: 'memory.ram_budget_kb', type: 'number', default: 0, min: 0, max: 1e9, doc: 'KB' },
  { key: 'memory.storage_budget_kb', type: 'number', default: 0, min: 0, max: 1e9, doc: 'KB (flash / disk image)' },
  { key: 'memory.warn_percent', type: 'number', default: 90, min: 1, max: 100, doc: '%' },
  { key: 'motion.reduce', type: 'boolean', default: false, doc: 'true turns animations into instant changes' },
];

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
    '# Lithograph settings — save to apply. Delete a line to get its default back.',
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
    case 'string[]':
      return Array.isArray(raw) && raw.every((x) => typeof x === 'string')
        ? { ok: true, value: raw }
        : { ok: false, message: 'must be a list of quoted strings' };
  }
}
