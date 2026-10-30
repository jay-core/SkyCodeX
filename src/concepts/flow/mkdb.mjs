// Writes a compile_commands.json for a folder without one, the way SkyCodeX does (every header folder an include path).
// usage: node mkdb.mjs <root> <out dir>
import fs from 'node:fs';
import path from 'node:path';
const [root, out] = process.argv.slice(2);
const sources = [], headerDirs = [];
const SKIP = /^(\.|node_modules$|third[_-]?party$|vendor$)/i;
const walk = (d) => {
  let has = false;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.test(e.name)) walk(path.join(d, e.name)); }
    else if (/\.(c|cc|cpp|cxx)$/i.test(e.name)) sources.push(path.join(d, e.name));
    else if (/\.(h|hh|hpp|hxx|inl)$/i.test(e.name)) has = true;
  }
  if (has) headerDirs.push(d);
};
walk(root);
const flags = [root, ...headerDirs].map((d) => `-I${d}`);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'compile_commands.json'), JSON.stringify(sources.map((f) => ({ directory: root, file: f, arguments: [/\.c$/i.test(f) ? 'clang' : 'clang++', ...flags, '-c', f] }))));
console.log(`${sources.length} sources, ${headerDirs.length} include folders`);
