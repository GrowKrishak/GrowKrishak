'use strict';

/**
 * Main admin routes — fully working backend for admin.html.
 * The single site admin logs in with ADMIN_EMAIL / ADMIN_PASSWORD
 * (see .env.example) and can then manage registered user data.
 *
 *   POST   /api/admin/login       -> { email, password }
 *   POST   /api/admin/logout
 *   GET    /api/admin/me
 *   GET    /api/admin/users?q=&sort=&page=&limit= -> paged, sanitized list
 *   GET    /api/admin/users/:id  -> single sanitized user
 *   PUT    /api/admin/users/:id  -> update { name, email, location, photo }
 *   DELETE /api/admin/users/:id  -> remove a registered user
 *   GET    /api/admin/stats       -> counts + recent signups
 *
 * Password hashes are NEVER sent to the client. Every other user field
 * (including the full profile photo) IS sent, so the admin dashboard
 * shows/stores exactly the same data as the user account itself.
 */
const { Router } = require('express');
const config = require('../config');
const { asyncHandler, requireAdmin } = require('../middleware');
const { destroySession } = require('../session');
const { loadUsers, saveUsers, loadCollection } = require('../db');

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    location: user.location || '',
    photo: user.photo || '',
    hasPhoto: Boolean(user.photo),
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
    lastLoginAt: user.lastLoginAt || '',
  };
}

function sortUsers(users, sort) {
  const rows = [...users];
  if (sort === 'oldest') {
    rows.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  } else if (sort === 'name') {
    rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } else {
    // newest (default): most recently created first
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  return rows;
}

const router = Router();

router.post(
  '/admin/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Admin email and password are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail !== config.adminEmail || String(password) !== config.adminPassword) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }
    // Admin session is separate from farmer sessions — clear any user login.
    if (req.session) {
      delete req.session.userId;
      req.session.isAdmin = true;
      req.session.adminEmail = config.adminEmail;
    }
    return res.json({ message: 'Admin login successful.', admin: { email: config.adminEmail } });
  })
);

router.post('/admin/logout', (req, res) => {
  if (!req.session) return res.json({ message: 'Already signed out.' });
  destroySession(req, (error) => {
    if (error) return res.status(500).json({ message: 'Unable to sign out right now.' });
    return res.json({ message: 'Admin signed out successfully.' });
  });
});

router.get('/admin/me', (req, res) => {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ message: 'Not authenticated as admin.' });
  }
  return res.json({ email: req.session.adminEmail || config.adminEmail, role: 'admin' });
});

router.get(
  '/admin/users',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const q = String(req.query.q || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'newest');
    const filtered = q
      ? users.filter(
          (u) =>
            String(u.name || '').toLowerCase().includes(q) ||
            String(u.email || '').toLowerCase().includes(q) ||
            String(u.location || '').toLowerCase().includes(q) ||
            String(u.id || '').toLowerCase().includes(q)
        )
      : [...users];
    const sorted = sortUsers(filtered, sort);

    // Optional pagination: ?page=1&limit=20. Without limit -> all rows.
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const hasPaging = Number.isFinite(limitRaw) && limitRaw > 0;
    if (!hasPaging) {
      return res.json({ total: users.length, count: sorted.length, users: sorted.map(sanitizeUser) });
    }
    const limit = Math.min(Math.max(Math.floor(limitRaw), 1), 100);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pages = Math.max(1, Math.ceil(sorted.length / limit));
    const slice = sorted.slice((page - 1) * limit, page * limit);
    return res.json({
      total: users.length,
      count: slice.length,
      filtered: sorted.length,
      page,
      limit,
      pages,
      users: slice.map(sanitizeUser),
    });
  })
);

router.get(
  '/admin/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = (await loadUsers()).find((u) => String(u.id) === String(req.params.id));
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json(sanitizeUser(user));
  })
);

router.put(
  '/admin/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const user = users.find((u) => String(u.id) === String(req.params.id));
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { name, email, location, photo } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (users.some((u) => u.id !== user.id && u.email === normalizedEmail)) {
      return res.status(409).json({ message: 'This email is already used by another account.' });
    }
    // Same photo limit as the user profile endpoint (PUT /api/me).
    if (photo !== undefined && !(typeof photo === 'string')) {
      return res.status(400).json({ message: 'Photo must be a string.' });
    }
    if (typeof photo === 'string' && photo.length > 3000000) {
      return res.status(400).json({ message: 'Photo is too large (max ~2MB).' });
    }

    user.name = String(name).trim();
    user.email = normalizedEmail;
    user.location = location ? String(location).trim() : '';
    if (typeof photo === 'string') user.photo = photo;
    user.updatedAt = new Date().toISOString();
    await saveUsers(users);
    return res.json({ message: 'User updated successfully.', user: sanitizeUser(user) });
  })
);

router.delete(
  '/admin/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const idx = users.findIndex((u) => String(u.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ message: 'User not found.' });
    const [removed] = users.splice(idx, 1);
    await saveUsers(users);
    return res.json({ message: 'User deleted.', user: sanitizeUser(removed) });
  })
);

router.get(
  '/admin/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await loadUsers();
    const stats = { users: users.length };
    for (const key of ['farmers', 'crops', 'fertilizers', 'schemes', 'soils']) {
      try {
        const col = await loadCollection(key);
        stats[key] = Array.isArray(col) ? col.length : 0;
      } catch (e) {
        stats[key] = 0;
      }
    }
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    stats.signupsLast7Days = users.filter((u) => {
      const t = Date.parse(u.createdAt || '');
      return Number.isFinite(t) && t >= weekAgo;
    }).length;
    stats.recentUsers = sortUsers(users, 'newest')
      .slice(0, 5)
      .map(sanitizeUser);
    return res.json(stats);
  })
);

module.exports = router;
