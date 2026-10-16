require('dotenv/config'); // loads variables from .env into process.env
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { engine } = require('express-handlebars');
const { env } = require('./config/env.js');
const { notFoundHandler, errorHandler } = require('./middleware/error.js');
const { loadUser } = require('./middleware/auth.js');
const authRoutes = require('./routes/auth.routes.js');
const sessionRoutes = require('./routes/session.routes.js');
const bookingRoutes = require('./routes/booking.routes.js');
const checkinRoutes = require('./routes/checkin.routes.js');
const pageRoutes = require('./routes/page.routes.js');

// Builds the Express app. Kept separate from server.js so we can
// reuse it later for tests.
function createApp() {
  const app = express();

  // Handlebars renders the HTML pages (server-side templates).
  app.engine(
    'hbs',
    engine({
      extname: '.hbs',
      defaultLayout: 'main',
      layoutsDir: path.join(__dirname, '..', 'views', 'layouts'),
      partialsDir: path.join(__dirname, '..', 'views', 'partials'),
      helpers: {
        // Used in templates for simple comparisons like role === "admin".
        eq: (a, b) => a === b,
      },
    })
  );
  app.set('view engine', 'hbs');
  app.set('views', path.join(__dirname, '..', 'views'));

  // Allow other origins to call the API (useful when the app is deployed
  // separately) and parse cookies + JSON bodies.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Plain CSS and JavaScript for the pages.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Make the logged-in user available to every template as {{user}}.
  // toSafeJSON() returns a plain object, so Handlebars can read user.role and
  // user.name (it blocks access to Mongoose document prototypes by default).
  app.use(async (req, res, next) => {
    const user = await loadUser(req);
    res.locals.user = user ? user.toSafeJSON() : null;
    next();
  });

  // JSON API
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'gym-slot-booking', time: new Date().toISOString() });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api', bookingRoutes);
  app.use('/api/checkin', checkinRoutes);

  // HTML pages
  app.use('/', pageRoutes);

  // 404 for unmatched routes, then the central error handler (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
