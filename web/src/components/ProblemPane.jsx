import { useEffect, useState } from 'react';
import Markdownish from './Markdownish.jsx';
import ResultsTable from './ResultsTable.jsx';
import CaseDetail from './CaseDetail.jsx';

const TABS = ['Description', 'Past Submissions', 'Hint', 'Solution'];

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
  starred,
  savedCode,
  savedSolution,
  savedOutputExplanation,
  submissions,
  onLoadSubmission,
  onToggleStar,
}) {
  const [tab, setTab] = useState('Description');
  const [bodySplit, setBodySplit] = useState(40);

  // Only failing cases are worth looking at once you've passed the rest —
  // a re-run via "Run again" can flip a case's pass state without a fresh
  // Submit, so this recomputes from caseRun rather than trusting verdict alone.
  const failingCases = verdict?.cases
    ?.map((c, i) => ({ ...c, i, pass: caseRun?.[i]?.pass ?? c.pass }))
    .filter((c) => !c.pass) ?? [];

  useEffect(() => setTab('Description'), [problem.id]);

  // Jump to the Test Cases tab automatically whenever a case gets selected —
  // i.e. right after Submit picks the first failure, or a pill is clicked.
  // If no failures, fall back to Description.
  useEffect(() => {
    if (selectedCase != null) setTab('Test Cases');
  }, [selectedCase]);
  useEffect(() => {
    if (tab === 'Test Cases' && !failingCases.length) setTab('Description');
  }, [tab, failingCases.length]);

  const tabs = failingCases.length ? ['Description', 'Test Cases', 'Past Submissions', 'Hint', 'Solution'] : TABS;

  const pastSubs = (submissions ?? [])
    .filter((s) => s.problemId === problem.id)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return (
    <section className="problem-pane">
      <nav className="pane-nav">
        <div className="tabs">
          {tabs.map((t) => (
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
        <div className="pane-body-top" style={{ flex: bodySplit }}>
          {tab !== 'Description' && tab !== 'Test Cases' && tab !== 'Past Submissions' && (
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
                  <button
                    className={`star-btn ${starred ? 'starred' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleStar(problem.id); }}
                    title={starred ? 'Unstar' : 'Star'}
                  >
                    <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="14" height="14">
                      <path fill="currentColor" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {tab === 'Description' && (
              <>
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
                    <button
                      className={`star-btn ${starred ? 'starred' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleStar(problem.id); }}
                      title={starred ? 'Unstar' : 'Star'}
                    >
                      <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="14" height="14">
                        <path fill="currentColor" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="prose">
                  <Markdownish text={problem.description} />
                </div>
              </>
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
                {status === 'solved' ? (
                  <>
                    {savedCode && (
                      <>
                        <p className="muted note">Your accepted solution:</p>
                        <pre className="solution">{savedCode}</pre>
                      </>
                    )}
                    {savedSolution && (
                      <details style={{ marginTop: 12 }} open={!savedCode}>
                        <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Reference answer</summary>
                        <pre className="solution" style={{ marginTop: 8 }}>{savedSolution}</pre>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="muted">Solve this problem to unlock the solution.</p>
                )}
              </div>
            )}
          </div>

        <div
          className="splitter"
          onMouseDown={(e) => {
            e.preventDefault();
            const pane = e.currentTarget.parentElement;
            const totalH = pane.offsetHeight - pane.querySelector('.splitter').offsetHeight;
            const startY = e.clientY;
            const startPct = bodySplit;
            const onMove = (me) => {
              const dy = me.clientY - startY;
              const pct = startPct + (dy / totalH) * 100;
              setBodySplit(Math.min(90, Math.max(10, pct)));
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />

        <div className="pane-body-bottom" style={{ flex: 100 - bodySplit }}>
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

              {status === 'solved' && savedOutputExplanation ? (
                <>
                  <h3>Why the output looks like this</h3>
                  <div className="prose">
                    <Markdownish text={savedOutputExplanation} />
                  </div>
                </>
              ) : (
                <p className="muted note">
                  Submit runs your query against <strong>{tests.length} test cases</strong> — this
                  example plus hidden ones covering empty tables, ties, duplicates and NULLs.
                </p>
              )}
            </div>
          )}

          {tab === 'Past Submissions' && (
            <div className="pane-body-scroll" style={{ flex: 'none' }}>
              {pastSubs.length === 0 ? (
                <p className="muted">No past submissions for this problem.</p>
              ) : (
                <div className="past-subs">
                  {pastSubs.map((s) => (
                    <button
                      key={s.id ?? s.submittedAt}
                      className="past-sub-row"
                      onClick={() => onLoadSubmission(s)}
                    >
                      <span className="past-sub-date">
                        {new Date(s.submittedAt).toLocaleDateString()}
                        <span className="muted">
                          {' '}{new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                      <span className={`past-sub-status ${s.status === 'solved' ? 'solved' : 'attempted'}`}>
                        {s.status === 'solved' ? 'Solved' : 'Attempted'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
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
                  orderMatters={problem.orderMatters}
                />
              ) : failingCases.length ? (
                <p className="muted">Click a numbered case above to inspect it.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
