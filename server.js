'use strict';

/**
 * GrowKrishak backend entry point.
 * All Express setup lives in ./src/app; this file only starts
 * the HTTP listener (tries ports 3000-3005 by default).
 *
 *   node server.js            -> auto-pick free port
 *   PORT=3000 node server.js  -> fixed port
 */
const { createApp } = require('./src/app');
const config = require('./src/config');

// Never let a background driver retry (e.g. Mongo) take the whole
// process down: log it and keep serving (DB routes return 503).
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error(
    'Unhandled rejection (server staying up):',
    reason && reason.message ? reason.message : reason
  );
});

const app = createApp();

// In serverless (Vercel) there is no port to listen on — the platform
// invokes the exported app directly. Never call app.listen there:
// it hangs the invocation until the gateway returns 504.
function startServer(portIndex = 0) {
  const port = config.portsToTry[portIndex];
  const server = app.listen(port);

  server.on('listening', () => {
    // eslint-disable-next-line no-console
    console.log(`GrowKrishak app running at http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && portIndex < config.portsToTry.length - 1) {
      // eslint-disable-next-line no-console
      console.log(`Port ${port} is busy, trying http://localhost:${config.portsToTry[portIndex + 1]}...`);
      startServer(portIndex + 1);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('Unable to start server:', error);
    process.exit(1);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

module.exports = app;
