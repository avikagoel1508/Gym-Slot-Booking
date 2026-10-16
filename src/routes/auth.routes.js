const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User.js');
const { signToken } = require('../utils/token.js');
const { asyncHandler } = require('../utils/asyncHandler.js');
const { errors } = require('../utils/errors.js');
const { requireAuth } = require('../middleware/auth.js');

const router = express.Router();

// Keep the token in an httpOnly cookie so server-rendered pages can tell who
// is logged in. The token is also returned in the JSON body for API clients.
function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true, // not readable from JavaScript
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// POST /api/auth/register
// Always creates a member. Admins are added directly in the database.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw errors.unprocessable('Name must be at least 2 characters.');
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      throw errors.unprocessable('Please enter a valid email address.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw errors.unprocessable('Password must be at least 6 characters.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      throw errors.conflict('That email is already registered.', 'EMAIL_IN_USE');
    }

    // Hash the password. We never store or log the plain text.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'member',
    });

    const token = signToken(user);
    res.status(201);
    setAuthCookie(res, token);
    res.json({ token, user: user.toSafeJSON() });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw errors.unprocessable('Email and password are required.');
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    // Same message either way so we do not reveal which emails exist.
    if (!user) throw errors.unauthenticated('Incorrect email or password.');

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) throw errors.unauthenticated('Incorrect email or password.');

    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ token, user: user.toSafeJSON() });
  })
);

// GET /api/auth/me  (protected)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

// POST /api/auth/logout — clear the cookie so the browser is signed out.
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;
