const STAGE_COLORS = ['#4c8dff', '#35c46b', '#e8a33d', '#a855f7', '#f0553f'];

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

export default function PythonSidebar({ problems, progress, selectedId, onSelect }) {
  const stages = [...new Set(problems.map((p) => p.stage))].sort((a, b) => a - b);

  return (
    <aside className="py-sidebar">
      <div className="py-sidebar-header">
        <span className="py-sidebar-title">Python</span>
      </div>
      <div className="py-sidebar-body">
        <div className="py-sidebar-inner">
        {stages.map((stage) => {
          const unlocked = isStageUnlocked(problems, progress, stage);
          const { solved, total } = stageProgress(problems, progress, stage);
          const stageLabel = problems.find((p) => p.stage === stage)?.stageLabel ?? `Stage ${stage}`;
          const topics = [...new Set(
            problems.filter((p) => p.stage === stage).map((p) => p.topic)
          )];
          const color = STAGE_COLORS[(stage - 1) % STAGE_COLORS.length];

          return (
            <div key={stage} className={`py-stage ${unlocked ? '' : 'locked'}`}>

              {/* Stage label strip */}
              <div className="py-stage-header" style={{ '--stage-color': color }}>
                <div className="py-stage-left">
                  <span className="py-stage-num" style={{ color }}>Stage {stage}</span>
                  <span className="py-stage-label">{stageLabel}</span>
                </div>
                {unlocked
                  ? <span className="py-stage-count">{solved}/{total}</span>
                  : <span className="py-locked-badge">🔒</span>
                }
              </div>
              <div className="py-stage-rule" />

              {unlocked && topics.map((topic) => {
                const topicProblems = problems.filter(
                  (p) => p.stage === stage && p.topic === topic
                );
                const topicSolved = topicProblems.filter(
                  (p) => progress[p.id]?.status === 'solved'
                ).length;
                const allSolved = topicSolved === topicProblems.length;

                return (
                  <div key={topic} className="py-topic">
                    <div className="py-topic-header">
                      <span className={`py-topic-name ${allSolved ? 'done' : ''}`}>
                        {topic}
                      </span>
                      <span className="py-topic-count">
                        {topicSolved}/{topicProblems.length}
                      </span>
                    </div>

                    {topicProblems.map((p) => {
                      const status = progress[p.id]?.status;
                      return (
                        <button
                          key={p.id}
                          className={`py-problem-item ${p.id === selectedId ? 'selected' : ''}`}
                          onClick={() => onSelect(p.id)}
                        >
                          <span className={`py-status-dot ${status ?? 'none'}`} />
                          <span className="py-problem-title">{p.title}</span>
                          <span className={`py-diff-dot ${p.difficulty?.toLowerCase()}`} />
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {!unlocked && (
                <div className="py-locked-msg">
                  Complete Stage {stage - 1} to unlock
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </aside>
  );
}
