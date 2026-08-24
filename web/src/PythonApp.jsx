import { useCallback, useEffect, useRef, useState } from 'react';
import PythonPane from './components/python/PythonPane.jsx';
import PythonProblemList from './components/python/PythonProblemList.jsx';
import PythonEditor from './components/python/PythonEditor.jsx';
import TopicComplete from './components/python/TopicComplete.jsx';
import { apiFetch } from './lib/auth.js';
import { runPython } from './lib/pyodide-runner.js';

const PYTHON_STARTER = '# Write your solution here\n';

export default function PythonApp({ userName, initialId, listOpen, onListClose }) {
  const [problems, setProblems] = useState([]);
  const [progress, setProgress] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [code, setCode] = useState(PYTHON_STARTER);
  const [output, setOutput] = useState(null); // { error } | { results }
  const [verdict, setVerdict] = useState(null);
  const [running, setRunning] = useState(false);
  const [topicComplete, setTopicComplete] = useState(null); // { topic, nextId }
  const [splitRatio, setSplitRatio] = useState(40);
  const [workspaceSplit, setWorkspaceSplit] = useState(42);
  const [editorNonce, setEditorNonce] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  const problem = problems.find((p) => p.id === selectedId) ?? null;
  const prevIdRef = useRef(null);

  // When problem changes: load saved code or starter, reset state
  if (problem && problem.id !== prevIdRef.current) {
    prevIdRef.current = problem.id;
    const saved = progress[problem.id]?.code;
    setCode(saved || problem.starterCode || PYTHON_STARTER);
    setOutput(null);
    setVerdict(null);
  }

  useEffect(() => {
    apiFetch('/api/python/problems')
      .then((r) => r.json())
      .then((ps) => {
        setProblems(ps);
        setSelectedId((cur) => {
          if (cur && ps.some((p) => p.id === cur)) return cur;
          if (initialId && ps.some((p) => p.id === initialId)) return initialId;
          return ps[0]?.id ?? null;
        });
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  // Sync URL when selected problem changes
  useEffect(() => {
    if (!selectedId) return;
    const target = `/python/${encodeURIComponent(selectedId)}`;
    if (window.location.pathname === '/python') {
      window.history.replaceState(null, '', target);
    } else if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
  }, [selectedId]);

  // Browser back/forward
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/^\/python\/([^/]+)/);
      if (m) setSelectedId(decodeURIComponent(m[1]));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!userName) return;
    apiFetch(`/api/python/progress?user=${encodeURIComponent(userName)}`, {}, userName)
      .then((r) => r.ok ? r.json() : {})
      .then(setProgress)
      .catch(() => {});
  }, [userName]);

  const saveProgress = useCallback(async (id, codeText, status) => {
    const res = await apiFetch('/api/python/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userName || 'anonymous', id, code: codeText, status }),
    }, userName);
    if (res.ok) {
      const saved = await res.json();
      setProgress((prev) => ({ ...prev, [id]: saved }));
    }
  }, [userName]);

  const run = useCallback(async () => {
    if (!problem || running) return;
    setRunning(true);
    setOutput(null);
    setVerdict(null);
    try {
      const data = await runPython({
        code: codeRef.current,
        functionName: problem.functionName,
        helperCode: problem._helperCode ?? '',
        tests: problem.tests,
      });
      if (data.error && !data.results?.length) {
        setOutput({ error: data.error });
      } else {
        const results = data.results ?? [];
        const passed = results.length > 0 && results.every((r) => r.passed);
        const passedCount = results.filter((r) => r.passed).length;
        setVerdict({ results, passed, passedCount, total: results.length, error: data.error, isRun: true });
      }
    } catch (err) {
      setOutput({ error: err.message });
    } finally {
      setRunning(false);
    }
  }, [problem, running]);

  const submit = useCallback(async () => {
    if (!problem || running) return;
    setRunning(true);
    setOutput(null);
    setVerdict(null);
    try {
      const data = await runPython({
        code: codeRef.current,
        functionName: problem.functionName,
        helperCode: problem._helperCode ?? '',
        tests: problem.tests,
      });
      const results = data.results ?? [];
      const passed = results.length > 0 && results.every((r) => r.passed);
      const passedCount = results.filter((r) => r.passed).length;
      const v = { results, passed, passedCount, total: results.length, error: data.error };
      setVerdict(v);

      const status = passed ? 'solved' : 'attempted';
      await saveProgress(problem.id, codeRef.current, status);

      if (passed) {
        // Check if this solved the last problem in its topic
        const topicProblems = problems.filter((p) => p.topic === problem.topic && p.stage === problem.stage);
        const newProgress = { ...progress, [problem.id]: { status: 'solved', code: codeRef.current } };
        const allSolved = topicProblems.every((p) => newProgress[p.id]?.status === 'solved');
        const wasSolved = topicProblems.every((p) => progress[p.id]?.status === 'solved');
        if (allSolved && !wasSolved) {
          const curIdx = problems.findIndex((p) => p.id === problem.id);
          const nextId = problems[curIdx + 1]?.id ?? null;
          setTopicComplete({ topic: problem.topic, nextId });
        }
      }
    } catch (err) {
      setVerdict({ results: [], passed: false, error: err.message });
    } finally {
      setRunning(false);
    }
  }, [problem, running, saveProgress]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    setEditorNonce((n) => n + 1);
  }, []);

  if (loadError) return <div className="fatal">{loadError}</div>;
  if (!problems.length) return <div className="fatal muted">Loading Python problems…</div>;

  return (
    <div className="py-layout">
      <div className="py-workspace">
        {/* Left: lesson + problem pane */}
        <div className="py-left-pane" style={{ flex: workspaceSplit }}>
          <PythonPane
            problem={problem}
            verdict={verdict}
            defaultTab={problem?.lesson && !progress[problem?.id] ? 'lesson' : 'problem'}
          />
        </div>

        {/* Vertical splitter */}
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
              setWorkspaceSplit(Math.min(75, Math.max(20, startFlex + (dx / totalW) * 100)));
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />

        {/* Right: editor + output */}
        <section className="editor-pane" style={{ flex: 100 - workspaceSplit }}>
          <div className="toolbar">
            <span className="muted">Python 3</span>
            <div className="actions">
              <button
                onClick={() => {
                  setCode(problem?.starterCode || PYTHON_STARTER);
                  setEditorNonce((n) => n + 1);
                }}
              >
                Reset
              </button>
              <button onClick={run} disabled={running}>
                {running ? 'Running…' : 'Run'}
              </button>
              <button className="primary" onClick={submit} disabled={running}>
                Submit
              </button>
            </div>
          </div>

          <div className="editor-wrap" style={{ flex: splitRatio }}>
            {problem && (
              <PythonEditor
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
                setSplitRatio(Math.min(90, Math.max(10, startFlex + (dy / totalH) * 100)));
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />

          <div className="py-output-panel" style={{ flex: 100 - splitRatio, minHeight: 0 }}>
            <div className="py-output-header">
              <span>Output</span>
              {(verdict || output) && (
                <button className="py-output-clear" onClick={() => { setVerdict(null); setOutput(null); }}>
                  Clear
                </button>
              )}
            </div>
          <div className="output" style={{ flex: 1, minHeight: 0 }}>
            {running && <p className="muted">Running…</p>}

            {!running && verdict && (
              <>
                <div className={`verdict ${verdict.passed ? 'pass' : 'fail'}`}>
                  <strong>
                    {verdict.isRun
                      ? `${verdict.passedCount} / ${verdict.total} tests passed`
                      : verdict.passed ? 'Accepted' : 'Wrong Answer'}
                    {!verdict.isRun && <span className="score">{verdict.passedCount} / {verdict.total} passed</span>}
                  </strong>
                  <span>
                    {verdict.passed
                      ? `All ${verdict.total} test cases passed.`
                      : verdict.error
                        ? verdict.error
                        : `${verdict.total - verdict.passedCount} test case(s) failed.`}
                  </span>
                </div>
                {verdict.results?.map((r, i) => (
                  !r.passed && (
                    <div key={i} className="py-fail-detail">
                      <div className="py-fail-name">{r.name}</div>
                      {r.error
                        ? <pre className="error">{r.error}</pre>
                        : (
                          <div className="diff">
                            <div><h4>Expected</h4><pre className="py-val">{r.expected}</pre></div>
                            <div><h4>Got</h4><pre className="py-val">{r.actual ?? 'None'}</pre></div>
                          </div>
                        )}
                    </div>
                  )
                ))}
              </>
            )}

            {!running && !verdict && output?.error && (
              <pre className="error">{output.error}</pre>
            )}

            {!running && !verdict && !output && (
              <p className="muted">
                Press <kbd>Ctrl+Enter</kbd> to run · <kbd>Submit</kbd> to grade all tests
              </p>
            )}
          </div>
          </div>
        </section>
      </div>

      {listOpen && (
        <PythonProblemList
          problems={problems}
          progress={progress}
          selectedId={selectedId}
          onSelect={handleSelect}
          onHide={onListClose}
        />
      )}

      {topicComplete && (
        <TopicComplete
          topic={topicComplete.topic}
          onClose={() => setTopicComplete(null)}
          onNext={topicComplete.nextId ? () => { handleSelect(topicComplete.nextId); setTopicComplete(null); } : null}
        />
      )}

    </div>
  );
}
