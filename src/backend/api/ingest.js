// ingest.js — Document ingestion: file upload + text paste
const express = require('express');
const multer = require('multer');
const { createSession, updateSession } = require('../sessions/store');
const { saveDocument } = require('../storage/documents');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/plain', 'text/markdown', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

function detectLanguage(text) {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const total = text.length || 1;
  if (hebrewChars / total > 0.05) return 'he';
  if (arabicChars / total > 0.05) return 'ar';
  return 'en';
}

// POST /api/ingest/text — paste raw text
router.post('/text', async (req, res) => {
  const { text, title } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const trimmed  = text.trim();
  const language = detectLanguage(trimmed);
  const sessionId = createSession({
    title: title || `הערכה ${new Date().toLocaleDateString('he-IL')}`,
    documentText: trimmed,
    language,
    wordCount: trimmed.split(/\s+/).length,
  });
  // Persist document to GCS (or local file) — fire-and-forget; failure is non-fatal
  saveDocument(sessionId, trimmed)
    .then(path => updateSession(sessionId, { documentPath: path }))
    .catch(err  => console.error('[Ingest] saveDocument failed:', err.message));
  res.json({ sessionId, language, wordCount: trimmed.split(/\s+/).length });
});

// POST /api/ingest/file — upload a document
router.post('/file', upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let text = '';
  const { mimetype, buffer, originalname } = req.file;

  if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
    text = buffer.toString('utf-8');
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (mimetype === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    text = data.text;
  }

  const trimmed = text.trim();
  if (!trimmed) return res.status(422).json({ error: 'Could not extract text from file' });

  const language = detectLanguage(trimmed);
  const wordCount = trimmed.split(/\s+/).length;
  const sessionId = createSession({
    title: originalname.replace(/\.[^.]+$/, ''),
    documentText: trimmed,
    language,
    wordCount,
  });
  // Persist document to GCS (or local file) — fire-and-forget; failure is non-fatal
  saveDocument(sessionId, trimmed)
    .then(path => updateSession(sessionId, { documentPath: path }))
    .catch(err  => console.error('[Ingest] saveDocument failed:', err.message));
  res.json({ sessionId, language, wordCount });
});

module.exports = router;
