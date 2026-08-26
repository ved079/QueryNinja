import { useEffect, useMemo, useRef, useState } from 'react';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const STATUSES = ['All', 'Solved', 'Unsolved'];
const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

const StarIcon = () => (
  <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="14" height="14">
    <path fill="currentColor" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>
  </svg>
);

export default function PythonProblemList({ problems, progress, selectedId, onSelect, onHide, onToggleStar }) {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');

  const isSolved = (p) => progress[p.id]?.status === 'solved';

  const stats = useMemo(() => {
    const base = { Easy: [0, 0], Medium: [0, 0], Hard: [0, 0] };
    for (const p of problems) {
      const row = base[p.difficulty];
      if (!row) continue;
      row[1] += 1;
      if (isSolved(p)) row[0] += 1;
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems, progress]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (difficulty !== 'All' && p.difficulty !== difficulty) return false;
      if (status === 'Solved' && !isSolved(p)) return false;
      if (status === 'Unsolved' && isSolved(p)) return false;
      const haystack = `${p.title} ${p.topic ?? ''}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems, progress, query, difficulty, status]);

  // Group filtered problems by topic, preserving topic order from problems array
  const groups = useMemo(() => {
    const order = [];
    const map = {};
    for (const p of filtered) {
      const key = p.topic ?? 'Other';
      if (!map[key]) { map[key] = []; order.push(key); }
      map[key].push(p);
    }
    return order.map((topic) => ({ topic, items: map[topic] }));
  }, [filtered]);

  const solved = problems.filter(isSolved).length;

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onHide(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onHide]);

  return (
    <div className="fullscreen-overlay" onClick={onHide}>
      <div className="fs-list" onClick={(e) => e.stopPropagation()}>
        <header className="fs-list-head">
          <div className="fs-list-head-top">
            <h1>Python Problems</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>Esc to close</span>
              <button className="hide-btn" onClick={onHide} title="Close">×</button>
            </div>
          </div>
          <div className="fs-list-head-stats">
            <span className="big">{solved}</span>
            <span className="muted">/ {problems.length} solved</span>
            <div className="bar" style={{ display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
              {['Easy', 'Medium', 'Hard'].map((d) => {
                const w = problems.length ? (stats[d][0] / problems.length) * 100 : 0;
                if (w <= 0) return null;
                return <div key={d} style={{ width: `${w}%`, height: '100%', background: d === 'Easy' ? 'var(--easy)' : d === 'Medium' ? 'var(--medium)' : 'var(--hard)' }} />;
              })}
            </div>
            <div className="stat-row">
              {DIFFICULTIES.slice(1).map((d) => (
                <span key={d} className="stat">
                  <span className={`difficulty ${d.toLowerCase()}`}>{d}</span>
                  <span className="muted">{stats[d][0]}/{stats[d][1]}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="fs-list-filters">
            <div className="chips">
              {STATUSES.map((s) => (
                <button key={s} className={`chip ${status === s ? 'active' : ''}`}
                  onClick={() => setStatus(s)}>{s}</button>
              ))}
            </div>
            <div className="chips">
              {DIFFICULTIES.map((d) => (
                <button key={d} className={`chip ${difficulty === d ? 'active' : ''}`}
                  onClick={() => setDifficulty(d)}>{d}</button>
              ))}
            </div>
            <input
              className="fs-search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </header>

        <div className="fs-list-body">
          {groups.length === 0 && (
            <p className="muted pad">No problems match these filters.</p>
          )}
          {groups.map(({ topic, items }) => {
            const topicSolved = items.filter(isSolved).length;
            return (
              <div key={topic} className="py-topic-group">
                <div className="py-topic-group-header">
                  <span className="py-topic-group-name">{topic}</span>
                  <span className="muted py-topic-group-count">{topicSolved}/{items.length}</span>
                </div>
                <ul className="fs-list-items">
                  {items.map((p) => {
                    const itemStatus = progress[p.id]?.status;
                    return (
                      <li key={p.id}>
                        <button
                          className={`problem-item ${selectedId === p.id ? 'selected' : ''}`}
                          onClick={() => { onSelect(p.id); onHide(); }}
                        >
                          <span className={`status ${itemStatus ?? 'none'}`} title={itemStatus ?? 'not started'} />
                          <span className="problem-title">{p.title}</span>
                          <span className={`difficulty ${(p.difficulty ?? 'easy').toLowerCase()}`}>
                            {p.difficulty ?? 'Easy'}
                          </span>
                        </button>
                        <button
                          className={`star-btn ${progress[p.id]?.starred ? 'starred' : ''}`}
                          onClick={(e) => { e.stopPropagation(); onToggleStar?.(p.id); }}
                          title={progress[p.id]?.starred ? 'Unstar' : 'Star'}
                        >
                          <StarIcon />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <footer className="fs-list-foot muted">
          {filtered.length} shown · {problems.length} total
        </footer>
      </div>
    </div>
  );
}
