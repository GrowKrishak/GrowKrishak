'use strict';

/**
 * Tiny JSON-file store (collections + users).
 * Synchronous reads/writes keep the code simple and are fine
 * for this app's scale. Swap with a real DB later without
 * touching routes: they only use loadCollection/saveCollection.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const USERS_FILE = path.join(config.dataDir, 'users.json');

const DEMO_USERS = [
  {
    id: 'demo-farmer',
    name: 'Demo Farmer',
    email: 'demo@growkrishak.com',
    passwordHash: '$2a$10$c65ffco0KCiuEomG5pepO.5ZdG6j8ra821B.DD/AQ/2WAbSVTiu0e',
  },
  {
    id: 'demo-manager',
    name: 'Farm Manager',
    email: 'farm@growkrishak.com',
    passwordHash: '$2a$10$Og60Mo1gm0GvYrzC2gmNKubWc0539BHrnB8uR4Y4AfHVj6Ti.ALre',
  },
  {
    id: 'demo-operator',
    name: 'Field Operator',
    email: 'operator@growkrishak.com',
    passwordHash: '$2a$10$9GUjtJ9xliVLC90keN7bBeQzjB2QewP9BS7UXa47/AkLdACV8rFMq',
  },
];

const COLLECTION_FILES = {
  farmers: 'farmers.json',
  crops: 'crops.json',
  fertilizers: 'fertilizers.json',
  schemes: 'schemes.json',
  soils: 'soils.json',
};

const SEED_DATA = {
  farmers: [
    { id: 'F-101', name: 'Ramesh Patel' },
    { id: 'F-102', name: 'Sunita Yadav' },
  ],
  crops: [
    {
      id: 'C-201',
      cropType: 'Wheat',
      cropHealth: 'Good',
      requiredMatter: 'Urea + Irrigation',
      cropPhoto: '',
    },
    {
      id: 'C-202',
      cropType: 'Rice',
      cropHealth: 'Average',
      requiredMatter: 'Organic compost',
      cropPhoto: '',
    },
  ],
  fertilizers: [
    { id: 'FT-301', name: 'Urea', price: 350 },
    { id: 'FT-302', name: 'DAP', price: 1350 },
  ],
  schemes: [
    {
      id: 'S-401',
      name: 'PM-KISAN',
      description: 'Income support of Rs 6000/year to farmer families.',
      benefits: 'Rs 6000 per year in 3 installments',
      link: 'https://pmkisan.gov.in/',
    },
    {
      id: 'S-402',
      name: 'Soil Health Card Scheme',
      description: 'Soil testing and health cards for better fertilizer use.',
      benefits: 'Free soil testing + guidance',
      link: 'https://soilhealth.dac.gov.in/',
    },
  ],
  soils: [
    {
      id: 'SO-501',
      soilType: 'Alluvial',
      suitableCrops: 'Rice, Wheat, Sugarcane, Maize, Pulses',
      phRange: '6.5 - 7.5',
      characteristics: 'Fertile, rich in potash, found in Indo-Gangetic plains.',
    },
    {
      id: 'SO-502',
      soilType: 'Black (Regur / Cotton)',
      suitableCrops: 'Cotton, Soybean, Sunflower, Groundnut, Wheat',
      phRange: '6.5 - 8.0',
      characteristics: 'Moisture-retentive clayey soil, rich in iron and lime.',
    },
    {
      id: 'SO-503',
      soilType: 'Red',
      suitableCrops: 'Groundnut, Potato, Millet, Pulses, Tobacco',
      phRange: '5.5 - 7.0',
      characteristics: 'Iron-rich, low nitrogen, needs fertilizer management.',
    },
    {
      id: 'SO-504',
      soilType: 'Laterite',
      suitableCrops: 'Tea, Coffee, Cashew, Coconut, Rubber',
      phRange: '5.0 - 6.5',
      characteristics: 'High iron/aluminium, low fertility, good in high rainfall.',
    },
    {
      id: 'SO-505',
      soilType: 'Desert / Sandy',
      suitableCrops: 'Bajra, Guar, Barley, Watermelon, Moth Bean',
      phRange: '7.0 - 8.5',
      characteristics: 'Low water retention, needs drip irrigation + organic matter.',
    },
    {
      id: 'SO-506',
      soilType: 'Mountain / Forest',
      suitableCrops: 'Tea, Apple, Spices, Maize, Barley',
      phRange: '5.0 - 6.5',
      characteristics: 'Acidic, rich in organic matter, good on hill slopes.',
    },
    {
      id: 'SO-507',
      soilType: 'Loamy',
      suitableCrops: 'Wheat, Rice, Sugarcane, Vegetables, Pulses',
      phRange: '6.0 - 7.5',
      characteristics: 'Balanced sand-silt-clay, ideal for most crops.',
    },
  ],
};

function collectionFile(key) {
  return path.join(config.dataDir, COLLECTION_FILES[key]);
}

function ensureCollectionFile(key) {
  const file = collectionFile(key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(SEED_DATA[key] || [], null, 2), 'utf8');
  }
}

function loadCollection(key) {
  ensureCollectionFile(key);
  try {
    const parsed = JSON.parse(fs.readFileSync(collectionFile(key), 'utf8'));
    if (Array.isArray(parsed)) return parsed;
    return SEED_DATA[key] || [];
  } catch (e) {
    return SEED_DATA[key] || [];
  }
}

function saveCollection(key, rows) {
  ensureCollectionFile(key);
  fs.writeFileSync(collectionFile(key), JSON.stringify(rows, null, 2), 'utf8');
}

function loadUsers() {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf8');

  let users;
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    users = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    users = [...DEMO_USERS];
    saveUsers(users);
    return users;
  }

  let changed = false;
  for (const demoUser of DEMO_USERS) {
    if (!users.some((u) => u.email === demoUser.email)) {
      users.push(demoUser);
      changed = true;
    }
  }
  if (changed) saveUsers(users);
  return users;
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
}

module.exports = {
  COLLECTION_FILES,
  collectionFile,
  ensureCollectionFile,
  loadCollection,
  saveCollection,
  loadUsers,
  saveUsers,
  makeId,
};
