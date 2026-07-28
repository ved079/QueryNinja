import { useEffect, useRef, useState } from 'react';
import SubmitButton from './SubmitButton.jsx';

const NAV_OPTIONS = [
  { label: 'Random unsolved', action: 'random' },
  { label: 'Random any', action: 'randomAll' },
  { label: 'Next in series', action: 'next' },
];

/**
 * Full-width bar above both panes: problem navigation on the left,
 * Run/Submit centered. Intentionally has no account/social chrome
 * (avatar, upvotes, premium, etc.) — this app has no accounts.
 */
export default function TopBar({
  onShowSidebar,
  problemMode,
  onToggleMode,
  onShowProgress,
  userName,
  onChangeName,
  nav,
  onRun,
  onSubmit,
}) {
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setNavOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleNav = (action) => {
    nav[action]?.();
    setNavOpen(false);
  };

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button className="sidebar-show" onClick={onShowSidebar} title="Show problem list">
          Problem List
        </button>
        <button
          className="sidebar-show"
          onClick={onToggleMode}
          title={problemMode === 'complex' ? 'Click to switch back to the original problems' : 'Click to switch to the newly added problems'}
        >
          {problemMode === 'complex' ? 'Complex Problems' : 'Normal Problems'} ▾
        </button>
        <button onClick={nav.prev} title="Previous problem" disabled={!nav.hasPrev}>
          ‹
        </button>
        <div className="nav-dropdown" ref={navRef}>
          <button onClick={() => setNavOpen((o) => !o)} title="Navigate">
            Go to ▾
          </button>
          {navOpen && (
            <div className="nav-dropdown-menu">
              {NAV_OPTIONS.map((opt) => (
                <button key={opt.action} onClick={() => handleNav(opt.action)}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={nav.next} title="Next problem" disabled={!nav.hasNext}>
          ›
        </button>
      </div>

      <div className="top-bar-center">
        <button onClick={onRun}>Run</button>
        <SubmitButton onClick={onSubmit} />
      </div>

      <div className="top-bar-right">
        {userName ? (
          <span className="user-name-group">
            <button onClick={onShowProgress} title="View progress">
              {userName}
            </button>
            <button className="rename-btn" onClick={onChangeName} title="Change name">
              ✎
            </button>
          </span>
        ) : (
          <button onClick={onChangeName} title="Set a name so your progress is your own">
            Set name
          </button>
        )}
      </div>
    </header>
  );
}
