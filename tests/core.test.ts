import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'smol-toml';
import { resolveDataDir, portableBase } from '../src/main/datadir';
import { loadSettings, setSetting, lineOf } from '../src/main/settings';
import { defaultFileText, defaults, SETTINGS } from '../src/shared/settings-schema';
import { atomicWrite, saveBuffer, loadBuffers, dropBuffer, listSources } from '../src/main/files';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'litho-'));

describe('portable data dir', () => {
  const base = { appRoot: '/repo', appDataFallback: '/Users/x/Library/Application Support' };
  it('sits beside Lithograph.app on macOS', () => {
    const i = { ...base, isPackaged: true, platform: 'darwin' as const, execPath: '/Tools/Lithograph/Lithograph.app/Contents/MacOS/Lithograph' };
    expect(portableBase(i)).toBe('/Tools/Lithograph');
    expect(resolveDataDir(i, () => true)).toEqual({ dir: '/Tools/Lithograph/data', fallback: false });
  });
  it('sits beside the exe on Windows and Linux', () => {
    expect(portableBase({ ...base, isPackaged: true, platform: 'win32', execPath: 'D:/apps/Lithograph/lithograph.exe' })).toBe('D:/apps/Lithograph');
    expect(portableBase({ ...base, isPackaged: true, platform: 'linux', execPath: '/opt/Lithograph/lithograph' })).toBe('/opt/Lithograph');
  });
  it('uses the project folder when unpackaged', () => {
    expect(resolveDataDir({ ...base, isPackaged: false, platform: 'darwin', execPath: '/x' }, () => true).dir).toBe('/repo/data');
  });
  it('falls back, with a reason, when the folder is read-only', () => {
    const r = resolveDataDir({ ...base, isPackaged: true, platform: 'win32', execPath: 'C:/Program Files/Lithograph/lithograph.exe' }, () => false);
    expect(r.fallback).toBe(true);
    expect(r.dir).toBe(path.join(base.appDataFallback, 'Lithograph'));
    expect(r.reason).toMatch(/can't be written/);
  });
  it('detects macOS App Translocation', () => {
    const r = resolveDataDir({ ...base, isPackaged: true, platform: 'darwin', execPath: '/private/var/folders/x/AppTranslocation/ABC/d/Lithograph.app/Contents/MacOS/Lithograph' }, () => true);
    expect(r.fallback).toBe(true);
    expect(r.reason).toMatch(/quarantine/);
  });
});

describe('settings.toml', () => {
  it('first-run file lists every option and parses back to the defaults', () => {
    const text = defaultFileText();
    for (const d of SETTINGS) expect(lineOf(text, d.key), d.key).toBeGreaterThan(0);
    expect(() => parse(text)).not.toThrow();
    const r = loadSettings(text);
    expect(r.problems).toEqual([]);
    expect(r.settings).toEqual(defaults());
  });
  it('bad values fall back to defaults and are reported with their line', () => {
    const text = defaultFileText().replace(/^size(\s*)= 13/m, 'size$1= 135');
    const r = loadSettings(text);
    expect(r.settings['font.size']).toBe(13);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0].line).toBe(lineOf(text, 'font.size'));
    expect(r.problems[0].message).toMatch(/6–72/);
  });
  it('unknown keys and broken syntax never throw', () => {
    expect(loadSettings('[font]\nwhatever = 1\n').problems[0].message).toMatch(/unknown/);
    const broken = loadSettings('[font\nsize = ');
    expect(broken.settings).toEqual(defaults());
    expect(broken.problems[0].message).toMatch(/can't be read/);
  });
  it('setSetting changes one value and keeps comments', () => {
    const text = defaultFileText();
    const out = setSetting(text, 'font.size', 14.5);
    expect(loadSettings(out).settings['font.size']).toBe(14.5);
    const line = out.split('\n')[lineOf(out, 'font.size') - 1];
    expect(line).toMatch(/^size\s*= 14\.5\s+# code text size$/);
    expect(out.split('\n').length).toBe(text.split('\n').length);
    const s = setSetting(out, 'font.family', 'Mono # odd');
    expect(loadSettings(s).settings['font.family']).toBe('Mono # odd');
    expect(() => setSetting(text, 'font.size', 999)).toThrow();
  });
  it('setSetting adds a missing key to its section, or a new section', () => {
    const a = setSetting('[font]\nsize = 12\n', 'font.ligatures', true);
    expect(loadSettings(a).settings['font.ligatures']).toBe(true);
    const b = setSetting('# empty\n', 'editor.tab_size', 2);
    expect(loadSettings(b).settings['editor.tab_size']).toBe(2);
  });
});

describe('files', () => {
  it('atomic write replaces content and keeps the mode', () => {
    const d = tmp(); const f = path.join(d, 'a.cpp');
    fs.writeFileSync(f, 'old'); fs.chmodSync(f, 0o755);
    atomicWrite(f, 'new');
    expect(fs.readFileSync(f, 'utf8')).toBe('new');
    expect(fs.statSync(f).mode & 0o777).toBe(0o755);
    expect(fs.readdirSync(d)).toEqual(['a.cpp']);
  });
  it('hot-exit buffers round-trip and can be dropped', () => {
    const d = tmp();
    saveBuffer(d, '/p/x.cpp', 'int x;');
    expect(loadBuffers(d)).toEqual([{ file: '/p/x.cpp', text: 'int x;' }]);
    dropBuffer(d, '/p/x.cpp');
    expect(loadBuffers(d)).toEqual([]);
  });
  it('listSources finds C/C++ files and skips build output', () => {
    const d = tmp();
    fs.mkdirSync(path.join(d, 'src')); fs.mkdirSync(path.join(d, 'build'));
    fs.writeFileSync(path.join(d, 'src/a.cpp'), ''); fs.writeFileSync(path.join(d, 'src/a.h'), '');
    fs.writeFileSync(path.join(d, 'build/gen.cpp'), ''); fs.writeFileSync(path.join(d, 'README.md'), '');
    expect(listSources(d).map((p) => path.relative(d, p)).sort()).toEqual(['src/a.cpp', 'src/a.h']);
  });
});

import { symbolQuery } from '../src/shared/symname';
describe('memory symbols → source names', () => {
  it('drops parameters, templates and qualifiers, keeps the scope', () => {
    expect(symbolQuery('HexMatrixProcessor::mapMemoryBoundaries()')).toEqual({ leaf: 'mapMemoryBoundaries', scope: 'HexMatrixProcessor' });
    expect(symbolQuery('ns::Box<int, std::vector<char>>::get(unsigned long) const')).toEqual({ leaf: 'get', scope: 'ns::Box' });
    expect(symbolQuery('int add<int>(int, int)')).toEqual({ leaf: 'add', scope: '' });
    expect(symbolQuery('vtable for Server')).toEqual({ leaf: 'Server', scope: '' });
    expect(symbolQuery('(anonymous namespace)::counter')).toEqual({ leaf: 'counter', scope: '' });
    expect(symbolQuery('Fn::operator()(int)')).toEqual({ leaf: 'operator()', scope: 'Fn' });
  });
  it('leaves compiler-made symbols alone', () => {
    expect(symbolQuery('_GLOBAL__sub_I_main.cpp')).toBeNull();
    expect(symbolQuery('.str.1')).toBeNull();
    expect(symbolQuery('ltmp0')).toBeNull();
  });
});
