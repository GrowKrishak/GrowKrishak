const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const PORTS_TO_TRY = process.env.PORT
  ? [Number(process.env.PORT)]
  : [3000, 3001, 3002, 3003, 3004, 3005];
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
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

function ensureUsersFile() {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]', 'utf8');
  }
}

function loadUsers() {
  ensureUsersFile();

  try {
    const storedUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

    const users = Array.isArray(storedUsers) ? storedUsers : [];
    let changed = false;

    for (const demoUser of DEMO_USERS) {
      const alreadyExists = users.some((user) => user.email === demoUser.email);

      if (!alreadyExists) {
        users.push(demoUser);
        changed = true;
      }
    }

    if (changed) {
      saveUsers(users);
    }

    return users;
  } catch (error) {
    saveUsers(DEMO_USERS);
    return DEMO_USERS;
  }
}

function saveUsers(users) {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

let users = loadUsers();

app.use(express.static(__dirname));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// ---------- 4-Table Storage (Farmers, Crops, Fertilizers, Schemes) ----------
const DATA_FILES = {
  farmers: path.join(__dirname, 'data', 'farmers.json'),
  crops: path.join(__dirname, 'data', 'crops.json'),
  fertilizers: path.join(__dirname, 'data', 'fertilizers.json'),
  schemes: path.join(__dirname, 'data', 'schemes.json'),
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
};

function ensureCollectionFile(key) {
  const file = DATA_FILES[key];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(SEED_DATA[key] || [], null, 2), 'utf8');
  }
}

function loadCollection(key) {
  ensureCollectionFile(key);
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILES[key], 'utf8'));
    if (Array.isArray(parsed)) return parsed;
    return SEED_DATA[key] || [];
  } catch (e) {
    return SEED_DATA[key] || [];
  }
}

function saveCollection(key, rows) {
  ensureCollectionFile(key);
  fs.writeFileSync(DATA_FILES[key], JSON.stringify(rows, null, 2), 'utf8');
}

Object.keys(DATA_FILES).forEach(ensureCollectionFile);

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
}

