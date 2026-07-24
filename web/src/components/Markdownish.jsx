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
      {text.split('\n\n').map((para, i) => (
        <p key={i}>{inline(para, i)}</p>
      ))}
    </>
  );
}
