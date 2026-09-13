'use strict';

/**
 * Validation + normalization schemas, one per collection.
 * validate(body, isUpdate) returns an error string or null.
 * normalize(body) returns the clean record to store.
 */
const { makeId } = require('./store');

const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== '';

const schemas = {
  farmers: {
    validate: (b) => {
      if (!nonEmpty(b.id)) return 'Farmer ID is required.';
      if (!nonEmpty(b.name)) return 'Farmer name is required.';
      return null;
    },
    normalize: (b) => ({ id: String(b.id).trim(), name: String(b.name).trim() }),
    idPrefix: 'FA',
  },

  crops: {
    validate: (b) => {
      if (!nonEmpty(b.cropType)) return 'Crop type is required.';
      if (!nonEmpty(b.cropHealth)) return 'Crop health is required.';
      if (!nonEmpty(b.requiredMatter)) return 'Required matter is required.';
      return null;
    },
    normalize: (b) => ({
      id: b.id ? String(b.id).trim() : makeId('C'),
      cropType: String(b.cropType || '').trim(),
      cropHealth: String(b.cropHealth || '').trim(),
      requiredMatter: String(b.requiredMatter || '').trim(),
      cropPhoto: typeof b.cropPhoto === 'string' ? b.cropPhoto : '',
    }),
    idPrefix: 'C',
  },

  fertilizers: {
    validate: (b) => {
      if (!nonEmpty(b.id)) return 'Fertilizer ID is required.';
      if (!nonEmpty(b.name)) return 'Fertilizer name is required.';
      if (b.price === undefined || b.price === null || b.price === '') {
        return 'Fertilizer price is required.';
      }
      if (Number.isNaN(Number(b.price)) || Number(b.price) < 0) {
        return 'Price must be a valid non-negative number.';
      }
      return null;
    },
    normalize: (b) => ({
      id: String(b.id).trim(),
      name: String(b.name).trim(),
      price: Number(b.price),
    }),
    idPrefix: 'FT',
  },

  schemes: {
    validate: (b) => {
      if (!nonEmpty(b.name)) return 'Scheme name is required.';
      if (!nonEmpty(b.description)) return 'Scheme description is required.';
      return null;
    },
    normalize: (b) => ({
      id: b.id ? String(b.id).trim() : makeId('S'),
      name: String(b.name || '').trim(),
      description: String(b.description || '').trim(),
      benefits: String(b.benefits || '').trim(),
      link: String(b.link || '').trim(),
    }),
    idPrefix: 'S',
  },

  soils: {
    validate: (b) => {
      if (!nonEmpty(b.soilType)) return 'Soil type is required.';
      if (!nonEmpty(b.suitableCrops)) return 'Suitable crops are required.';
      return null;
    },
    normalize: (b) => ({
      id: b.id ? String(b.id).trim() : makeId('SO'),
      soilType: String(b.soilType || '').trim(),
      suitableCrops: String(b.suitableCrops || '').trim(),
      phRange: String(b.phRange || '').trim(),
      characteristics: String(b.characteristics || '').trim(),
    }),
    idPrefix: 'SO',
  },
};

module.exports = schemas;
