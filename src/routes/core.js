'use strict';

const path = require('path');
const { Router } = require('express');
const config = require('../config');
const { asyncHandler, requireAuth } = require('../middleware');
const { loadUsers, useMongo } = require('../db');

function buildDashboardData(user) {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      location: user.location || '',
      photo: user.photo || '',
    },
    metrics: {
      fieldCoverage: '87%',
      soilMoisture: '64%',
      activeTasks: '12',
      cropHealth: '93%',
      waterUsage: '1,240L',
      weedDetection: '16 spots',
      alerts: '03',
    },
    tasks: [
      { name: 'Irrigation cycle', detail: 'Zone A • 09:30 AM', status: 'Running' },
      { name: 'Weed scan', detail: 'Zone C • 10:15 AM', status: 'Queued' },
      { name: 'Crop health check', detail: 'Zone B • 11:00 AM', status: 'Pending' },
    ],
    alerts: [
      {
        title: 'Low moisture in Zone D',
        detail: 'Scheduled irrigation was delayed by 18 minutes.',
        tone: 'warning',
      },
      {
        title: 'Weather update',
        detail: 'Dry wind detected. Recommend adjusting spray timing.',
        tone: 'info',
      },
      {
        title: 'Routine inspection complete',
        detail: 'All cameras and sensors reported normal status.',
        tone: 'success',
      },
    ],
  };
}

const router = Router();

// Reports which storage the app is actually using so you can verify a
// proper MongoDB/Vercel setup: storage "mongodb" + mongoState 1 means
// connected (0 = disconnected, 2 = connecting, 3 = disconnecting).
// mongoState is read-only here — this endpoint never opens a connection.
router.get('/health', (req, res) => {
  let mongoState = null;
  if (useMongo) {
    try {
      // eslint-disable-next-line global-require
      mongoState = require('mongoose').connection.readyState;
    } catch (e) {
      mongoState = -1;
    }
  }
  return res.json({
    status: 'ok',
    storage: useMongo ? 'mongodb' : 'json',
    mongoConfigured: useMongo,
    mongoState,
  });
});

router.get(
  '/dashboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (await loadUsers()).find((u) => u.id === req.session.userId);
    if (!user) return res.status(401).json({ message: 'Session invalid.' });
    return res.json(buildDashboardData(user));
  })
);

function mountPages(app) {
  app.get('/', (req, res) => res.sendFile(path.join(config.rootDir, 'landing.html')));
  // Browsers + bots request /favicon.ico unconditionally; serve the logo
  // instead of logging a 404 on every visit.
  app.get('/favicon.ico', (req, res) => res.sendFile(path.join(config.rootDir, 'logo.png')));
}

module.exports = { router, mountPages, buildDashboardData };
