export default function PythonOutput({ output, verdict, isRunning }) {
  if (isRunning) {
    return (
      <div className="python-output">
        <div className="python-output-status running">Running...</div>
      </div>
    );
  }

  if (verdict) {
    return (
      <div className="python-output">
        <div className={`python-output-status ${verdict.allPassed ? 'pass' : 'fail'}`}>
          {verdict.allPassed ? 'Accepted' : 'Wrong Answer'}
          <span className="python-score">{verdict.passed} / {verdict.total} test cases passed</span>
        </div>
        <div className="python-test-results">
          {verdict.results.map((r, i) => (
            <div key={i} className={`python-test-result ${r.passed ? 'pass' : 'fail'}`}>
              <span className="python-test-indicator">{r.passed ? '✓' : '✗'}</span>
              <span className="python-test-name">{r.name}</span>
              {!r.passed && r.stderr && (
                <span className="python-test-error">{r.stderr}</span>
              )}
              {!r.passed && !r.stderr && r.actual !== r.expected && (
                <span className="python-test-diff">
                  Expected: <code>{r.expected}</code>
                  Got: <code>{r.actual}</code>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (output) {
    if (output.error) {
      return (
        <div className="python-output">
          <pre className="python-error">{output.error}</pre>
        </div>
      );
    }

    return (
      <div className="python-output">
        {output.stderr && (
          <div className="python-output-section">
            <div className="python-output-label">stderr</div>
            <pre className="python-stderr">{output.stderr}</pre>
          </div>
        )}
        {output.stdout && (
          <div className="python-output-section">
            <div className="python-output-label">stdout</div>
            <pre className="python-stdout">{output.stdout}</pre>
          </div>
        )}
        {!output.stdout && !output.stderr && (
          <div className="python-output-empty">No output</div>
        )}
        {output.timedOut && (
          <div className="python-output-timeout">Timed out (8s limit)</div>
        )}
      </div>
    );
  }

  return (
    <div className="python-output">
      <div className="python-output-empty">Run your code to see output here</div>
    </div>
  );
}
