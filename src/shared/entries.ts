// Which entry point the flow page opens on, when a project has many `main`s (ThreadX has 278: ports, samples, tests,
// tools). Pure: ranked from paths alone, before anything is asked of clangd, so the first picture comes quickly.

/** Folders that hold tests, tools and build scaffolding rather than the program a reader wants first. */
const TEST = /^(tests?|testing|unit_?tests?|regression|ctest|gtest|fuzz(ing)?|bench(marks?)?)$/i;
const TOOL = /^(utilit(y|ies)|tools?|scripts?|cmake|build|third_party|3rdparty|vendor|external|deps|extern)$/i;
const PORT = /^(ports?(_\w+)?|arch|platforms?|boards?|bsp|example_build)$/i;
const MAIN = /^(samples?|demos?|examples?|apps?|src|source|programs?|cmd|bin)$/i;

/** A score for an entry point's file (higher first): a sample, demo or the project's own main beats tests and tools. */
export function entryScore(rel: string): number {
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean), dirs = parts.slice(0, -1), stem = (parts[parts.length - 1] ?? '').replace(/\.[^.]+$/, '');
  let s = 0;
  for (const d of dirs) {
    if (TEST.test(d)) s -= 6;
    else if (TOOL.test(d)) s -= 4;
    else if (PORT.test(d)) s -= 2;
    else if (MAIN.test(d)) s += 2;
  }
  if (/^(main|app|program)$/i.test(stem) || /^(demo|sample)/i.test(stem)) s += 2;
  if (/test/i.test(stem)) s -= 3;
  return s - dirs.length * 0.5;
}

/** Entry points best first; equal scores keep path order. */
export function rankEntries<T extends { rel: string }>(list: T[]): T[] {
  return list.map((e, i) => ({ e, i, s: entryScore(e.rel) })).sort((a, b) => b.s - a.s || a.e.rel.localeCompare(b.e.rel) || a.i - b.i).map((x) => x.e);
}
