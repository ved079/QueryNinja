import { useEffect, useState } from 'react';
import LessonRenderer from './LessonRenderer.jsx';

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export default function PythonPane({ problem, verdict, problems = [], progress = {}, onSelect }) {
  const [view, setView] = useState('lesson');
  const [bodySplit, setBodySplit] = useState(55);

  useEffect(() => {
    if (!problem) return;
    const hasLesson = !!problem.lesson;
    const alreadyStarted = !!progress[problem.id];
    setView(hasLesson && !alreadyStarted ? 'lesson' : 'problem');
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

  return (
    <section className="problem-pane">

      {/* Top bar */}
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

      <div className="pane-body">

        {/* Description */}
        <div className="pane-body-top" style={{ flex: hasTests ? bodySplit : 100 }}>
          <div className="pane-body-scroll">
            <div className="problem-head">
              <h2>{problem.title}</h2>
            </div>
            <div className="prose">
              <LessonRenderer markdown={problem.description} />
            </div>

            {/* Freerun: show expected output hint */}
            {hasFreerun && problem.expectedOutput && (
              <div className="py-expected-hint">
                <h4>Expected output</h4>
                <pre className="py-val">{problem.expectedOutput}</pre>
              </div>
            )}

            {/* Freerun: inputs used */}
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

        {/* Splitter + test cases (function-mode only) */}
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
