const mongoose = require('mongoose');
const { env } = require('./env.js');

// Connect to MongoDB. We wait for the connection before the server starts
// listening, so we never serve requests without a database.
async function connectDb(uri = env.MONGO_URI) {
  // Fail fast (5s) instead of hanging for 30s when the DB is unreachable.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB');
  return mongoose.connection;
}

module.exports = { connectDb };
