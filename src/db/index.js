'use strict';

/**
 * Database selector. Set MONGODB_URI (Atlas connection string)
 * to use MongoDB; otherwise the app runs on local JSON files.
 * Both stores expose the same functions, so routes work with
 * either — `await` works fine on the sync JSON functions too.
 */
const jsonStore = require('../store');

// Use MongoDB whenever MONGODB_URI is set — including on Vercel, where it
// is REQUIRED for persistence (the serverless filesystem forgets JSON data
// between invocations). Without MONGODB_URI the app falls back to JSON
// files (local dev, or /tmp on Vercel). Connection failures never crash the
// app: src/db/mongo.js converts them to a 503 "Database unavailable" error.
const useMongo = Boolean(process.env.MONGODB_URI);

let mongo = null;
if (useMongo) {
  // eslint-disable-next-line global-require
  mongo = require('./mongo');
}

const active = useMongo ? mongo : jsonStore;

module.exports = {
  useMongo,
  loadCollection: (...args) => active.loadCollection(...args),
  saveCollection: (...args) => active.saveCollection(...args),
  loadUsers: (...args) => active.loadUsers(...args),
  saveUsers: (...args) => active.saveUsers(...args),
  makeId: jsonStore.makeId,
};
