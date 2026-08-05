import { useEffect, useRef, useState } from 'react';
import SubmitButton from './SubmitButton.jsx';

const NAV_OPTIONS = [
  { label: 'Random unsolved', action: 'random' },
  { label: 'Random any', action: 'randomAll' },
  { label: 'Next in series', action: 'next' },
];

// The three sections a user can browse. 'da' problems are the Data Analyst
// (business-metric) set and are exclusive to that section.
const SECTION_OPTIONS = [
  { value: 'normal', label: 'Normal Problems' },
  { value: 'complex', label: 'Complex Problems' },
  { value: 'da', label: 'Data Analyst' },
];

/**
 * Full-width bar above both panes: problem navigation on the left,
 * Run/Submit centered. Intentionally has no account/social chrome
 * (avatar, upvotes, premium, etc.) — this app has no accounts.
 */
export default function TopBar({
  onShowSidebar,
  problemMode,
  onChangeMode,
  onShowProgress,
  userName,
  streak,
  onChangeName,
  onLoginWithEmail,
  nav,
  onRun,
  onSubmit,
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const navRef = useRef(null);
  const sectionsRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setNavOpen(false);
      if (sectionsRef.current && !sectionsRef.current.contains(e.target)) setSectionsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleNav = (action) => {
    nav[action]?.();
    setNavOpen(false);
  };

  const currentSection = SECTION_OPTIONS.find((s) => s.value === problemMode) ?? SECTION_OPTIONS[0];

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <img src="/logo.png" alt="QueryNinja" className="top-logo" />
        <button className="sidebar-show" onClick={onShowSidebar} title="Show problem list">
          Problem List
        </button>
        <div className="nav-dropdown" ref={sectionsRef}>
          <button
            className="sidebar-show"
            onClick={() => setSectionsOpen((o) => !o)}
            title="Switch problem section"
          >
            {currentSection.label} ▾
          </button>
          {sectionsOpen && (
            <div className="nav-dropdown-menu">
              {SECTION_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  className={problemMode === s.value ? 'section-active' : ''}
                  onClick={() => { onChangeMode(s.value); setSectionsOpen(false); }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
            <span className={`streak-badge${streak > 0 ? ' active' : ''}`}>
              <svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor">
                <path fillRule="evenodd" d="M7.19 1.564a.75.75 0 01.729.069c2.137 1.475 3.373 3.558 3.981 5.002l.641-.663a.75.75 0 011.17.115c1.633 2.536 1.659 5.537.391 7.725-1.322 2.282-3.915 2.688-5.119 2.688-1.177 0-3.679-.203-5.12-2.688-.623-1.076-.951-2.29-.842-3.528.109-1.245.656-2.463 1.697-3.54.646-.67 1.129-1.592 1.468-2.492.337-.895.51-1.709.564-2.105a.75.75 0 01.44-.583zm.784 2.023c-.1.368-.226.773-.385 1.193-.375.997-.947 2.13-1.792 3.005-.821.851-1.205 1.754-1.282 2.63-.078.884.153 1.792.647 2.645C6.176 14.81 7.925 15 8.983 15c1.03 0 2.909-.366 3.822-1.94.839-1.449.97-3.446.11-5.315l-.785.812a.75.75 0 01-1.268-.345c-.192-.794-1.04-2.948-2.888-4.625z" clipRule="evenodd" />
              </svg>
              <span className="streak-count">{streak}</span>
              <span className="streak-tooltip">
                <strong>{streak} Streak{streak === 1 ? '' : 's'}</strong>
                <span>{streak > 0 ? 'Keep the fire going!' : 'Get Started Early!'}</span>
              </span>
            </span>
            <button onClick={onShowProgress} title="View progress">
              {userName}
            </button>
            <button className="rename-btn" onClick={onChangeName} title="Change name">
              ✎
            </button>
          </span>
        ) : (
          <span className="user-name-group">
            <span className="set-name-hint">Track your progress →</span>
            <button
              className="set-name-btn glow"
              onClick={onChangeName}
              title="Set a name so your progress is your own"
            >
              Set name
            </button>
            <button className="login-email-link" onClick={onLoginWithEmail} title="Log in with your recovery email">
              Log in with email
            </button>
          </span>
        )}
      </div>
    </header>
  );
}
