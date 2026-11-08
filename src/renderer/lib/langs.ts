import type { Extension } from '@codemirror/state';
import { StreamLanguage } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { python } from '@codemirror/lang-python';
import { go } from '@codemirror/lang-go';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';
import { cpp } from './cm';

export type LangId = 'cpp' | 'rust' | 'python' | 'go' | 'cmake' | 'json' | 'yaml' | 'markdown' | 'text';

const cppFiles = new Set<string>();
export const markCpp = (file: string) => { cppFiles.add(file); };
const CPP_START = /^\s*(#\s*(pragma\s+once|ifndef\s+\w|if\s|ifdef\s|define\s+\w|include\s*[<"])|\/\/.*-\*-\s*(C\+\+|C|c\+\+)\s*-\*-|\/\*.*-\*-\s*(C\+\+|C)\s*-\*-|namespace\s+\w|template\s*<|extern\s+"C")/m;
export function looksLikeCpp(text: string): boolean {
  const head = text.slice(0, 6000).replace(/\/\*(?![^*]*-\*-)[\s\S]*?\*\//g, '').split('\n').filter((l) => l.trim() && !/^\s*\/\/(?!.*-\*-)/.test(l)).slice(0, 12).join('\n');
  return CPP_START.test(head);
}
export function noteText(file: string, text: string) { if (langOf(file) === 'text' && looksLikeCpp(text)) markCpp(file); }

export function langOf(file: string): LangId {
  if (cppFiles.has(file)) return 'cpp';
  const name = file.replace(/\\/g, '/').split('/').pop()!.toLowerCase();
  if (name === 'cmakelists.txt' || name.endsWith('.cmake')) return 'cmake';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (/^(c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|h\+\+|ipp|inl|tpp|tcc|txx|ixx|cppm|ccm|cxxm|c\+\+m|mpp|cu|cuh|m|mm)$/.test(ext)) return 'cpp';
  if (ext === 'rs') return 'rust';
  if (ext === 'py' || ext === 'pyi') return 'python';
  if (ext === 'go') return 'go';
  if (ext === 'json' || ext === 'jsonc') return 'json';
  if (ext === 'yaml' || ext === 'yml' || name === '.clang-format' || name === '.clang-tidy' || name === '.clangd') return 'yaml';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (!ext && /^(makefile|gnumakefile)$/.test(name)) return 'text';
  return !ext && /[\\/](include|c\+\+)[\\/]/.test(file) ? 'cpp' : 'text';
}

export function syntaxFor(file: string): Extension {
  switch (langOf(file)) {
    case 'cpp': return cpp();
    case 'rust': return rust();
    case 'python': return python();
    case 'go': return go();
    case 'cmake': return StreamLanguage.define(cmake);
    case 'json': return json();
    case 'yaml': return yaml();
    case 'markdown': return markdown();
    default: return [];
  }
}

export function serverLang(file: string): 'rust' | 'python' | 'go' | null {
  const l = langOf(file);
  return l === 'rust' || l === 'python' || l === 'go' ? l : null;
}
