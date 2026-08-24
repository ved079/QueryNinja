import { useState } from 'react';
import LessonRenderer from './LessonRenderer.jsx';

const DIFFICULTY_COLOR = { easy: '#35c46b', medium: '#e8a33d', hard: '#f0553f' };

export default function PythonPane({ problem, verdict, defaultTab }) {
  const [tab, setTab] = useState(defaultTab ?? (problem?.lesson ? 'lesson' : 'problem'));

  if (!problem) return null;

  const diffColor = DIFFICULTY_COLOR[problem.difficulty?.toLowerCase()] ?? '#8b95a5';

  return (
    <div className="problem-pane">
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

        {/* ── LESSON ── */}
        {tab === 'lesson' && (
          <div className="pane-body-top">
            <LessonRenderer markdown={problem.lesson} />
          </div>
        )}

        {/* ── PROBLEM ── */}
        {tab === 'problem' && (
          <div className="pane-body-top">
            {/* header */}
            <div className="py-problem-header">
              <h2 className="py-problem-title-text">{problem.title}</h2>
              <div className="py-problem-meta">
                <span className="py-meta-pill" style={{ color: diffColor, background: `${diffColor}18`, borderColor: `${diffColor}30` }}>
                  {problem.difficulty}
                </span>
                <span className="py-meta-pill">{problem.topic}</span>
                <span className="py-meta-pill">Stage {problem.stage}</span>
              </div>
            </div>

            {/* description — uses full lesson renderer so code blocks render properly */}
            <div className="py-description">
              <LessonRenderer markdown={problem.description} />
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab === 'results' && verdict && (
          <div className="pane-body-top">
            <div className="py-results-header">
              <span className={`py-verdict-label ${verdict.passed ? 'pass' : 'fail'}`}>
                {verdict.passed ? '✓ All tests passed' : `${verdict.passedCount} / ${verdict.total} passed`}
              </span>
            </div>
            <div className="py-results">
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
                        <div className="py-diff">
                          <div className="py-diff-side">
                            <span className="py-diff-label">Expected</span>
                            <code className="py-val">{String(r.expected)}</code>
                          </div>
                          <div className="py-diff-side">
                            <span className="py-diff-label">Got</span>
                            <code className="py-val got">{r.actual ?? 'None'}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
