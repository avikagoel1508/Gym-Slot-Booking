const http = require('node:http');
const { createApp } = require('./app.js');
const { env } = require('./config/env.js');
const { connectDb } = require('./config/db.js');
const { initRealtime } = require('./realtime.js');

// Start order matters: connect to the database first, then start listening.
async function main() {
  await connectDb();

  const app = createApp();
  // Wrap the app in a raw HTTP server so Socket.IO can share the port.
  const server = http.createServer(app);
  initRealtime(server);

  server.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
