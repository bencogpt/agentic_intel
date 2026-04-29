// middleware/requireAdmin.js — Must be chained after requireAuth
'use strict';

module.exports = function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
