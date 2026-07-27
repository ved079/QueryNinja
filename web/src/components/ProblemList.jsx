import { useMemo, useState } from 'react';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const STATUSES = ['Solved', 'Unsolved'];
const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

export default function ProblemList({ problems, progress, selectedId, onSelect, onHide }) {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');
  const [topic, setTopic] = useState('All');
  const [sortBy, setSortBy] = useState('number');

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

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <div className="sidebar-title-row">
          <h1>SQL Practice</h1>
          <button className="hide-btn" onClick={onHide} title="Close">
            ×
          </button>
        </div>
        <div className="progress-row">
          <span className="big">{solved}</span>
          <span className="muted">/ {problems.length} solved</span>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="stat-row">
          {DIFFICULTIES.slice(1).map((d) => (
            <span key={d} className="stat">
              <span className={`difficulty ${d.toLowerCase()}`}>{d}</span>
              <span className="muted">
                {stats[d][0]}/{stats[d][1]}
              </span>
            </span>
          ))}
        </div>
      </header>

      <div className="filters">

        <div className="chips-row">
          <div className="chips">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={`chip ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="chips">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`chip ${status === s ? 'active' : ''}`}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="selects">
          <label className="sort">
            <span className="muted">Topic</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="sort">
            <span className="muted">Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="number">Number</option>
              <option value="difficulty">Difficulty</option>
              <option value="status">Unsolved first</option>
            </select>
          </label>
        </div>
      </div>

      <ul className="problem-list">
        {visible.map((p) => {
          const itemStatus = progress[p.id]?.status;
          return (
            <li key={p.id}>
              <button
                className={`problem-item ${selectedId === p.id ? 'selected' : ''}`}
                onClick={() => onSelect(p.id)}
              >
                <span
                  className={`status ${itemStatus ?? 'none'}`}
                  title={itemStatus ?? 'not started'}
                />
                <span className="problem-title">
                  {p.number}. {p.title}
                </span>
                <span className={`difficulty ${p.difficulty.toLowerCase()}`}>
                  {p.difficulty[0]}
                </span>
              </button>
            </li>
          );
        })}
        {!visible.length && <li className="muted pad">No problems match these filters.</li>}
      </ul>

      <footer className="sidebar-foot muted">
        {visible.length} shown · {problems.length} total
      </footer>
    </aside>
  );
}
