import { Fragment } from 'react';

// Tiny inline formatter: `code` and **bold**. Enough for problem statements,
// without pulling in a markdown dependency.
function inline(text, keyPrefix) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1)
      return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 3)
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export default function Markdownish({ text = '' }) {
  return (
    <>
      {text.split('\n\n').map((block, i) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => l.trimStart().startsWith('- '));
        if (isList) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.trimStart().slice(2), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        // Mixed block: render line by line, joining non-bullet lines as a paragraph
        const mixed = lines.map((l, j) => {
          if (l.trimStart().startsWith('- ')) {
            return <li key={j}>{inline(l.trimStart().slice(2), `${i}-${j}`)}</li>;
          }
          return <span key={j}>{inline(l, `${i}-${j}`)}<br /></span>;
        });
        const hasLi = lines.some((l) => l.trimStart().startsWith('- '));
        return hasLi ? <ul key={i}>{mixed}</ul> : <p key={i}>{mixed}</p>;
      })}
    </>
  );
}
