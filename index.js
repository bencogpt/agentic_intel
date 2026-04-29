// index.js — Firebase Cloud Functions v2 entry point
// This file is the deployed entry; local dev uses src/backend/server.js instead.
require('dotenv').config();

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
  concurrency: 80,
  timeoutSeconds: 3600, // allow up to 1-hour analysis + SSE connections
  memory: '1GiB',
});

const createApp = require('./src/backend/app');
const app = createApp();

exports.api = onRequest(app);
