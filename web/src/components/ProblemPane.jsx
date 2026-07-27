import { useEffect, useState } from 'react';
import Markdownish from './Markdownish.jsx';
import ResultsTable from './ResultsTable.jsx';
import CaseDetail from './CaseDetail.jsx';

const TABS = ['Description', 'Test Cases', 'Hint', 'Solution'];

export default function ProblemPane({
  problem,
  tables,
  expected,
  tests,
  verdict,
  caseRun,
  selectedCase,
  onSelectCase,
  onRunCase,
  status,
}) {
  const [tab, setTab] = useState('Description');

  useEffect(() => setTab('Description'), [problem.id]);

  // Jump to the Test Cases tab automatically whenever a case gets selected —
  // i.e. right after Submit picks the first failure, or a pill is clicked.
  useEffect(() => {
    if (selectedCase != null) setTab('Test Cases');
  }, [selectedCase]);

  // Only failing cases are worth looking at once you've passed the rest —
  // a re-run via "Run again" can flip a case's pass state without a fresh
  // Submit, so this recomputes from caseRun rather than trusting verdict alone.
  const failingCases = verdict?.cases
    ?.map((c, i) => ({ ...c, i, pass: caseRun?.[i]?.pass ?? c.pass }))
    .filter((c) => !c.pass) ?? [];

  return (
    <section className="problem-pane">
      <nav className="pane-nav">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <div className="pane-body">
        <div className="pane-body-top">
          <div className="problem-head">
            <h2>
              {problem.number}. {problem.title}
            </h2>
            <div className="badges">
              <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
                {problem.difficulty}
              </span>
              {status === 'solved' && <span className="badge solved">Solved</span>}
              {status === 'attempted' && <span className="badge attempted">Attempted</span>}
              {(problem.tags ?? []).map((t) => (
                <span key={t} className="badge">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {tab === 'Description' && (
            <div className="prose">
              <Markdownish text={problem.description} />
            </div>
          )}

          {tab === 'Test Cases' && verdict?.cases && (
            failingCases.length ? (
              <div className="pills">
                {failingCases.map((c) => (
                  <button
                    key={c.i}
                    className={`pill bad ${selectedCase === c.i ? 'selected' : ''}`}
                    title={`Case ${c.i + 1} — ${c.name}`}
                    onClick={() => onSelectCase(selectedCase === c.i ? null : c.i)}
                  >
                    {c.i + 1}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted note">All {verdict.cases.length} test cases passed.</p>
            )
          )}

          {tab === 'Test Cases' && !verdict?.cases && (
            <div className="pills">
              {tests.map((t, i) => (
                <button
                  key={i}
                  className={`pill ${selectedCase === i ? 'selected' : ''}`}
                  title={`Case ${i + 1} — ${t.name}`}
                  onClick={() => onSelectCase(selectedCase === i ? null : i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          {tab === 'Hint' && (
            <div className="prose">
              {problem.hint ? (
                <p className="hint">{problem.hint}</p>
              ) : (
                <p className="muted">No hint for this one — you're on your own.</p>
              )}
            </div>
          )}

          {tab === 'Solution' && (
            <div className="prose">
              <p className="muted note">One accepted answer — not the only one.</p>
              <pre className="solution">{problem.solutionSql}</pre>
            </div>
          )}
        </div>

        {tab === 'Description' && (
          <div className="pane-body-scroll">
            <h3>Example input</h3>
            {tables.map((t) => (
              <div key={t.name} className="table-block">
                <h4>{t.name}</h4>
                <ResultsTable result={t} empty="(empty table)" />
              </div>
            ))}

            <h3>Expected output</h3>
            {expected ? (
              <>
                <ResultsTable result={expected} empty="(no rows)" />
                <p className="muted note">
                  {expected.rows.length} row{expected.rows.length === 1 ? '' : 's'}
                  {problem.orderMatters ? ' — order matters' : ' — any row order accepted'}
                </p>
              </>
            ) : (
              <p className="muted">Computing…</p>
            )}

            <p className="muted note">
              Submit runs your query against <strong>{tests.length} test cases</strong> — this
              example plus hidden ones covering empty tables, ties, duplicates and NULLs.
            </p>
          </div>
        )}

        {tab === 'Test Cases' && (
          <div className="pane-body-scroll">
            {!verdict?.cases ? (
              <p className="muted">
                {selectedCase != null
                  ? 'Submit your query first to see this test case’s result.'
                  : 'Submit your query first to see test case results here.'}
              </p>
            ) : selectedCase != null ? (
              <CaseDetail
                index={selectedCase}
                case={caseRun?.[selectedCase] ?? verdict.cases[selectedCase]}
                onRunCase={onRunCase}
                isRunResult={selectedCase in (caseRun ?? {})}
              />
            ) : failingCases.length ? (
              <p className="muted">Click a numbered case above to inspect it.</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
