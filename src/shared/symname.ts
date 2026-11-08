function stripTemplates(s: string): string {
  let prev = '';
  while (prev !== s) { prev = s; s = s.replace(/<[^<>]*>/g, ''); }
  return s;
}

function stripParams(s: string): string {
  s = s.replace(/\s*(const|volatile|&&|&|noexcept)\s*$/g, '').trimEnd();
  if (!s.endsWith(')')) return s;
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ')') depth++;
    else if (s[i] === '(' && --depth === 0) {
      const head = s.slice(0, i);
      return /operator\s*$/.test(head) && s.slice(i, i + 2) === '()' ? s.slice(0, i + 2) : head;
    }
  }
  return s;
}

export function symbolQuery(demangled: string): { leaf: string; scope: string } | null {
  let n = demangled.trim()
    .replace(/^(construction vtable|vtable|VTT|typeinfo name|typeinfo|guard variable|reference temporary #\d+) for /, '')
    .replace(/\(anonymous namespace\)::/g, '');
  if (!/^[A-Za-z_~]/.test(n) || /^(_GLOBAL__|__|ltmp|l_|L_|GCC_except)/.test(n) || /\.(str|cst)|\$/.test(n)) return null;
  n = stripTemplates(stripParams(n));
  const parts = n.split('::').map((p) => p.trim()).filter(Boolean);
  const leaf = (parts.pop() ?? '').split(/\s+/).pop() ?? '';
  if (!leaf) return null;
  return { leaf, scope: parts.map((p) => p.split(/\s+/).pop()).join('::') };
}
