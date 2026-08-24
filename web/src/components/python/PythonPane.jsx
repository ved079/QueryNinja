import { useEffect, useState } from 'react';
import LessonRenderer from './LessonRenderer.jsx';

const DIFF_COLOR = { easy: '#35c46b', medium: '#e8a33d', hard: '#f0553f' };

export default function PythonPane({ problem, verdict, defaultTab, problems = [], progress = {}, onSelect }) {
  const [tab, setTab] = useState(defaultTab ?? 'problem');
  const [bodySplit, setBodySplit] = useState(45);

  // Reset tab whenever the problem changes
  useEffect(() => {
    setTab(defaultTab ?? (problem?.lesson ? 'lesson' : 'problem'));
  }, [problem?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!problem) return null;

  const diff = problem.difficulty?.toLowerCase() ?? 'easy';

  // All problems in this topic (for the lesson view)
  const topicProblems = problems.filter(
    (p) => p.stage === problem.stage && p.topic === problem.topic
  );

  const hasBottom = tab === 'problem';

  return (
    <section className="problem-pane">
      <nav className="pane-nav">
        <div className="tabs">
          {problem.lesson && (
            <button className={`tab ${tab === 'lesson' ? 'active' : ''}`} onClick={() => setTab('lesson')}>
              Lesson
            </button>
          )}
          <button className={`tab ${tab === 'problem' ? 'active' : ''}`} onClick={() => setTab('problem')}>
            Problem
          </button>
          {verdict && (
            <button className={`tab ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>
              Results
            </button>
          )}
        </div>
        {tab === 'lesson' && (
          <button className="pane-nav-cta" onClick={() => setTab('problem')}>
            Start Problems →
          </button>
        )}
      </nav>

      <div className="pane-body">

        {/* ── LESSON ── lesson content + topic problem list */}
        {tab === 'lesson' && (
          <div className="pane-body-top" style={{ flex: 100 }}>
            <div className="pane-body-scroll">
              <LessonRenderer markdown={problem.lesson} />

              {topicProblems.length > 0 && (
                <div className="py-topic-problems">
                  <h1>Python Problems</h1>
                  <ul className="fs-list-items">
                    {topicProblems.map((p) => {
                      const st = progress[p.id]?.status;
                      const dc = DIFF_COLOR[p.difficulty?.toLowerCase()] ?? '#8b95a5';
                      return (
                        <li key={p.id}>
                          <button
                            className={`problem-item ${p.id === problem.id ? 'selected' : ''}`}
                            onClick={() => onSelect?.(p.id)}
                          >
                            <span className={`status ${st ?? 'none'}`} title={st ?? 'not started'} />
                            <span className="problem-title">{p.title}</span>
                            <span className="badge" style={{ color: dc, background: `${dc}18`, borderColor: `${dc}30` }}>
                              {p.difficulty}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PROBLEM ── top: description, bottom: test examples */}
        {tab === 'problem' && (
          <div className="pane-body-top" style={{ flex: bodySplit }}>
            <div className="problem-head">
              <h2>{problem.title}</h2>
              <div className="badges">
                <span className={`difficulty ${diff}`}>{problem.difficulty}</span>
                <span className="badge">{problem.topic}</span>
                <span className="badge">Stage {problem.stage}</span>
              </div>
            </div>
            <div className="prose">
              <LessonRenderer markdown={problem.description} />
            </div>
          </div>
        )}

        {/* ── RESULTS ── full-height scrollable */}
        {tab === 'results' && verdict && (
          <div className="pane-body-top" style={{ flex: 100 }}>
            <div className="pane-body-scroll">
              <div className={`verdict ${verdict.passed ? 'pass' : 'fail'}`} style={{ marginBottom: 12 }}>
                <strong>
                  {verdict.passed ? 'All tests passed' : `${verdict.passedCount} / ${verdict.total} passed`}
                </strong>
              </div>
              {verdict.results?.map((r, i) => (
                <div key={i} className={`py-result-row ${r.passed ? 'pass' : 'fail'}`}>
                  <div className="py-result-top">
                    <span className="py-result-name">{r.name}</span>
                    <span className={`py-result-badge ${r.passed ? 'pass' : 'fail'}`}>
                      {r.passed ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                  {!r.passed && (
                    <div className="py-result-detail">
                      {r.error ? (
                        <pre className="error">{r.error}</pre>
                      ) : (
                        <div className="diff">
                          <div><h4>Expected</h4><pre className="py-val">{String(r.expected)}</pre></div>
                          <div><h4>Got</h4><pre className="py-val">{r.actual ?? 'None'}</pre></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Splitter + bottom test cases (problem tab only) */}
        {hasBottom && (
          <div
            className="splitter"
            onMouseDown={(e) => {
              e.preventDefault();
              const pane = e.currentTarget.parentElement;
              const totalH = pane.offsetHeight - e.currentTarget.offsetHeight;
              const startY = e.clientY;
              const startPct = bodySplit;
              const onMove = (me) => {
                const pct = startPct + ((me.clientY - startY) / totalH) * 100;
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
        )}

        {hasBottom && (
          <div className="pane-body-bottom" style={{ flex: 100 - bodySplit }}>
            <div className="pane-body-scroll">
              <h3>Example test cases</h3>
              {problem.tests?.slice(0, 3).map((t, i) => (
                <div key={i} className="table-block">
                  <h4>{t.name}</h4>
                  <div className="diff">
                    <div>
                      <h4>Input</h4>
                      <pre className="py-val">{JSON.stringify(Array.isArray(t.input) && t.input.length === 1 ? t.input[0] : t.input)}</pre>
                    </div>
                    <div>
                      <h4>Expected</h4>
                      <pre className="py-val">{JSON.stringify(t.expectedOutput)}</pre>
                    </div>
                  </div>
                </div>
              ))}
              <p className="muted note">
                Submit runs your code against <strong>{problem.tests?.length} test cases</strong> — including hidden edge cases.
              </p>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
