import { useCallback, useEffect, useRef, useState } from 'react';
import ProblemList from './components/ProblemList.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import ProblemPane from './components/ProblemPane.jsx';
import SqlEditor from './components/SqlEditor.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import TopBar from './components/TopBar.jsx';
import NameModal from './components/NameModal.jsx';
import Markdownish from './components/Markdownish.jsx';
import { compare, createDb, exec, describeTables, gradeAll, testsOf, diffResults } from './lib/db.js';

const STARTER = '-- Write your query here\nSELECT ';
const NAME_KEY = 'sql-practice-name';
const NAME_SKIP_KEY = 'sql-practice-name-skip';

export default function App() {
  const [problems, setProblems] = useState([]);
  const [progress, setProgress] = useState({});
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('sql-practice-problem') || null);
  const [tables, setTables] = useState([]);
  const [expected, setExpected] = useState(null);
  const [code, setCode] = useState(STARTER);
  const [output, setOutput] = useState(null); // { result } | { error }
  const [runMatch, setRunMatch] = useState(null); // null | true | false — vs. the example's expected output
  const [verdict, setVerdict] = useState(null); // { pass, reason }
  const [loadError, setLoadError] = useState(null);
  const [editorNonce, setEditorNonce] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 'normal' = the original 90; 'complex' = whatever's been added since —
  // toggling this scopes prev/next/Go-to/Problem-List to just that set.
  const [problemMode, setProblemMode] = useState('normal');
  const [progressOpen, setProgressOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseRun, setCaseRun] = useState({});
  const [splitRatio, setSplitRatio] = useState(40);
  const [workspaceSplit, setWorkspaceSplit] = useState(55);
  const [submissions, setSubmissions] = useState([]);
  const [userName, setUserName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameSkipped, setNameSkipped] = useState(() => localStorage.getItem(NAME_SKIP_KEY) === '1');
  const splitterRef = useRef(null);

  const dbRef = useRef(null);
  const codeRef = useRef(code);
  codeRef.current = code;
  const namePromptedRef = useRef(false);

  const handleCodeChange = useCallback((val) => {
    setCode(val);
    if (!userName && !nameSkipped && !namePromptedRef.current) {
      namePromptedRef.current = true;
      setNameModalOpen(true);
    }
  }, [userName, nameSkipped]);

  const problem = problems.find((p) => p.id === selectedId) ?? null;

  // The original 90 are numbers 1-90; anything added since is "complex."
  const visibleProblems = problems.filter((p) =>
    problemMode === 'complex' ? p.number > 90 : p.number <= 90
  );
  const index = visibleProblems.findIndex((p) => p.id === selectedId);

  const prevId = useRef(null);
  // Reset editor code synchronously when the problem changes, so the
  // SqlEditor always renders with the correct initial value from the start.
  if (problem && problem.id !== prevId.current) {
    prevId.current = problem.id;
    // Debug-style problems pre-fill the editor with their buggy query
    // instead of a blank placeholder — you're fixing something, not
    // starting from scratch.
    setCode(progress[problem.id]?.code || problem.startingSql || STARTER);
  }

  const nav = {
    hasPrev: index > 0,
    hasNext: index >= 0 && index < visibleProblems.length - 1,
    prev: () => index > 0 && setSelectedId(visibleProblems[index - 1].id),
    next: () => index < visibleProblems.length - 1 && setSelectedId(visibleProblems[index + 1].id),
    random: () => {
      const pool = visibleProblems.filter(
        (p) => progress[p.id]?.status !== 'solved' && p.id !== selectedId
      );
      const from = pool.length ? pool : visibleProblems;
      setSelectedId(from[Math.floor(Math.random() * from.length)].id);
    },
    randomAll: () => {
      const pool = visibleProblems.filter((p) => p.id !== selectedId);
      setSelectedId(pool[Math.floor(Math.random() * pool.length)].id);
    },
  };

  const toggleMode = useCallback(() => {
    setProblemMode((m) => (m === 'complex' ? 'normal' : 'complex'));
  }, []);

  // Jump to the first problem in the newly active set if the current
  // selection doesn't belong to it (e.g. switching from normal to complex
  // while viewing problem #5).
  useEffect(() => {
    if (!visibleProblems.length) return;
    if (!visibleProblems.some((p) => p.id === selectedId)) {
      setSelectedId(visibleProblems[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemMode, problems]);

  useEffect(() => {
    (async () => {
      try {
        const p = await fetch('/api/problems').then((r) => r.json());
        setProblems(p);
        setSelectedId((cur) => {
          if (cur && p.some((prob) => prob.id === cur)) return cur;
          return p[0]?.id ?? null;
        });
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

  useEffect(() => {
    if (selectedId) localStorage.setItem('sql-practice-problem', selectedId);
  }, [selectedId]);

  // Rebuild a fresh database whenever the selected problem changes.
  useEffect(() => {
    if (!problem) return;
    let cancelled = false;
    setOutput(null);
    setVerdict(null);
    setSelectedCase(null);
    setCaseRun({});
    setRunMatch(null);
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
    setRunMatch(null);
    try {
      // Re-seed so a stray UPDATE/DELETE in a previous run can't poison results.
      createDb(problem).then((db) => {
        dbRef.current?.close();
        dbRef.current = db;
        try {
          const result = exec(db, codeRef.current);
          setOutput({ result });
          setRunMatch(expected ? compare(result, expected, problem.orderMatters).pass : null);
        } catch (err) {
          setOutput({ error: err.message });
        }
      });
    } catch (err) {
      setOutput({ error: err.message });
    }
  }, [problem, expected]);

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
        problemMode={problemMode}
        onToggleMode={toggleMode}
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
                  setCode(problem?.startingSql || STARTER);
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
                onChange={handleCodeChange}
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
            {!verdict && output && !output.error && (() => {
              const diff = runMatch === false && expected
                ? diffResults(output.result, expected, problem?.orderMatters)
                : null;
              return (
                <>
                  {runMatch != null && (
                    <div className={`run-match ${runMatch ? 'pass' : 'fail'}`}>
                      {runMatch ? '✓ Matches the expected output' : '✗ Doesn\'t match the expected output'}
                    </div>
                  )}
                  {diff ? (
                    <>
                      <div className="diff">
                        <div>
                          <h4>Expected</h4>
                          <ResultsTable
                            result={expected}
                            empty="(no rows)"
                            columnStatus={diff.columnMismatches}
                            rowStatus={diff.expectedRowStatus}
                          />
                        </div>
                        <div>
                          <h4>Your output</h4>
                          <ResultsTable
                            result={output.result}
                            empty="(no rows)"
                            columnStatus={diff.columnMismatches}
                            rowStatus={diff.actualRowStatus}
                          />
                        </div>
                      </div>
                      <p className="muted note diff-legend">
                        {problem?.orderMatters
                          ? 'Highlighted rows are out of place or don\'t match — compare them position by position.'
                          : 'Highlighted rows in Expected are missing from your output; highlighted rows in Your output aren\'t expected (wrong values, or extras).'}
                      </p>
                    </>
                  ) : (
                    <ResultsTable result={output.result} empty="Query ran, but returned no rows." />
                  )}
                </>
              );
            })()}

            {!output && !verdict && (
              expected ? (
                <div className="output-preview">
                  <p className="muted note">Run a query to see your own output — until then, here's what it should look like:</p>
                  <h4>Expected output</h4>
                  <ResultsTable result={expected} empty="(no rows)" />
                  {problem?.outputExplanation && (
                    <>
                      <h4>Why the output looks like this</h4>
                      <div className="prose">
                        <Markdownish text={problem.outputExplanation} />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="muted">Run a query to see its output.</p>
              )
            )}
          </div>
        </section>
      </main>

      {nameModalOpen && (
        <NameModal
          currentName={userName}
          onClose={() => setNameModalOpen(false)}
          onSkip={() => {
            localStorage.setItem(NAME_SKIP_KEY, '1');
            setNameSkipped(true);
            setNameModalOpen(false);
          }}
          onSave={(val) => {
            localStorage.setItem(NAME_KEY, val);
            localStorage.removeItem(NAME_SKIP_KEY);
            setNameSkipped(false);
            setUserName(val);
            setNameModalOpen(false);
          }}
        />
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
        <div className="fullscreen-overlay">
          <ProblemList
            problems={visibleProblems}
            progress={progress}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); }}
            onHide={() => setSidebarOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
