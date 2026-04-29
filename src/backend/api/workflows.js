// workflows.js — Workflow CRUD (named analysis configurations)
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const WORKFLOWS_DIR = path.resolve(__dirname, '../../../workflows');

function loadAll() {
  const all = [];
  for (const sub of ['default', 'custom']) {
    const dir = path.join(WORKFLOWS_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
        all.push({ ...data, isDefault: sub === 'default' });
      } catch (_) {}
    }
  }
  return all;
}

router.get('/', (_req, res) => res.json(loadAll()));

router.post('/', (req, res) => {
  const { id, name, description, agents, autoActivateKeywords, synthesisFocus } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
  const workflow = { id, name, description, agents: agents || [], autoActivateKeywords: autoActivateKeywords || [], synthesisFocus: synthesisFocus || '', isDefault: false };
  const p = path.join(WORKFLOWS_DIR, 'custom', `${id}.json`);
  fs.writeFileSync(p, JSON.stringify(workflow, null, 2));
  res.status(201).json(workflow);
});

router.put('/:id', (req, res) => {
  const p = path.join(WORKFLOWS_DIR, 'custom', `${req.params.id}.json`);
  if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom workflows can be edited' });
  const existing = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const updated = { ...existing, ...req.body, id: req.params.id, isDefault: false };
  fs.writeFileSync(p, JSON.stringify(updated, null, 2));
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const p = path.join(WORKFLOWS_DIR, 'custom', `${req.params.id}.json`);
  if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom workflows can be deleted' });
  fs.unlinkSync(p);
  res.json({ ok: true });
});

module.exports = router;
