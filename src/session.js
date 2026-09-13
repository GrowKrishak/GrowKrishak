'use strict';

/**
 * Session middleware that works everywhere:
 * - MONGODB_URI set  -> connect-mongo (persistent, works
 *   locally AND serverless on Vercel).
 * - Vercel without DB -> signed-cookie sessions (no shared
 *   memory between serverless instances).
 * - Local dev default -> express-session in-memory store.
 * Only the userId is stored, so cookies stay tiny.
 */
const expressSession = require('express-session');
const cookieSession = require('cookie-session');
const config = require('./config');

function useCookieSessions() {
  if (process.env.SESSION_STORE) return process.env.SESSION_STORE === 'cookie';
  return Boolean(process.env.VERCEL);
}

function createSessionMiddleware() {
  if (process.env.MONGODB_URI) {
    // eslint-disable-next-line global-require
    const { MongoStore } = require('connect-mongo');
    const session = require('express-session');
    return session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
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
