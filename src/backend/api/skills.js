// skills.js — Skills listing and management
// Default skills: read from disk (bundled in deploy).
// Custom skills:  Firestore `custom_skills` collection (Firebase mode) or disk (local mode).
'use strict';
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const matter  = require('gray-matter');

const router       = express.Router();
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const SKILLS_DIR   = path.join(PROJECT_ROOT, 'skills');

// ─── Firestore (lazy-init) ────────────────────────────────────────────────────

let _db = undefined; // undefined = not yet attempted; null = unavailable

function getDb() {
  if (_db !== undefined) return _db;
  if (!process.env.K_SERVICE && !process.env.USE_FIRESTORE) { _db = null; return null; }
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) return null; // not yet initialised — don't cache yet
    _db = admin.firestore();
    return _db;
  } catch (_) { _db = null; return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMeta(id, data, isCustom) {
  return {
    id,
    name:                 data.name || id,
    nameEn:               data.name_en || '',
    version:              data.version || '1.0',
    tags:                 data.tags || [],
    autoTriggerKeywords:  data.auto_trigger_keywords || [],
    isCustom,
  };
}

function loadDefaultSkillsFromDisk() {
  const dir = path.join(SKILLS_DIR, 'default');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
      return parseMeta(f.replace('.md', ''), data, false);
    });
}

function loadCustomSkillsFromDisk() {
  const dir = path.join(SKILLS_DIR, 'custom');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
      return parseMeta(f.replace('.md', ''), data, true);
    });
}

async function loadCustomSkillsFromFirestore() {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection('custom_skills').get();
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id:                   d.id,
        name:                 data.name || d.id,
        nameEn:               data.nameEn || '',
        version:              data.version || '1.0',
        tags:                 data.tags || [],
        autoTriggerKeywords:  data.autoTriggerKeywords || [],
        isCustom:             true,
      };
    });
  } catch (err) {
    console.error('[Skills] Firestore read error:', err.message);
    return null;
  }
}

// ─── Exported helper for analyze.js ──────────────────────────────────────────

/**
 * Returns the full markdown content (frontmatter + body) for a skill.
 * Default skills come from disk; custom skills from Firestore (Firebase) or disk (local).
 */
async function getSkillContent(skillId) {
  // Default skills are always on disk (part of the deployed bundle)
  const defaultPath = path.join(SKILLS_DIR, 'default', `${skillId}.md`);
  if (fs.existsSync(defaultPath)) return fs.readFileSync(defaultPath, 'utf-8');

  // Custom — try Firestore first, then disk fallback
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_skills').doc(skillId).get();
      if (doc.exists) return doc.data().content || null;
    } catch (err) {
      console.error('[Skills] Firestore getSkillContent error:', err.message);
    }
  }
  const customPath = path.join(SKILLS_DIR, 'custom', `${skillId}.md`);
  if (fs.existsSync(customPath)) return fs.readFileSync(customPath, 'utf-8');
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const defaults = loadDefaultSkillsFromDisk();
    const custom   = (await loadCustomSkillsFromFirestore()) ?? loadCustomSkillsFromDisk();
    res.json([...defaults, ...custom]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:skillId', async (req, res) => {
  const { skillId } = req.params;
  const defaultPath = path.join(SKILLS_DIR, 'default', `${skillId}.md`);
  if (fs.existsSync(defaultPath)) {
    const { data, content } = matter(fs.readFileSync(defaultPath, 'utf-8'));
    return res.json({ ...data, id: skillId, body: content, isCustom: false });
  }
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_skills').doc(skillId).get();
      if (doc.exists) {
        const { data: fm, content: body } = matter(doc.data().content || '');
        return res.json({ ...fm, id: skillId, body, isCustom: true });
      }
    } catch (err) {
      console.error('[Skills] Firestore GET error:', err.message);
    }
  }
  const customPath = path.join(SKILLS_DIR, 'custom', `${skillId}.md`);
  if (fs.existsSync(customPath)) {
    const { data, content } = matter(fs.readFileSync(customPath, 'utf-8'));
    return res.json({ ...data, id: skillId, body: content, isCustom: true });
  }
  res.status(404).json({ error: 'Skill not found' });
});

router.post('/', async (req, res) => {
  const { id, content } = req.body;
  if (!id || !content) return res.status(400).json({ error: 'id and content are required' });
  const db = getDb();
  if (db) {
    try {
      const { data } = matter(content);
      await db.collection('custom_skills').doc(id).set({
        content,
        name:                data.name || '',
        nameEn:              data.name_en || '',
        version:             data.version || '1.0',
        tags:                data.tags || [],
        autoTriggerKeywords: data.auto_trigger_keywords || [],
        createdAt:           new Date().toISOString(),
      });
    } catch (err) {
      return res.status(500).json({ error: `Failed to save skill: ${err.message}` });
    }
  } else {
    const p = path.join(SKILLS_DIR, 'custom', `${id}.md`);
    fs.writeFileSync(p, content, 'utf-8');
  }
  res.status(201).json({ id });
});

router.put('/:skillId', async (req, res) => {
  const { skillId } = req.params;
  const { content }  = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('custom_skills').doc(skillId).get();
      if (!doc.exists) return res.status(403).json({ error: 'Only custom skills can be edited' });
      const { data } = matter(content);
      await db.collection('custom_skills').doc(skillId).set({
        content,
        name:                data.name || '',
        nameEn:              data.name_en || '',
        version:             data.version || '1.0',
        tags:                data.tags || [],
        autoTriggerKeywords: data.auto_trigger_keywords || [],
        updatedAt:           new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      return res.status(500).json({ error: `Failed to update skill: ${err.message}` });
    }
  } else {
    const p = path.join(SKILLS_DIR, 'custom', `${skillId}.md`);
    if (!fs.existsSync(p)) return res.status(403).json({ error: 'Only custom skills can be edited' });
    fs.writeFileSync(p, content, 'utf-8');
  }
  res.json({ ok: true });
});

module.exports = router;
module.exports.getSkillContent = getSkillContent;
