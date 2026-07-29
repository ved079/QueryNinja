import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Dropdown({ label, value, options, onChange, menuPortalRef }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          (!menuPortalRef?.current || !menuPortalRef.current.contains(e.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuPortalRef]);

  useLayoutEffect(() => {
    if (open && menuPortalRef?.current && triggerRef.current) {
      const btnRect = triggerRef.current.getBoundingClientRect();
      const portalRect = menuPortalRef.current.getBoundingClientRect();
      setMenuStyle({ top: `${btnRect.bottom - portalRect.top + 6}px` });
    } else {
      setMenuStyle({});
    }
  }, [open, menuPortalRef]);

  const displayLabel = (opt) => (typeof opt === 'object' ? opt.label : opt);
  const optValue = (opt) => (typeof opt === 'object' ? opt.value : opt);

  const menu = open && (
    <div className="dropdown-menu" style={menuPortalRef?.current ? menuStyle : undefined}>
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
  );

  return (
    <div className="dropdown" ref={ref}>
      <span className="muted dropdown-label">{label}</span>
      <button className="dropdown-trigger" ref={triggerRef} onClick={() => setOpen((o) => !o)}>
        <span>{displayLabel(options.find((o) => optValue(o) === value) ?? value)}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menuPortalRef?.current ? createPortal(menu, menuPortalRef.current) : menu}
    </div>
  );
}
