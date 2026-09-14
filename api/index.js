'use strict';

/**
 * Vercel serverless entry point. Vercel routes all /api/* here
 * (see vercel.json); static .html/.png files are served by the
 * Vercel CDN directly. Exporting the Express app is all
 * @vercel/node needs — no app.listen in serverless.
 */
const { createApp } = require('../src/app');

// A background driver retry (e.g. MongoDB server selection) must never
// surface as an unhandled function error: log it and keep serving.
// Routes that need the DB still return a clean 503 via ensureConnection().
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error(
    'Unhandled rejection (function staying up):',
    reason && reason.message ? reason.message : reason
  );
});

module.exports = createApp();
