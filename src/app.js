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
const { mountCrud } = require('./routes/crud');
const { router: coreRoutes, mountPages } = require('./routes/core');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: config.jsonLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.jsonLimit }));

  app.use(createSessionMiddleware());

  app.use(requestLogger);
  app.use(blockPrivateFiles);
  app.use(express.static(config.rootDir));

  mountPages(app);
  app.use('/api', coreRoutes); // /api/health, /api/dashboard
  app.use('/api', authRoutes); // /api/signup, /api/login, ...
  mountCrud(app); // /api/farmers, /api/crops, ...
  app.use('/api', apiNotFound);

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
