// api/auth.js — Login and current-user routes
'use strict';

const express    = require('express');
const jwt        = require('jsonwebtoken');
const userStore  = require('../users/store');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login — public
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const valid = await userStore.verifyPassword(username, password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const user = userStore.getUserByUsername(username);
  const token = jwt.sign(
    { username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, username: user.username, role: user.role });
});

// GET /api/auth/me — protected
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

module.exports = router;
