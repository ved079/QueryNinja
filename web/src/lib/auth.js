// Client-side session token handling (server: server/app.js requireUser).
// The token is minted by the server on first name set / OTP login, stored
// here keyed by the username it belongs to, and echoed back on every request
// via the X-User-Token header.
//
// SECURITY NOTE (M-3): tokens live in localStorage, which is readable by any
// JavaScript running on this origin. This is safe as long as there are no XSS
// sinks (confirmed: no dangerouslySetInnerHTML / innerHTML in the codebase).
// A future migration to HttpOnly session cookies would remove this risk class
// entirely — localStorage tokens are immune to network sniffing but not to
// XSS, while HttpOnly cookies are immune to both.
const TOKEN_PREFIX = 'sql-practice-token:';

export const tokenKeyFor = (name) => `${TOKEN_PREFIX}${(name || 'anonymous').trim()}`;

export const getToken = (name) => localStorage.getItem(tokenKeyFor(name)) || '';

export const setToken = (name, token) => {
  if (token) localStorage.setItem(tokenKeyFor(name), token);
  else localStorage.removeItem(tokenKeyFor(name));
};

export const clearToken = (name) => localStorage.removeItem(tokenKeyFor(name));

/** fetch wrapper that attaches the session token for `user` to the request. */
export const apiFetch = (url, options = {}, user) => {
  const headers = new Headers(options.headers || {});
  const token = getToken(user);
  if (token) headers.set('X-User-Token', token);
  return fetch(url, { ...options, headers });
};
