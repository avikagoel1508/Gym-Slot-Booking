const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { env } = require('./config/env.js');

// Thin wrapper around Socket.IO. Whenever a session's seat count changes the
// API calls emitSeatUpdate(), and every open page updates itself.
let io = null;

// Read a single cookie value from the raw Cookie header.
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// Attach Socket.IO to the HTTP server and verify the connection's token.
function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, methods: ['GET', 'POST'], credentials: true },
  });

  // Reject connections without a valid token. The token comes from the
  // handshake (API clients) or the login cookie (the web pages).
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        readCookie(socket.handshake.headers.cookie, 'token');
      const payload = jwt.verify(token, env.JWT_SECRET);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Let clients subscribe to one session's live updates.
    socket.on('session:subscribe', (sessionId) => {
      if (typeof sessionId === 'string' && sessionId) {
        socket.join(`session:${sessionId}`);
      }
    });
    socket.on('session:unsubscribe', (sessionId) => {
      socket.leave(`session:${sessionId}`);
    });
  });

  return io;
}

// Tell every connected browser about a session's latest seat numbers.
function emitSeatUpdate(payload) {
  if (!io) return;
  io.emit('session:update', payload);
}

module.exports = { initRealtime, emitSeatUpdate };
