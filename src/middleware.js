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

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ message: 'Admin authentication required.' });
  }
  return next();
}

// Blocks direct HTTP access to backend internals served by express.static.
// NOTE: '/.env' is the critical entry — it holds MONGODB_URI and must
// never be served. '/api/index.js' is the serverless entry point source.
const BLOCKED_PREFIXES = ['/src/', '/data/', '/tests/', '/.git/'];
const BLOCKED_EXACT = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/.env',
  '/.gitignore',
  '/.vercelignore',
  '/vercel.json',
  '/api/index.js',
]);

function blockPrivateFiles(req, res, next) {
  const urlPath = req.path;
  if (BLOCKED_EXACT.has(urlPath) || BLOCKED_PREFIXES.some((p) => urlPath.startsWith(p))) {
    return res.status(404).json({ message: 'Not found.' });
  }
  return next();
}

// JSON 404 for unknown API routes (non-API falls through to static files).
// Includes the attempted path so clients can tell a wrong URL apart from
// an outdated/stopped backend (e.g. server started before new routes existed).
function apiNotFound(req, res) {
  return res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
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
  requireAdmin,
  blockPrivateFiles,
  apiNotFound,
  errorHandler,
};
