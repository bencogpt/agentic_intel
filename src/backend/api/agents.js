// agents.js — Agent listing and management
const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const router = express.Router();
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const AGENTS_DIR = path.join(PROJECT_ROOT, 'agents');

let agentsCache = null;

function loadAllAgents() {
  if (agentsCache) return agentsCache;
  const agents = [];
  for (const sub of ['default', 'custom']) {
    const dir = path.join(AGENTS_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const { data } = matter(raw);
      agents.push({
        id: file.replace('.md', ''),
        name: data.name,
        role: data.role,
        version: data.version,
        skills: data.skills || [],
        autoActivateOn: data.auto_activate_on || [],
        priority: data.priority || 3,
        isCustom: sub === 'custom',
      });
    }
  }
  agentsCache = agents.sort((a, b) => a.priority - b.priority);
  return agentsCache;
}

router.get('/', (_req, res) => {
  res.json(loadAllAgents());
});

router.get('/:agentId', (req, res) => {
  for (const sub of ['default', 'custom']) {
    const p = path.join(AGENTS_DIR, sub, `${req.params.agentId}.md`);
    if (fs.existsSync(p)) {
      const { data, content } = matter(fs.readFileSync(p, 'utf-8'));
      return res.json({ ...data, id: req.params.agentId, body: content, isCustom: sub === 'custom' });
    }
  }
  res.status(404).json({ error: 'Agent not found' });
});

router.put('/:agentId', (req, res) => {
  const p = path.join(AGENTS_DIR, 'custom', `${req.params.agentId}.md`);
  if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom agents can be edited' });
  fs.writeFileSync(p, req.body.content, 'utf-8');
  agentsCache = null; // invalidate cache
  res.json({ ok: true });
});

router.post('/', (req, res) => {
  const { id, content } = req.body;
  if (!id || !content) return res.status(400).json({ error: 'id and content are required' });
  const p = path.join(AGENTS_DIR, 'custom', `${id}.md`);
  fs.writeFileSync(p, content, 'utf-8');
  agentsCache = null; // invalidate cache
  res.status(201).json({ id });
});

module.exports = router;
