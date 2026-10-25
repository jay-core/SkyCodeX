// Executable targets named in a project's build files, so the flow view can call each program by its real name
// and notice when one program starts another.
import fs from 'node:fs';
import path from 'node:path';

export interface Target { name: string; sources: string[] }

const BUILD_FILE = /^(CMakeLists\.txt|meson\.build)$/;
const SKIP = /^(\.|node_modules$|build$|out$|cmake-build-)/i;

/** add_executable(name a.cpp b.cpp) in CMake, executable('name', 'a.cpp', …) in Meson; sources resolved against their folder. */
export function buildTargets(root: string): Target[] {
  const out: Target[] = [];
  let level = [root];
  for (let depth = 0; level.length && depth < 8; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (e.isDirectory()) { if (!SKIP.test(e.name)) next.push(path.join(dir, e.name)); continue; }
        if (!BUILD_FILE.test(e.name)) continue;
        let text = '';
        try { text = fs.readFileSync(path.join(dir, e.name), 'utf8'); } catch { continue; }
        text = text.replace(/#[^\n]*/g, '');
        const re = e.name === 'meson.build' ? /\bexecutable\s*\(\s*'([^']+)'([^)]*)\)/g : /\badd_executable\s*\(\s*([\w.+-]+)([^)]*)\)/g;
        for (const m of text.matchAll(re)) {
          const files = [...m[2].matchAll(/['"]?([\w./+-]+\.(?:c|cc|cpp|cxx|c\+\+|m|mm))['"]?/g)].map((f) => path.resolve(dir, f[1]));
          if (!m[1].includes('$')) out.push({ name: m[1], sources: files });
        }
      }
    }
    level = next;
  }
  return out;
}
