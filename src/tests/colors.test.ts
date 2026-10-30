// The colour settings: exact round trips through the sliders, defaults that match the stylesheet they control,
// validation, and settings.toml.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { hexToHsla, hslaToHex, isColor } from '../shared/color';
import { SETTINGS, SECTIONS, validate, defaultFileText } from '../shared/settings-schema';
import { setSetting, loadSettings } from '../main/settings';
import { PAL } from '../renderer/lib/lines';

const COLORS = SETTINGS.filter((d) => d.type === 'color');
const css = fs.readFileSync(path.join(__dirname, '../renderer/styles.css'), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

describe('colours', () => {
  it('hex → hue/saturation/lightness → hex is exact for every default', () => {
    for (const d of COLORS) expect(hslaToHex(hexToHsla(String(d.default)), String(d.default).length === 9), d.key).toBe(d.default);
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080', '#12345678']) expect(hslaToHex(hexToHsla(hex), hex.length === 9)).toBe(hex);
  });
  it('the sliders move what they say', () => {
    expect(hexToHsla('#ff0000')).toMatchObject({ h: 0, s: 100, l: 50, a: 1 });
    expect(hslaToHex({ h: 120, s: 100, l: 50, a: 1 })).toBe('#00ff00');
    expect(hslaToHex({ h: 0, s: 0, l: 100, a: 1 })).toBe('#ffffff');
    expect(hslaToHex({ h: 240, s: 100, l: 50, a: 0.5 })).toBe('#0000ff80');
  });
  it('every colour setting defaults to the stylesheet value of the variable it sets', () => {
    for (const d of COLORS.filter((x) => x.css)) {
      const m = new RegExp(`${d.css!.replace(/[-]/g, '\\-')}:\\s*(#[0-9a-fA-F]{6,8})\\s*;`).exec(root);
      expect(m?.[1].toLowerCase(), `${d.key} → ${d.css}`).toBe(d.default);
    }
  });
  it('the card colours are the palette the preview uses, eight of them, none of them red', () => {
    const cards = COLORS.filter((d) => d.key.startsWith('colors.cards.')).map((d) => d.default);
    expect(cards).toEqual(PAL);
    expect(cards).toHaveLength(8);
    for (const c of cards) { const { h, s } = hexToHsla(String(c)); expect(s < 15 || (h > 40 && h < 300), `${c} reads as red`).toBe(true); }
  });
  it('every colour belongs to a section that says what it colours', () => {
    for (const d of COLORS) expect(SECTIONS.some((s) => s.name === d.key.slice(0, d.key.lastIndexOf('.'))), d.key).toBe(true);
  });
  it('validation: hex colours only, stored in lower case', () => {
    const d = COLORS[0];
    expect(validate(d, '#ABCDEF')).toEqual({ ok: true, value: '#abcdef' });
    expect(validate(d, '#abcdef80')).toEqual({ ok: true, value: '#abcdef80' });
    for (const bad of ['abcdef', '#abc', 'red', 12, '#abcdeg']) expect(validate(d, bad).ok).toBe(false);
    expect(isColor('#1b1c1b')).toBe(true);
  });
  it('a colour written into settings.toml reads back, and the file lists every colour section', () => {
    const text = setSetting(defaultFileText(), 'colors.code.keyword', '#86a8e7');
    expect(loadSettings(text).settings['colors.code.keyword']).toBe('#86a8e7');
    expect(loadSettings(text).problems).toEqual([]);
    for (const s of ['colors.editor', 'colors.code', 'colors.diagnostics', 'colors.cards', 'colors.flow']) expect(defaultFileText()).toContain(`[${s}]`);
    const fresh = setSetting('', 'colors.flow.now', '#d4c26a');
    expect(loadSettings(fresh).settings['colors.flow.now']).toBe('#d4c26a');
  });
});
