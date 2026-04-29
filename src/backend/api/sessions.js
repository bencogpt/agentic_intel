// sessions.js — List all assessment sessions (history)
const express = require('express');
const { getAllSessions } = require('../sessions/store');

const router = express.Router();

// GET /api/sessions — return all sessions, newest first
router.get('/', (req, res) => {
  const sessions = getAllSessions().map(s => ({
    id: s.id,
    title: s.title,
    status: s.status,
    language: s.language,
    wordCount: s.wordCount,
    createdAt: s.createdAt,
    completedAt: s.completedAt || null,
    error: s.error || null,
    agentsActivated: s.report?.agentsActivated || [],
    telemetry: s.telemetry || null,
  }));
  res.json(sessions);
});

module.exports = router;
