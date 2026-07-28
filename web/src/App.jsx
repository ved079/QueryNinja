import { useCallback, useEffect, useRef, useState } from 'react';
import ProblemList from './components/ProblemList.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import ProblemPane from './components/ProblemPane.jsx';
import SqlEditor from './components/SqlEditor.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import TopBar from './components/TopBar.jsx';
import { compare, createDb, exec, describeTables, gradeAll, testsOf } from './lib/db.js';

const STARTER = '-- Write your query here\nSELECT ';
const NAME_KEY = 'sql-practice-name';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseRun, setCaseRun] = useState({});
  const [splitRatio, setSplitRatio] = useState(40);
  const [workspaceSplit, setWorkspaceSplit] = useState(55);
  const [submissions, setSubmissions] = useState([]);
  const [userName, setUserName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const splitterRef = useRef(null);

  const dbRef = useRef(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  const problem = problems.find((p) => p.id === selectedId) ?? null;
  const index = problems.findIndex((p) => p.id === selectedId);

  const prevId = useRef(null);
  // Reset editor code synchronously when the problem changes, so the
  // SqlEditor always renders with the correct initial value from the start.
  if (problem && problem.id !== prevId.current) {
    prevId.current = problem.id;
    setCode(progress[problem.id]?.code || STARTER);
  }

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
    randomAll: () => {
      const pool = problems.filter((p) => p.id !== selectedId);
      setSelectedId(pool[Math.floor(Math.random() * pool.length)].id);
    },
  };

  useEffect(() => {
    (async () => {
      try {
        const p = await fetch('/api/problems').then((r) => r.json());
        setProblems(p);
        setSelectedId((cur) => cur ?? p[0]?.id ?? null);
      } catch (err) {
        setLoadError(`Could not reach the API server. Is it running? (${err.message})`);
      }
    })();
  }, []);

  // Progress/submissions are per-name (no real login — just whatever name
  // is set via the name button). Re-fetch whenever that name changes so
  // switching names swaps in that person's own data.
  useEffect(() => {
    (async () => {
      try {
        const q = `?user=${encodeURIComponent(userName)}`;
        const [pr, subs] = await Promise.all([
          fetch(`/api/progress${q}`).then((r) => r.json()),
          fetch(`/api/submissions${q}`).then((r) => r.json()),
        ]);
        setProgress(pr);
        setSubmissions(subs);
      } catch (err) {
        setLoadError(`Could not reach the API server. Is it running? (${err.message})`);
      }
    })();
  }, [userName]);

  const changeName = useCallback(() => {
    setNameModalOpen(true);
  }, []);

  // Rebuild a fresh database whenever the selected problem changes.
  useEffect(() => {
    if (!problem) return;
    let cancelled = false;
    setOutput(null);
    setVerdict(null);
    setSelectedCase(null);
    setCaseRun({});
    setExpected(null);

    (async () => {
      try {
        const db = await createDb(problem);
        if (cancelled) return db.close();
        dbRef.current?.close();
        dbRef.current = db;
        setTables(describeTables(db));

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
      body: JSON.stringify({ user: userName, id, status, code: sqlText }),
    });
    const saved = await res.json();
    setProgress((prev) => ({ ...prev, [id]: saved }));
  }, [userName]);

  /** Run the query for its output only — no grading. */
  const run = useCallback(() => {
    if (!problem || !dbRef.current) return;
    setVerdict(null);
    setSelectedCase(null);
    setCaseRun({});
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

  /**
   * Run against every test case and record the result. Every case's input,
   * expected and actual output are kept (not just the first failure) so any
   * pill in the verdict can be clicked to inspect that case.
   */
  const submit = useCallback(async () => {
    if (!problem) return;
    const sqlText = codeRef.current;
    setVerdict({ pending: true });
    setSelectedCase(null);
    setCaseRun({});
    try {
      const report = await gradeAll(problem, sqlText);
      const pass = report.passed === report.total;

      setVerdict({
        pass,
        passed: report.passed,
        total: report.total,
        cases: report.cases,
        reason: pass ? `Passed all ${report.total} test cases.` : report.firstFailure.reason,
      });
      // Default to the first failing case; on a full pass, open the example
      // (case 0) so there's something to look at without an extra click.
      setSelectedCase(report.firstFailure ? report.firstFailure.index : 0);
      setOutput(null);

      await saveProgress(problem.id, pass ? 'solved' : 'attempted', sqlText);
      const entry = {
        problemId: problem.id,
        code: sqlText,
        status: pass ? 'solved' : 'attempted',
        submittedAt: new Date().toISOString(),
      };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, ...entry }),
      });
      if (res.ok) {
        const saved = await res.json();
        entry.id = saved.id;
      }
      setSubmissions((prev) => [...prev, entry]);
    } catch (err) {
      setOutput({ error: err.message });
      setVerdict({ pass: false, reason: err.message });
    }
  }, [problem, saveProgress, userName]);

  const runCase = useCallback(async (index) => {
    if (!problem) return;
    const sqlText = codeRef.current;
    const test = testsOf(problem)[index];
    const db = await createDb(problem, test);
    try {
      const actual = exec(db, sqlText);
      const refDb = await createDb(problem, test);
      let expected;
      try {
        expected = exec(refDb, problem.solutionSql);
      } finally {
        refDb.close();
      }
      const tables = describeTables(db);
      const verdict = actual && expected ? compare(actual, expected, problem.orderMatters) : { pass: false, reason: 'Could not compare results.' };
      setCaseRun((prev) => ({ ...prev, [index]: { index, name: test.name, tables, expected, actual, pass: verdict.pass, reason: verdict.reason } }));
    } catch (err) {
      setCaseRun((prev) => ({ ...prev, [index]: { index, name: test.name, pass: false, error: err.message } }));
    } finally {
      db.close();
    }
  }, [problem]);

  const loadSubmission = useCallback((entry) => {
    setCode(entry.code);
    setEditorNonce((n) => n + 1);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    await fetch(`/api/user?user=${encodeURIComponent(userName)}`, { method: 'DELETE' });
    setProgress({});
    setSubmissions([]);
    localStorage.removeItem(NAME_KEY);
    setUserName('');
    setNameModalOpen(true);
  }, [userName]);

  if (loadError) return <div className="fatal">{loadError}</div>;
  if (!problems.length) return <div className="fatal muted">Loading problems…</div>;

  return (
    <div className="layout">
      <TopBar
        onShowSidebar={() => setSidebarOpen(true)}
        onShowProgress={() => setProgressOpen(true)}
        userName={userName}
        onChangeName={changeName}
        nav={nav}
        onRun={run}
        onSubmit={submit}
      />

      <main className="workspace">
        {problem && (
          <div style={{ flex: workspaceSplit, minWidth: 0 }}>
            <ProblemPane
              problem={problem}
              tables={tables}
              expected={expected}
              tests={testsOf(problem)}
              verdict={verdict}
              caseRun={caseRun}
              selectedCase={selectedCase}
              onSelectCase={setSelectedCase}
              onRunCase={runCase}
              status={progress[problem.id]?.status}
              savedCode={progress[problem.id]?.code}
              submissions={submissions}
              onLoadSubmission={loadSubmission}
            />
          </div>
        )}

        <div
          className="splitter-vert"
          onMouseDown={(e) => {
            e.preventDefault();
            const pane = e.currentTarget.parentElement;
            const totalW = pane.offsetWidth - e.currentTarget.offsetWidth;
            const startX = e.clientX;
            const startFlex = workspaceSplit;
            const onMove = (me) => {
              const dx = me.clientX - startX;
              const pct = startFlex + (dx / totalW) * 100;
              setWorkspaceSplit(Math.min(85, Math.max(20, pct)));
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />

        <section className="editor-pane" style={{ flex: 100 - workspaceSplit, minWidth: 0 }}>
          <div className="toolbar">
            <span className="muted">SQLite</span>
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
            </div>
          </div>

          <div className="editor-wrap" style={{ flex: splitRatio }}>
            {problem && (
              <SqlEditor
                value={code}
                docKey={`${problem.id}:${editorNonce}`}
                onChange={setCode}
                onRun={run}
              />
            )}
          </div>

          <div
            className="splitter"
            onMouseDown={(e) => {
              e.preventDefault();
              const pane = e.currentTarget.parentElement;
              const totalH = pane.offsetHeight - pane.querySelector('.splitter').offsetHeight;
              const startY = e.clientY;
              const startFlex = splitRatio;
              const onMove = (me) => {
                const dy = me.clientY - startY;
                const pct = startFlex + (dy / totalH) * 100;
                setSplitRatio(Math.min(90, Math.max(10, pct)));
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />

          <div className="output" style={{ flex: 100 - splitRatio }}>
            {verdict?.pending && <p className="muted">Running test cases…</p>}

            {verdict && !verdict.pending && (() => {
              const dynamicPass = verdict.cases.every((c, i) => (caseRun[i]?.pass ?? c.pass));
              const dynamicCount = verdict.cases.reduce((n, c, i) => n + ((caseRun[i]?.pass ?? c.pass) ? 1 : 0), 0);
              const firstFail = verdict.cases.find((c, i) => !(caseRun[i]?.pass ?? c.pass));
              return (
                <div className={`verdict ${dynamicPass ? 'pass' : 'fail'}`}>
                  <strong>
                    {dynamicPass ? 'Accepted' : 'Wrong Answer'}
                    {verdict.total != null && (
                      <span className="score">
                        {dynamicCount} / {verdict.total} test cases passed
                      </span>
                    )}
                  </strong>
                  <span>
                    {dynamicPass
                      ? `Passed all ${verdict.total} test cases.`
                      : `Case ${firstFail.index + 1} — ${firstFail.name}: see the Test Cases tab.`}
                  </span>
                </div>
              );
            })()}

            {!verdict && output?.error && <pre className="error">{output.error}</pre>}
            {!verdict && output && !output.error && (
              <ResultsTable result={output.result} empty="Query ran, but returned no rows." />
            )}

            {!output && !verdict && <p className="muted">Run a query to see its output.</p>}
          </div>
        </section>
      </main>

      {nameModalOpen && (
        <div className="modal-overlay" onClick={() => setNameModalOpen(false)}>
          <div className="modal-body name-modal" onClick={(e) => e.stopPropagation()}>
            <div className="name-modal-inner">
              <h3>Set your name</h3>
              <p className="muted">This name keeps your progress saved — you will lose it without one.</p>
              <input
                className="name-input"
                type="text"
                defaultValue={userName}
                placeholder="Your name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      localStorage.setItem(NAME_KEY, val);
                      setUserName(val);
                      setNameModalOpen(false);
                    }
                  }
                }}
              />
              <div className="name-modal-actions">
                <button onClick={() => setNameModalOpen(false)}>Cancel</button>
                <button className="primary" onClick={(e) => {
                  const input = e.currentTarget.closest('.name-modal-inner').querySelector('.name-input');
                  const val = input.value.trim();
                  if (val) {
                    localStorage.setItem(NAME_KEY, val);
                    setUserName(val);
                    setNameModalOpen(false);
                  }
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {progressOpen && (
        <div className="modal-overlay" onClick={() => setProgressOpen(false)}>
          <div className="modal-body wide" onClick={(e) => e.stopPropagation()}>
            <ProgressPanel
              problems={problems}
              progress={progress}
              submissions={submissions}
              userName={userName}
              onDeleteAccount={handleDeleteAccount}
              onHide={() => setProgressOpen(false)}
            />
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div className="modal-overlay" onClick={() => setSidebarOpen(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <ProblemList
              problems={problems}
              progress={progress}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); }}
              onHide={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
