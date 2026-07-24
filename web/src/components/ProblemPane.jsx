import { useEffect, useState } from 'react';
import Markdownish from './Markdownish.jsx';
import ResultsTable from './ResultsTable.jsx';

const TABS = ['Description', 'Hint', 'Solution'];

export default function ProblemPane({ problem, tables, expected, testCount, status, nav }) {
  const [tab, setTab] = useState('Description');

  // A new problem always opens on its description — never on the solution.
  useEffect(() => setTab('Description'), [problem.id]);

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
        <div className="nav-buttons">
          <button onClick={nav.prev} title="Previous problem" disabled={!nav.hasPrev}>
            ‹
          </button>
          <button onClick={nav.random} title="Random unsolved problem">
            Random
          </button>
          <button onClick={nav.next} title="Next problem" disabled={!nav.hasNext}>
            ›
          </button>
        </div>
      </nav>

      <div className="pane-body">
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
          <>
            <div className="prose">
              <Markdownish text={problem.description} />
            </div>

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
              Submit runs your query against <strong>{testCount} test cases</strong> — this
              example plus hidden ones covering empty tables, ties, duplicates and NULLs.
            </p>
          </>
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
    </section>
  );
}
