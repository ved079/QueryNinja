import { useCallback, useEffect, useRef, useState } from 'react';
import ProblemList from './components/ProblemList.jsx';
import ProblemPane from './components/ProblemPane.jsx';
import SqlEditor from './components/SqlEditor.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import { createDb, exec, describeTables, gradeAll, testsOf } from './lib/db.js';

const STARTER = '-- Write your query here\nSELECT ';

export default function App() {
  const [problems, setProblems] = useState([]);
  const [progress, setProgress] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [tables, setTables] = useState([]);
  const [expected, setExpected] = useState(null);
  const [code, setCode] = useState(STARTER);
  const [output, setOutput] = useState(null); // { result } | { error }
  const [verdict, setVerdict] = useState(null); // { pass, reason }
  const [loadError, setLoadError] = useState(null);
  const [editorNonce, setEditorNonce] = useState(0);

  const dbRef = useRef(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  const problem = problems.find((p) => p.id === selectedId) ?? null;
  const index = problems.findIndex((p) => p.id === selectedId);

  const nav = {
    hasPrev: index > 0,
    hasNext: index >= 0 && index < problems.length - 1,
    prev: () => index > 0 && setSelectedId(problems[index - 1].id),
    next: () => index < problems.length - 1 && setSelectedId(problems[index + 1].id),
    random: () => {
      const pool = problems.filter(
        (p) => progress[p.id]?.status !== 'solved' && p.id !== selectedId
      );
      const from = pool.length ? pool : problems;
      setSelectedId(from[Math.floor(Math.random() * from.length)].id);
    },
  };

  useEffect(() => {
    (async () => {
      try {
        const [p, pr] = await Promise.all([
          fetch('/api/problems').then((r) => r.json()),
          fetch('/api/progress').then((r) => r.json()),
        ]);
        setProblems(p);
        setProgress(pr);
        setSelectedId((cur) => cur ?? p[0]?.id ?? null);
      } catch (err) {
        setLoadError(`Could not reach the API server. Is it running? (${err.message})`);
      }
    })();
  }, []);

  // Rebuild a fresh database whenever the selected problem changes.
  useEffect(() => {
    if (!problem) return;
    let cancelled = false;
    setOutput(null);
    setVerdict(null);
    setExpected(null);

    (async () => {
      try {
        const db = await createDb(problem);
        if (cancelled) return db.close();
        dbRef.current?.close();
        dbRef.current = db;
        setTables(describeTables(db));
        setCode(progress[problem.id]?.code || STARTER);

        // Sample output shown with the problem: derived from the reference
        // solution rather than stored, so the two can never disagree.
        const refDb = await createDb(problem);
        try {
          setExpected(exec(refDb, problem.solutionSql));
        } finally {
          refDb.close();
        }
      } catch (err) {
        setLoadError(`Failed to set up "${problem.title}": ${err.message}`);
      }
    })();

    return () => {
      cancelled = true;
    };
    // progress is intentionally excluded: saved code is only restored on switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, problems]);

  const saveProgress = useCallback(async (id, status, sqlText) => {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, code: sqlText }),
    });
    const saved = await res.json();
    setProgress((prev) => ({ ...prev, [id]: saved }));
  }, []);

  /** Run the query for its output only — no grading. */
  const run = useCallback(() => {
    if (!problem || !dbRef.current) return;
    setVerdict(null);
    try {
      // Re-seed so a stray UPDATE/DELETE in a previous run can't poison results.
      createDb(problem).then((db) => {
        dbRef.current?.close();
        dbRef.current = db;
        try {
          setOutput({ result: exec(db, codeRef.current) });
        } catch (err) {
          setOutput({ error: err.message });
        }
      });
    } catch (err) {
      setOutput({ error: err.message });
    }
  }, [problem]);

  /** Run against every test case and record the result. */
  const submit = useCallback(async () => {
    if (!problem) return;
    const sqlText = codeRef.current;
    setVerdict({ pending: true });
    try {
      const report = await gradeAll(problem, sqlText);
      const pass = !report.failure;

      setVerdict({
        pass,
        passed: report.passed,
        total: report.total,
        failure: report.failure,
        reason: pass
          ? `Passed all ${report.total} test cases.`
          : report.failure.reason,
      });
      setOutput(
        report.failure?.error
          ? { error: report.failure.error }
          : { result: report.failure?.actual ?? null }
      );

      await saveProgress(problem.id, pass ? 'solved' : 'attempted', sqlText);
    } catch (err) {
      setOutput({ error: err.message });
      setVerdict({ pass: false, reason: err.message });
    }
  }, [problem, saveProgress]);

  if (loadError) return <div className="fatal">{loadError}</div>;
  if (!problems.length) return <div className="fatal muted">Loading problems…</div>;

  return (
    <div className="layout">
      <ProblemList
        problems={problems}
        progress={progress}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <main className="workspace">
        {problem && (
          <ProblemPane
            problem={problem}
            tables={tables}
            expected={expected}
            testCount={testsOf(problem).length}
            status={progress[problem.id]?.status}
            nav={nav}
          />
        )}

        <section className="editor-pane">
          <div className="toolbar">
            <span className="muted">SQLite · Ctrl+Enter to run</span>
            <div className="actions">
              <button
                onClick={() => {
                  setCode(STARTER);
                  // The editor only rebuilds its document when docKey changes.
                  setEditorNonce((n) => n + 1);
                }}
                title="Clear the editor"
              >
                Reset
              </button>
              <button onClick={run}>Run</button>
              <button className="primary" onClick={submit}>
                Submit
              </button>
            </div>
          </div>

          {problem && (
            <SqlEditor
              value={code}
              docKey={`${problem.id}:${editorNonce}`}
              onChange={setCode}
              onRun={run}
            />
          )}

          <div className="output">
            {verdict?.pending && <p className="muted">Running test cases…</p>}

            {verdict && !verdict.pending && (
              <div className={`verdict ${verdict.pass ? 'pass' : 'fail'}`}>
                <strong>
                  {verdict.pass ? 'Accepted' : 'Wrong Answer'}
                  {verdict.total != null && (
                    <span className="score">
                      {verdict.passed} / {verdict.total} test cases passed
                    </span>
                  )}
                </strong>
                <span>
                  {verdict.failure
                    ? `Failed on case ${verdict.failure.index + 1} — ${verdict.failure.name}: ${verdict.reason}`
                    : verdict.reason}
                </span>
                {verdict.total != null && (
                  <div className="pills">
                    {Array.from({ length: verdict.total }, (_, i) => (
                      <span
                        key={i}
                        className={`pill ${
                          i < verdict.passed ? 'ok' : i === verdict.passed ? 'bad' : 'skipped'
                        }`}
                        title={`Case ${i + 1}`}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {output?.error && <pre className="error">{output.error}</pre>}

            {verdict?.failure ? (
              <div className="failure-detail">
                <h4>Input for this case</h4>
                {verdict.failure.tables.map((t) => (
                  <div key={t.name} className="table-block">
                    <h5>{t.name}</h5>
                    <ResultsTable result={t} empty="(empty table)" />
                  </div>
                ))}
                <div className="diff">
                  <div>
                    <h4>Expected</h4>
                    <ResultsTable result={verdict.failure.expected} empty="(no rows)" />
                  </div>
                  <div>
                    <h4>Your output</h4>
                    <ResultsTable result={verdict.failure.actual} empty="(no rows)" />
                  </div>
                </div>
              </div>
            ) : (
              output &&
              !output.error && (
                <ResultsTable result={output.result} empty="Query ran, but returned no rows." />
              )
            )}

            {!output && !verdict && <p className="muted">Run a query to see its output.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
