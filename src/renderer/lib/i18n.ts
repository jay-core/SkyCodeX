export function t(en: string, vars?: Record<string, string | number>): string {
  return vars ? en.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : en;
}
