// Decode a JWT payload without verifying the signature (UI display only).
// The backend is always the source of truth for authorization.
export function decodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + ((4 - b64.length % 4) % 4), '='));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

// If the URL has ?managed_token=..., adopt it as the session token and strip
// it from the address bar so it doesn't leak into history or screenshots.
export function adoptManagedTokenFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const t = params.get('managed_token');
  if (!t) return null;
  localStorage.setItem('tenant_token', t);
  localStorage.removeItem('tenant_info');
  localStorage.removeItem('tenant_user');
  params.delete('managed_token');
  const qs = params.toString();
  const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  window.history.replaceState({}, document.title, clean);
  return t;
}
