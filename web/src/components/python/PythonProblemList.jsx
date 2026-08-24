import { useState } from 'react';

const STAGE_COLORS = ['#4c8dff', '#35c46b', '#e8a33d', '#a855f7', '#f0553f'];
const DIFF_COLOR = { easy: '#35c46b', medium: '#e8a33d', hard: '#f0553f' };

function stageProgress(problems, progress, stage) {
  const ps = problems.filter((p) => p.stage === stage);
  const solved = ps.filter((p) => progress[p.id]?.status === 'solved').length;
  return { total: ps.length, solved };
}

function isStageUnlocked(problems, progress, stage) {
  if (stage === 1) return true;
  const prev = stageProgress(problems, progress, stage - 1);
  return prev.solved === prev.total && prev.total > 0;
}

export default function PythonProblemList({ problems, progress, selectedId, onSelect, onHide }) {
  const [query, setQuery] = useState('');

  const stages = [...new Set(problems.map((p) => p.stage))].sort((a, b) => a - b);

  const filtered = query.trim()
    ? problems.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()) || p.topic.toLowerCase().includes(query.toLowerCase()))
    : null;

  return (
    <div className="fullscreen-overlay" onClick={(e) => { if (e.target === e.currentTarget) onHide(); }}>
      <div className="fs-list">
        <div className="fs-list-header">
          <span className="fs-list-title">Python Problems</span>
          <input
            className="fs-search"
            placeholder="Search problems…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className="link fs-close" onClick={onHide}>✕</button>
        </div>

        <div className="fs-list-body py-pl-body">
          {filtered ? (
            /* flat search results */
            filtered.length === 0 ? (
              <div className="py-pl-empty">No problems match "{query}"</div>
            ) : filtered.map((p) => (
              <ProblemRow key={p.id} p={p} progress={progress} selectedId={selectedId} onSelect={onSelect} onHide={onHide} />
            ))
          ) : (
            /* grouped by stage → topic */
            stages.map((stage) => {
              const unlocked = isStageUnlocked(problems, progress, stage);
              const { solved, total } = stageProgress(problems, progress, stage);
              const stageLabel = problems.find((p) => p.stage === stage)?.stageLabel ?? `Stage ${stage}`;
              const color = STAGE_COLORS[(stage - 1) % STAGE_COLORS.length];
              const topics = [...new Set(problems.filter((p) => p.stage === stage).map((p) => p.topic))];

              return (
                <div key={stage} className={`py-pl-stage ${unlocked ? '' : 'locked'}`}>
                  <div className="py-pl-stage-header">
                    <div className="py-pl-stage-left">
                      <span className="py-pl-stage-num" style={{ color }}>Stage {stage}</span>
                      <span className="py-pl-stage-label">{stageLabel}</span>
                    </div>
                    <span className="py-pl-stage-count">
                      {unlocked ? `${solved}/${total}` : '🔒'}
                    </span>
                  </div>

                  {unlocked && topics.map((topic) => {
                    const topicProblems = problems.filter((p) => p.stage === stage && p.topic === topic);
                    const topicSolved = topicProblems.filter((p) => progress[p.id]?.status === 'solved').length;
                    return (
                      <div key={topic} className="py-pl-topic">
                        <div className="py-pl-topic-header">
                          <span className={`py-pl-topic-name ${topicSolved === topicProblems.length ? 'done' : ''}`}>{topic}</span>
                          <span className="py-pl-topic-count">{topicSolved}/{topicProblems.length}</span>
                        </div>
                        {topicProblems.map((p) => (
                          <ProblemRow key={p.id} p={p} progress={progress} selectedId={selectedId} onSelect={onSelect} onHide={onHide} />
                        ))}
                      </div>
                    );
                  })}

                  {!unlocked && (
                    <div className="py-pl-locked-msg">Complete Stage {stage - 1} to unlock</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ProblemRow({ p, progress, selectedId, onSelect, onHide }) {
  const status = progress[p.id]?.status;
  const diffColor = DIFF_COLOR[p.difficulty?.toLowerCase()] ?? '#8b95a5';
  return (
    <button
      className={`problem-item ${p.id === selectedId ? 'selected' : ''}`}
      onClick={() => { onSelect(p.id); onHide(); }}
    >
      <span className={`status ${status === 'solved' ? 'solved' : status === 'attempted' ? 'attempted' : ''}`} />
      <span className="problem-title">{p.title}</span>
      <span className="badge" style={{ color: diffColor, background: `${diffColor}18`, borderColor: `${diffColor}30` }}>
        {p.difficulty}
      </span>
    </button>
  );
}
