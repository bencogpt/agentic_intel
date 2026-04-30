// report.js — Report retrieval and export
const express = require('express');
const { getSession, getOrFetchSession } = require('../sessions/store');
const { loadDocument } = require('../storage/documents');

const router = express.Router();

router.get('/:sessionId', async (req, res) => {
  const session = getSession(req.params.sessionId) || await getOrFetchSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'complete') return res.status(202).json({ status: session.status });
  // Load document text from storage if not in memory (cold-start on a different instance)
  const documentText = session.documentText || await loadDocument(session.id);

  res.json({
    sessionId: session.id,
    title: session.title,
    generatedAt: session.completedAt,
    documentText: documentText || null,
    telemetry: session.telemetry || null,
    suggestions: session.suggestions || null,
    searchAudit: session.searchAudit || [],
    report: session.report,
    analysis: session.analysis,
    agentOutputs: session.agentOutputs,
  });
});

router.get('/:sessionId/export', async (req, res) => {
  const { format = 'md' } = req.query;
  if (!['md', 'pdf', 'docx'].includes(format)) {
    return res.status(400).json({ error: 'format must be md, pdf, or docx' });
  }
  const session = getSession(req.params.sessionId) || await getOrFetchSession(req.params.sessionId);
  if (!session?.report) return res.status(404).json({ error: 'Report not found' });

  if (format === 'md') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.sessionId}.md"`);
    return res.send(session.report.content);
  }
  res.status(501).json({ message: 'PDF/DOCX export coming soon' });
});

module.exports = router;
