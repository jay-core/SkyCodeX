// Reads, validates and edits data/settings.toml without ever losing the user's comments.
import { parse } from 'smol-toml';
import { SETTINGS, SettingDef, SettingProblem, Settings, defaults, validate, RETIRED } from '../shared/settings-schema';

const BY_KEY = new Map(SETTINGS.map((d) => [d.key, d]));

function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !BY_KEY.has(key)) flatten(v as Record<string, unknown>, key, out);
    else out[key] = v;
  }
  return out;
}

/** 1-based line of `key` in the text, or 0. */
export function lineOf(text: string, key: string): number {
  const section = key.slice(0, key.lastIndexOf('.'));
  const name = key.slice(key.lastIndexOf('.') + 1);
  const lines = text.split('\n');
  let current = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^\s*\[([^\]]+)\]/);
    if (h) { current = h[1].trim(); continue; }
    if (current === section && new RegExp(`^\\s*${name}\\s*=`).test(lines[i])) return i + 1;
  }
  return 0;
}

export interface LoadResult {
  settings: Settings;
  problems: SettingProblem[];
}

/** Parses settings text. Bad values fall back to their default and are reported; nothing throws. */
export function loadSettings(text: string): LoadResult {
  const settings = defaults();
  const problems: SettingProblem[] = [];
  let raw: Record<string, unknown>;
  try {
    raw = flatten(parse(text) as Record<string, unknown>);
  } catch (e) {
    const err = e as { line?: number; message: string };
    problems.push({ key: '', line: err.line ?? 0, message: `settings.toml can't be read (${err.message.split('\n')[0]}); all defaults are in use` });
    return { settings, problems };
  }
  for (const [key, value] of Object.entries(raw)) {
    const def = BY_KEY.get(key);
    if (!def) { if (!RETIRED.test(key)) problems.push({ key, line: lineOf(text, key), message: `unknown setting "${key}" — ignored` }); continue; }
    const r = validate(def, value);
    if (r.ok) settings[key] = r.value;
    else problems.push({ key, line: lineOf(text, key), message: `${key} ${r.message}; using ${JSON.stringify(def.default)}` });
  }
  return { settings, problems };
}

function tomlValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => JSON.stringify(x)).join(', ') + ']';
  return String(v);
}

/** Splits "name = value   # comment" into its value span, honouring quotes. */
function valueSpan(line: string): [number, number] {
  const eq = line.indexOf('=');
  let i = eq + 1;
  while (line[i] === ' ' || line[i] === '\t') i++;
  const start = i;
  let inStr: string | null = null;
  let end = line.length;
  for (; i < line.length; i++) {
    const c = line[i];
    if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '#') { end = i; break; }
  }
  while (end > start && /\s/.test(line[end - 1])) end--;
  return [start, end];
}

/** Returns new file text with one setting changed; comments and layout are kept. */
export function setSetting(text: string, key: string, value: unknown): string {
  const def: SettingDef | undefined = BY_KEY.get(key);
  if (!def) throw new Error(`unknown setting ${key}`);
  const r = validate(def, value);
  if (!r.ok) throw new Error(`${key} ${r.message}`);
  const lines = text.split('\n');
  const ln = lineOf(text, key);
  const name = key.slice(key.lastIndexOf('.') + 1);
  if (ln) {
    const line = lines[ln - 1];
    const [s, e] = valueSpan(line);
    const oldLen = e - s;
    const v = tomlValue(value);
    // keep the comment column where it was when the new value fits
    const pad = line.slice(e).match(/^\s*/)![0];
    const rest = line.slice(e + pad.length);
    const newPad = rest ? ' '.repeat(Math.max(1, oldLen + pad.length - v.length)) : '';
    lines[ln - 1] = line.slice(0, s) + v + (rest ? newPad + rest : '');
    return lines.join('\n');
  }
  const section = key.slice(0, key.lastIndexOf('.'));
  const header = lines.findIndex((l) => l.match(/^\s*\[([^\]]+)\]/)?.[1].trim() === section);
  const entry = `${name} = ${tomlValue(value)}`;
  if (header >= 0) { lines.splice(header + 1, 0, entry); return lines.join('\n'); }
  return text.replace(/\n*$/, '\n') + `\n[${section}]\n${entry}\n`;
}
