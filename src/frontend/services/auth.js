// services/auth.js — Token management and auth API calls
const TOKEN_KEY = 'avar_token';

// Must match the BASE logic in client.js — auth calls bypass the request()
// helper to avoid circular imports, so they compute the base URL independently.
const API_BASE = import.meta.env.VITE_CLOUD_RUN_URL
  ? `${import.meta.env.VITE_CLOUD_RUN_URL}/api`
  : '/api';

export const getToken   = () => localStorage.getItem(TOKEN_KEY);
export const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');
  setToken(data.token);
  return { username: data.username, role: data.role };
}

export function logout() {
  clearToken();
}

export async function getMe() {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { clearToken(); return null; }
  return res.json();
}
