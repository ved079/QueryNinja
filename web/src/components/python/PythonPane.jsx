import { useEffect, useState } from 'react';
import LessonRenderer from './LessonRenderer.jsx';

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export default function PythonPane({ problem, verdict, problems = [], progress = {}, onSelect }) {
  const [view, setView] = useState('lesson');
  const [tab, setTab] = useState('Problem');
  const [bodySplit, setBodySplit] = useState(55);

  useEffect(() => {
    if (!problem) return;
    const hasLesson = !!problem.lesson;
    const alreadyStarted = !!progress[problem.id];
    setView(hasLesson && !alreadyStarted ? 'lesson' : 'problem');
    setTab('Problem');
  }, [problem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!problem) return null;

  const diff = problem.difficulty?.toLowerCase() ?? 'easy';
  const topicProblems = problems.filter(
    (p) => p.stage === problem.stage && p.topic === problem.topic
  );
  const curIdx = topicProblems.findIndex((p) => p.id === problem.id);
  const prevP = topicProblems[curIdx - 1] ?? null;
  const nextP = topicProblems[curIdx + 1] ?? null;
  const topicLesson = topicProblems.find((p) => p.lesson);
  const solvedCount = topicProblems.filter((p) => progress[p.id]?.status === 'solved').length;

  // ── LESSON VIEW ──────────────────────────────────────────
  if (view === 'lesson') {
    return (
      <section className="problem-pane">
        <div className="py-lesson-wrap">
          {/* Stage breadcrumb */}
          <div className="py-lesson-crumb">
            <span className="py-crumb-stage">Stage {problem.stage} · {problem.stageLabel}</span>
            <span className="py-crumb-sep">›</span>
            <span className="py-crumb-topic">{problem.topic}</span>
          </div>

          {/* Lesson content */}
          <div className="py-lesson-scroll">
            <LessonRenderer markdown={problem.lesson} />
          </div>

          {/* Topic progress + CTA */}
          <div className="py-lesson-footer">
            <div className="py-topic-progress">
              <span className="py-tp-label">{solvedCount}/{topicProblems.length} solved</span>
              <div className="py-tp-dots">
                {topicProblems.map((p, i) => {
                  const st = progress[p.id]?.status;
                  const isCur = p.id === problem.id;
                  return (
                    <button
                      key={p.id}
                      className={`py-tp-dot ${st === 'solved' ? 'solved' : st === 'attempted' ? 'attempted' : ''} ${isCur ? 'current' : ''}`}
                      title={p.title}
                      onClick={() => { onSelect?.(p.id); setView('problem'); }}
                    />
                  );
                })}
              </div>
            </div>
            <button
              className="py-start-btn"
              onClick={() => { onSelect?.(topicProblems[0]?.id ?? problem.id); setView('problem'); }}
            >
              Start Problems <span className="py-start-arrow">→</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── PROBLEM VIEW ─────────────────────────────────────────
  const hasFreerun = problem.type === 'freerun';
  const hasTests = !hasFreerun && Array.isArray(problem.tests) && problem.tests.length > 0;
  const savedProg = progress[problem.id];
  const isSolved = savedProg?.status === 'solved';

  return (
    <section className="problem-pane">

      {/* Top bar: back + breadcrumb + difficulty */}
      <div className="py-prob-topbar">
        <div className="py-prob-topbar-left">
          {topicLesson && (
            <button
              className="py-back-lesson"
              onClick={() => { onSelect?.(topicLesson.id); setView('lesson'); }}
              title="Back to lesson"
            >
              ← Lesson
            </button>
          )}
          <span className="py-prob-crumb">
            {problem.topic} · {curIdx + 1}/{topicProblems.length}
          </span>
        </div>
        <span className={`difficulty ${diff}`}>{problem.difficulty}</span>
      </div>

      {/* Tab bar */}
      <nav className="pane-nav" style={{ paddingLeft: 12 }}>
        <div className="tabs">
          {['Problem', 'Hint', 'Solution', 'Past Submissions'].map((t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </nav>

      <div className="pane-body">

        {/* ── Problem tab ── */}
        {tab === 'Problem' && (
          <>
            <div className="pane-body-top" style={{ flex: hasTests ? bodySplit : 100 }}>
              <div className="pane-body-scroll">
                <div className="problem-head">
                  <h2>{problem.title}</h2>
                </div>
                <div className="prose">
                  <LessonRenderer markdown={problem.description} />
                </div>
                {hasFreerun && problem.expectedOutput && (
                  <div className="py-expected-hint">
                    <h4>Expected output</h4>
                    <pre className="py-val">{problem.expectedOutput}</pre>
                  </div>
                )}
                {hasFreerun && problem.inputs?.length > 0 && (
                  <div className="py-expected-hint">
                    <h4>Inputs provided to <code>input()</code></h4>
                    {problem.inputs.map((v, i) => (
                      <pre key={i} className="py-val">{v}</pre>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {hasTests && (
              <>
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
                <div className="pane-body-bottom" style={{ flex: 100 - bodySplit }}>
                  <div className="pane-body-scroll">
                    <h3>Example test cases</h3>
                    {problem.tests.slice(0, 3).map((t, i) => (
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
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Hint tab ── */}
        {tab === 'Hint' && (
          <div className="pane-body-top" style={{ flex: 100 }}>
            <div className="pane-body-scroll">
              <div className="prose">
                {problem.hint
                  ? <p className="hint">{problem.hint}</p>
                  : <p className="muted">No hint for this one — you're on your own.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Solution tab ── */}
        {tab === 'Solution' && (
          <div className="pane-body-top" style={{ flex: 100 }}>
            <div className="pane-body-scroll">
              <div className="prose">
                {isSolved ? (
                  savedProg?.code
                    ? <>
                        <p className="muted note">Your accepted solution:</p>
                        <pre className="solution">{savedProg.code}</pre>
                      </>
                    : <p className="muted">No code saved for your solution.</p>
                ) : (
                  <p className="muted">Solve this problem to unlock the solution.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Past Submissions tab ── */}
        {tab === 'Past Submissions' && (
          <div className="pane-body-top" style={{ flex: 100 }}>
            <div className="pane-body-scroll past-sub-pane">
              {savedProg ? (
                <div className="past-subs">
                  <button className="past-sub-row">
                    <span className="past-sub-date">
                      {savedProg.solvedAt
                        ? new Date(savedProg.solvedAt).toLocaleDateString()
                        : savedProg.updatedAt
                          ? new Date(savedProg.updatedAt).toLocaleDateString()
                          : '—'}
                      <span className="muted">
                        {' '}{savedProg.solvedAt
                          ? new Date(savedProg.solvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </span>
                    <span className={`past-sub-status ${isSolved ? 'solved' : 'attempted'}`}>
                      {isSolved ? 'Solved' : 'Attempted'}
                    </span>
                  </button>
                </div>
              ) : (
                <p className="muted">No submissions yet for this problem.</p>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Bottom navigation */}
      <div className="py-prob-footer">
        <button
          className="py-nav-btn"
          disabled={!prevP}
          onClick={() => prevP && onSelect?.(prevP.id)}
          title={prevP?.title ?? ''}
        >
          ← Prev
        </button>

        <div className="py-tp-dots">
          {topicProblems.map((p) => {
            const st = progress[p.id]?.status;
            const isCur = p.id === problem.id;
            return (
              <button
                key={p.id}
                className={`py-tp-dot ${st === 'solved' ? 'solved' : st === 'attempted' ? 'attempted' : ''} ${isCur ? 'current' : ''}`}
                title={p.title}
                onClick={() => onSelect?.(p.id)}
              />
            );
          })}
        </div>

        <button
          className="py-nav-btn"
          disabled={!nextP}
          onClick={() => nextP && onSelect?.(nextP.id)}
          title={nextP?.title ?? ''}
        >
          Next →
        </button>
      </div>

    </section>
  );
}
