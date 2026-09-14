'use strict';

/**
 * MongoDB store. Same function names/signatures as src/store.js
 * (the JSON store), but async. Seeds demo users + collections
 * on first use when empty — mirroring the JSON behaviour.
 */
const mongoose = require('mongoose');
const { User, MODELS } = require('./models');
const jsonStore = require('../store');

// Serverless-safe: single connection, fail fast instead of buffering
// commands while disconnected (ensureConnection() always runs first,
// so routes either get a live connection or a clean 503 — never a hang).
mongoose.set('bufferCommands', false);

let connected = false;
let connecting = null;

function mongoUri() {
  return process.env.MONGODB_URI || '';
}

async function ensureConnection() {
  if (connected && mongoose.connection.readyState === 1) return;
  connected = false;
  if (!connecting) {
    connecting = mongoose
      .connect(mongoUri(), {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000,
        maxPoolSize: 1,
      })
      .then(() => {
        connected = true;
      })
      .catch((err) => {
        connecting = null;
        err.expose = true;
        err.status = 503;
        err.message = 'Database unavailable. Check MONGODB_URI.';
        throw err;
      });
  }
  await connecting;
}

function stripDoc(doc) {
  const obj = { ...(doc.toObject ? doc.toObject() : doc) };
  delete obj._id;
  return obj;
}

async function seedIfEmpty() {
  // Users (demo accounts)
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const seedUsers = jsonStore.loadUsers(); // includes demo users
    await User.insertMany(
      seedUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash: u.passwordHash,
        location: u.location || '',
        photo: u.photo || '',
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || u.createdAt || new Date().toISOString(),
        lastLoginAt: u.lastLoginAt || '',
      }))
    );
  }
  // Collections
  for (const key of Object.keys(MODELS)) {
    const count = await MODELS[key].countDocuments();
    if (count === 0) {
      const seedRows = jsonStore.loadCollection(key);
      if (seedRows.length) await MODELS[key].insertMany(seedRows);
    }
  }
}

async function loadCollection(key) {
  await ensureConnection();
  await seedIfEmpty();
  const docs = await MODELS[key].find({}).lean();
  return docs.map((d) => {
    const { _id, ...rest } = d;
    return rest;
  });
}

async function saveCollection(key, rows) {
  await ensureConnection();
  await MODELS[key].deleteMany({});
  if (rows.length) await MODELS[key].insertMany(rows);
}

async function loadUsers() {
  await ensureConnection();
  await seedIfEmpty();
  const docs = await User.find({}).lean();
  return docs.map((d) => {
    const { _id, ...rest } = d;
    return rest;
  });
}

async function saveUsers(users) {
  await ensureConnection();
  await User.deleteMany({});
  if (users.length) await User.insertMany(users);
}

module.exports = {
  loadCollection,
  saveCollection,
  loadUsers,
  saveUsers,
  stripDoc,
};
