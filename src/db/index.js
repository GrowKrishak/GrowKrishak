'use strict';

/**
 * Database selector. Set MONGODB_URI (Atlas connection string)
 * to use MongoDB; otherwise the app runs on local JSON files.
 * Both stores expose the same functions, so routes work with
 * either — `await` works fine on the sync JSON functions too.
 *
 * Resilience: if MongoDB is configured but UNREACHABLE (e.g. Atlas
 * Network Access blocks Vercel's IPs), calls automatically fall back
 * to the JSON store (/tmp on Vercel) instead of failing with 503, so
 * login/signup keep working. A warning is logged so the owner knows
 * persistence is degraded. Genuine app errors still propagate.
 */
const jsonStore = require('../store');

// Use MongoDB whenever MONGODB_URI is set — including on Vercel, where it
// is REQUIRED for persistence (the serverless filesystem forgets JSON data
// between invocations). Without MONGODB_URI the app uses JSON files
// directly (local dev, or /tmp on Vercel).
const useMongo = Boolean(process.env.MONGODB_URI);

let mongo = null;
if (useMongo) {
  // eslint-disable-next-line global-require
  mongo = require('./mongo');
}

function isConnectionError(err) {
  if (!err) return false;
  if (err.status === 503) return true;
  const text = `${err.name || ''} ${err.message || ''}`;
  return (
    text.includes('Database unavailable') ||
    /ServerSelection|MongoNetwork|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timed out/i.test(text)
  );
}

let mongoDownUntil = 0;

async function callWithFallback(method, ...args) {
  // If Mongo just failed, don't burn another 4s timeout on every call —
  // go straight to the JSON store for the next 60s, then retry Mongo.
  // (Module state is shared across warm serverless invocations.)
  if (Date.now() < mongoDownUntil) {
    return jsonStore[method](...args);
  }
  try {
    return await mongo[method](...args);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    mongoDownUntil = Date.now() + 60000;
    // eslint-disable-next-line no-console
    console.error(
      `Mongo ${method} unreachable (${err.message}); using temporary JSON store. ` +
        'Fix Atlas Network Access (allow 0.0.0.0/0) for persistence.'
    );
    return jsonStore[method](...args);
  }
}

module.exports = useMongo
  ? {
      useMongo,
      loadCollection: (...args) => callWithFallback('loadCollection', ...args),
      saveCollection: (...args) => callWithFallback('saveCollection', ...args),
      loadUsers: (...args) => callWithFallback('loadUsers', ...args),
      saveUsers: (...args) => callWithFallback('saveUsers', ...args),
      makeId: jsonStore.makeId,
    }
  : {
      useMongo,
      loadCollection: (...args) => jsonStore.loadCollection(...args),
      saveCollection: (...args) => jsonStore.saveCollection(...args),
      loadUsers: (...args) => jsonStore.loadUsers(...args),
      saveUsers: (...args) => jsonStore.saveUsers(...args),
      makeId: jsonStore.makeId,
    };
