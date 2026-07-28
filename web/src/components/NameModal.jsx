import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 800;

// available: null (untouched/blank) | 'checking' | 'available' | 'taken' | 'invalid'
export default function NameModal({ currentName, onSave, onClose, onSkip }) {
  const [value, setValue] = useState(currentName ?? '');
  const [available, setAvailable] = useState(null);
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = value.trim();
    clearTimeout(timerRef.current);

    if (!trimmed) {
      setAvailable(null);
      return;
    }
    // Re-saving your own current name (or just its casing) needs no check.
    if (trimmed.toLowerCase() === (currentName ?? '').trim().toLowerCase()) {
      setAvailable('available');
      return;
    }

    setAvailable('checking');
    const requestId = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ name: trimmed, current: currentName ?? '' });
        const res = await fetch(`/api/username-available?${params}`);
        const data = await res.json();
        if (requestId !== requestIdRef.current) return; // stale response
        if (!data.available && data.reason === 'invalid') setAvailable('invalid');
        else setAvailable(data.available ? 'available' : 'taken');
      } catch {
        if (requestId === requestIdRef.current) setAvailable(null);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [value, currentName]);

  const canSave = value.trim() && available === 'available';

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || available !== 'available') return;
    onSave(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-body name-modal" onClick={(e) => e.stopPropagation()}>
        <div className="name-modal-inner">
          <h3>Set your name</h3>
          <p className="muted">This name keeps your progress saved — you will lose it without one.</p>
          <input
            className="name-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your username"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />
          <p className={`name-availability ${available ?? ''}`}>
            {available === 'checking' && 'Checking availability…'}
            {available === 'available' && '✓ Available'}
            {available === 'taken' && '✗ Already taken — try another'}
            {available === 'invalid' && 'Use 1–24 letters, numbers, spaces, - or _'}
            {!available && ' '}
          </p>
          <div className="name-modal-actions">
            {onSkip && !currentName && (
              <button className="skip-name-btn" onClick={onSkip}>
                Use without a username
              </button>
            )}
            <button onClick={onClose}>Cancel</button>
            <button className="primary" disabled={!canSave} onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
