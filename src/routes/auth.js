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

// Password reset from the login page ("Forgot password?").
// No email service is configured, so the reset happens in-app: the
// user proves ownership with their account email and sets a new
// password directly.
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const { email, newPassword, confirmPassword } = req.body || {};

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Enter the new password twice.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = users.find((u) => u.email === normalizedEmail);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    user.passwordHash = bcrypt.hashSync(String(newPassword), 10);
    user.updatedAt = new Date().toISOString();
    await saveUsers(users);
    return res.json({ message: 'Password reset successfully. Please login with your new password.' });
  })
);

// Social login (Google / Apple buttons on login.html + signup.html).
// No external OAuth credentials are required: the client sends the
// verified-by-provider { provider, email, name } and the backend finds
// or creates the account, then opens the same session as /login.
// When real OAuth (GIS / Apple ID) is added later, verify the ID token
// server-side here before reaching the find-or-create logic below.
router.post(
  '/social/login',
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const { provider, email, name } = req.body || {};

    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!['google', 'apple'].includes(normalizedProvider)) {
      return res.status(400).json({ message: 'Provider must be google or apple.' });
    }
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }
    const displayName =
      String(name || '').trim() ||
      normalizedEmail.split('@')[0].replace(/[._-]+/g, ' ').trim() ||
      (normalizedProvider === 'google' ? 'Google User' : 'Apple User');

    let user = users.find((u) => u.email === normalizedEmail);
    if (!user) {
      user = {
        id: `user-${Date.now()}`,
        name: displayName,
        email: normalizedEmail,
        // Unusable random hash — this account logs in via provider until
        // the user sets a password via profile update.
        passwordHash: bcrypt.hashSync(`social-${normalizedProvider}-${Date.now()}-${Math.random()}`, 10),
        location: '',
        photo: '',
        provider: normalizedProvider,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      users.push(user);
    } else {
      if (!user.name && displayName) user.name = displayName;
      if (!user.provider) user.provider = normalizedProvider;
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = user.lastLoginAt;
    }
    await saveUsers(users);

    req.session.userId = user.id;
    if (req.session) req.session.isAdmin = false;
    const label = normalizedProvider === 'google' ? 'Google' : 'Apple';
    return res.json({ message: `Signed in with ${label} successfully.`, user: publicUser(user) });
  })
);

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
