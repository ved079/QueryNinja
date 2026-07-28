import { useMemo, useState } from 'react';

const ARC_LENGTH = 197.92;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BADGE_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1l1.57 3.18 3.5.51-2.54 2.47.6 3.49L8 9.27l-3.13 1.38.6-3.49L2.93 4.69l3.5-.51L8 1z" />
  </svg>
);

function computeBadges(solvedSet, solvedCount, problems, activeDays, maxStreak) {
  const badges = [];
  const allProblems = problems.length;

  // milestone
  const milestones = [[1, 'First Solve', 'Solved your first problem'],
    [5, 'Rising Star', 'Solved 5 problems'],
    [10, 'Double Digits', 'Solved 10 problems'],
    [25, 'Quarter Century', 'Solved 25 problems'],
    [50, 'Half Century', 'Solved 50 problems']];
  for (const [threshold, title, desc] of milestones) {
    if (solvedCount >= threshold) badges.push({ id: 'm' + threshold, title, desc, sort: 100 + threshold });
  }

  // difficulty
  const byDiff = { Easy: [], Medium: [], Hard: [] };
  problems.forEach((p) => byDiff[p.difficulty]?.push(p.id));
  if (byDiff.Easy.every((id) => solvedSet.has(id))) badges.push({ id: 'd-easy', title: 'Easy Street', desc: 'All Easy problems solved', sort: 200 });
  if (byDiff.Medium.every((id) => solvedSet.has(id))) badges.push({ id: 'd-med', title: 'Medium Well', desc: 'All Medium problems solved', sort: 201 });
  if (byDiff.Hard.every((id) => solvedSet.has(id))) badges.push({ id: 'd-hard', title: 'Hard Core', desc: 'All Hard problems solved', sort: 202 });
  if (['Easy', 'Medium', 'Hard'].every((d) => byDiff[d].some((id) => solvedSet.has(id)))) {
    badges.push({ id: 'd-mix', title: 'Full House', desc: 'At least one of each difficulty solved', sort: 203 });
  }

  // tag completion
  const tagMap = {};
  problems.forEach((p) => (p.tags ?? []).forEach((t) => { (tagMap[t] ??= []).push(p.id); }));
  for (const [tag, ids] of Object.entries(tagMap)) {
    if (ids.every((id) => solvedSet.has(id))) {
      badges.push({ id: 't-' + tag, title: tag + ' Master', desc: 'All ' + tag + ' problems solved', sort: 300 });
    }
  }

  // activity
  if (activeDays >= 1) badges.push({ id: 'a-first', title: 'First Try', desc: 'First submission ever', sort: 400 });
  if (activeDays >= 7) badges.push({ id: 'a-7', title: 'Getting Started', desc: 'Submitted on 7+ different days', sort: 401 });
  if (activeDays >= 30) badges.push({ id: 'a-30', title: 'Consistent', desc: 'Submitted on 30+ different days', sort: 402 });
  if (maxStreak >= 10) badges.push({ id: 'a-s10', title: 'Streak Master', desc: 'Max streak of 10+ days', sort: 403 });
  if (maxStreak >= 30) badges.push({ id: 'a-s30', title: 'Streak Legend', desc: 'Max streak of 30+ days', sort: 404 });

  // ultimate
  if (solvedCount >= allProblems) badges.push({ id: 'grand', title: 'Grand Master', desc: 'All problems solved', sort: 500 });

  badges.sort((a, b) => a.sort - b.sort);
  return badges;
}

export default function ProgressPanel({ problems, progress, submissions, userName, onDeleteAccount, onHide }) {
  const [deleting, setDeleting] = useState(false);
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
    // Build date→count lookup from array of submission entries.
    const byDate = {};
    (submissions ?? []).forEach((s) => {
      const d = s.submittedAt ? s.submittedAt.slice(0, 10) : null;
      if (d) byDate[d] = (byDate[d] ?? 0) + 1;
    });
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
        const count = byDate[key] ?? 0;
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

  const badges = useMemo(() => {
    const solvedSet = new Set(problems.filter((p) => progress[p.id]?.status === 'solved').map((p) => p.id));
    const solvedCount = solvedSet.size;
    return computeBadges(solvedSet, solvedCount, problems, heatmap.activeDays, heatmap.maxStreak);
  }, [problems, progress, heatmap.activeDays, heatmap.maxStreak]);

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
            {badges.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Keep solving to earn badges.</p>
            ) : (
              <>
                <div className="badge-highlight">
                  <div className="badge-icon">{BADGE_ICON}</div>
                  <div className="badge-info">
                    <h4>{badges[0].title}</h4>
                    <span>{badges[0].desc}</span>
                  </div>
                </div>
                {badges.slice(1).map((b) => (
                  <div key={b.id} className="badge-row">
                    <div className="badge-icon">{BADGE_ICON}</div>
                    <div className="badge-info">
                      <h4>{b.title}</h4>
                      <span>{b.desc}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
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

        <div className="progress-delete-section">
          {!deleting ? (
            <button className="delete-btn" onClick={() => setDeleting(true)}>
              Delete my data
            </button>
          ) : (
            <div className="delete-confirm">
              <p className="muted">This will erase all progress and submissions for <strong>{userName || 'anonymous'}</strong>. This cannot be undone.</p>
              <div className="delete-confirm-actions">
                <button onClick={() => setDeleting(false)}>Cancel</button>
                <button className="danger" onClick={() => { setDeleting(false); onDeleteAccount(); }}>
                  Yes, delete everything
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
