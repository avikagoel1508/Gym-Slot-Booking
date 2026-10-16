const express = require('express');
const { requireAuthPage, requireAdminPage } = require('../middleware/auth.js');

const router = express.Router();

// Every page is rendered on the server. Protected pages check the token
// (from the cookie) before rendering, so a member can never even load the
// admin page — the server redirects them away.

router.get('/', (req, res) => {
  res.redirect(req.user ? '/sessions' : '/login');
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/sessions');
  res.render('login', { title: 'Log in' });
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/sessions');
  res.render('register', { title: 'Register' });
});

router.get('/sessions', requireAuthPage, (req, res) => {
  res.render('sessions', { title: 'Sessions' });
});

router.get('/bookings', requireAuthPage, (req, res) => {
  res.render('bookings', { title: 'My bookings' });
});

router.get('/admin', requireAuthPage, requireAdminPage, (req, res) => {
  res.render('admin', { title: 'Admin' });
});

// Anything else that is not an API route becomes a friendly 404 page.
router.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.status(404).render('notfound', { title: 'Not found' });
});

module.exports = router;
