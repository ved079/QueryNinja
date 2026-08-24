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
import PythonEditor from './components/PythonEditor.jsx';
import PythonOutput from './components/PythonOutput.jsx';
import PythonTestCases from './components/PythonTestCases.jsx';
import PythonProblemPane from './components/PythonProblemPane.jsx';
import PythonProblemList from './components/PythonProblemList.jsx';
import { compare, createDb, exec, describeTables, gradeAll, testsOf, diffResults, expectedOutputToResult } from './lib/db.js';
import { apiFetch, getToken, setToken, clearToken } from './lib/auth.js';
import { format } from 'sql-formatter';
import { computeCurrentStreak } from './lib/streak.js';

const STARTER = '-- Write your query here\nSELECT ';
const NAME_KEY = 'sql-practice-name';
const NAME_SKIP_KEY = 'sql-practice-name-skip';

/**
 * Ensure the active user has a session token minted (server-side). Called
 * when a name is set/chosen so subsequent authenticated writes carry it. An
 * anonymous ("use without a username") session needs no token — the server
 * treats that shared bucket as public.
 */
const ensureSession = async (name) => {
  const n = (name ?? '').trim();
  if (!n) return;
  if (getToken(n)) return;
  try {
    const res = await apiFetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: n }),
    }, n);
    const data = await res.json();
    if (res.ok && data.token) setToken(n, data.token);
  } catch {
    // Leave the token empty; a later authenticated call will surface the
    // server's error to the user.
  }
};

// Sections: normal (original), complex (technique-heavy), and the Data
// Analyst (KPI/business-metric) set. Each lives in its own URL namespace.
// Route format: /<mode>_problems/<id>
const parseRoute = () => {
  const m = window.location.pathname.match(/^\/(normal|complex|da|python)_problems\/([^/]+)/);
  return m ? { mode: m[1], id: decodeURIComponent(m[2]) } : null;
};

