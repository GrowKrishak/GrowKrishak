'use strict';

const { Router } = require('express');
const { asyncHandler, requireAuth } = require('../middleware');
const { loadCollection, saveCollection, makeId } = require('../db');
const schemas = require('../validators');

/**
 * Generic CRUD endpoints for one collection:
 *   GET    /api/<key>?q=...   (search across all fields)
 *   POST   /api/<key>
 *   PUT    /api/<key>/:id
 *   DELETE /api/<key>/:id
 */
function crudRouter(key) {
  const schema = schemas[key];
  if (!schema) throw new Error(`No validator schema for collection "${key}"`);
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await loadCollection(key);
      const q = (req.query.q || '').toString().trim().toLowerCase();
      if (!q) return res.json(rows);
      return res.json(rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))));
    })
  );

  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await loadCollection(key);
      const body = req.body || {};
      const error = schema.validate(body, false);
      if (error) return res.status(400).json({ message: error });

      const clean = schema.normalize(body);
      if (!clean.id) clean.id = makeId(schema.idPrefix);
      if (rows.some((r) => String(r.id).toLowerCase() === String(clean.id).toLowerCase())) {
        return res.status(409).json({ message: `Duplicate id "${clean.id}". Use a unique id.` });
      }
      rows.push(clean);
      await saveCollection(key, rows);
      return res.status(201).json(clean);
    })
  );

  router.put(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await loadCollection(key);
      const idx = rows.findIndex((r) => String(r.id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ message: 'Record not found.' });

      const merged = { ...rows[idx], ...(req.body || {}), id: rows[idx].id };
      const error = schema.validate(merged, true);
      if (error) return res.status(400).json({ message: error });

      rows[idx] = schema.normalize(merged);
      await saveCollection(key, rows);
      return res.json(rows[idx]);
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await loadCollection(key);
      const idx = rows.findIndex((r) => String(r.id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ message: 'Record not found.' });
      const [removed] = rows.splice(idx, 1);
      await saveCollection(key, rows);
      return res.json({ message: 'Deleted successfully.', removed });
    })
  );

  return router;
}

function mountCrud(app) {
  for (const key of Object.keys(schemas)) {
    app.use(`/api/${key}`, crudRouter(key));
  }
}

module.exports = { crudRouter, mountCrud };
