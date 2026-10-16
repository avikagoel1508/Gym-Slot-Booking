require('dotenv/config'); // read .env into process.env before we read values

// One central place for configuration, so the rest of the app never
// touches process.env directly.
const env = {
  PORT: Number(process.env.PORT) || 4444,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gym_slots',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  CAPACITY: 20, // mat count per session (fixed by the gym)
};

module.exports = { env };
