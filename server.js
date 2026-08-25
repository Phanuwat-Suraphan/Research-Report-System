const http = require('node:http');
const db = require('./src/db');
const { seedDefaultSubjects } = require('./src/db/seed');
const { handleRequest } = require('./src/app');
const backup = require('./src/lib/backup');
const { SCHOOL_NAME } = require('./src/lib/config');

const PORT = process.env.PORT || 3000;

// A brand new database gets the standard subject list so the dropdown on the
// submission form is never empty. Once any subject exists this is a no-op.
if (db.prepare('SELECT COUNT(*) AS c FROM subjects').get().c === 0) {
  seedDefaultSubjects();
}

backup.warnIfEphemeral();
backup.scheduleDaily();

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`${SCHOOL_NAME} — ระบบเผยแพร่ผลงานวิจัยและนวัตกรรมครู`);
  console.log(`พร้อมใช้งานที่ http://localhost:${PORT}`);
});

module.exports = server;
