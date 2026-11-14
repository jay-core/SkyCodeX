import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'data/gen');
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

const named = (i, len) => {
  if (len === 1) return LETTERS[i];
  const base = `f${i}_`;
  let s = base;
  for (let k = 0; s.length < len; k++) s += LETTERS[k % 26];
  return s.slice(0, Math.max(len, base.length));
};

function cfile(fns, extern = []) {
  const lines = ['#include <stdio.h>', '', 'volatile int sink;', ''];
  for (const e of extern) lines.push(`void ${e}(void);`);
  for (const f of Object.keys(fns)) if (f !== 'main') lines.push(`void ${f}(void);`);
  lines.push('');
  for (const [f, calls] of Object.entries(fns)) {
    lines.push(f === 'main' ? 'int main(void) {' : `void ${f}(void) {`);
    lines.push('  sink++;', '  sink++;', '  sink++;');
    for (const c of calls) lines.push(`  ${c}();`);
    if (f === 'main') lines.push('  return 0;');
    lines.push('}', '');
  }
  return lines.join('\n');
}

const programs = {};
const put = (id, files) => { programs[id] = files; };

for (const len of [1, 10, 40, 120, 300]) {
  const [a, b, c] = [0, 1, 2].map((i) => named(i, len));
  put(`names-${len}`, { 'main.c': cfile({ main: [a, b], [a]: [c], [b]: [], [c]: [] }) });
}
for (const n of [1, 2, 3, 4, 8]) put(`repeat-${n}`, { 'main.c': cfile({ main: Array(n).fill('g'), g: [] }) });
put('repeat-mixed', { 'main.c': cfile({ main: ['g', 'h', 'g'], g: [], h: [] }) });
put('repeat-loop', {
  'main.c': `volatile int sink;
void g(void) {
  sink++;
  sink++;
  sink++;
}
int main(void) {
  for (int i = 0; i < 3; i++) g();
  return 0;
}
`,
});
put('recursion-direct', {
  'main.c': `int fact(int n) {
  if (n <= 1)
    return 1;
  return n * fact(n - 1);
}
int main(void) {
  return fact(4) == 0;
}
`,
});
put('recursion-mutual', {
  'main.c': `int is_odd(int n);
int is_even(int n) {
  if (n == 0)
    return 1;
  return is_odd(n - 1);
}
int is_odd(int n) {
  if (n == 0)
    return 0;
  return is_even(n - 1);
}
int main(void) {
  return is_even(4) == 0;
}
`,
});
for (const k of [0, 1, 5, 20]) {
  const hs = Array.from({ length: k }, (_, i) => `h${i + 1}`);
  put(`calls-${k}`, { 'main.c': cfile({ main: ['f'], f: hs, ...Object.fromEntries(hs.map((h) => [h, []])) }) });
}
put('kinds', {
  'main.c': `static int sq(int x) { return x * x; }
static int apply(int (*f)(int), int v) { return f(v); }
static int fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }
volatile int sink;
static void step(void) { sink++; }
int main(void) {
  step();
  step();
  int r = apply(sq, 3);
  for (int i = 0; i < 3; i++) step();
  r += fact(4);
  return r == 0;
}
`,
});
for (const n of [1, 10, 11, 60]) {
  const others = Array.from({ length: n - 1 }, (_, i) => `in_file_${i + 1}`);
  const files = { 'main.c': cfile({ main: n === 1 ? ['local'] : others, ...(n === 1 ? { local: [] } : {}) }, n === 1 ? [] : others) };
  for (const [i, f] of others.entries()) files[`file_${i + 1}.c`] = `extern volatile int sink;\nvoid ${f}(void) {\n  sink++;\n  sink++;\n  sink++;\n}\n`;
  put(`files-${n}`, files);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const [id, files] of Object.entries(programs)) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
}
console.log(JSON.stringify({ out: OUT, programs: Object.keys(programs).length, ids: Object.keys(programs) }));
