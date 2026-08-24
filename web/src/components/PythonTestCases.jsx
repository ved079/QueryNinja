import { useState } from 'react';

export default function PythonTestCases({ tests, onRunTest, caseRun }) {
  const [expanded, setExpanded] = useState(null);

  if (!tests || !tests.length) return null;

  return (
    <div className="python-test-cases">
      <h4 className="python-test-cases-title">Test Cases ({tests.length})</h4>
      {tests.map((tc, i) => {
        const isExpanded = expanded === i;
        const run = caseRun?.[i];
        return (
          <div key={i} className={`python-test-case ${isExpanded ? 'expanded' : ''}`}>
            <button
              className="python-test-case-header"
              onClick={() => setExpanded(isExpanded ? null : i)}
            >
              <span className={`python-test-case-status ${run ? (run.pass ? 'pass' : 'fail') : ''}`}>
                {run ? (run.pass ? '✓' : '✗') : (i + 1)}
              </span>
              <span className="python-test-case-name">{tc.name}</span>
              <span className="python-test-case-chevron">{isExpanded ? '▾' : '▸'}</span>
            </button>
            {isExpanded && (
              <div className="python-test-case-detail">
                <div className="python-test-case-section">
                  <div className="python-test-case-label">Input</div>
                  <pre className="python-test-case-code">{tc.input}</pre>
                </div>
                <div className="python-test-case-section">
                  <div className="python-test-case-label">Expected Output</div>
                  <pre className="python-test-case-code expected">{tc.expectedOutput}</pre>
                </div>
                {run && (
                  <div className="python-test-case-section">
                    <div className="python-test-case-label">Your Output</div>
                    <pre className={`python-test-case-code ${run.pass ? 'pass' : 'fail'}`}>
                      {run.error || run.actual || '(no output)'}
                    </pre>
                  </div>
                )}
                <button
                  className="python-run-test-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRunTest?.(i);
                  }}
                >
                  Run this test
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
