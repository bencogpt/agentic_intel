// users/store.js — User store (dual-mode: local JSON file or Firestore)
'use strict';

const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.resolve(__dirname, '../../../reports/users.json');
const users      = new Map(); // username → user record

let db      = null;
let fsAdmin = null;

// ready resolves once users are loaded and admin is seeded — login handler awaits this
let _resolveReady;
const ready = new Promise(resolve => { _resolveReady = resolve; });

// ─── Local persistence ────────────────────────────────────────────────────────

function loadLocal() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      Object.entries(data).forEach(([k, v]) => users.set(k, v));
    }
  } catch (err) {
    console.error('[Users] Failed to load from disk:', err.message);
  }
}

function saveLocal() {
  if (db) return;
  try {
    const data = {};
    users.forEach((v, k) => { data[k] = v; });
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (_) {} // read-only FS in Cloud Functions — silently ignore
}

// ─── Admin seeding ────────────────────────────────────────────────────────────

function seedAdminSync() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) { console.warn('[Users] ADMIN_PASSWORD not set — admin login disabled'); return; }
  if (users.has(username)) return;
  const passwordHash = bcrypt.hashSync(password, 12);
  const record = { username, passwordHash, role: 'admin', createdAt: new Date().toISOString() };
  users.set(username, record);
  saveLocal();
  console.log(`[Users] Admin seeded (local)`);
}

async function seedAdminAsync() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || users.has(username)) return;
  const passwordHash = await bcrypt.hash(password, 12);
  const record = { username, passwordHash, role: 'admin', createdAt: new Date().toISOString() };
  users.set(username, record);
  if (db) db.collection('users').doc(username).set(record).catch(() => {});
  else saveLocal();
  console.log(`[Users] Admin seeded (Firestore)`);
}

// ─── Firestore ────────────────────────────────────────────────────────────────

async function initFirestore() {
  try {
    fsAdmin = require('firebase-admin');
    if (!fsAdmin.apps.length) fsAdmin.initializeApp();
    db = fsAdmin.firestore();
    const snap = await db.collection('users').get();
    snap.docs.forEach(d => { users.set(d.id, d.data()); });
    await seedAdminAsync(); // no-op if admin already in Firestore
    console.log(`[Users] Loaded ${snap.docs.length} users from Firestore`);
  } catch (err) {
    console.error('[Users] Firestore unavailable — falling back to local file:', err.message);
    db = null;
    loadLocal();
    seedAdminSync();
  }
  _resolveReady();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (process.env.K_SERVICE || process.env.USE_FIRESTORE) {
  // Async Firestore init — ready resolves when done
  initFirestore();
} else {
  // Pure local mode — synchronous, ready immediately
  loadLocal();
  seedAdminSync();
  _resolveReady();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function createUser(username, plainPassword, role = 'analyst') {
  if (users.has(username)) throw new Error(`User '${username}' already exists`);
  const passwordHash = await bcrypt.hash(plainPassword, 12);
  const record = { username, passwordHash, role, createdAt: new Date().toISOString() };
  users.set(username, record);
  if (db) db.collection('users').doc(username).set(record).catch(() => {});
  else saveLocal();
  return { username, role, createdAt: record.createdAt };
}

function getAllUsers() {
  return Array.from(users.values())
    .map(({ username, role, createdAt }) => ({ username, role, createdAt }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getUserByUsername(username) {
  return users.get(username) || null;
}

async function deleteUser(username) {
  if (!users.has(username)) throw new Error(`User '${username}' not found`);
  users.delete(username);
  if (db) db.collection('users').doc(username).delete().catch(() => {});
  else saveLocal();
}

async function updatePassword(username, newPlainPassword) {
  const record = users.get(username);
  if (!record) throw new Error(`User '${username}' not found`);
  const passwordHash = await bcrypt.hash(newPlainPassword, 12);
  const updated = { ...record, passwordHash, updatedAt: new Date().toISOString() };
  users.set(username, updated);
  if (db) db.collection('users').doc(username).set(updated).catch(() => {});
  else saveLocal();
}

async function verifyPassword(username, plainPassword) {
  await ready; // wait for init to complete before checking
  const record = users.get(username);
  if (!record) return false;
  return bcrypt.compare(plainPassword, record.passwordHash);
}

module.exports = { ready, createUser, getAllUsers, getUserByUsername, deleteUser, updatePassword, verifyPassword };
