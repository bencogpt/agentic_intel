// store.js — Session store + SSE registry
// Local mode  (no FIREBASE_PROJECT_ID): in-memory Map + JSON file on disk.
// Firebase mode (FIREBASE_PROJECT_ID set): in-memory cache + Firestore persistence.
//   SSE events are delivered via Firestore onSnapshot so they work across instances.
'use strict';

const { v4: uuidv4 } = require('uuid');
const fs   = require('fs');
const path = require('path');

const SESSIONS_FILE = path.resolve(__dirname, '../../../reports/sessions.json');
const sessions      = new Map();   // in-memory cache (always used)
const sseClients    = new Map();   // local mode: sessionId → Express res
const sseUnsubscribers = new Map(); // Firebase mode: sessionId → Firestore unsubscribe fn

// Fields stored in GCS / local file — never written to Firestore
const STORAGE_FIELDS = new Set(['documentText']);
// Fields stored in sessions_content/{id} — heavy content that could exceed 1MB with metadata
const CONTENT_FIELDS = new Set(['report', 'analysis', 'agentOutputs']);

// ─── Firestore (Firebase mode) ────────────────────────────────────────────────

let db = null;
let fsAdmin = null;

function initFirestore() {
  // K_SERVICE is auto-set by Cloud Functions runtime; USE_FIRESTORE enables it locally
  if (!process.env.K_SERVICE && !process.env.USE_FIRESTORE) return;
  try {
    fsAdmin = require('firebase-admin');
    if (!fsAdmin.apps.length) fsAdmin.initializeApp();
    db = fsAdmin.firestore();
    console.log('[Store] Firestore mode enabled — loading session metadata...');
    // Load only lightweight metadata fields at startup; full data fetched on demand
    db.collection('sessions')
      .select('id', 'title', 'status', 'language', 'wordCount', 'createdAt', 'completedAt', 'error', 'telemetry', 'activeAgents', 'events')
      .get()
      .then(snap => {
        // Mark as _stub so getOrFetchSession knows to fetch sessions_content on demand
        snap.docs.forEach(d => { if (!sessions.has(d.id)) sessions.set(d.id, { ...d.data(), _stub: true }); });
        console.log(`[Store] Loaded ${snap.docs.length} session stubs from Firestore`);
      })
      .catch(err => console.error('[Store] Firestore load error:', err.message));
  } catch (err) {
    console.error('[Store] Firestore init failed — falling back to local mode:', err.message);
    db = null;
  }
}

initFirestore();

// ─── Persistence (local mode only) ───────────────────────────────────────────

function loadSessions() {
  if (db) return; // Firestore handles persistence
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      Object.entries(data).forEach(([k, v]) => sessions.set(k, v));
      console.log(`[Store] Loaded ${sessions.size} sessions from disk`);
    }
  } catch (err) {
    console.error('[Store] Failed to load sessions from disk:', err.message);
  }
}

function saveSessions() {
  if (db) return; // Firestore handles persistence; skip file write
  try {
    const data = {};
    sessions.forEach((v, k) => {
      data[k] = {
        id: v.id, title: v.title, createdAt: v.createdAt, completedAt: v.completedAt,
        status: v.status, language: v.language, wordCount: v.wordCount,
        documentText: v.documentText || null,
        telemetry: v.telemetry || null,
        suggestions: v.suggestions || null,
        searchAudit: v.searchAudit || [],
        report: v.report, analysis: v.analysis, error: v.error,
        events: (v.events || []).slice(-100),
      };
    });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Store] Failed to save sessions to disk:', err.message);
  }
}

loadSessions();

// ─── Session CRUD ─────────────────────────────────────────────────────────────

function createSession(data) {
  const id = uuidv4();
  const session = {
    id,
    createdAt: new Date().toISOString(),
    status: 'pending',
    activeAgents: [],
    events: [],
    ...data,
  };
  sessions.set(id, session);
  if (db) {
    // Write metadata only: strip documentText (→ GCS) and content fields (→ sessions_content)
    const firestoreMeta = Object.fromEntries(
      Object.entries(session).filter(([k]) => !CONTENT_FIELDS.has(k) && !STORAGE_FIELDS.has(k))
    );
    db.collection('sessions').doc(id).set(firestoreMeta)
      .catch(err => console.error('[Store] createSession Firestore error:', err.message));
  }
  return id;
}

