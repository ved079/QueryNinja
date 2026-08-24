export default function PythonProblemPane({ problem, status, savedSolution, outputExplanation }) {
  if (!problem) return null;

  return (
    <div className="python-problem-pane">
      <div className="python-problem-header">
        <span className="python-problem-number">#{problem.number}</span>
        <h2 className="python-problem-title">{problem.title}</h2>
        <span className={`python-problem-difficulty ${problem.difficulty.toLowerCase()}`}>
          {problem.difficulty}
        </span>
        {status === 'solved' && <span className="python-solved-badge">Solved</span>}
      </div>

      <div className="python-problem-tags">
        {(problem.tags || []).map((tag) => (
          <span key={tag} className="python-tag">{tag}</span>
        ))}
        <span className="python-tag category">{problem.category}</span>
      </div>

      <div className="python-problem-description">
        {problem.description.split('\n').map((line, i) => {
          // Simple markdown-like rendering
          if (line.startsWith('```')) return <pre key={i} className="python-code-block">{line.replace(/^```\w*/, '').replace(/```$/, '')}</pre>;
          if (line.startsWith('- ')) return <li key={i}>{renderInline(line.slice(2))}</li>;
          if (line.match(/^\d+\./)) return <li key={i}>{renderInline(line)}</li>;
          if (line.trim() === '') return <br key={i} />;
          return <p key={i}>{renderInline(line)}</p>;
        })}
      </div>

      <div className="python-starter-code">
        <div className="python-starter-label">Starter Code</div>
        <pre className="python-starter-pre">{problem.starterCode}</pre>
      </div>

      {status === 'solved' && (savedSolution || problem.solutionCode) && (
        <div className="python-solution">
          <h4>Reference Solution</h4>
          <pre className="python-solution-code">{savedSolution || problem.solutionCode}</pre>
          {outputExplanation && (
            <div className="python-explanation">
              <h4>Explanation</h4>
              <p>{outputExplanation}</p>
            </div>
          )}
        </div>
      )}

      {status !== 'solved' && (
        <div className="python-hint">
          <h4>Hint</h4>
          <p>{problem.hint}</p>
        </div>
      )}
    </div>
  );
}

function renderInline(text) {
  // Handle bold, inline code, and links
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`(.*?)`/);

    let nextMatch = null;
    let matchType = null;

    if (boldMatch && (!codeMatch || boldMatch.index < codeMatch.index)) {
      nextMatch = boldMatch;
      matchType = 'bold';
    } else if (codeMatch) {
      nextMatch = codeMatch;
      matchType = 'code';
    }

    if (!nextMatch) {
      parts.push(remaining);
      break;
    }

    if (nextMatch.index > 0) {
      parts.push(remaining.slice(0, nextMatch.index));
    }

    if (matchType === 'bold') {
      parts.push(<strong key={key++}>{nextMatch[1]}</strong>);
    } else if (matchType === 'code') {
      parts.push(<code key={key++} className="inline-code">{nextMatch[1]}</code>);
    }

    remaining = remaining.slice(nextMatch.index + nextMatch[0].length);
  }

  return parts;
}