// Exclusive membership: normal = numbers 1-90, complex = numbers >90 that are
// not Data Analyst problems, da = anything tagged "Data Analyst", python = all.
const isDataAnalyst = (p) => (p.tags ?? []).includes('Data Analyst');
const MODES = ['normal', 'complex', 'da', 'python'];
const inMode = (mode) => (p) => {
  if (mode === 'python') return true;
  if (mode === 'da') return isDataAnalyst(p);
  return mode === 'complex' ? p.number > 90 && !isDataAnalyst(p) : p.number <= 90;
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
  // 'normal' = the original numbering; 'complex' = technique-heavy additions;
  // 'da' = the Data Analyst (business-metric) set. Filtering is in inMode().
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

  // Python-specific state
  const [pythonProblems, setPythonProblems] = useState([]);
  const [pythonProgress, setPythonProgress] = useState({});
  const [pythonSubmissions, setPythonSubmissions] = useState([]);
  const [pythonOutput, setPythonOutput] = useState(null);
  const [pythonVerdict, setPythonVerdict] = useState(null);
  const [pythonIsRunning, setPythonIsRunning] = useState(false);
  const [pythonCaseRun, setPythonCaseRun] = useState({});
  const [pythonSelectedProblemId, setPythonSelectedProblemId] = useState(null);
  const [pythonCode, setPythonCode] = useState('');
  const pythonCodeRef = useRef(pythonCode);
  pythonCodeRef.current = pythonCode;

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

  // Fetch problem detail (including solution fields if solved) when the selected
  // problem changes. Passes the user identity so the server can gate solutionSql.
  useEffect(() => {
    if (!selectedId) return;
    const u = encodeURIComponent(userName || 'anonymous');
    apiFetch(`/api/problem/${encodeURIComponent(selectedId)}?user=${u}`, {}, userName)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) solutionsCache.current[data.id] = data;
      })
      .catch(() => {});
  }, [selectedId, userName]);

  // Scope prev/next/Go-to/Problem-List to the active section (normal/complex/da).
  const visibleProblems = problems.filter(inMode(problemMode));
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

  const setMode = useCallback((mode) => {
    if (MODES.includes(mode)) setProblemMode(mode);
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
        const p = await apiFetch('/api/problems').then((r) => r.json());
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

  // Progress/submissions are per-name. Re-fetch whenever the name changes.
  // On first load the name may already be set from localStorage but the session
  // token doesn't exist yet (new feature), so ensure the token is minted first.
  useEffect(() => {
    (async () => {
      try {
        if (userName) await ensureSession(userName);
        const q = `?user=${encodeURIComponent(userName)}`;
        const [prRes, subRes] = await Promise.all([
          apiFetch(`/api/progress${q}`, {}, userName),
          apiFetch(`/api/submissions${q}`, {}, userName),
        ]);
        if (prRes.ok) setProgress(await prRes.json());
        if (subRes.ok) setSubmissions(await subRes.json());
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

        // Sample output shown with the problem. solutionSql is only returned by
        // the server when the user has already solved this problem; unsolved users
        // fall back to the pre-computed expectedOutput stored in the first test
        // case so the expected output panel is still populated.
        let solutionSql = solutionsCache.current[problem.id]?.solutionSql;
        if (!solutionSql) {
          try {
            const u = encodeURIComponent(userName || 'anonymous');
            const r = await apiFetch(`/api/problem/${encodeURIComponent(problem.id)}?user=${u}`, {}, userName);
            if (r.ok) {
              const data = await r.json();
              solutionsCache.current[problem.id] = data;
              solutionSql = data.solutionSql;
            }
          } catch {
            // fall through — expected will use the pre-computed fallback below
          }
        }
        if (solutionSql) {
          const refDb = await createDb(problem);
          try {
            setExpected(exec(refDb, solutionSql));
          } finally {
            refDb.close();
          }
        } else {
          // Use the pre-computed expectedOutput from the first test case.
          setExpected(expectedOutputToResult(testsOf(problem)[0]?.expectedOutput) ?? null);
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

  const saveProgress = useCallback(async (id, sqlText, caseResults = []) => {
    const res = await apiFetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userName, id, code: sqlText, caseResults }),
    }, userName);
    const saved = await res.json();
    setProgress((prev) => ({ ...prev, [id]: saved }));
    return saved;
  }, [userName]);

  const handleToggleStar = useCallback(async (id) => {
    const current = progress[id]?.starred ?? false;
    // Optimistic update — flip immediately, no flash.
    setProgress((prev) => ({ ...prev, [id]: { ...prev[id], starred: !current } }));
    try {
      const res = await apiFetch('/api/progress/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, id, starred: !current }),
      }, userName);
      if (res.ok) {
        const saved = await res.json();
        setProgress((prev) => ({ ...prev, [id]: { ...prev[id], ...saved } }));
      }
    } catch {
      // Revert on network error.
      setProgress((prev) => ({ ...prev, [id]: { ...prev[id], starred: current } }));
    }
  }, [userName, progress]);

  // Client-side cooldown: prevents rapid-fire execution that would saturate
  // the WASM sql.js thread and freeze the browser. This is a UX guard only —
  // if server-side execution is ever added, pair this with a real server-side
  // rate limit (e.g. per-user token bucket), as client-side debouncing is not
  // a security control.
  const lastRunRef = useRef(0);
  const RUN_COOLDOWN_MS = 1000;

  /** Run the query for its output only — no grading. */
  const run = useCallback(() => {
    if (!problem || !dbRef.current) return;
    const now = Date.now();
    if (now - lastRunRef.current < RUN_COOLDOWN_MS) return;
    lastRunRef.current = now;
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
          const result = exec(db, codeRef.current, { isUserQuery: true });
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
      const u = encodeURIComponent(userName || 'anonymous');
      const r = await apiFetch(`/api/problem/${encodeURIComponent(id)}?user=${u}`, {}, userName);
      if (r.ok) solutionsCache.current[id] = await r.json();
    } catch { /* leave cache as-is */ }
  }, [userName]);

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

      // Build caseResults: the actual rows from each test case, sent to the
      // server so it can verify the answer via HMAC without running SQL itself.
      const caseResults = report.cases.map((c) => ({
        actual: c.actual ? { columns: c.actual.columns, rows: c.actual.rows } : null,
      }));
      const saved = await saveProgress(problem.id, sqlText, caseResults);
      // If this submission just earned a solve, re-fetch the problem so the
      // server now returns solutionSql/hint/outputExplanation for this user.
      if (saved?.status === 'solved' && !solutionsCache.current[problem.id]?.solutionSql) {
        try {
          const u = encodeURIComponent(userName || 'anonymous');
          const r = await apiFetch(`/api/problem/${encodeURIComponent(problem.id)}?user=${u}`, {}, userName);
          if (r.ok) solutionsCache.current[problem.id] = await r.json();
        } catch { /* non-critical; solution panel will populate on next load */ }
      }

      const entry = {
        problemId: problem.id,
        code: sqlText,
        submittedAt: new Date().toISOString(),
      };
      // status is derived server-side from the verified progress bucket.
      const res = await apiFetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName, ...entry }),
      }, userName);
      if (res.ok) {
        const saved = await res.json();
        entry.id = saved.id;
        // Use the status the server determined (from HMAC verification), not
        // the client's local pass/fail signal, so the streak is always accurate.
        entry.status = saved.status ?? (pass ? 'solved' : 'attempted');
      } else {
        entry.status = pass ? 'solved' : 'attempted';
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
      const actual = exec(db, sqlText, { isUserQuery: true });
      const refDb = await createDb(problem, test);
      let expected;
      try {
        const sol = solutionsCache.current[problem.id]?.solutionSql ?? problem.solutionSql;
        expected = sol ? exec(refDb, sol) : expectedOutputToResult(test.expectedOutput);
      } finally {
        refDb.close();
      }
      const tables = describeTables(db);
      const res = actual && expected ? compare(actual, expected, problem.orderMatters) : { pass: false, reason: 'Could not compare results.' };
      const run = { index, name: test.name, tables, expected, actual, pass: res.pass, reason: res.reason };
      setCaseRun((prev) => ({ ...prev, [index]: run }));
      // If this case just flipped to passing, jump the panel to the next failure
      // so the user keeps working through remaining failing cases.
      if (run.pass) {
        const updated = { ...caseRun, [index]: run };
        const failing = verdict?.cases
          ?.map((c, i) => ({ ...c, i, pass: updated[i]?.pass ?? c.pass }))
          .filter((c) => !c.pass) ?? [];
        if (!failing.length) {
          setSelectedCase(null);
        } else {
          const next = failing.find((c) => c.i > index) ?? failing[0];
          setSelectedCase(next.i);
        }
      }
    } catch (err) {
      setCaseRun((prev) => ({ ...prev, [index]: { index, name: test.name, pass: false, error: err.message } }));
    } finally {
      db.close();
    }
  }, [problem, verdict, caseRun]);

  const loadSubmission = useCallback((entry) => {
    setCode(entry.code);
    setEditorNonce((n) => n + 1);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    await apiFetch(`/api/user?user=${encodeURIComponent(userName)}`, { method: 'DELETE' }, userName);
    setProgress({});
    setSubmissions([]);
    localStorage.removeItem(NAME_KEY);
    clearToken(userName);
    setUserName('');
    setNameModalOpen(true);
  }, [userName]);

  // ─── Python Section Logic ────────────────────────────────────────────────

  // Fetch Python problems when entering Python mode
  useEffect(() => {
    if (problemMode !== 'python') return;
    (async () => {
      try {
        const p = await apiFetch('/api/python/problems').then((r) => r.json());
        setPythonProblems(p);
        setPythonSelectedProblemId((cur) => {
          if (cur && p.some((prob) => prob.id === cur)) return cur;
          return p[0]?.id ?? null;
        });
      } catch (err) {
        console.error('Failed to load Python problems:', err);
      }
    })();
  }, [problemMode]);

  // Fetch Python progress when user changes
  useEffect(() => {
    if (problemMode !== 'python') return;
    (async () => {
      try {
        const q = `?user=${encodeURIComponent(userName || 'anonymous')}`;
        const data = await apiFetch(`/api/python/progress${q}`, {}, userName).then((r) => r.json());
        setPythonProgress(data.progress || {});
        setPythonSubmissions(data.submissions || []);
      } catch {
        // silent
      }
    })();
  }, [userName, problemMode]);

  // Set Python selected problem to first in list when switching to python mode
  useEffect(() => {
    if (problemMode !== 'python') return;
    if (!pythonProblems.length) return;
    if (!pythonProblems.some((p) => p.id === pythonSelectedProblemId)) {
      setPythonSelectedProblemId(pythonProblems[0]?.id ?? null);
    }
  }, [problemMode, pythonProblems]);

  const pythonProblem = pythonProblems.find((p) => p.id === pythonSelectedProblemId) ?? null;

  // Reset Python state when problem changes
  useEffect(() => {
    if (problemMode !== 'python' || !pythonProblem) return;
    setPythonOutput(null);
    setPythonVerdict(null);
    setPythonCaseRun({});
    setPythonCode(pythonProgress[pythonProblem.id]?.code || pythonProblem.starterCode || '');
  }, [pythonSelectedProblemId, problemMode]);

  // Python navigation
  const pythonVisibleProblems = pythonProblems;
  const pythonIndex = pythonVisibleProblems.findIndex((p) => p.id === pythonSelectedProblemId);

  const pythonNav = {
    hasPrev: pythonIndex > 0,
    hasNext: pythonIndex >= 0 && pythonIndex < pythonVisibleProblems.length - 1,
    prev: () => pythonIndex > 0 && setPythonSelectedProblemId(pythonVisibleProblems[pythonIndex - 1].id),
    next: () => pythonIndex < pythonVisibleProblems.length - 1 && setPythonSelectedProblemId(pythonVisibleProblems[pythonIndex + 1].id),
    random: () => {
      const pool = pythonVisibleProblems.filter(
        (p) => pythonProgress[p.id]?.status !== 'solved' && p.id !== pythonSelectedProblemId
      );
      const from = pool.length ? pool : pythonVisibleProblems;
      setPythonSelectedProblemId(from[Math.floor(Math.random() * from.length)].id);
    },
    randomAll: () => {
      const pool = pythonVisibleProblems.filter((p) => p.id !== pythonSelectedProblemId);
      setPythonSelectedProblemId(pool[Math.floor(Math.random() * pool.length)].id);
    },
  };

  // Python run (single test case)
  const handlePythonRun = useCallback(async (testIndex) => {
    if (!pythonProblem) return;
    const currentCode = pythonCodeRef.current || pythonProblem.starterCode;
    const test = testIndex != null ? pythonProblem.tests[testIndex] : pythonProblem.tests[0];

    setPythonIsRunning(true);
    setPythonOutput(null);
    setPythonVerdict(null);

    try {
      const res = await apiFetch('/api/python/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, testInput: test.input }),
      }, userName);
      const data = await res.json();
      if (data.error) {
        setPythonOutput({ error: data.error + (data.details ? `\n${data.details}` : '') });
      } else {
        setPythonOutput({
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          timedOut: data.timedOut || false,
        });
      }
    } catch {
      setPythonOutput({ error: 'Failed to run code.' });
    } finally {
      setPythonIsRunning(false);
    }
  }, [pythonProblem, userName]);

  // Python run single test case (from test case list)
  const handlePythonRunCase = useCallback(async (index) => {
    if (!pythonProblem) return;
    const currentCode = pythonCodeRef.current || pythonProblem.starterCode;
    const test = pythonProblem.tests[index];

    try {
      const res = await apiFetch('/api/python/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, testInput: test.input }),
      }, userName);
      const data = await res.json();
      const passed = !data.timedOut && data.exitCode === 0 && (data.stdout || '').trim() === test.expectedOutput;
      setPythonCaseRun((prev) => ({
        ...prev,
        [index]: {
          pass: passed,
          actual: data.stdout || '',
          expected: test.expectedOutput,
          stderr: data.stderr || '',
          error: data.timedOut ? 'Timed out' : null,
        },
      }));
    } catch (err) {
      setPythonCaseRun((prev) => ({
        ...prev,
        [index]: { pass: false, error: err.message },
      }));
    }
  }, [pythonProblem, userName]);

  // Python submit (all test cases)
  const handlePythonSubmit = useCallback(async () => {
    if (!pythonProblem) return;
    const currentCode = pythonCodeRef.current || pythonProblem.starterCode;

    setPythonIsRunning(true);
    setPythonOutput(null);
    setPythonVerdict(null);
    setPythonCaseRun({});

    try {
      const res = await apiFetch('/api/python/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, problemId: pythonProblem.id, user: userName }),
      }, userName);
      const data = await res.json();
      if (data.error) {
        setPythonOutput({ error: data.error });
      } else {
        setPythonVerdict({
          passed: data.passed,
          total: data.total,
          allPassed: data.allPassed,
          results: data.results || [],
        });
        // Update local progress
        if (data.allPassed) {
          setPythonProgress((prev) => ({
            ...prev,
            [pythonProblem.id]: { ...prev[pythonProblem.id], status: 'solved', code: currentCode },
          }));
        } else {
          setPythonProgress((prev) => ({
            ...prev,
            [pythonProblem.id]: { ...prev[pythonProblem.id], status: 'attempted', code: currentCode },
          }));
        }
        // Refresh progress from server
        try {
          const q = `?user=${encodeURIComponent(userName || 'anonymous')}`;
          const progData = await apiFetch(`/api/python/progress${q}`, {}, userName).then((r) => r.json());
          setPythonProgress(progData.progress || {});
          setPythonSubmissions(progData.submissions || []);
        } catch { /* non-critical */ }
      }
    } catch (err) {
      setPythonOutput({ error: 'Failed to submit code.' });
    } finally {
      setPythonIsRunning(false);
    }
  }, [pythonProblem, userName]);

  if (loadError) return <div className="fatal">{loadError}</div>;
  if (problemMode === 'python' && !pythonProblems.length) return <div className="fatal muted">Loading Python problems…</div>;
  if (problemMode !== 'python' && !problems.length) return <div className="fatal muted">Loading problems…</div>;

  // Build nav: use Python nav when in Python mode, SQL nav otherwise
  const activeNav = problemMode === 'python' ? pythonNav : nav;
  const activeOnRun = problemMode === 'python' ? () => handlePythonRun() : run;
  const activeOnSubmit = problemMode === 'python' ? handlePythonSubmit : submit;

  return (
    <div className="layout">
      <TopBar
        onShowSidebar={() => setSidebarOpen(true)}
        problemMode={problemMode}
        onChangeMode={setMode}
        onShowProgress={() => setProgressOpen(true)}
        userName={userName}
        streak={streak}
        onChangeName={changeName}
        onLoginWithEmail={() => setLoginModalOpen(true)}
        nav={activeNav}
        onRun={activeOnRun}
        onSubmit={activeOnSubmit}
      />

      <main className="workspace">
        {problemMode === 'python' ? (
          // ─── Python Mode ─────────────────────────────────────────────
          <>
            {pythonProblem && (
              <div style={{ flex: workspaceSplit, minWidth: 0 }}>
                <PythonProblemPane
                  problem={pythonProblem}
                  status={pythonProgress[pythonProblem.id]?.status}
                  savedSolution={pythonProgress[pythonProblem.id]?.solutionCode || pythonProblem.solutionCode}
                  outputExplanation={pythonProblem.outputExplanation}
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
                <span className="muted">Python</span>
                <div className="actions">
                  <button
                    onClick={() => {
                      setPythonCode(pythonProblem?.starterCode || '');
                    }}
                    title="Reset to starter code"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="editor-wrap" style={{ flex: splitRatio }}>
                {pythonProblem && (
                  <PythonEditor
                    value={pythonCode}
                    docKey={`py:${pythonProblem.id}`}
                    onChange={setPythonCode}
                    onRun={() => handlePythonRun()}
                    onSubmit={handlePythonSubmit}
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
                {pythonProblem && (
                  <>
                    <PythonTestCases
                      tests={pythonProblem.tests}
                      onRunTest={handlePythonRunCase}
                      caseRun={pythonCaseRun}
                    />
                    <PythonOutput
                      output={pythonOutput}
                      verdict={pythonVerdict}
                      isRunning={pythonIsRunning}
                    />
                  </>
                )}
              </div>
            </section>
          </>
        ) : (
          // ─── SQL Mode (normal/complex/da) ────────────────────────────
          <>
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
                  outputExplanation={solutionsCache.current[problem.id]?.outputExplanation}
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
          </>
        )}
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
            ensureSession(val);
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
            ensureSession(username);
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
          {problemMode === 'python' ? (
            <PythonProblemList
              problems={pythonVisibleProblems}
              progress={pythonProgress}
              selectedId={pythonSelectedProblemId}
              onSelect={(id) => { setPythonSelectedProblemId(id); setSidebarOpen(false); }}
              onHide={() => setSidebarOpen(false)}
            />
          ) : (
            <ProblemList
              problems={visibleProblems}
              progress={progress}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); }}
              onHide={() => setSidebarOpen(false)}
              onToggleStar={handleToggleStar}
            />
          )}
        </div>
      )}
    </div>
  );
}
