// sources.js — External API data sources management
// Stores queryable API sources with credentials in Firestore `custom_sources` collection.
'use strict';
const express = require('express');
const router  = express.Router();

// ─── Firestore (lazy-init, same pattern as skills.js) ─────────────────────────

let _db = undefined;

function getDb() {
  if (_db !== undefined) return _db;
  if (!process.env.K_SERVICE && !process.env.USE_FIRESTORE) { _db = null; return null; }
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) return null;
    _db = admin.firestore();
    return _db;
  } catch (_) { _db = null; return null; }
}

// ─── Credential masking — never expose secrets to the frontend ────────────────

function maskSource(src) {
  const { auth, ...rest } = src;
  if (!auth || auth.type === 'none') return { ...rest, auth: { type: 'none' }, hasAuth: false };
  return {
    ...rest,
    auth: { type: auth.type },
    hasAuth: true,
  };
}

// ─── In-memory fallback (local dev without Firestore) ────────────────────────

const _localSources = new Map();

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  const db = getDb();
  try {
    if (db) {
      const snap = await db.collection('custom_sources').get();
      return res.json(snap.docs.map(d => maskSource({ id: d.id, ...d.data() })));
    }
    return res.json([..._localSources.values()].map(maskSource));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:sourceId', async (req, res) => {
  const { sourceId } = req.params;
  const db = getDb();
  try {
    if (db) {
      const doc = await db.collection('custom_sources').doc(sourceId).get();
      if (!doc.exists) return res.status(404).json({ error: 'Source not found' });
      return res.json(maskSource({ id: doc.id, ...doc.data() }));
    }
    const src = _localSources.get(sourceId);
    if (!src) return res.status(404).json({ error: 'Source not found' });
    return res.json(maskSource(src));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { id, name, description, url, method, queryParam, auth, responseMap } = req.body;
  if (!id || !name || !url) return res.status(400).json({ error: 'id, name, and url are required' });

  const doc = {
    name,
    description: description || '',
    url,
    method:      method || 'GET',
    queryParam:  queryParam || 'q',
    auth:        auth || { type: 'none' },
    responseMap: responseMap || { resultsPath: 'results', title: 'title', url: 'url', snippet: 'description' },
    createdAt:   new Date().toISOString(),
  };

  const db = getDb();
  try {
    if (db) {
      await db.collection('custom_sources').doc(id).set(doc);
    } else {
      _localSources.set(id, { id, ...doc });
    }
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:sourceId', async (req, res) => {
  const { sourceId } = req.params;
  const { name, description, url, method, queryParam, auth, responseMap } = req.body;

  const update = {
    ...(name        !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(url         !== undefined && { url }),
    ...(method      !== undefined && { method }),
    ...(queryParam  !== undefined && { queryParam }),
    ...(auth        !== undefined && { auth }),
    ...(responseMap !== undefined && { responseMap }),
    updatedAt: new Date().toISOString(),
  };

  const db = getDb();
  try {
    if (db) {
      const doc = await db.collection('custom_sources').doc(sourceId).get();
      if (!doc.exists) return res.status(404).json({ error: 'Source not found' });
      await db.collection('custom_sources').doc(sourceId).set(update, { merge: true });
    } else {
      if (!_localSources.has(sourceId)) return res.status(404).json({ error: 'Source not found' });
      _localSources.set(sourceId, { ..._localSources.get(sourceId), ...update });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:sourceId', async (req, res) => {
  const { sourceId } = req.params;
  const db = getDb();
  try {
    if (db) {
      await db.collection('custom_sources').doc(sourceId).delete();
    } else {
      _localSources.delete(sourceId);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Internal helper — load a source with full credentials (server-side only) ─

async function getSourceWithCredentials(sourceId) {
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_sources').doc(sourceId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    } catch (_) { return null; }
  }
  return _localSources.get(sourceId) || null;
}

module.exports = router;
module.exports.getSourceWithCredentials = getSourceWithCredentials;
