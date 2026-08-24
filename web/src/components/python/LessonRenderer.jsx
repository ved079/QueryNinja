/**
 * Full-featured lesson renderer for Python curriculum.
 * Handles: ## headings, ``` code blocks, **bold**, `inline code`,
 * bullet lists, numbered lists, > callouts, plain paragraphs.
 */

const PY_KEYWORDS = new Set([
  'def','return','if','elif','else','for','while','in','not','and','or',
  'True','False','None','import','from','class','pass','break','continue',
  'lambda','try','except','raise','with','as','is','del','global','yield',
]);

function highlightPython(line) {
  // Simple tokenizer: strings, comments, keywords, numbers, builtins
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    // Comment
    if (line[i] === '#') {
      tokens.push({ type: 'comment', val: line.slice(i) });
      break;
    }
    // String (single or double quoted, simple)
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      let j = i + 1;
      // Triple-quote
      if (line.slice(i, i + 3) === q + q + q) {
        const end = line.indexOf(q + q + q, i + 3);
        const val = end === -1 ? line.slice(i) : line.slice(i, end + 3);
        tokens.push({ type: 'string', val });
        i += val.length;
        continue;
      }
      while (j < line.length && line[j] !== q) j++;
      tokens.push({ type: 'string', val: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Word (keyword, builtin, or ident)
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const BUILTINS = new Set(['print','len','range','type','int','float','str','bool',
        'list','dict','set','tuple','sum','min','max','sorted','enumerate','zip',
        'map','filter','isinstance','repr','abs','round','input']);
      if (PY_KEYWORDS.has(word)) tokens.push({ type: 'kw', val: word });
      else if (BUILTINS.has(word)) tokens.push({ type: 'builtin', val: word });
      else tokens.push({ type: 'ident', val: word });
      i = j;
      continue;
    }
    // Number
    if (/[0-9]/.test(line[i]) || (line[i] === '-' && /[0-9]/.test(line[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ type: 'num', val: line.slice(i, j) });
      i = j;
      continue;
    }
    // Operator / punctuation — group consecutive non-word chars
    tokens.push({ type: 'op', val: line[i] });
    i++;
  }

  return tokens.map((t, idx) => {
    const style = {
      kw: { color: '#c792ea' },
      builtin: { color: '#82aaff' },
      string: { color: '#c3e88d' },
      num: { color: '#f78c6c' },
      comment: { color: '#546e7a', fontStyle: 'italic' },
    }[t.type];
    return <span key={idx} style={style}>{t.val}</span>;
  });
}

function CodeBlock({ code, lang }) {
  const lines = code.replace(/\n$/, '').split('\n');
  const isPython = !lang || lang === 'python' || lang === 'py';
  return (
    <pre className="lesson-code-block">
      <code>
        {lines.map((line, i) => (
          <div key={i} className="lesson-code-line">
            {isPython ? highlightPython(line) : line}
          </div>
        ))}
      </code>
    </pre>
  );
}

function InlineText({ text }) {
  // Parse **bold** and `code` inline
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`'))
          return <code key={i} className="lesson-inline-code">{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function parseBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // Heading
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3) });
      i++; continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4) });
      i++; continue;
    }

    // Callout / note  (> text)
    if (line.startsWith('> ')) {
      blocks.push({ type: 'callout', text: line.slice(2) });
      i++; continue;
    }

    // Horizontal rule
    if (line.trim() === '---') {
      blocks.push({ type: 'hr' });
      i++; continue;
    }

    // Blank line — separator
    if (line.trim() === '') { i++; continue; }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Table  (| col | col |)
    if (line.startsWith('|')) {
      const rows = [];
      let isHeader = false;
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
        if (cells.every((c) => /^[-:]+$/.test(c))) {
          isHeader = true;
          i++;
          continue;
        }
        rows.push({ cells, header: rows.length === 0 && !isHeader });
        i++;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    // Paragraph — collect until blank line or special token
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('## ') &&
      !lines[i].startsWith('### ') &&
      !lines[i].startsWith('> ') &&
      !lines[i].startsWith('- ') &&
      !lines[i].startsWith('* ') &&
      !lines[i].startsWith('|') &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) blocks.push({ type: 'p', text: paraLines.join(' ') });
  }

  return blocks;
}

export default function LessonRenderer({ markdown = '' }) {
  const blocks = parseBlocks(markdown);

  return (
    <div className="lesson-renderer">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2': return <h2 key={i} className="lesson-h2">{b.text}</h2>;
          case 'h3': return <h3 key={i} className="lesson-h3">{b.text}</h3>;
          case 'hr': return <hr key={i} className="lesson-hr" />;
          case 'code': return <CodeBlock key={i} code={b.code} lang={b.lang} />;
          case 'callout': return (
            <div key={i} className="lesson-callout">
              <InlineText text={b.text} />
            </div>
          );
          case 'ul': return (
            <ul key={i} className="lesson-ul">
              {b.items.map((item, j) => (
                <li key={j}><InlineText text={item} /></li>
              ))}
            </ul>
          );
          case 'ol': return (
            <ol key={i} className="lesson-ol">
              {b.items.map((item, j) => (
                <li key={j}><InlineText text={item} /></li>
              ))}
            </ol>
          );
          case 'table': return (
            <div key={i} className="table-wrap lesson-table">
              <table>
                {b.rows.map((row, j) => (
                  j === 0
                    ? <thead key={j}><tr>{row.cells.map((c, k) => <th key={k}>{c}</th>)}</tr></thead>
                    : null
                ))}
                <tbody>
                  {b.rows.slice(1).map((row, j) => (
                    <tr key={j}>{row.cells.map((c, k) => <td key={k}><InlineText text={c} /></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          case 'p': return <p key={i} className="lesson-p"><InlineText text={b.text} /></p>;
          default: return null;
        }
      })}
    </div>
  );
}
