// CodeMirror setup: C/C++ language, the charcoal highlight style, and shared extensions.
import { parser as cppParser } from '@lezer/cpp';
import { LRLanguage, LanguageSupport, HighlightStyle, syntaxHighlighting, indentNodeProp, foldNodeProp, foldInside, continuedIndent, flatIndent, delimitedIndent, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, keymap, rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';

export const cppLanguage = LRLanguage.define({
  name: 'cpp',
  parser: cppParser.configure({
    props: [
      indentNodeProp.add({
        IfStatement: continuedIndent({ except: /^\s*({|else\b)/ }),
        TryStatement: continuedIndent({ except: /^\s*({|catch)\b/ }),
        LabeledStatement: flatIndent,
        CaseStatement: (c) => c.baseIndent + c.unit,
        BlockComment: () => null,
        CompoundStatement: delimitedIndent({ closing: '}' }),
        Statement: continuedIndent({ except: /^{/ }),
      }),
      foldNodeProp.add({
        'DeclarationList CompoundStatement EnumeratorList FieldDeclarationList InitializerList': foldInside,
        BlockComment: (tree) => ({ from: tree.from + 2, to: tree.to - 2 }),
      }),
    ],
  }),
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } }, indentOnInput: /^\s*(?:case |default:|\{|\})$/, closeBrackets: { brackets: ['(', '[', '{', "'", '"'] } },
});
export const cpp = () => new LanguageSupport(cppLanguage);

export const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier, t.moduleKeyword, t.processingInstruction], color: 'var(--kw)' },
  { tag: [t.typeName, t.className, t.standard(t.typeName)], color: 'var(--ty)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName)), t.macroName], color: 'var(--fn)' },
  { tag: [t.variableName, t.definition(t.variableName)], color: 'var(--var)' },
  { tag: [t.propertyName], color: 'var(--fn)' },
  { tag: [t.string, t.special(t.string), t.character], color: 'var(--str)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--var)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--cm)', fontStyle: 'italic' },
  { tag: [t.namespace], color: 'var(--fg)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: 'var(--fg)' },
  { tag: t.invalid, color: 'var(--err)' },
]);

export const baseTheme = EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }, { dark: true });

export function editorExtensions(opts: { tabSize: number; wrap: boolean }): Extension[] {
  return [
    lineNumbers(), highlightActiveLineGutter(), foldGutter({ markerDOM: (open) => { const s = document.createElement('span'); s.textContent = open ? '⌄' : '›'; return s; } }),
    history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
    bracketMatching(), closeBrackets(), rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
    syntaxHighlighting(highlight), cpp(), baseTheme,
    EditorState.tabSize.of(opts.tabSize),
    opts.wrap ? EditorView.lineWrapping : [],
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
  ];
}

/** Read-only card editor: same language and colours, line numbers starting at the definition's line. */
export function cardExtensions(firstLine: number): Extension[] {
  return [
    lineNumbers({ formatNumber: (n) => String(n + firstLine - 1) }),
    drawSelection(), highlightActiveLine(),
    syntaxHighlighting(highlight), cpp(), baseTheme,
    EditorState.readOnly.of(true), EditorView.editable.of(true),
    keymap.of(defaultKeymap),
  ];
}

export const posToOffset = (doc: EditorState['doc'], line: number, ch: number) => {
  const l = doc.line(Math.min(Math.max(line + 1, 1), doc.lines));
  return Math.min(l.from + ch, l.to);
};
export const offsetToPos = (doc: EditorState['doc'], off: number) => {
  const l = doc.lineAt(off);
  return { line: l.number - 1, character: off - l.from };
};
