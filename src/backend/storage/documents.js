// storage/documents.js — Document text storage: GCS in Firebase mode, local file fallback
'use strict';

const fs   = require('fs');
const path = require('path');

const LOCAL_DIR = path.resolve(__dirname, '../../../reports/docs');

let _bucket     = null;
let _bucketReady = false;

/**
 * Returns the GCS bucket, or null if GCS is unavailable (falls back to local files).
 * Lazy-initialised on first call after firebase-admin is ready.
 */
function getBucket() {
  if (_bucketReady) return _bucket;
  if (!process.env.K_SERVICE && !process.env.USE_FIRESTORE) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) return null; // firebase-admin not yet initialised — retry on next call
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    _bucket = bucketName ? admin.storage().bucket(bucketName) : admin.storage().bucket();
    _bucketReady = true;
    console.log(`[Storage] GCS bucket ready: ${_bucket.name}`);
    return _bucket;
  } catch (err) {
    console.error('[Storage] GCS unavailable — using local files:', err.message);
    _bucketReady = true; // stop retrying
    _bucket = null;
    return null;
  }
}

/** Save document text for a session. Returns a storage path string. */
async function saveDocument(sessionId, text) {
  const bucket = getBucket();
  if (bucket) {
    const gcsPath = `sessions/${sessionId}/document.txt`;
    const file = bucket.file(gcsPath);
    await file.save(Buffer.from(text, 'utf-8'), {
      metadata: { contentType: 'text/plain; charset=utf-8' },
    });
    return `gcs:${gcsPath}`;
  }
  // Local fallback
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const filePath = path.join(LOCAL_DIR, `${sessionId}.txt`);
  fs.writeFileSync(filePath, text, 'utf-8');
  return `local:${sessionId}.txt`;
}

/** Load document text for a session. Returns null if not found. */
async function loadDocument(sessionId) {
  const bucket = getBucket();
  if (bucket) {
    try {
      const [contents] = await bucket.file(`sessions/${sessionId}/document.txt`).download();
      return contents.toString('utf-8');
    } catch (err) {
      if (err.code === 404) return null;
      console.error(`[Storage] GCS load failed for ${sessionId}:`, err.message);
      // Fall through to local fallback
    }
  }
  // Local fallback (also used when GCS load fails)
  const filePath = path.join(LOCAL_DIR, `${sessionId}.txt`);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (_) {
    return null;
  }
}

/** Delete stored document. Called on session cleanup (optional). */
async function deleteDocument(sessionId) {
  const bucket = getBucket();
  if (bucket) {
    try { await bucket.file(`sessions/${sessionId}/document.txt`).delete(); } catch (_) {}
    return;
  }
  const filePath = path.join(LOCAL_DIR, `${sessionId}.txt`);
  try { fs.unlinkSync(filePath); } catch (_) {}
}

module.exports = { saveDocument, loadDocument, deleteDocument };
