import { useMemo } from 'react';

const ARC_LENGTH = 197.92;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ProgressPanel({ problems, progress, submissions, onHide }) {
  const stats = useMemo(() => {
    const solved = problems.filter((p) => progress[p.id]?.status === 'solved').length;
    const attempted = problems.filter((p) => progress[p.id]?.status === 'attempted').length;
    const buckets = { Easy: { total: 0, solved: 0 }, Medium: { total: 0, solved: 0 }, Hard: { total: 0, solved: 0 } };
    problems.forEach((p) => {
      const b = buckets[p.difficulty] ?? buckets.Hard;
      b.total++;
      if (progress[p.id]?.status === 'solved') b.solved++;
    });
    const total = problems.length;
    const pct = total ? Math.round((solved / total) * 100) : 0;
    return { total, solved, attempted, pct, buckets };
  }, [problems, progress]);

  const dashOffset = ARC_LENGTH * (1 - stats.pct / 100);

  const heatmap = useMemo(() => {
    const today = new Date();
    const curM = today.getMonth();
    const curY = today.getFullYear();
    let totalSubs = 0;
    let activeDays = 0;
    let streak = 0;
    let maxStreak = 0;
    const months = [];

    for (let offset = 5; offset >= 0; offset--) {
      const m = (curM - offset + 12) % 12;
      const year = curY + (curM - offset < 0 ? -1 : 0);
      const isCurrent = m === curM && year === curY;
      const firstDow = new Date(year, m, 1).getDay();
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const lastDay = isCurrent ? today.getDate() : daysInMonth;
      const monthData = { month: m, name: MONTHS[m], isCurrent, cells: [], firstDow };

      for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, m, d);
        const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        const count = submissions[key] ?? 0;
        totalSubs += count;
        if (count > 0) activeDays++;
        if (count > 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;

        let level = 0;
        if (count > 0) {
          if (count === 1) level = 4;
          else if (count === 2) level = 3;
          else if (count === 3) level = 2;
          else level = 1;
        }
        monthData.cells.push({ level, day: date.getDay(), date, count });
      }
      months.push(monthData);
    }
    return { months, totalSubs, activeDays, maxStreak };
  }, [submissions]);

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <h2 className="progress-title">Progress</h2>
        <button className="progress-close" onClick={onHide}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      </div>

      <div className="progress-body">
        <div className="progress-card">
          <div className="progress-card-label">Solved Problems</div>
          <div className="solved-container">
            <div className="ring-wrapper">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <path d="M 20.302 79.698 A 42 42 0 1 1 79.698 79.698"
                  stroke="var(--border)" strokeWidth="8" fill="none" strokeLinecap="round" />
                <path d="M 20.302 79.698 A 42 42 0 1 1 79.698 79.698"
                  stroke="var(--accent)" strokeWidth="8" fill="none" strokeLinecap="round"
                  strokeDasharray={ARC_LENGTH} strokeDashoffset={dashOffset} />
              </svg>
              <div className="ring-text">
                <div className="ring-pct">{stats.pct}%</div>
                <div className="ring-total">{stats.solved} / {stats.total}</div>
              </div>
            </div>

            <div className="diff-list">
              {[
                { key: 'Easy', color: 'var(--easy)' },
                { key: 'Medium', color: 'var(--medium)' },
                { key: 'Hard', color: 'var(--hard)' },
              ].map((d) => (
                <div key={d.key} className="diff-row">
                  <span className="diff-name">
                    <span className="diff-dot" style={{ background: d.color }} />
                    {d.key}
                  </span>
                  <span className="diff-count">
                    <strong>{stats.buckets[d.key].solved}</strong> / {stats.buckets[d.key].total}
                  </span>
                </div>
              ))}
              <div className="attempting-row">
                {stats.attempted} Attempting
              </div>
            </div>
          </div>
        </div>

        <div className="progress-card">
          <div className="progress-card-label">Badges & Achievements</div>
          <div className="badges-container">
            <div className="badge-highlight">
              <div className="badge-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8.5.75a.75.75 0 0 0-1.5 0v.75c-3.387.387-6 3.281-6 6.75a6.75 6.75 0 0 0 6.75 6.75h.75v.75a.75.75 0 0 0 1.5 0v-.75h.75A6.75 6.75 0 0 0 17.25 8.25c0-3.469-2.613-6.363-6-6.75V.75Z" />
                </svg>
              </div>
              <div className="badge-info">
                <h4>SQL Scholar</h4>
                <span>Completed your first SQL problem</span>
              </div>
            </div>
            <div className="badge-row">
              <div className="badge-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.373a.75.75 0 0 1 1.06 0L8 6.06l1.56-1.433a.75.75 0 1 1 1.06 1.06L8.5 7.12v1.88l1.62 1.62a.75.75 0 1 1-1.06 1.06L8 10.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06L7.5 9V7.12L6.379 5.927a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </div>
              <div className="badge-info">
                <h4>Join Master</h4>
                <span>Solved all JOIN problems</span>
              </div>
            </div>
            <div className="badge-row">
              <div className="badge-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="m7.429 1.525a.75.75 0 0 1 1.142 0l3.75 5.25a.75.75 0 0 1 0 .9l-3.75 5.25a.75.75 0 0 1-1.142 0l-3.75-5.25a.75.75 0 0 1 0-.9l3.75-5.25Z" />
                </svg>
              </div>
              <div className="badge-info">
                <h4>Consistent Solver</h4>
                <span>Solved 10 problems</span>
              </div>
            </div>
          </div>
        </div>

        <div className="progress-card heatmap-card">
          <div className="progress-card-label">Submission Activity</div>
          <div className="heatmap-header">
            <div className="heatmap-summary">
              {heatmap.totalSubs} submissions in last 6 months
            </div>
            <div className="heatmap-stats">
              <span>Active days: <strong>{heatmap.activeDays}</strong></span>
              <span>Max streak: <strong>{heatmap.maxStreak} days</strong></span>
            </div>
          </div>
          <div className="heatmap-body">
            <div className="heatmap-months-row">
              {heatmap.months.map((m, idx) => {
                const cols = Math.ceil((m.firstDow + m.cells.length) / 7);
                return (
                  <div key={idx} className={`heatmap-month${m.isCurrent ? ' heatmap-month-current' : ''}`}>
                    <span className="heatmap-month-label">{m.name}</span>
                    <div className="heatmap-month-grid" style={{ gridTemplateColumns: `repeat(${cols}, 10px)` }}>
                      {Array.from({ length: m.firstDow }, (_, i) => (
                        <div key={`s-${i}`} />
                      ))}
                      {m.cells.map((c, i) => (
                        <div key={i} className={`heatmap-cell${c.level ? ` lvl-${c.level}` : ''}`}
                          title={`${c.count} submission${c.count === 1 ? '' : 's'} on ${MONTHS[c.date.getMonth()]} ${c.date.getDate()}, ${c.date.getFullYear()}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
