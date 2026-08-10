const http = require('node:http');
const db = require('./src/db');
const { seedDemoUsers } = require('./src/db/seed');
const { handleRequest } = require('./src/app');

const PORT = process.env.PORT || 3000;

// On a brand new database (fresh install / fresh persistent disk on a host
// like Render) seed demo accounts automatically so there is no separate
// manual step required before first login. Once any user exists, this is a
// no-op forever — set AUTO_SEED_DEMO=false to disable it outright.
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0 && process.env.AUTO_SEED_DEMO !== 'false') {
  seedDemoUsers();
}

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`Research Report System listening on http://localhost:${PORT}`);
});
