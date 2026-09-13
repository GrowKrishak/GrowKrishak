'use strict';

// Loads local .env (MONGODB_URI, SESSION_SECRET, PORT) when present.
// On Vercel these come from the dashboard instead.
try {
  require('dotenv').config();
} catch (e) {
  /* dotenv is optional at runtime */
}

const os = require('os');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
// Vercel's filesystem is read-only except /tmp, and nothing
// persists between invocations — so store JSON data in /tmp
// there (freshly seeded on cold start). Override anywhere with
// DATA_DIR. Local dev keeps using ./data.
const DATA_DIR =
  process.env.DATA_DIR ||
  (process.env.VERCEL ? path.join(os.tmpdir(), 'growkrishak-data') : path.join(ROOT_DIR, 'data'));

const config = {
  rootDir: ROOT_DIR,
  dataDir: DATA_DIR,
  port: Number(process.env.PORT) || 0, // 0 = auto-pick below
  portsToTry: process.env.PORT ? [Number(process.env.PORT)] : [3000, 3001, 3002, 3003, 3004, 3005],
  sessionSecret: process.env.SESSION_SECRET || 'growkrishak-secret-key',
  sessionMaxAge: 1000 * 60 * 60 * 8, // 8h
  jsonLimit: '12mb',
};

module.exports = config;
