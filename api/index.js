'use strict';

/**
 * Vercel serverless entry point for exactly /api (see also
 * api/[...all].js, which handles every /api/* sub-path via filesystem
 * routing — no vercel.json rewrites). Static .html/.png/robots.txt are
 * served by the Vercel CDN directly and never reach a function.
 * Exporting the Express app is all @vercel/node needs — no app.listen
 * in serverless.
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

const app = createApp();

module.exports = app;
module.exports.default = app;
