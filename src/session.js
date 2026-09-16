'use strict';

/**
 * Session middleware that works everywhere:
 * - MONGODB_URI set  -> connect-mongo (persistent, works
 *   locally AND serverless on Vercel), wrapped in a resilient
 *   store: short timeouts so a dead/unreachable Mongo fails
 *   fast, background connection failures are handled (never
 *   "unhandled rejection" noise), and sessions transparently
 *   fall back to memory until Mongo recovers — login keeps
 *   working even when Atlas is blocked by network/DNS.
 * - Vercel without DB -> signed-cookie sessions (no shared
 *   memory between serverless instances).
 * - Local dev default -> express-session in-memory store.
 * Only the userId is stored, so cookies stay tiny.
 */
const expressSession = require('express-session');
const cookieSession = require('cookie-session');
const config = require('./config');

// How long to wait for Mongo before treating it as down (both for
// the session store client and the background re-probe). Short on
// purpose: the default driver timeout (30s) would hang every
// request while Mongo is unreachable.
const MONGO_TIMEOUT_MS = 4000;
// How long to serve sessions from memory before retrying Mongo.
const MONGO_RETRY_MS = 60000;

function isConnectionError(err) {
  if (!err) return false;
  const text = `${err.name || ''} ${err.message || ''}`;
  return /querySrv|ServerSelection|MongoNetwork|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timed out|topology|Database unavailable/i.test(
    text
  );
}

function shortError(err) {
  const msg = err && err.message ? String(err.message) : String(err);
  return msg.split('\n')[0].slice(0, 160);
}

let warnedStoreDown = false;
function warnStoreDown(detail) {
  if (warnedStoreDown) return;
  warnedStoreDown = true;
  // eslint-disable-next-line no-console
  console.error(
    `[sessions] MongoDB unreachable (${detail}); using in-memory sessions until it recovers. ` +
      'Fix Atlas Network Access / network / DNS, or unset MONGODB_URI for local JSON mode.'
  );
}

// Session store that prefers Mongo but serves from memory while
// Mongo is unreachable, re-probing in the background. Non-network
// errors still propagate so real bugs are never masked.
class ResilientSessionStore extends expressSession.Store {
  constructor(primary, fallback) {
    super();
    this.primary = primary;
    this.fallback = fallback;
    this.mongoDown = false;
    this.reprobeTimer = null;
  }

  useFallback() {
    if (!this.mongoDown) {
      this.mongoDown = true;
      warnStoreDown('connection failed');
      this.scheduleReprobe();
    }
    return this.fallback;
  }

  scheduleReprobe() {
    if (this.reprobeTimer) return;
    this.reprobeTimer = setTimeout(() => {
      this.reprobeTimer = null;
      // Probe with a get on a sid that can never exist: success (even
      // "not found") means Mongo is back; connection errors mean stay down.
      this.primary.get('__gk_probe__', (err) => {
        if (err && isConnectionError(err)) {
          this.scheduleReprobe();
          return;
        }
        this.mongoDown = false;
        // eslint-disable-next-line no-console
        console.error('[sessions] MongoDB recovered; using Mongo sessions again.');
      });
    }, MONGO_RETRY_MS);
    if (typeof this.reprobeTimer.unref === 'function') this.reprobeTimer.unref();
  }

  run(method, ...args) {
    const callback = args[args.length - 1];
    const params = args.slice(0, -1);
    if (this.mongoDown) {
      this.fallback[method](...params, callback);
      return;
    }
    const done = (err, ...rest) => {
      if (err && isConnectionError(err)) {
        this.useFallback()[method](...params, callback);
        return;
      }
      callback(err, ...rest);
    };
    let ret;
    try {
      ret = this.primary[method](...params, done);
    } catch (err) {
      if (isConnectionError(err)) {
        this.useFallback()[method](...params, callback);
        return;
      }
      callback(err);
      return;
    }
    // Some drivers also return a promise; make sure its rejection is
    // handled too (the callback path above is the primary channel).
    if (ret && typeof ret.catch === 'function') {
      ret.catch((err) => {
        if (isConnectionError(err)) this.useFallback();
        else done(err);
      });
    }
  }

  get(sid, cb) {
    this.run('get', sid, cb);
  }

  set(sid, sess, cb) {
    this.run('set', sid, sess, cb);
  }

  destroy(sid, cb) {
    this.run('destroy', sid, cb);
  }

  touch(sid, sess, cb) {
    if (typeof this.primary.touch !== 'function' && typeof this.fallback.touch === 'function') {
      this.fallback.touch(sid, sess, cb);
      return;
    }
    this.run('touch', sid, sess, cb);
  }

  all(cb) {
    this.run('all', cb);
  }

  length(cb) {
    this.run('length', cb);
  }

  clear(cb) {
    this.run('clear', cb);
  }
}

// connect-mongo connects in the background via internal promises and
// never attaches its own rejection handler: if Mongo is unreachable
// before any session is touched, Node reports "unhandled rejection".
// Mark that branch handled here (real operations still report their
// own errors through callbacks, picked up by ResilientSessionStore).
function guardStoreBackground(store) {
  for (const key of ['collectionP', 'clientP']) {
    const p = store && store[key];
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (isConnectionError(err)) warnStoreDown(shortError(err));
        // eslint-disable-next-line no-console
        else console.error('[sessions] MongoDB background error:', shortError(err));
      });
    }
  }
}

function useMongoSessions() {
  if (process.env.SESSION_STORE) return process.env.SESSION_STORE === 'mongo';
  return !process.env.VERCEL && Boolean(process.env.MONGODB_URI);
}

function useCookieSessions() {
  if (process.env.SESSION_STORE) return process.env.SESSION_STORE === 'cookie';
  return Boolean(process.env.VERCEL);
}

function createSessionMiddleware() {
  if (useMongoSessions() && process.env.MONGODB_URI) {
    // eslint-disable-next-line global-require
    const { MongoStore } = require('connect-mongo');
    const session = require('express-session');
    const primary = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      // Fail fast when Mongo is unreachable — the driver default (30s)
      // would hang every request touching the session.
      mongoOptions: {
        serverSelectionTimeoutMS: MONGO_TIMEOUT_MS,
        connectTimeoutMS: MONGO_TIMEOUT_MS,
      },
    });
    guardStoreBackground(primary);
    const store = new ResilientSessionStore(primary, new session.MemoryStore());
    return session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: config.sessionMaxAge },
    });
  }
  if (useCookieSessions()) {
    return cookieSession({
      name: 'gk_session',
      keys: [config.sessionSecret],
      maxAge: config.sessionMaxAge,
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(process.env.VERCEL), // Vercel serves HTTPS
    });
  }
  return expressSession({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.sessionMaxAge,
    },
  });
}

// express-session has req.session.destroy(cb); cookie-session clears via null.
function destroySession(req, callback) {
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(callback);
    return;
  }
  req.session = null;
  callback(null);
}

module.exports = { createSessionMiddleware, destroySession, useCookieSessions };
