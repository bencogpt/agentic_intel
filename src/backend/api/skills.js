// skills.js — Skills listing and management
const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const router = express.Router();
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'skills');

let skillsCache = null;

function loadAllSkills() {
  if (skillsCache) return skillsCache;
  const skills = [];
  for (const sub of ['default', 'custom']) {
    const dir = path.join(SKILLS_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const { data } = matter(raw);
      skills.push({
        id: file.replace('.md', ''),
        name: data.name,
        nameEn: data.name_en,
        version: data.version,
        tags: data.tags || [],
        autoTriggerKeywords: data.auto_trigger_keywords || [],
        isCustom: sub === 'custom',
      });
    }
  }
  skillsCache = skills;
  return skillsCache;
}

router.get('/', (_req, res) => res.json(loadAllSkills()));

router.get('/:skillId', (req, res) => {
  for (const sub of ['default', 'custom']) {
    const p = path.join(SKILLS_DIR, sub, `${req.params.skillId}.md`);
    if (fs.existsSync(p)) {
      const { data, content } = matter(fs.readFileSync(p, 'utf-8'));
      return res.json({ ...data, id: req.params.skillId, body: content, isCustom: sub === 'custom' });
    }
  }
  res.status(404).json({ error: 'Skill not found' });
});

router.post('/', (req, res) => {
  const { id, content } = req.body;
  if (!id || !content) return res.status(400).json({ error: 'id and content are required' });
  const p = path.join(SKILLS_DIR, 'custom', `${id}.md`);
  fs.writeFileSync(p, content, 'utf-8');
  skillsCache = null; // invalidate cache
  res.status(201).json({ id });
});

router.put('/:skillId', (req, res) => {
  const p = path.join(SKILLS_DIR, 'custom', `${req.params.skillId}.md`);
  if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom skills can be edited' });
  fs.writeFileSync(p, req.body.content, 'utf-8');
  skillsCache = null; // invalidate cache
  res.json({ ok: true });
});

module.exports = router;
