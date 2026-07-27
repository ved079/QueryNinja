import ResultsTable from './ResultsTable.jsx';

/** Shows one graded test case: its seeded input, and expected vs. actual output. */
export default function CaseDetail({ index, case: c, onRunCase, isRunResult }) {
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
          <pre className="error">{c.error}</pre>
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
          <div className="diff">
            <div>
              <h4>Expected</h4>
              <ResultsTable result={c.expected} empty="(no rows)" />
            </div>
            <div>
              <h4>Your output</h4>
              <ResultsTable result={c.actual} empty="(no rows)" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
