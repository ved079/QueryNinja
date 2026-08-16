import { useEffect, useRef } from 'react';
import ResultsTable from './ResultsTable.jsx';
import { diffResults } from '../lib/db.js';

/** Shows one graded test case: its seeded input, and expected vs. actual output. */
export default function CaseDetail({ index, case: c, onRunCase, isRunResult, orderMatters }) {
  const diff = !c.error && !c.pass ? diffResults(c.actual, c.expected, orderMatters) : null;
  const focusRef = useRef(null);

  // Bring the expected-vs-actual compare (or the error) into view whenever a
  // case is opened — including switching straight from one failing case's
  // pill to another's — so there's no scrolling needed to see it.
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [index, isRunResult, c.error, c.pass]);

  return (
    <div className="case-detail">
      <div className="case-title">
        <span>
          {isRunResult ? 'Run result' : 'Case'} {index + 1} — {c.name}
          <span className={`case-pass ${c.pass ? 'ok' : 'bad'}`}>
            {c.pass ? 'Passed' : 'Failed'}
          </span>
        </span>
        <button className="run-case-btn" onClick={() => onRunCase?.(index)}>
          {isRunResult ? 'Run again' : 'Run against this case'}
        </button>
      </div>

      {c.error ? (
        <>
          <h4>Error</h4>
          <pre className="error" ref={focusRef}>{c.error}</pre>
        </>
      ) : (
        <>
          <h4>Input for this case</h4>
          {c.tables.map((t) => (
            <div key={t.name} className="table-block">
              <h5>{t.name}</h5>
              <ResultsTable result={t} empty="(empty table)" />
            </div>
          ))}
          <div className="diff" ref={focusRef}>
            <div>
              <h4>Expected</h4>
              <ResultsTable
                result={c.expected}
                empty="(no rows)"
                columnStatus={diff?.columnMismatches}
                rowStatus={diff?.expectedRowStatus}
              />
            </div>
            <div>
              <h4>Your output</h4>
              <ResultsTable
                result={c.actual}
                empty="(no rows)"
                columnStatus={diff?.columnMismatches}
                rowStatus={diff?.actualRowStatus}
              />
            </div>
          </div>
          {diff && (
            <p className="muted note diff-legend">
              {orderMatters
                ? 'Highlighted rows are out of place or don\'t match — compare them position by position.'
                : 'Highlighted rows in Expected are missing from your output; highlighted rows in Your output aren\'t expected (wrong values, or extras).'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
