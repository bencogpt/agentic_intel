// api/users.js — User management (admin only)
'use strict';

const express      = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const userStore    = require('../users/store');

const router = express.Router();
// All routes in this file require admin (requireAuth is applied globally in app.js)
router.use(requireAdmin);

// GET /api/users
router.get('/', (_req, res) => {
  res.json(userStore.getAllUsers());
});

// POST /api/users
router.post('/', async (req, res) => {
  const { username, password, role = 'analyst' } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (role === 'admin') {
    return res.status(400).json({ error: 'Cannot create admin users via API' });
  }
  try {
    const user = await userStore.createUser(username, password, role);
    res.status(201).json(user);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// DELETE /api/users/:username
router.delete('/:username', async (req, res) => {
  const { username } = req.params;
  if (username === (process.env.ADMIN_USERNAME || 'admin')) {
    return res.status(403).json({ error: 'Cannot delete the admin account' });
  }
  try {
    await userStore.deleteUser(username);
    res.status(204).end();
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// PUT /api/users/:username/password
router.put('/:username/password', async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password is required' });
  try {
    await userStore.updatePassword(req.params.username, password);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
