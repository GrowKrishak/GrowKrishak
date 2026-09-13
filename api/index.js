'use strict';

/**
 * Vercel serverless entry point. Vercel routes all /api/* here
 * (see vercel.json); static .html/.png files are served by the
 * Vercel CDN directly. Exporting the Express app is all
 * @vercel/node needs — no app.listen in serverless.
 */
const { createApp } = require('../src/app');

module.exports = createApp();