function buildCrudRoutes(key, validate, normalize) {
  app.get(`/api/${key}`, requireAuth, (req, res) => {
    const rows = loadCollection(key);
    const q = (req.query.q || '').toString().trim().toLowerCase();
    if (!q) return res.json(rows);
    const filtered = rows.filter((r) =>
      Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
    return res.json(filtered);
  });

  app.post(`/api/${key}`, requireAuth, (req, res) => {
    const rows = loadCollection(key);
    const body = req.body || {};
    const error = validate(body, false);
    if (error) return res.status(400).json({ message: error });

    const clean = normalize(body);
    if (!clean.id) clean.id = makeId(key.slice(0, 2).toUpperCase());
    if (rows.some((r) => String(r.id).toLowerCase() === String(clean.id).toLowerCase())) {
      return res.status(409).json({ message: `Duplicate id "${clean.id}". Use a unique id.` });
    }
    rows.push(clean);
    saveCollection(key, rows);
    return res.status(201).json(clean);
  });

  app.put(`/api/${key}/:id`, requireAuth, (req, res) => {
    const rows = loadCollection(key);
    const idx = rows.findIndex((r) => String(r.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ message: 'Record not found.' });
    const merged = { ...rows[idx], ...(req.body || {}), id: rows[idx].id };
    const error = validate(merged, true);
    if (error) return res.status(400).json({ message: error });
    rows[idx] = normalize(merged);
    saveCollection(key, rows);
    return res.json(rows[idx]);
  });

  app.delete(`/api/${key}/:id`, requireAuth, (req, res) => {
    const rows = loadCollection(key);
    const idx = rows.findIndex((r) => String(r.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ message: 'Record not found.' });
    const [removed] = rows.splice(idx, 1);
    saveCollection(key, rows);
    return res.json({ message: 'Deleted successfully.', removed });
  });
}

buildCrudRoutes(
  'farmers',
  (b) => {
    if (!b.id || !String(b.id).trim()) return 'Farmer ID is required.';
    if (!b.name || !String(b.name).trim()) return 'Farmer name is required.';
    return null;
  },
  (b) => ({ id: String(b.id).trim(), name: String(b.name).trim() })
);

buildCrudRoutes(
  'crops',
  (b) => {
    if (!b.cropType || !String(b.cropType).trim()) return 'Crop type is required.';
    if (!b.cropHealth || !String(b.cropHealth).trim()) return 'Crop health is required.';
    if (!b.requiredMatter || !String(b.requiredMatter).trim()) return 'Required matter is required.';
    return null;
  },
  (b) => ({
    id: b.id ? String(b.id).trim() : makeId('C'),
    cropType: String(b.cropType || '').trim(),
    cropHealth: String(b.cropHealth || '').trim(),
    requiredMatter: String(b.requiredMatter || '').trim(),
    cropPhoto: typeof b.cropPhoto === 'string' ? b.cropPhoto : '',
  })
);

buildCrudRoutes(
  'fertilizers',
  (b) => {
    if (!b.id || !String(b.id).trim()) return 'Fertilizer ID is required.';
    if (!b.name || !String(b.name).trim()) return 'Fertilizer name is required.';
    if (b.price === undefined || b.price === null || b.price === '') return 'Fertilizer price is required.';
    if (isNaN(Number(b.price)) || Number(b.price) < 0) return 'Price must be a valid non-negative number.';
    return null;
  },
  (b) => ({ id: String(b.id).trim(), name: String(b.name).trim(), price: Number(b.price) })
);

buildCrudRoutes(
  'schemes',
  (b) => {
    if (!b.name || !String(b.name).trim()) return 'Scheme name is required.';
    if (!b.description || !String(b.description).trim()) return 'Scheme description is required.';
    return null;
  },
  (b) => ({
    id: b.id ? String(b.id).trim() : makeId('S'),
    name: String(b.name || '').trim(),
    description: String(b.description || '').trim(),
    benefits: String(b.benefits || '').trim(),
    link: String(b.link || '').trim(),
  })
);

app.use(
  session({
    secret: 'growkrishak-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return next();
}

function getUserById(userId) {
  return users.find((user) => user.id === userId);
}

function buildDashboardData(user) {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    metrics: {
      fieldCoverage: '87%',
      soilMoisture: '64%',
      activeTasks: '12',
      cropHealth: '93%',
      waterUsage: '1,240L',
      weedDetection: '16 spots',
      alerts: '07',
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/me', (req, res) => {
  users = loadUsers();

  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }

  const user = getUserById(req.session.userId);

  if (!user) {
    return res.status(401).json({ message: 'Session invalid.' });
  }

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  users = loadUsers();

  const user = getUserById(req.session.userId);

  if (!user) {
    return res.status(401).json({ message: 'Session invalid.' });
  }

  return res.json(buildDashboardData(user));
});

app.post('/api/signup', (req, res) => {
  users = loadUsers();

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

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    return res.status(409).json({ message: 'An account already exists with this email.' });
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
  };

  users.push(newUser);
  saveUsers(users);
  users = loadUsers();

  req.session.userId = newUser.id;

  return res.status(201).json({
    message: 'Account created successfully.',
    user: { id: newUser.id, name: newUser.name, email: newUser.email },
  });
});

app.post('/api/login', (req, res) => {
  users = loadUsers();

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((item) => item.email === normalizedEmail);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  req.session.userId = user.id;

  return res.json({
    message: 'Login successful.',
    user: { id: user.id, name: user.name, email: user.email },
  });
});

app.post('/api/logout', (req, res) => {
  if (!req.session) {
    return res.json({ message: 'Already signed out.' });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: 'Unable to sign out right now.' });
    }

    return res.json({ message: 'Signed out successfully.' });
  });
});

function startServer(portIndex = 0) {
  const port = PORTS_TO_TRY[portIndex];
  const server = app.listen(port);

  server.on('listening', () => {
    console.log(`GrowKrishak app running at http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && portIndex < PORTS_TO_TRY.length - 1) {
      console.log(`Port ${port} is busy, trying http://localhost:${PORTS_TO_TRY[portIndex + 1]}...`);
      startServer(portIndex + 1);
      return;
    }

    console.error('Unable to start server:', error);
    process.exit(1);
  });
}

startServer();
