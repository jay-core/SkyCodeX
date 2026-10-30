// One line of C/C++ coloured as the editor colours it (keywords, functions, strings, comments), as HTML. For the few
// lines the flow views quote; the editor and the step preview use CodeMirror.
const KW = /^(if|else|for|while|do|switch|case|default|return|break|continue|auto|const|constexpr|static|void|bool|int|char|long|short|unsigned|signed|float|double|size_t|true|false|nullptr|this|new|delete|struct|class|using|namespace|template|typename|noexcept|std|throw|try|catch)$/;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function hlLine(t: string): string {
  let out = '';
  const re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\/\/.*$)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|([^"'/A-Za-z_]+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m[1]) out += `<span class="st">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="cm">${esc(m[2])}</span>`;
    else if (m[3]) out += KW.test(m[3]) ? `<span class="kw">${m[3]}</span>` : `<span class="fn">${m[3]}</span>`;
    else if (m[4]) out += KW.test(m[4]) ? `<span class="kw">${m[4]}</span>` : m[4];
    else out += esc(m[5]);
  }
  return out;
}
