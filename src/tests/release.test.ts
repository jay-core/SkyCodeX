import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const WORKFLOW = fs.readFileSync(path.join(__dirname, '../../.github/workflows/release.yml'), 'utf8');
const steps = WORKFLOW.split(/\n(?= {6}- )/);

describe('the release workflow', () => {
  it('runs the unit tests in exactly one step', () => {
    expect(steps.filter((s) => /\n\s+run: npm test\s*$/m.test(s))).toHaveLength(1);
  });

  it('stops when the unit tests fail', () => {
    const step = steps.find((s) => /\n\s+run: npm test\s*$/m.test(s))!;
    expect(step).not.toMatch(/continue-on-error:\s*true/);
  });

  it('builds only after the unit tests ran', () => {
    const at = (re: RegExp) => steps.findIndex((s) => re.test(s));
    expect(at(/\n\s+run: npm test\s*$/m)).toBeGreaterThan(-1);
    expect(at(/\n\s+run: npm test\s*$/m)).toBeLessThan(at(/\n\s+run: npm run package\s*$/m));
  });
});
