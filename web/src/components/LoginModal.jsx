import { useState } from 'react';
import { apiFetch, setToken } from '../lib/auth.js';

// Two-step flow: request a code by email, then verify it. On success calls
// onLoggedIn(username) so the caller can set that as the active user.
export default function LoginModal({ onClose, onLoggedIn }) {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestCode = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send the code.');
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That code is invalid or expired.');
      // verify-otp returns a fresh session token for the logged-in username.
      if (data.token) setToken(data.username, data.token);
      onLoggedIn(data.username);
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
          <h3>Log in with email</h3>
          {step === 'email' ? (
            <>
              <p className="muted">
                Enter the email you linked to your account — we'll send a 6-digit code to it.
              </p>
              <input
                className="name-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && requestCode()}
              />
              {error && <p className="name-availability taken">{error}</p>}
              <div className="name-modal-actions">
                <button onClick={onClose}>Cancel</button>
                <button className="primary" disabled={busy || !email.trim()} onClick={requestCode}>
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                Enter the 6-digit code sent to <strong>{email.trim()}</strong>.
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
