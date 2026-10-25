// Interface text. English only for now; strings go through t() so translations can return later without touching every component.

/** The interface text; {name} parts are filled from vars. */
export function t(en: string, vars?: Record<string, string | number>): string {
  return vars ? en.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : en;
}
