// Which language a file is in, and its syntax colouring. All grammars are built in, so colouring works offline.
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

export function langOf(file: string): LangId {
  const name = file.replace(/\\/g, '/').split('/').pop()!.toLowerCase();
  if (name === 'cmakelists.txt' || name.endsWith('.cmake')) return 'cmake';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (/^(c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx|ipp|inl|tpp|m|mm)$/.test(ext)) return 'cpp';
  if (ext === 'rs') return 'rust';
  if (ext === 'py' || ext === 'pyi') return 'python';
  if (ext === 'go') return 'go';
  if (ext === 'json' || ext === 'jsonc') return 'json';
  if (ext === 'yaml' || ext === 'yml' || name === '.clang-format' || name === '.clang-tidy' || name === '.clangd') return 'yaml';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (!ext && /^(makefile|gnumakefile)$/.test(name)) return 'text';
  return !ext && /[\\/](include|c\+\+)[\\/]/.test(file) ? 'cpp' : 'text';   // extensionless standard headers such as <vector>
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

/** Languages whose language engine comes from a pack (C and C++ use clangd). */
export function serverLang(file: string): 'rust' | 'python' | 'go' | null {
  const l = langOf(file);
  return l === 'rust' || l === 'python' || l === 'go' ? l : null;
}
