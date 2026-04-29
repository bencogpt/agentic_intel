// search.js — Search tool abstraction (pluggable backends)
// שכבת הפשטה לחיפוש OSINT — תומכת בבאקאנדים מרובים

const express = require('express');
const router = express.Router();

/**
 * POST /api/search
 * Search for evidence related to a claim
 * Body: { query: string, lang?: 'he' | 'en' | 'ar', backend?: string }
 *
 * Supported backends (configured via SEARCH_BACKEND env var):
 * - web: generic web search
 * (extensible — see /src/backend/search-backends/README.md)
 */
router.post('/', async (req, res) => {
  const { query, lang = 'he', backend } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required' });
  }
  // TODO: route to correct backend based on env/request
  // TODO: return: [{ title, url, snippet, date, sourceTier }]
  res.status(501).json({ message: 'Not implemented' });
});

module.exports = router;
