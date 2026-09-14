'use strict';

/**
 * Vercel catch-all for /api/* (filesystem routing — no vercel.json
 * rewrites needed). Serves every /api/<anything> route with the same
 * Express app as api/index.js (which handles exactly /api).
 * Static pages (*.html, logo.png, robots.txt) are served by the Vercel
 * CDN directly and never reach a function.
 */
const { createApp } = require('../src/app');

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
