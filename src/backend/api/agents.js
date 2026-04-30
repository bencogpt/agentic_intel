// agents.js — Agent listing and management
// Default agents: read from disk (bundled in deploy).
// Custom agents:  Firestore `custom_agents` collection (Firebase mode) or disk (local mode).
'use strict';
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const matter  = require('gray-matter');

const router       = express.Router();
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const AGENTS_DIR   = path.join(PROJECT_ROOT, 'agents');

// ─── Firestore (lazy-init) ────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMeta(id, data, isCustom) {
  return {
    id,
    name:           data.name || id,
    role:           data.role || '',
    version:        data.version || '1.0',
    skills:         data.skills || [],
    autoActivateOn: data.auto_activate_on || [],
    priority:       data.priority || 3,
    isCustom,
  };
}

function loadDefaultAgentsFromDisk() {
  const dir = path.join(AGENTS_DIR, 'default');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
      return parseMeta(f.replace('.md', ''), data, false);
    });
}

function loadCustomAgentsFromDisk() {
  const dir = path.join(AGENTS_DIR, 'custom');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
      return parseMeta(f.replace('.md', ''), data, true);
    });
}

async function loadCustomAgentsFromFirestore(includeBody = false) {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection('custom_agents').get();
    return snap.docs.map(d => {
      const data  = d.data();
      const entry = {
        id:             d.id,
        name:           data.name || d.id,
        role:           data.role || '',
        version:        data.version || '1.0',
        skills:         data.skills || [],
        autoActivateOn: data.auto_activate_on || [],
        priority:       data.priority || 3,
        isCustom:       true,
      };
      if (includeBody) {
        // Parse body from stored full markdown content
        const { content: body } = matter(data.content || '');
        entry.body = body;
      }
      return entry;
    });
  } catch (err) {
    console.error('[Agents] Firestore read error:', err.message);
    return null;
  }
}

// ─── Exported helper for analyze.js ──────────────────────────────────────────

/**
 * Returns all agents with `body` field (needed for analysis prompts).
 * Merges default agents from disk with custom agents from Firestore (or disk in local mode).
 */
async function loadAllAgentsWithBody() {
  // Default agents — always from disk
  const dir = path.join(AGENTS_DIR, 'default');
  const defaults = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { data, content } = matter(raw);
      defaults.push({ ...parseMeta(f.replace('.md', ''), data, false), body: content });
    }
  }

  // Custom agents — Firestore or disk
  let custom = await loadCustomAgentsFromFirestore(true);
  if (!custom) {
    // Local fallback
    const customDir = path.join(AGENTS_DIR, 'custom');
    custom = [];
    if (fs.existsSync(customDir)) {
      for (const f of fs.readdirSync(customDir).filter(f => f.endsWith('.md'))) {
        const raw = fs.readFileSync(path.join(customDir, f), 'utf-8');
        const { data, content } = matter(raw);
        custom.push({ ...parseMeta(f.replace('.md', ''), data, true), body: content });
      }
    }
  }

  return [...defaults, ...custom].sort((a, b) => a.priority - b.priority);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const defaults = loadDefaultAgentsFromDisk();
    const custom   = (await loadCustomAgentsFromFirestore()) ?? loadCustomAgentsFromDisk();
    const all = [...defaults, ...custom].sort((a, b) => a.priority - b.priority);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:agentId', async (req, res) => {
  const { agentId } = req.params;
  // Check default on disk first
  const defaultPath = path.join(AGENTS_DIR, 'default', `${agentId}.md`);
  if (fs.existsSync(defaultPath)) {
    const { data, content } = matter(fs.readFileSync(defaultPath, 'utf-8'));
    return res.json({ ...data, id: agentId, body: content, isCustom: false });
  }
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_agents').doc(agentId).get();
      if (doc.exists) {
        const data = doc.data();
        const { data: fm, content: body } = matter(data.content || '');
        return res.json({ ...fm, id: agentId, body, isCustom: true });
      }
    } catch (err) {
      console.error('[Agents] Firestore GET error:', err.message);
    }
  }
  const customPath = path.join(AGENTS_DIR, 'custom', `${agentId}.md`);
  if (fs.existsSync(customPath)) {
    const { data, content } = matter(fs.readFileSync(customPath, 'utf-8'));
    return res.json({ ...data, id: agentId, body: content, isCustom: true });
  }
  res.status(404).json({ error: 'Agent not found' });
});

router.post('/', async (req, res) => {
  const { id, content } = req.body;
  if (!id || !content) return res.status(400).json({ error: 'id and content are required' });
  const db = getDb();
  if (db) {
    try {
      const { data } = matter(content);
      await db.collection('custom_agents').doc(id).set({
        content,
        name:             data.name || '',
        role:             data.role || '',
        version:          data.version || '1.0',
        skills:           data.skills || [],
        auto_activate_on: data.auto_activate_on || [],
        priority:         data.priority || 3,
        createdAt:        new Date().toISOString(),
      });
    } catch (err) {
      return res.status(500).json({ error: `Failed to save agent: ${err.message}` });
    }
  } else {
    const p = path.join(AGENTS_DIR, 'custom', `${id}.md`);
    fs.writeFileSync(p, content, 'utf-8');
  }
  res.status(201).json({ id });
});

router.put('/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { content }  = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_agents').doc(agentId).get();
      if (!doc.exists) return res.status(403).json({ error: 'Only custom agents can be edited' });
      const { data } = matter(content);
      await db.collection('custom_agents').doc(agentId).set({
        content,
        name:             data.name || '',
        role:             data.role || '',
        version:          data.version || '1.0',
        skills:           data.skills || [],
        auto_activate_on: data.auto_activate_on || [],
        priority:         data.priority || 3,
        updatedAt:        new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      return res.status(500).json({ error: `Failed to update agent: ${err.message}` });
    }
  } else {
    const p = path.join(AGENTS_DIR, 'custom', `${agentId}.md`);
    if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom agents can be edited' });
    fs.writeFileSync(p, content, 'utf-8');
  }
  res.json({ ok: true });
});

module.exports = router;
module.exports.loadAllAgentsWithBody = loadAllAgentsWithBody;
