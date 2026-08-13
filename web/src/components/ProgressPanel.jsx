import { useEffect, useMemo, useState } from 'react';
import { firstSolvedDays } from '../lib/streak.js';
import { apiFetch, setToken } from '../lib/auth.js';

const ARC_LENGTH = 197.92;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ICONS = {
  star: (
    <path d="M8 1l1.57 3.18 3.5.51-2.54 2.47.6 3.49L8 9.27l-3.13 1.38.6-3.49L2.93 4.69l3.5-.51L8 1z" />
  ),
  trophy: (
    <path d="M4 2h8v1.5h1.5a1 1 0 011 1V6a2.5 2.5 0 01-2.5 2.5h-.26A4.5 4.5 0 018.75 11.9V13H10a1 1 0 011 1v.5H5V14a1 1 0 011-1h1.25v-1.1A4.5 4.5 0 014.26 8.5H4A2.5 2.5 0 011.5 6V4.5a1 1 0 011-1H4V2zm-1.5 2.5V6a1 1 0 001 1h.09A6.6 6.6 0 014 4.5h-1.5zM12 4.5a6.6 6.6 0 01-.09 2.5H12a1 1 0 001-1V4.5h-1z" />
  ),
  flame: (
    <path d="M8.15 1.1c1.9 1.3 3 3.1 3.5 4.4l.6-.6a.6.6 0 01.94.1c1.4 2.2 1.4 4.9.3 6.8-1.15 2-3.4 2.4-4.5 2.4-1 0-3.2-.2-4.4-2.4-.55-.94-.83-2-.74-3.1.1-1.1.58-2.16 1.5-3.1.56-.6 1-1.4 1.28-2.2.3-.78.45-1.5.5-1.85a.6.6 0 01.62-.5z" />
  ),
  tag: (
    <path d="M2 2h5.17a1.5 1.5 0 011.06.44l5.33 5.33a1.5 1.5 0 010 2.12l-3.66 3.66a1.5 1.5 0 01-2.12 0L2.44 8.23A1.5 1.5 0 012 7.17V2zm2.75 2a1 1 0 100 2 1 1 0 000-2z" />
  ),
  layers: (
    <path d="M8 1.5l6 3-6 3-6-3 6-3zm-6 5.4l6 3 6-3v1.7l-6 3-6-3V6.9zm0 3.6l6 3 6-3v1.7l-6 3-6-3v-1.7z" />
  ),
  crown: (
    <path d="M2 5.2l2.6 1.8L8 3l3.4 4 2.6-1.8L13 12H3L2 5.2zM3.2 13h9.6v1.3H3.2V13z" />
  ),
};

const BADGE_STYLE = {
  milestone: { color: 'var(--accent)', icon: 'star' },
  easy: { color: 'var(--easy)', icon: 'trophy' },
  medium: { color: 'var(--medium)', icon: 'trophy' },
  hard: { color: 'var(--hard)', icon: 'trophy' },
  mix: { color: '#a78bfa', icon: 'layers' },
  tag: { color: '#2dd4bf', icon: 'tag' },
  activity: { color: '#ff9d2e', icon: 'flame' },
  grand: { color: '#facc15', icon: 'crown' },
};

function badgeCategory(id) {
  if (id === 'grand') return 'grand';
  if (id === 'd-easy') return 'easy';
  if (id === 'd-med') return 'medium';
  if (id === 'd-hard') return 'hard';
  if (id === 'd-mix') return 'mix';
  if (id.startsWith('t-')) return 'tag';
  if (id.startsWith('a-')) return 'activity';
  return 'milestone';
}

function badgeColor(id) {
  return BADGE_STYLE[badgeCategory(id)].color;
}

function BadgeIcon({ id }) {
  const icon = BADGE_STYLE[badgeCategory(id)].icon;
  return (
    <div className="badge-icon">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        {ICONS[icon]}
      </svg>
    </div>
  );
}

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

// The grid is 2 columns, but the first badge is a highlighted card that
// spans both columns (its own full row) — so the first page only has room
// for 2 more regular badges alongside it (3 total), while every later page
// is a plain 2x2 grid with room for 4.
const FIRST_BADGE_PAGE_SIZE = 3;
const BADGES_PER_PAGE = 4;

function badgePageSlice(badges, page) {
  if (page === 0) return badges.slice(0, FIRST_BADGE_PAGE_SIZE);
  const offset = FIRST_BADGE_PAGE_SIZE + (page - 1) * BADGES_PER_PAGE;
  return badges.slice(offset, offset + BADGES_PER_PAGE);
}

function badgePageCountFor(total) {
  if (total <= FIRST_BADGE_PAGE_SIZE) return 1;
  return 1 + Math.ceil((total - FIRST_BADGE_PAGE_SIZE) / BADGES_PER_PAGE);
}

