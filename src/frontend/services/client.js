// api/client.js — Typed fetch wrapper for AVAR backend
import { getToken, clearToken } from './auth.js';

const BASE = '/api';

// Firebase Hosting rewrites do not support multipart/form-data — file uploads
// must call the Cloud Run service URL directly, bypassing the Hosting proxy.
const DIRECT_BASE = import.meta.env.VITE_CLOUD_RUN_URL
  ? `${import.meta.env.VITE_CLOUD_RUN_URL}/api`
  : '/api';

async function _fetch(base, method, path, body, isFormData = false) {
  const opts = { method, headers: {} };

  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;

  if (body) {
    if (isFormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(`${base}${path}`, opts);
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const request = (method, path, body, isFormData) => _fetch(BASE, method, path, body, isFormData);
const directRequest = (method, path, body, isFormData) => _fetch(DIRECT_BASE, method, path, body, isFormData);

export const api = {
  ingest: {
    text: (text, title) => request('POST', '/ingest/text', { text, title }),
    file: (file) => {
      const fd = new FormData();
      fd.append('document', file);
      return directRequest('POST', '/ingest/file', fd, true);
    },
  },
  analyze: {
    start: (sessionId, agentIds, synthesisFocus, model) => request('POST', '/analyze', { sessionId, agentIds, synthesisFocus, model }),
    status: (sessionId, since = 0) => request('GET', `/analyze/${sessionId}/status?since=${since}`),
  },
  models: {
    list: () => request('GET', '/models'),
  },
  workflows: {
    list: () => request('GET', '/workflows'),
    create: (w) => request('POST', '/workflows', w),
    update: (id, w) => request('PUT', `/workflows/${id}`, w),
    remove: (id) => request('DELETE', `/workflows/${id}`),
  },
  report: {
    get: (sessionId) => request('GET', `/report/${sessionId}`),
    exportMd: async (sessionId) => {
      const res = await fetch(`${BASE}/report/${sessionId}/export?format=md`);
      return res.blob();
    },
  },
  skills: {
    list: () => request('GET', '/skills'),
    get: (id) => request('GET', `/skills/${id}`),
    create: (id, content) => request('POST', '/skills', { id, content }),
    update: (id, content) => request('PUT', `/skills/${id}`, { content }),
    remove: (id) => request('DELETE', `/skills/${id}`),
  },
  sources: {
    list:   ()         => request('GET', '/sources'),
    create: (id, data) => request('POST', '/sources', { id, ...data }),
    update: (id, data) => request('PUT', `/sources/${id}`, data),
    remove: (id)       => request('DELETE', `/sources/${id}`),
  },
  sessions: {
    list: () => request('GET', '/sessions'),
  },
  agents: {
    list: () => request('GET', '/agents'),
    get: (id) => request('GET', `/agents/${id}`),
    create: (id, content) => request('POST', '/agents', { id, content }),
    update: (id, content) => request('PUT', `/agents/${id}`, { content }),
  },
  users: {
    list: ()                         => request('GET', '/users'),
    create: (username, password)     => request('POST', '/users', { username, password, role: 'analyst' }),
    remove: (username)               => request('DELETE', `/users/${username}`),
    updatePassword: (username, pwd)  => request('PUT', `/users/${username}/password`, { password: pwd }),
  },
};
