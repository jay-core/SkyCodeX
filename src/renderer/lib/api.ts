// Typed access to the preload bridge.
import type { LithoApi } from '../../preload/preload';

declare global { interface Window { litho: LithoApi } }
export const api = window.litho;

export interface Pos { line: number; character: number }
export interface Range { start: Pos; end: Pos }
export interface CallItem { name: string; kind: number; detail?: string; uri: string; range: Range; selectionRange: Range; data?: unknown }
export interface OutgoingCall { to: CallItem; fromRanges: Range[] }
export interface DocSymbol { name: string; detail?: string; kind: number; range: Range; selectionRange: Range; children?: DocSymbol[] }
export interface Diagnostic { range: Range; severity?: number; message: string; source?: string; code?: string | number }
export interface DirEntry { name: string; path: string; dir: boolean }

export const FN_KINDS = new Set([6, 9, 12]); // method, constructor, function

export function fileToUri(p: string): string {
  const norm = p.replace(/\\/g, '/');
  return 'file://' + (norm.startsWith('/') ? '' : '/') + norm.split('/').map(encodeURIComponent).join('/').replace(/^\/([A-Za-z])%3A/, '/$1:');
}
export function uriToFile(u: string): string {
  const s = decodeURIComponent(u.replace(/^file:\/\//, ''));
  return /^\/[A-Za-z]:/.test(s) ? s.slice(1) : s;
}
export const basename = (p: string) => p.replace(/\\/g, '/').split('/').pop() ?? p;
export const relPath = (root: string, p: string) => (p.startsWith(root) ? p.slice(root.length).replace(/^[\\/]/, '') : p);