export default function ProgressPanel({ problems, progress, submissions, userName, onDeleteAccount, onLogout, onHide }) {
  const [deleting, setDeleting] = useState(false);
  const [badgePage, setBadgePage] = useState(0);
  const [linkedEmail, setLinkedEmail] = useState(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailStatus, setEmailStatus] = useState(null); // null | 'saving' | 'saved' | error message
  const [editingEmail, setEditingEmail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLinkedEmail(null);
    setEmailStatus(null);
    setEditingEmail(false);
    apiFetch(`/api/auth/email?user=${encodeURIComponent(userName || 'anonymous')}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setLinkedEmail(d.email ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userName]);

  // Step 1: link-email emails a code (it does not link yet) and returns
  // { pendingVerification: true }. Step 2 verifies the code, which is when
  // the email actually gets bound to the account.
  const [emailCode, setEmailCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);

  const sendEmailCode = async () => {
    const trimmed = emailDraft.trim();
    if (!trimmed) return;
    setEmailStatus('saving');
    setEmailCode('');
    setPendingVerification(false);
    try {
      const res = await apiFetch('/api/auth/link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName || 'anonymous', email: trimmed }),
      }, userName);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send the code.');
      setPendingVerification(true);
      setEmailStatus(null);
    } catch (err) {
      setEmailStatus(err.message);
    }
  };

  const saveEmail = async () => {
    const trimmed = emailCode.trim();
    if (!trimmed) return;
    setEmailStatus('saving');
    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userName || 'anonymous', email: emailDraft.trim(), code: trimmed }),
      }, userName);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That code is invalid or expired.');
      if (data.token) setToken(userName || 'anonymous', data.token);
      setLinkedEmail(data.email ?? emailDraft.trim());
      setPendingVerification(false);
      setEmailCode('');
      setEditingEmail(false);
      setEmailStatus(null);
    } catch (err) {
      setEmailStatus(err.message);
    }
  };
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
    // Days with a first-time solve drive the max-streak stat; submission
    // volume below still counts every entry (level + total count).
    const solveDays = firstSolvedDays(submissions);
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
        if (solveDays.has(key)) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;

        // More submissions that day = a higher level = a brighter/glowier flame.
        let level = 0;
        if (count === 1) level = 1;
        else if (count === 2) level = 2;
        else if (count === 3) level = 3;
        else if (count > 3) level = 4;
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

  const badgePageCount = badgePageCountFor(badges.length);
  const clampedBadgePage = Math.min(badgePage, badgePageCount - 1);
  const badgesOnPage = badgePageSlice(badges, clampedBadgePage);

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
          <div className="progress-card-label">
            Badges & Achievements
            {badges.length > 0 && (
              <span className="badges-count">{badges.length} earned</span>
            )}
          </div>
          <div className="badges-container">
            {badges.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Keep solving to earn badges.</p>
            ) : (
              <>
                <div className="badges-grid">
                  {badgesOnPage.map((b, i) => (
                    <div
                      key={b.id}
                      className={clampedBadgePage === 0 && i === 0 ? 'badge-highlight' : 'badge-row'}
                      style={{ '--badge-color': badgeColor(b.id) }}
                    >
                      <BadgeIcon id={b.id} />
                      <div className="badge-info">
                        <h4>{b.title}</h4>
                        <span>{b.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {badgePageCount > 1 && (
                  <div className="badges-pager">
                    <button
                      onClick={() => setBadgePage((p) => Math.max(0, p - 1))}
                      disabled={clampedBadgePage === 0}
                      title="Previous badges"
                    >
                      ‹
                    </button>
                    <span className="badges-pager-count">
                      Page {clampedBadgePage + 1} of {badgePageCount}
                    </span>
                    <button
                      onClick={() => setBadgePage((p) => Math.min(badgePageCount - 1, p + 1))}
                      disabled={clampedBadgePage === badgePageCount - 1}
                      title="Next badges"
                    >
                      ›
                    </button>
                  </div>
                )}
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
                          title={`${c.count} submission${c.count === 1 ? '' : 's'} on ${MONTHS[c.date.getMonth()]} ${c.date.getDate()}, ${c.date.getFullYear()}`}>
                          🔥
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="progress-card recovery-email-card">
          <div className="progress-card-label">Recovery email</div>
          {linkedEmail && !editingEmail ? (
            <div className="recovery-email-row">
              <span>{linkedEmail}</span>
              <button onClick={() => { setEditingEmail(true); setEmailDraft(linkedEmail); }}>Change</button>
            </div>
          ) : pendingVerification ? (
            <div className="recovery-email-row">
              <input
                className="name-input"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                autoFocus
              />
              <button className="primary" disabled={emailStatus === 'saving' || !emailCode.trim()} onClick={saveEmail}>
                {emailStatus === 'saving' ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          ) : (
            <div className="recovery-email-row">
              <input
                className="name-input"
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={(e) => e.key === 'Enter' && sendEmailCode()}
              />
              <button className="primary" disabled={emailStatus === 'saving' || !emailDraft.trim()} onClick={sendEmailCode}>
                {emailStatus === 'saving' ? 'Sending…' : 'Save'}
              </button>
            </div>
          )}
          {pendingVerification && (
            <button onClick={() => { setPendingVerification(false); setEmailCode(''); }}>Back</button>
          )}
          {emailStatus && emailStatus !== 'saving' && (
            <p className="name-availability taken" style={{ marginTop: 6 }}>{emailStatus}</p>
          )}
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
            Link an email so you can log back in as <strong>{userName || 'anonymous'}</strong> from another device with a code, no password needed.
          </p>
        </div>

        <div className="progress-delete-section">
          {!deleting ? (
            <div className="delete-confirm-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="delete-btn" onClick={onLogout}>
                Log out
              </button>
              <button className="delete-btn" onClick={() => setDeleting(true)}>
                Delete my data
              </button>
            </div>
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
