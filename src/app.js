'use strict';

/**
 * Express app factory. Middleware order matters:
 * parsers -> session -> logger -> private-file guard -> static ->
 * API routes -> API 404 -> central error handler.
 * (Previously session was registered AFTER the API routes, so
 *  req.session was undefined inside authenticated handlers.)
 */
const express = require('express');
const config = require('./config');
const { createSessionMiddleware } = require('./session');
const {
  requestLogger,
  blockPrivateFiles,
  apiNotFound,
  errorHandler,
} = require('./middleware');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { mountCrud } = require('./routes/crud');
const { router: coreRoutes, mountPages } = require('./routes/core');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Vercel terminates TLS at its edge proxy — trust it so `secure`
  // cookies (cookie-session on Vercel) are set correctly over HTTPS.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: config.jsonLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.jsonLimit }));

  app.use(createSessionMiddleware());

  app.use(requestLogger);
  app.use(blockPrivateFiles);
  // Static frontend lives in public/ (Vercel CDN serves it in
  // production; Express serves it for local dev). Keep rootDir as a
  // fallback so old checkouts without public/ still work.
  app.use(express.static(config.publicDir));
  app.use(express.static(config.rootDir));

  mountPages(app);
  app.use('/api', coreRoutes); // /api/health, /api/dashboard
  app.use('/api', authRoutes); // /api/signup, /api/login, ...
  app.use('/api', adminRoutes); // /api/admin/login, /api/admin/users, ...
  mountCrud(app); // /api/farmers, /api/crops, ...
  app.use('/api', apiNotFound);

  // Non-API fallback: if a page request somehow reaches the function
  // (stale rewrite, direct invocation), serve the homepage instead of
  // an empty 404 so the site stays usable.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(require('path').join(config.publicDir, 'index.html'), (err) => {
        if (err) next(err);
      });
    }
    return next();
  });

  app.use(errorHandler);
  return app;
}

// Default export is a ready app instance so that any platform
// auto-detection (Vercel Express preset looks at server.js / src/app.js)
// receives a working (req, res) handler instead of a factory.
// `createApp` is also exposed for local dev, tests and api/ functions.
// Note: creating one instance here is side-effect free (no DB connection
// or listener is opened at require time).
const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
module.exports.default = app;
