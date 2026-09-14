'use strict';

/**
 * Database selector. Set MONGODB_URI (Atlas connection string)
 * to use MongoDB; otherwise the app runs on local JSON files.
 * Both stores expose the same functions, so routes work with
 * either — `await` works fine on the sync JSON functions too.
 */
const jsonStore = require('../store');

// Vercel serverless deployments should not force a MongoDB connection just
// because a local .env file exists in the repo. Fall back to JSON storage on
// Vercel unless a specific explicit override is added.
const useMongo = Boolean(process.env.MONGODB_URI) && !process.env.VERCEL;

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
