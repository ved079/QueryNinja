import { useEffect, useRef, useState } from 'react';

export default function Dropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const displayLabel = (opt) => (typeof opt === 'object' ? opt.label : opt);
  const optValue = (opt) => (typeof opt === 'object' ? opt.value : opt);

  return (
    <div className="dropdown" ref={ref}>
      <span className="muted dropdown-label">{label}</span>
      <button className="dropdown-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{displayLabel(options.find((o) => optValue(o) === value) ?? value)}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu">
          {options.map((opt) => {
            const v = optValue(opt);
            return (
              <button
                key={v}
                className={`dropdown-item ${value === v ? 'active' : ''}`}
                onClick={() => { onChange(v); setOpen(false); }}
              >
                {displayLabel(opt)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
