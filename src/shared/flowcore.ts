import { parser } from '@lezer/cpp';
import type { Tree, SyntaxNode } from '@lezer/common';

export const parseCpp = (text: string): Tree => parser.parse(text.includes('\r') ? text.replace(/\r/g, ' ') : text);

export interface LoopInfo { key: string; label: string; from: number }

const LOOPS = new Set(['ForStatement', 'ForRangeLoop', 'WhileStatement', 'DoStatement']);
const squash = (s: string, max = 34) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };

export function loopLabel(node: SyntaxNode, text: string): string {
  const src = text.slice(node.from, node.to);
  if (node.name === 'ForStatement') {
    const head = src.slice(src.indexOf('(') + 1, matchingParen(src, src.indexOf('(')));
    const m = head.match(/^\s*(?:(?:unsigned|int|size_t|std::size_t|auto|long|short)\s+)*(\w+)\s*=\s*0\s*;\s*\1\s*(<|<=)\s*(\d+)\s*;/);
    if (m) return `×${Number(m[3]) + (m[2] === '<=' ? 1 : 0)}`;
    const cond = head.split(';')[1] ?? '';
    return cond.trim() ? `while ${squash(cond)}` : 'forever';
  }
  if (node.name === 'ForRangeLoop') {
    const head = src.slice(src.indexOf('(') + 1, matchingParen(src, src.indexOf('(')));
    const range = head.slice(head.lastIndexOf(':') + 1);
    return `×n · ${squash(range, 26)}`;
  }
  if (node.name === 'WhileStatement') {
    const cond = src.slice(src.indexOf('(') + 1, matchingParen(src, src.indexOf('(')));
    return /^\s*(true|1)\s*$/.test(cond) ? 'forever' : `while ${squash(cond)}`;
  }
  const tail = src.slice(src.lastIndexOf('while'));
  return `do … ${squash(tail)}`;
}

function matchingParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return i;
  }
  return s.length;
}

export function loopsAt(tree: Tree, text: string, offset: number, fileKey: string): LoopInfo[] {
  const out: LoopInfo[] = [];
  for (let n: SyntaxNode | null = tree.resolveInner(offset, 1); n; n = n.parent) {
    if (n.name === 'FunctionDefinition' || n.name === 'LambdaExpression') break;
    if (LOOPS.has(n.name)) {
      out.push({ key: `${fileKey}#${n.from}`, label: loopLabel(n, text), from: n.from });
    }
  }
  return out;
}

export interface FnDef { name: string; line: number; endLine: number; from: number; to: number }

export function functionDefs(tree: Tree, text: string): FnDef[] {
  const out: FnDef[] = [];
  tree.iterate({
    enter(n) {
      if (n.name !== 'FunctionDefinition') return;
      const decl = n.node.getChild('FunctionDeclarator') ?? findDeep(n.node, 'FunctionDeclarator');
      if (!decl) return false;
      const nameNode = decl.firstChild;
      const name = nameNode ? text.slice(nameNode.from, nameNode.to).replace(/\s+/g, '') : '?';
      out.push({ name, line: lineOf(text, nameNode?.from ?? decl.from), endLine: lineOf(text, n.to), from: n.from, to: n.to });
      return false;
    },
  });
  return out;
}

export function definedNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/^(?![#/*\s{}])[^;{}()=\n]*?\b([A-Za-z_]\w*)\s*\(/gm)) out.add(m[1]);
  return out;
}

export function addressTaken(text: string, names: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const n of addressCandidates(text)) if (names.has(n)) out.add(n);
  return out;
}
export function addressCandidates(text: string): string[] {
  const clean = text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ').replace(/"(?:\\.|[^"\\])*"/g, '""');
  return [...clean.matchAll(/(?:[=,({]|\breturn)\s*&?\s*(?:\w+::)*([A-Za-z_]\w*)\s*(?=[,;)}])/g)].map((m) => m[1]);
}

function findDeep(n: SyntaxNode, name: string): SyntaxNode | null {
  for (let c = n.firstChild; c; c = c.nextSibling) {
    if (c.name === name) return c;
    if (c.name === 'CompoundStatement') continue;
    const d = findDeep(c, name);
    if (d) return d;
  }
  return null;
}

export const lineOf = (text: string, off: number) => {
  if (text !== nlText) { nlText = text; nl = []; for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) nl.push(i); }
  const end = Math.min(off, text.length);
  let lo = 0, hi = nl.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (nl[mid] < end) lo = mid + 1; else hi = mid; }
  return lo;
};
let nlText = '', nl: number[] = [];
export const offsetOf = (text: string, line: number, ch: number) => { let off = 0; for (let l = 0; l < line; l++) { const i = text.indexOf('\n', off); if (i < 0) return text.length; off = i + 1; } return off + ch; };

export const THREAD_RE = /\b(std::thread|std::jthread|std::async|pthread_create|_beginthreadex|CreateThread|xTaskCreate\w*|k_thread_create)\b/;
