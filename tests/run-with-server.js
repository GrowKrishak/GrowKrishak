'use strict';
// Spins up an isolated server (temp DATA_DIR), waits for health,
// runs the API suite, then shuts everything down.
// Usage: node tests/run-with-server.js [default|cookie|mongo]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const mode = process.argv[2] || 'default';
const PORT = process.env.TEST_PORT || '3210';
const BASE = `http://localhost:${PORT}`;

if (mode === 'mongo' && !process.env.MONGODB_URI) {
  console.error('test:mongo needs MONGODB_URI (Atlas string or local mongod) in env or .env.');
  process.exit(2);
}

const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-test-'));
const env = { ...process.env, PORT, DATA_DIR: tmpData };
if (mode === 'cookie') env.SESSION_STORE = 'cookie';
// default/cookie modes must stay hermetic (isolated JSON in tmp DATA_DIR):
// blank out any local MONGODB_URI so `npm test` never touches the real DB.
// (Empty string, not delete: dotenv won't override a var that already
// exists, so the server stays on the JSON store.) Only `test:mongo`
// intentionally uses MongoDB.
if (mode !== 'mongo') env.MONGODB_URI = '';

const server = spawn(process.execPath, ['server.js'], { env, cwd: ROOT, stdio: 'ignore' });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch (e) {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

function runSuite() {
  return new Promise((resolve) => {
    const t = spawn(process.execPath, ['tests/api.test.js', BASE], {
      env: { ...process.env },
      cwd: ROOT,
      stdio: 'inherit',
    });
    t.on('exit', (code) => resolve(code ?? 1));
  });
}

(async () => {
  let code = 1;
  try {
    console.log(`Starting isolated server (${mode}) on ${PORT}...`);
    if (!(await waitForHealth())) {
      console.error('Server did not become healthy in time.');
    } else {
      code = await runSuite();
    }
  } finally {
    server.kill();
    await sleep(500);
    try {
      if (server.exitCode === null) server.kill('SIGKILL');
    } catch (e) {
      /* already dead */
    }
    fs.rmSync(tmpData, { recursive: true, force: true });
    if (mode === 'mongo' && code === 0) {
      console.log('Note: test:mongo leaves one apitest user in the DB (no delete-user endpoint). Remove users whose email contains "apitest".');
    }
  }
  process.exit(code);
})();
