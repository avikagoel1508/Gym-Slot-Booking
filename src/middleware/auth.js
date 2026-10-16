const jwt = require('jsonwebtoken');
const { env } = require('../config/env.js');
const { errors } = require('../utils/errors.js');
const User = require('../models/User.js');

// The token can arrive two ways:
//   - "Authorization: Bearer <token>"  (used by fetch/AJAX calls)
//   - the "token" cookie                (set at login, sent automatically,
//                                        lets the server protect HTML pages)
function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

// Verify the token and load the user onto req.user.
async function loadUser(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    return await User.findById(payload.sub);
  } catch {
    return null;
  }
}

// Guards every non-public API route. Sends 401 when there is no valid user.
async function requireAuth(req, _res, next) {
  const user = await loadUser(req);
  if (!user) return next(errors.unauthenticated());
  req.user = user;
  return next();
}

// Same check but for HTML pages: redirect instead of returning JSON.
async function requireAuthPage(req, res, next) {
  const user = await loadUser(req);
  if (!user) return res.redirect('/login');
  req.user = user;
  return next();
}

// Only admins may run the gym. Always mounted after requireAuth.
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(errors.forbidden('Admins only.'));
  }
  return next();
}

// Admin guard for HTML pages: send members back to the sessions list.
function requireAdminPage(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/sessions');
  return next();
}

module.exports = { requireAuth, requireAuthPage, requireAdmin, requireAdminPage, loadUser };
