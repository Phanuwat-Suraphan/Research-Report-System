const http = require('node:http');
const { handleRequest } = require('./src/app');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`Research Report System listening on http://localhost:${PORT}`);
});
