'use strict';

/**
 * Mongoose models. The app keeps its own string `id` field
 * (e.g. "F-101", "SO-501") so the API stays identical whether
 * data lives in JSON files or MongoDB.
 */
const mongoose = require('mongoose');

const baseOpts = { versionKey: false };

function stringId(schemaDef) {
  return new mongoose.Schema(
    { id: { type: String, required: true, unique: true, index: true }, ...schemaDef },
    baseOpts
  );
}

const User = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      id: { type: String, required: true, unique: true, index: true },
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
      passwordHash: { type: String, required: true },
      location: { type: String, default: '' },
      photo: { type: String, default: '' },
    },
    baseOpts
  )
);

const Farmer = mongoose.model('Farmer', stringId({ name: { type: String, required: true, trim: true } }));

const Crop = mongoose.model(
  'Crop',
  stringId({
    cropType: { type: String, required: true, trim: true },
    cropHealth: { type: String, required: true, trim: true },
    requiredMatter: { type: String, required: true, trim: true },
    cropPhoto: { type: String, default: '' },
  })
);

const Fertilizer = mongoose.model(
  'Fertilizer',
  stringId({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
  })
);

const Scheme = mongoose.model(
  'Scheme',
  stringId({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    benefits: { type: String, default: '' },
    link: { type: String, default: '' },
  })
);

const Soil = mongoose.model(
  'Soil',
  stringId({
    soilType: { type: String, required: true, trim: true },
    suitableCrops: { type: String, required: true, trim: true },
    phRange: { type: String, default: '' },
    characteristics: { type: String, default: '' },
  })
);

const MODELS = { farmers: Farmer, crops: Crop, fertilizers: Fertilizer, schemes: Scheme, soils: Soil };

module.exports = { User, Farmer, Crop, Fertilizer, Scheme, Soil, MODELS };
