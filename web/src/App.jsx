import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProblemList from './components/ProblemList.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import ProblemPane from './components/ProblemPane.jsx';
import SqlEditor from './components/SqlEditor.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import TopBar from './components/TopBar.jsx';
import NameModal from './components/NameModal.jsx';
import LoginModal from './components/LoginModal.jsx';
import Markdownish from './components/Markdownish.jsx';
import { compare, createDb, exec, describeTables, gradeAll, testsOf, diffResults } from './lib/db.js';
import { format } from 'sql-formatter';
import { computeCurrentStreak } from './lib/streak.js';

const STARTER = '-- Write your query here\nSELECT ';
const NAME_KEY = 'sql-practice-name';
const NAME_SKIP_KEY = 'sql-practice-name-skip';

// Route format: /normal_problems/<id> or /complex_problems/<id>
const parseRoute = () => {
  const m = window.location.pathname.match(/^\/(normal|complex)_problems\/([^/]+)/);
  return m ? { mode: m[1], id: decodeURIComponent(m[2]) } : null;
};

export default function App() {
  const [problems, setProblems] = useState([]);
  const [progress, setProgress] = useState({});
  const [selectedId, setSelectedId] = useState(() => {
    const route = parseRoute();
    return route?.id ?? localStorage.getItem('sql-practice-problem') ?? null;
  });
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
  const [problemMode, setProblemMode] = useState(() => parseRoute()?.mode ?? 'normal');
  const [progressOpen, setProgressOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseRun, setCaseRun] = useState({});
  const [splitRatio, setSplitRatio] = useState(40);
  const [workspaceSplit, setWorkspaceSplit] = useState(55);
  const [submissions, setSubmissions] = useState([]);
  const [userName, setUserName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameSkipped, setNameSkipped] = useState(() => localStorage.getItem(NAME_SKIP_KEY) === '1');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const splitterRef = useRef(null);

  const dbRef = useRef(null);
  const codeRef = useRef(code);
  codeRef.current = code;
  const namePromptedRef = useRef(false);
  // Caches solutionSql/hint/outputExplanation per problem (fetched separately
  // so the public /api/problems list never leaks them).
  const solutionsCache = useRef({});

  const handleCodeChange = useCallback((val) => {
    setCode(val);
    if (!userName && !nameSkipped && !namePromptedRef.current) {
      namePromptedRef.current = true;
      setNameModalOpen(true);
    }
  }, [userName, nameSkipped]);

  const problem = problems.find((p) => p.id === selectedId) ?? null;
  const streak = useMemo(() => computeCurrentStreak(submissions), [submissions]);

  // Fetch solution data for the current problem (needed for client-side grading).
  // Populates solutionsCache so the setup effect and gradeAll can access it.
  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/problem/${encodeURIComponent(selectedId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) solutionsCache.current[data.id] = data;
      })
      .catch(() => {});
  }, [selectedId]);

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

  // Keep the address bar in sync with the current problem. Waits for the
  // selection to settle into the active set (so a mode toggle doesn't push a
  // half-resolved URL), then pushState if the path doesn't already match.
  // A bare "/" load is normalized in place so back doesn't land on an empty URL.
  useEffect(() => {
    if (!visibleProblems.length || !selectedId) return;
    if (!visibleProblems.some((p) => p.id === selectedId)) return;
    const target = `/${problemMode}_problems/${encodeURIComponent(selectedId)}`;
    if (window.location.pathname === '/') {
      window.history.replaceState(null, '', target);
    } else if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemMode, selectedId, visibleProblems]);

  // Browser back/forward: read the new URL and reapply it to app state.
  useEffect(() => {
    const onPop = () => {
      const route = parseRoute();
      if (route) {
        setProblemMode(route.mode);
        setSelectedId(route.id);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
        // The solution is fetched separately from /api/problem/:id since the
        // public list strips it; if it hasn't arrived yet, wait for it here.
        let solutionSql = solutionsCache.current[problem.id]?.solutionSql;
        if (!solutionSql) {
          try {
            const data = await fetch(`/api/problem/${encodeURIComponent(problem.id)}`).then((r) => r.json());
            solutionsCache.current[problem.id] = data;
            solutionSql = data.solutionSql;
          } catch {
            // fall through — expected will remain null
          }
        }
        if (solutionSql) {
          const refDb = await createDb(problem);
          try {
            setExpected(exec(refDb, solutionSql));
          } finally {
            refDb.close();
          }
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

  const handleToggleStar = useCallback(async (id) => {
    const current = progress[id]?.starred ?? false;
    // Optimistic update — flip immediately, no flash.
    setProgress((prev) => ({ ...prev, [id]: { ...prev[id], starred: !current } }));
    try {
      const res = await fetch('/api/progress/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, id, starred: !current }),
      });
      if (res.ok) {
        const saved = await res.json();
        setProgress((prev) => ({ ...prev, [id]: { ...prev[id], ...saved } }));
      }
    } catch {
      // Revert on network error.
      setProgress((prev) => ({ ...prev, [id]: { ...prev[id], starred: current } }));
    }
  }, [userName, progress]);

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
  const ensureSolution = useCallback(async (id) => {
    if (solutionsCache.current[id]?.solutionSql) return;
    try {
      const data = await fetch(`/api/problem/${encodeURIComponent(id)}`).then((r) => r.json());
      solutionsCache.current[id] = data;
    } catch { /* leave cache as-is */ }
  }, []);

  const submit = useCallback(async () => {
    if (!problem) return;
    await ensureSolution(problem.id);
    const sqlText = codeRef.current;
    setVerdict({ pending: true });
    setSelectedCase(null);
    setCaseRun({});
    try {
      const report = await gradeAll({ ...problem, ...solutionsCache.current[problem.id] }, sqlText);
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
    await ensureSolution(problem.id);
    const sqlText = codeRef.current;
    const test = testsOf(problem)[index];
    const db = await createDb(problem, test);
    try {
      const actual = exec(db, sqlText);
      const refDb = await createDb(problem, test);
      let expected;
      try {
        expected = exec(refDb, solutionsCache.current[problem.id]?.solutionSql ?? problem.solutionSql);
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
        streak={streak}
        onChangeName={changeName}
        onLoginWithEmail={() => setLoginModalOpen(true)}
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
              starred={progress[problem.id]?.starred ?? false}
              savedCode={progress[problem.id]?.code}
              savedSolution={progress[problem.id]?.solutionSql}
              savedOutputExplanation={progress[problem.id]?.outputExplanation}
              submissions={submissions}
              onLoadSubmission={loadSubmission}
              onToggleStar={handleToggleStar}
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
                  try {
                    const formatted = format(code, { language: 'sqlite', uppercase: true, tabWidth: 2 });
                    if (formatted !== code) {
                      setCode(formatted);
                      setEditorNonce((n) => n + 1);
                    }
                  } catch { /* leave as-is if formatting fails */ }
                }}
                title="Format SQL"
              >
                Format
              </button>
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
                  <h4>Expected output</h4>
                  <ResultsTable result={expected} empty="(no rows)" />
                  {progress[problem.id]?.status === 'solved' && progress[problem.id]?.outputExplanation && (
                    <>
                      <h4>Why the output looks like this</h4>
                      <div className="prose">
                        <Markdownish text={progress[problem.id].outputExplanation} />
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

      {loginModalOpen && (
        <LoginModal
          onClose={() => setLoginModalOpen(false)}
          onLoggedIn={(username) => {
            localStorage.setItem(NAME_KEY, username);
            localStorage.removeItem(NAME_SKIP_KEY);
            setNameSkipped(false);
            setUserName(username);
            setLoginModalOpen(false);
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
                onLogout={() => { setUserName(''); localStorage.removeItem(NAME_KEY); window.location.reload(); }}
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
            onToggleStar={handleToggleStar}
          />
        </div>
      )}
    </div>
  );
}
