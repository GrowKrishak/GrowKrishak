'use strict';
// Full backend API test suite (64 checks: auth, 5 CRUD collections,
// dashboard, validation/duplicate/missing cases, logout, admin login
// + user-data management, private-file guard, favicon/robots).
// Usage:
//   npm test                          -> isolated server, default (JSON) mode
//   npm run test:cookie               -> isolated server, cookie-session mode
//   npm run test:mongo                -> isolated server, MongoDB mode (needs MONGODB_URI)
//   npm run test:live                 -> suite only, against a running server
//   npm run test:live -- <url>        -> suite only, custom base URL
//   BASE_URL=<url> npm run test:live
// NOTE: tests create + delete their own records, but signup leaves
// a throwaway user behind — the run-with-server modes use a temp
// DATA_DIR so your real data stays untouched.
const BASE = process.argv[2] || process.env.BASE_URL || 'http://localhost:3210';
let cookie = '';
let pass = 0, fail = 0;

async function req(method, path, body, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const jar = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (jar.length) {
    cookie = jar.map((c) => c.split(';')[0]).join('; ');
  } else {
    const single = res.headers.get('set-cookie');
    if (single && !cookie) cookie = single.split(';')[0];
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data };
}

function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra) : '')); }
}

(async () => {
  const email = 'apitest' + Date.now() + '@example.com';

  let r = await req('GET', '/api/health', undefined, false);
  check('health', r.status === 200 && r.data.status === 'ok', r);

  r = await req('GET', '/api/farmers', undefined, false);
  check('CRUD requires auth (401)', r.status === 401, r.status);

  r = await req('GET', '/data/users.json', undefined, false);
  check('private data file blocked', r.status === 404, r.status);

  r = await req('GET', '/server.js', undefined, false);
  check('server.js blocked', r.status === 404, r.status);

  r = await req('GET', '/.env', undefined, false);
  check('.env blocked', r.status === 404, r.status);

  r = await req('GET', '/api/index.js', undefined, false);
  check('serverless entry source blocked', r.status === 404, r.status);

  check('favicon served (200)', (await fetch(BASE + '/favicon.ico')).status === 200);
  check('robots.txt served (200)', (await fetch(BASE + '/robots.txt')).status === 200);

  r = await req('POST', '/api/signup', { name: 'A', email, password: 'x', confirmPassword: 'y' }, false);
  check('signup rejects mismatched passwords (400)', r.status === 400, r.status);

  r = await req('POST', '/api/signup', { name: 'API Tester', email, password: 'secret123', confirmPassword: 'secret123' }, false);
  check('signup works (201)', r.status === 201 && r.data.user.email === email, r);

  r = await req('GET', '/api/me');
  check('me after signup (200)', r.status === 200 && r.data.email === email, r);

  r = await req('GET', '/api/dashboard');
  check('dashboard (200 + metrics)', r.status === 200 && r.data.metrics && r.data.user.email === email, r.status);

  r = await req('PUT', '/api/me', { name: 'API Tester 2', email });
  check('update profile (200)', r.status === 200 && r.data.user.name === 'API Tester 2', r);

  // CRUD over all 5 collections
  const payloads = {
    farmers: { crud: true, create: { id: 'T-F1', name: 'Test Farmer' }, bad: { id: '', name: '' }, update: { name: 'Renamed' }, q: 'test farmer' },
    crops: { create: { cropType: 'TestCrop', cropHealth: 'Good', requiredMatter: 'Water' }, bad: { cropType: '' }, update: { cropHealth: 'Poor' }, q: 'testcrop' },
    fertilizers: { create: { id: 'T-FT1', name: 'TestFert', price: 100 }, bad: { id: 'x', name: 'y', price: -5 }, update: { price: 200 }, q: 'testfert' },
    schemes: { create: { name: 'TestScheme', description: 'desc' }, bad: { name: '' }, update: { benefits: 'lots' }, q: 'testscheme' },
    soils: { create: { soilType: 'TestSoil', suitableCrops: 'Wheat' }, bad: { soilType: '' }, update: { phRange: '6-7' }, q: 'testsoil' },
  };
  for (const [key, p] of Object.entries(payloads)) {
    r = await req('POST', '/api/' + key, p.bad);
    check(key + ' rejects invalid (400)', r.status === 400, r.status);
    r = await req('POST', '/api/' + key, p.create);
    check(key + ' create (201)', r.status === 201 && r.data.id, r);
    const id = r.data.id;
    const dup = await req('POST', '/api/' + key, { ...p.create, id });
    if (p.create.id) check(key + ' rejects duplicate id (409)', dup.status === 409, dup.status);
    r = await req('GET', '/api/' + key + '?q=' + encodeURIComponent(p.q));
    check(key + ' search (finds 1)', r.status === 200 && r.data.length >= 1, (r.data || []).length);
    r = await req('PUT', '/api/' + key + '/' + encodeURIComponent(id), p.update);
    check(key + ' update (200)', r.status === 200, r);
    r = await req('PUT', '/api/' + key + '/NOPE-123', p.update);
    check(key + ' update missing (404)', r.status === 404, r.status);
    r = await req('DELETE', '/api/' + key + '/' + encodeURIComponent(id));
    check(key + ' delete (200)', r.status === 200, r);
    r = await req('DELETE', '/api/' + key + '/' + encodeURIComponent(id));
    check(key + ' delete missing (404)', r.status === 404, r.status);
  }

  r = await req('GET', '/api/nope');
  check('unknown API 404', r.status === 404, r.status);

  r = await req('POST', '/api/logout');
  check('logout (200)', r.status === 200, r);

  r = await req('GET', '/api/me');
  check('me after logout (401)', r.status === 401, r.status);

  // Main admin flow (separate session, real user-data checks)
  r = await req('GET', '/api/admin/users', undefined, false);
  check('admin users requires auth (401)', r.status === 401, r.status);

  r = await req('POST', '/api/admin/login', { email: 'admin@growkrishak.com', password: 'wrong' }, false);
  check('admin rejects bad password (401)', r.status === 401, r.status);

  r = await req('POST', '/api/admin/login', { email: 'admin@growkrishak.com', password: 'Admin@123' }, false);
  check('admin login works (200)', r.status === 200 && r.data.admin.email === 'admin@growkrishak.com', r);

  r = await req('GET', '/api/admin/me');
  check('admin me (200)', r.status === 200 && r.data.role === 'admin', r);

  r = await req('GET', '/api/admin/stats');
  check('admin stats (counts + recent)', r.status === 200 && typeof r.data.users === 'number' && Array.isArray(r.data.recentUsers), r);

  r = await req('GET', '/api/admin/users?sort=newest');
  check('admin users list (no passwordHash)', r.status === 200 && r.data.total >= 1 && !JSON.stringify(r.data).includes('passwordHash'), (r.data || {}).total);
  const hasDates = (r.data.users || []).every((u) => u.createdAt && u.id && u.email);
  check('admin users have proper saved data (id/email/createdAt)', hasDates, (r.data.users || [])[0]);

  const targetId = (r.data.users || [])[0] && r.data.users[0].id;
  r = await req('GET', '/api/admin/users/' + encodeURIComponent(targetId));
  check('admin single user (200)', r.status === 200 && r.data.id === targetId, r);

  r = await req('PUT', '/api/admin/users/' + encodeURIComponent(targetId), { name: 'Edited By Admin', email: r.data.email, location: 'Test Village' });
  check('admin edit user (200 + location saved)', r.status === 200 && r.data.user.location === 'Test Village', r);

  r = await req('POST', '/api/admin/logout');
  check('admin logout (200)', r.status === 200, r);

  r = await req('GET', '/api/admin/users');
  check('admin users after logout (401)', r.status === 401, r.status);

  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
