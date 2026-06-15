// app.js — Express app factory (no listen). Used by both server.js (local) and index.js (Firebase).
'use strict';

const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();

  // Trigger admin seeding on startup
  require('./users/store');

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://avar-3dd66.web.app',
        'https://avar-3dd66.firebaseapp.com',
        'https://avaraiapp.web.app',
        'https://avaraiapp.firebaseapp.com',
      ];

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '20mb' }));

  // Public routes — must be registered BEFORE the auth middleware
  app.use('/api/auth', require('./api/auth'));

  // All routes below require a valid JWT
  app.use('/api', require('./middleware/auth'));

  app.use('/api/ingest',    require('./api/ingest'));
  app.use('/api/analyze',   require('./api/analyze'));
  app.use('/api/agents',    require('./api/agents'));
  app.use('/api/skills',    require('./api/skills'));
  app.use('/api/search',    require('./api/search'));
  app.use('/api/report',    require('./api/report'));
  app.use('/api/sessions',  require('./api/sessions'));
  app.use('/api/chat',      require('./api/chat'));
  app.use('/api/workflows', require('./api/workflows'));
  app.use('/api/sources',  require('./api/sources'));
  app.use('/api/users',     require('./api/users'));

  // Model registry — returns available LLM models for the frontend selector
  app.get('/api/models', (_req, res) => {
    const { MODELS, DEFAULT_MODEL } = require('./llm/chat');
    res.json({
      default: DEFAULT_MODEL,
      models: Object.entries(MODELS).map(([id, m]) => ({
        id,
        label:       m.label,
        labelEn:     m.labelEn,
        description: m.description,
        provider:    m.provider,
      })),
    });
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
