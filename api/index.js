'use strict';

/**
 * Vercel serverless entry point. vercel.json routes ONLY /api/* here;
 * static .html/.png/robots.txt are served by the Vercel CDN directly,
 * so `/` never hits this function (that was the old 404: a catch-all
 * rewrite forced every page through Express, where the bundle had no
 * static files). Exporting the Express app is all @vercel/node needs
 * — no app.listen in serverless.
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
