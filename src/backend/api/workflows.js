// workflows.js — Workflow CRUD (named analysis configurations)
// Default workflows: read from disk (bundled in deploy).
// Custom workflows:  Firestore `custom_workflows` collection (Firebase mode) or disk (local mode).
'use strict';
const express = require('express');
const fs      = require('fs');
const path    = require('path');

const router        = express.Router();
const WORKFLOWS_DIR = path.resolve(__dirname, '../../../workflows');

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

function loadDefaultWorkflows() {
  const dir = path.join(WORKFLOWS_DIR, 'default');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return { ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')), isDefault: true }; }
      catch (_) { return null; }
    })
    .filter(Boolean);
}

function loadCustomWorkflowsFromDisk() {
  const dir = path.join(WORKFLOWS_DIR, 'custom');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return { ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')), isDefault: false }; }
      catch (_) { return null; }
    })
    .filter(Boolean);
}

async function loadCustomWorkflowsFromFirestore() {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection('custom_workflows').get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id, isDefault: false }));
  } catch (err) {
    console.error('[Workflows] Firestore read error:', err.message);
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const defaults = loadDefaultWorkflows();
    const custom   = (await loadCustomWorkflowsFromFirestore()) ?? loadCustomWorkflowsFromDisk();
    res.json([...defaults, ...custom]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { id, name, description, agents, autoActivateKeywords, synthesisFocus } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
  const workflow = {
    id, name,
    description:          description || '',
    agents:               agents || [],
    autoActivateKeywords: autoActivateKeywords || [],
    synthesisFocus:       synthesisFocus || '',
    isDefault:            false,
    createdAt:            new Date().toISOString(),
  };
  const db = getDb();
  if (db) {
    try {
      await db.collection('custom_workflows').doc(id).set(workflow);
    } catch (err) {
      return res.status(500).json({ error: `Failed to save workflow: ${err.message}` });
    }
  } else {
    const p = path.join(WORKFLOWS_DIR, 'custom', `${id}.json`);
    fs.writeFileSync(p, JSON.stringify(workflow, null, 2));
  }
  res.status(201).json(workflow);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_workflows').doc(id).get();
      if (!doc.exists) return res.status(403).json({ error: 'Only custom workflows can be edited' });
      const updated = { ...doc.data(), ...req.body, id, isDefault: false, updatedAt: new Date().toISOString() };
      await db.collection('custom_workflows').doc(id).set(updated);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: `Failed to update workflow: ${err.message}` });
    }
  } else {
    const p = path.join(WORKFLOWS_DIR, 'custom', `${id}.json`);
    if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom workflows can be edited' });
    const existing = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const updated  = { ...existing, ...req.body, id, isDefault: false };
    fs.writeFileSync(p, JSON.stringify(updated, null, 2));
    res.json(updated);
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_workflows').doc(id).get();
      if (!doc.exists) return res.status(403).json({ error: 'Only custom workflows can be deleted' });
      await db.collection('custom_workflows').doc(id).delete();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Failed to delete workflow: ${err.message}` });
    }
  } else {
    const p = path.join(WORKFLOWS_DIR, 'custom', `${id}.json`);
    if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom workflows can be deleted' });
    fs.unlinkSync(p);
    res.json({ ok: true });
  }
});

module.exports = router;
