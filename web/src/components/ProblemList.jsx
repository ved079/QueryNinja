import { useEffect, useMemo, useRef, useState } from 'react';
import Dropdown from './Dropdown.jsx';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const STATUSES = ['All', 'Solved', 'Unsolved', 'Starred'];
const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

export default function ProblemList({ problems, progress, selectedId, onSelect, onHide, onToggleStar }) {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');
  const [topic, setTopic] = useState('All');
  const [sortBy, setSortBy] = useState('number');
  const topicMenuPortalRef = useRef(null);

  const isSolved = (p) => progress[p.id]?.status === 'solved';

  const topics = useMemo(
    () => ['All', ...new Set(problems.flatMap((p) => p.tags ?? []))].sort((a, b) =>
      a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)
    ),
    [problems]
  );

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

  const visible = useMemo(() => {
    const filtered = problems.filter((p) => {
      if (difficulty !== 'All' && p.difficulty !== difficulty) return false;
      if (status === 'Solved' && !isSolved(p)) return false;
      if (status === 'Unsolved' && isSolved(p)) return false;
      if (status === 'Starred' && !progress[p.id]?.starred) return false;
      if (topic !== 'All' && !(p.tags ?? []).includes(topic)) return false;
      const haystack = `${p.number}. ${p.title} ${(p.tags ?? []).join(' ')}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'difficulty') {
        const d = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
        if (d !== 0) return d;
      }
      if (sortBy === 'status') {
        const s = Number(isSolved(a)) - Number(isSolved(b));
        if (s !== 0) return s;
      }
      return (a.number ?? 0) - (b.number ?? 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems, progress, query, difficulty, status, topic, sortBy]);

  const solved = problems.filter(isSolved).length;
  const pct = problems.length ? Math.round((solved / problems.length) * 100) : 0;

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onHide(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onHide]);

  return (
    <div className="fs-list" onClick={(e) => e.stopPropagation()}>
      <header className="fs-list-head">
        <div className="fs-list-head-top">
          <h1>Problems</h1>
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
          <Dropdown label="Topic" value={topic} options={topics} onChange={setTopic} menuPortalRef={topicMenuPortalRef} />
          <Dropdown label="Sort" value={sortBy} options={[
            { label: 'Number', value: 'number' },
            { label: 'Difficulty', value: 'difficulty' },
            { label: 'Unsolved first', value: 'status' },
          ]} onChange={setSortBy} menuPortalRef={topicMenuPortalRef} />
        </div>
      </header>
      <div ref={topicMenuPortalRef} className="topic-menu-portal" />

      <div className="fs-list-body">
        <ul className="fs-list-items">
          {visible.map((p) => {
            const itemStatus = progress[p.id]?.status;
            return (
              <li key={p.id}>
                <button
                  className={`problem-item ${selectedId === p.id ? 'selected' : ''}`}
                  onClick={() => onSelect(p.id)}
                >
                  <span className={`status ${itemStatus ?? 'none'}`}
                    title={itemStatus ?? 'not started'} />
                  <span className="problem-title">{p.number}. {p.title}</span>
                  <span className={`difficulty ${p.difficulty.toLowerCase()}`}>{p.difficulty[0]}</span>
                </button>
                <button
                  className={`star-btn ${progress[p.id]?.starred ? 'starred' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleStar(p.id); }}
                  title={progress[p.id]?.starred ? 'Unstar' : 'Star'}
                >
                  <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="14" height="14">
                    <path fill="currentColor" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>
                  </svg>
                </button>
              </li>
            );
          })}
          {!visible.length && <li className="muted pad">No problems match these filters.</li>}
        </ul>
      </div>

      <footer className="fs-list-foot muted">
        {visible.length} shown · {problems.length} total
      </footer>
    </div>
  );
}
