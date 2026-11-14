import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.join(__dirname, '../build/check-smoke.mjs');
const GOOD = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/boot-report.json'), 'utf8'));

function judge(report: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-smoke-'));
  try {
    fs.mkdirSync(path.join(dir, 'data', 'logs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data', 'logs', 'smoke-report.json'), JSON.stringify(report));
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    return { code: r.status, err: r.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('the boot check', () => {
  it('passes a boot report from a good build', () => {
    const r = judge(GOOD);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
  });

  it('fails when the flow view drew nothing', () => {
    const r = judge({ ...GOOD, gridSquares: 0 });
    expect(r.code).toBe(1);
    expect(r.err).toContain('the flow view is empty');
  });

  it('fails when the grid loses the step selected in the metro', () => {
    const r = judge({ ...GOOD, gridKeptStep: false });
    expect(r.code).toBe(1);
    expect(r.err).toContain('the grid does not show the selected step');
  });

  it('fails when the grid draws text on text', () => {
    const r = judge({ ...GOOD, gridCollisionsAfterTab: ['"split" over "trim"'] });
    expect(r.code).toBe(1);
    expect(r.err).toContain('text on text in the grid: "split" over "trim"');
  });

  it('fails when the grid finds a wrong number of routes from main to split', () => {
    const r = judge({ ...GOOD, gridRoutes: 1 });
    expect(r.code).toBe(1);
    expect(r.err).toContain('main to split should have 2 routes, the grid shows 1');
  });
});