function getSession(id) {
  return sessions.get(id) || null;
}

// Async version for route handlers — always returns a fully-hydrated session.
// Stubs loaded at startup (metadata-only) are re-fetched from both collections.
async function getOrFetchSession(id) {
  const cached = sessions.get(id);
  // Return immediately only if fully loaded by this instance (no _stub flag)
  if (cached && !cached._stub) return cached;
  if (!db) return cached || null;
  try {
    const [metaDoc, contentDoc] = await Promise.all([
      db.collection('sessions').doc(id).get(),
      db.collection('sessions_content').doc(id).get(),
    ]);
    if (!metaDoc.exists) return null;
    const data = { ...metaDoc.data() }; // no _stub flag — fully loaded
    if (contentDoc.exists) Object.assign(data, contentDoc.data());
    sessions.set(id, data);
    return data;
  } catch (err) {
    console.error('[Store] getOrFetchSession error:', err.message);
    return cached || null;
  }
}

function updateSession(id, patch) {
  const session = sessions.get(id);
  if (!session) throw new Error(`Session not found: ${id}`);
  const updated = { ...session, ...patch };
  sessions.set(id, updated);
  if (db) {
    // Route fields to correct collection; skip GCS-managed fields entirely
    const metaPatch   = {};
    const contentPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      if (STORAGE_FIELDS.has(k)) continue;            // documentText → GCS only
      if (CONTENT_FIELDS.has(k)) contentPatch[k] = v; // heavy content → sessions_content
      else metaPatch[k] = v;                           // everything else → sessions (metadata)
    }
    if (Object.keys(metaPatch).length > 0) {
      db.collection('sessions').doc(id).set(metaPatch, { merge: true })
        .catch(err => console.error('[Store] updateSession metadata error:', err.message));
    }
    if (Object.keys(contentPatch).length > 0) {
      db.collection('sessions_content').doc(id).set(contentPatch, { merge: true })
        .catch(err => console.error('[Store] updateSession content error:', err.message));
    }
  } else if (patch.status === 'complete' || patch.status === 'error') {
    saveSessions();
  }
}

function getAllSessions() {
  return Array.from(sessions.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Always reads fresh metadata from Firestore — used by the polling status endpoint
// so events written by a different Cloud Run instance are always visible.
// Only reads the lightweight `sessions` doc (not `sessions_content`).
async function getSessionFreshMeta(id) {
  if (!db) return sessions.get(id) || null;
  try {
    const doc = await db.collection('sessions').doc(id).get();
    if (!doc.exists) return null;
    // Merge fresh metadata on top of any content fields already cached in memory
    const cached = sessions.get(id) || {};
    const merged = { ...cached, ...doc.data() };
    // Preserve _stub so getOrFetchSession still fetches sessions_content when needed.
    // If this instance hasn't loaded content fields yet, mark as stub to force a full
    // fetch next time — prevents returning metadata-only data as if fully loaded.
    if (!cached.report && !cached.analysis && !cached.agentOutputs) merged._stub = true;
    sessions.set(id, merged);
    return merged;
  } catch (err) {
    console.error('[Store] getSessionFreshMeta error:', err.message);
    return sessions.get(id) || null;
  }
}

// Synchronous telemetry update — safe in Node.js single-threaded event loop
function trackTelemetry(sessionId, { llmCall = false, inputTokens = 0, outputTokens = 0, searchCall = false } = {}) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const t = session.telemetry || { llmCalls: 0, inputTokens: 0, outputTokens: 0, searchCalls: 0 };
  const telemetry = {
    llmCalls:     t.llmCalls     + (llmCall    ? 1 : 0),
    inputTokens:  t.inputTokens  + inputTokens,
    outputTokens: t.outputTokens + outputTokens,
    searchCalls:  t.searchCalls  + (searchCall ? 1 : 0),
  };
  sessions.set(sessionId, { ...session, telemetry });
  if (db) {
    // Use atomic field-level increments to avoid race conditions between concurrent
    // LLM-call and search-call writes that both overwrite the full telemetry object.
    const inc = fsAdmin.firestore.FieldValue.increment;
    const patch = {};
    if (llmCall)      patch['telemetry.llmCalls']     = inc(1);
    if (inputTokens)  patch['telemetry.inputTokens']  = inc(inputTokens);
    if (outputTokens) patch['telemetry.outputTokens'] = inc(outputTokens);
    if (searchCall)   patch['telemetry.searchCalls']  = inc(1);
    if (Object.keys(patch).length > 0) {
      db.collection('sessions').doc(sessionId).update(patch).catch(() => {});
    }
  }
}

function updateAgentStatus(sessionId, agentId, status) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const activeAgents = (session.activeAgents || []).map(a =>
    a.id === agentId ? { ...a, status } : a
  );
  sessions.set(sessionId, { ...session, activeAgents });
}

