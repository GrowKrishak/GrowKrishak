'use strict';

const bcrypt = require('bcryptjs');
const { Router } = require('express');
const { asyncHandler, requireAuth } = require('../middleware');
const { destroySession } = require('../session');
const { loadUsers, saveUsers } = require('../db');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    location: user.location || '',
    photo: user.photo || '',
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
    lastLoginAt: user.lastLoginAt || '',
  };
}

function getUserById(users, userId) {
  return users.find((u) => u.id === userId);
}

const router = Router();

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const { name, email, password, confirmPassword } = req.body || {};

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Please complete all fields.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (users.some((u) => u.email === normalizedEmail)) {
      return res.status(409).json({ message: 'An account already exists with this email.' });
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(password, 10),
      location: '',
      photo: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    users.push(newUser);
    await saveUsers(users);

    req.session.userId = newUser.id;
    if (req.session) req.session.isAdmin = false;
    return res.status(201).json({ message: 'Account created successfully.', user: publicUser(newUser) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Track login time so the admin dashboard shows real activity data.
    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = user.lastLoginAt;
    await saveUsers(users);

    req.session.userId = user.id;
    if (req.session) req.session.isAdmin = false;
    return res.json({ message: 'Login successful.', user: publicUser(user) });
  })
);

router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ message: 'Already signed out.' });
  destroySession(req, (error) => {
    if (error) return res.status(500).json({ message: 'Unable to sign out right now.' });
    return res.json({ message: 'Signed out successfully.' });
  });
});

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const user = getUserById(await loadUsers(), req.session.userId);
    if (!user) return res.status(401).json({ message: 'Session invalid.' });
    return res.json(publicUser(user));
  })
);

router.put(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const user = getUserById(users, req.session.userId);
    if (!user) return res.status(401).json({ message: 'Session invalid.' });

    const { name, email, location, photo } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (users.some((u) => u.id !== user.id && u.email === normalizedEmail)) {
      return res.status(409).json({ message: 'This email is already used by another account.' });
    }
    if (photo && typeof photo === 'string' && photo.length > 3000000) {
      return res.status(400).json({ message: 'Photo is too large (max ~2MB).' });
    }

    user.name = String(name).trim();
    user.email = normalizedEmail;
    user.location = location ? String(location).trim() : '';
    if (typeof photo === 'string') user.photo = photo;
    user.updatedAt = new Date().toISOString();
    await saveUsers(users);

    return res.json({ message: 'Profile updated successfully.', user: publicUser(user) });
  })
);

module.exports = router;
