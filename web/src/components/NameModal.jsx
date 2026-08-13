import { useEffect, useRef, useState } from 'react';
import { apiFetch, getToken, setToken } from '../lib/auth.js';

const DEBOUNCE_MS = 800;

export default function NameModal({ currentName, onSave, onClose, onSkip }) {
  const [step, setStep] = useState('name');
  const [value, setValue] = useState(currentName ?? '');
  const [available, setAvailable] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = value.trim();
    clearTimeout(timerRef.current);
    if (!trimmed) { setAvailable(null); return; }
    if (trimmed.toLowerCase() === (currentName ?? '').trim().toLowerCase()) {
      setAvailable('available'); return;
    }
    setAvailable('checking');
    const requestId = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ name: trimmed, current: currentName ?? '' });
        const res = await apiFetch(`/api/username-available?${params}`);
        const data = await res.json();
        if (requestId !== requestIdRef.current) return;
        if (!data.available && data.reason === 'invalid') setAvailable('invalid');
        else setAvailable(data.available ? 'available' : 'taken');
      } catch {
        if (requestId === requestIdRef.current) setAvailable(null);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [value, currentName]);

  const canSave = value.trim() && available === 'available';
  const canSend = email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || available !== 'available') return;
    onSave(trimmed);
  };

  const nextToEmail = () => {
    const trimmed = value.trim();
    if (!trimmed || available !== 'available') return;
    setStep('email');
    setError('');
  };

  // link-email no longer links immediately — it emails a code and returns
  // { pendingVerification: true }. It also authenticates as the draft name,
  // so a fresh name claims its session token (via POST /api/auth/token)
  // before the code is requested.
  const sendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      const name = value.trim();
      if (!getToken(name)) {
        const tokenRes = await apiFetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: name }),
        }, name);
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error || 'Could not start a session for that name.');
        setToken(name, tokenData.token);
      }
      const res = await apiFetch('/api/auth/link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: name, email: trimmed }),
      }, name);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send the code.');
      setStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Only verify-otp actually links the email to the account — and only once
  // the code proves the caller controls that inbox.
  const verifyCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      const name = value.trim();
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: trimmed, user: name }),
      }, name);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That code is invalid or expired.');
      if (data.token) setToken(name, data.token);
      onSave(name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-body name-modal" onClick={(e) => e.stopPropagation()}>
        <div className="name-modal-inner">
          {step === 'name' && (
            <>
              <h3>Set your name</h3>
              <p className="muted">This name keeps your progress saved — you will lose it without one.</p>
              <input
                className="name-input"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Your username"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && canSave && nextToEmail()}
              />
              <p className={`name-availability ${available ?? ''}`}>
                {available === 'checking' && 'Checking availability…'}
                {available === 'available' && '✓ Available'}
                {available === 'taken' && '✗ Already taken — try another'}
                {available === 'invalid' && 'Use 1–24 letters, numbers, spaces, - or _'}
                {!available && '\u00A0'}
              </p>
              <div className="name-modal-actions">
                {onSkip && !currentName && (
                  <button className="skip-name-btn" onClick={onSkip}>
                    Use without a username
                  </button>
                )}
                <button onClick={onClose}>Cancel</button>
                <button className="primary" disabled={!canSave} onClick={nextToEmail}>
                  Next
                </button>
              </div>
            </>
          )}

          {step === 'email' && (
            <>
              <h3>Link your email</h3>
              <p className="muted">
                Link an email to <strong>{value.trim()}</strong> so you can log back in from any device with a code.
              </p>
              <input
                className="name-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && canSend && sendCode()}
              />
              {error && <p className="name-availability taken">{error}</p>}
              {!error && <p className="name-availability" style={{ visibility: 'hidden' }}>\u00A0</p>}
              <div className="name-modal-actions">
                <button onClick={() => { setStep('name'); setError(''); }}>Back</button>
                <button onClick={save} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: '8px 12px' }}>
                  Skip for now
                </button>
                <button className="primary" disabled={busy || !canSend} onClick={sendCode}>
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              </div>
            </>
          )}

          {step === 'verify' && (
            <>
              <h3>Check your inbox</h3>
              <p className="muted">
                We sent a 6-digit code to <strong>{email.trim()}</strong>. Enter it below to verify your email.
              </p>
              <input
                className="name-input"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
              />
              {error && <p className="name-availability taken">{error}</p>}
              {!error && <p className="name-availability" style={{ visibility: 'hidden' }}>\u00A0</p>}
              <div className="name-modal-actions">
                <button onClick={() => { setStep('email'); setError(''); }}>Back</button>
                <button className="primary" disabled={busy || !code.trim()} onClick={verifyCode}>
                  {busy ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