// ─── Audit ────────────────────────────────────────────────────────────────────

function appendAuditEntry(sessionId, entry) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const fullEntry = { ...entry, ts: Date.now() };
  const searchAudit = [...(session.searchAudit || []), fullEntry];
  sessions.set(sessionId, { ...session, searchAudit });
  if (db) {
    // Trim results to keep Firestore document small
    const compactEntry = { ...fullEntry, results: (fullEntry.results || []).slice(0, 5) };
    db.collection('sessions').doc(sessionId).update({
      searchAudit: fsAdmin.firestore.FieldValue.arrayUnion(compactEntry),
    }).catch(() => {});
  }
}

// ─── SSE / Live Events ────────────────────────────────────────────────────────

function appendEvent(sessionId, event) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const fullEvent = { ...event, ts: Date.now() };
  const events = [...(session.events || []), fullEvent];
  sessions.set(sessionId, { ...session, events });

  if (!db) {
    // Local mode: push directly to connected SSE client
    const res = sseClients.get(sessionId);
    if (res) {
      try { res.write(`data: ${JSON.stringify(fullEvent)}\n\n`); } catch (_) {}
    }
  } else {
    // Firebase mode: write to Firestore; SSE stream reads via onSnapshot
    db.collection('sessions').doc(sessionId).update({
      events: fsAdmin.firestore.FieldValue.arrayUnion(fullEvent),
    }).catch(err => {
      // arrayUnion may fail on first event (doc not yet fully written); fall back to set
      const current = sessions.get(sessionId);
      if (current) {
        db.collection('sessions').doc(sessionId)
          .set({ events: current.events || [] }, { merge: true })
          .catch(() => {});
      }
    });
  }
}

function registerSSEClient(sessionId, res) {
  if (!db) {
    sseClients.set(sessionId, res);
    return;
  }

  // Firebase mode: subscribe to Firestore onSnapshot for real-time event delivery
  const session = sessions.get(sessionId) || {};
  let knownCount = (session.events || []).length;

  const unsubscribe = db.collection('sessions').doc(sessionId)
    .onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      const events = data.events || [];

      // Push only new events (those beyond what the client already received)
      const newEvents = events.slice(knownCount);
      knownCount = events.length;
      newEvents.forEach(ev => {
        try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch (_) {}
      });

      // Close SSE when analysis completes or errors
      if (data.status === 'complete' || data.status === 'error') {
        try {
          res.write(`data: ${JSON.stringify({ type: data.status, ts: Date.now() })}\n\n`);
          res.end();
        } catch (_) {}
      }
    }, err => console.error('[Store] onSnapshot error:', err.message));

  sseUnsubscribers.set(sessionId, unsubscribe);
}

function unregisterSSEClient(sessionId) {
  if (!db) {
    sseClients.delete(sessionId);
  } else {
    const unsub = sseUnsubscribers.get(sessionId);
    if (unsub) { unsub(); sseUnsubscribers.delete(sessionId); }
  }
}

module.exports = {
  createSession, getSession, getOrFetchSession, getSessionFreshMeta, updateSession, getAllSessions,
  updateAgentStatus, appendEvent, appendAuditEntry, trackTelemetry,
  registerSSEClient, unregisterSSEClient,
};
