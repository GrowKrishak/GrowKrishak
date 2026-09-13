'use strict';

/* Shared Express middleware. */

function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
}

// Wraps async route handlers so rejections reach the error handler.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  return next();
}

// Blocks direct HTTP access to backend internals served by express.static.
const BLOCKED_PREFIXES = ['/src/', '/data/', '/.git/'];
const BLOCKED_EXACT = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/.gitignore',
]);

function blockPrivateFiles(req, res, next) {
  const urlPath = req.path;
  if (BLOCKED_EXACT.has(urlPath) || BLOCKED_PREFIXES.some((p) => urlPath.startsWith(p))) {
    return res.status(404).json({ message: 'Not found.' });
  }
  return next();
}

// JSON 404 for unknown API routes (non-API falls through to static files).
function apiNotFound(req, res) {
  return res.status(404).json({ message: 'API route not found.' });
}

// Central error handler — must be registered last.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // eslint-disable-next-line no-console
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return;
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ message: err.expose ? err.message : 'Something went wrong. Please try again.' });
}

module.exports = {
  requestLogger,
  asyncHandler,
  requireAuth,
  blockPrivateFiles,
  apiNotFound,
  errorHandler,
};
