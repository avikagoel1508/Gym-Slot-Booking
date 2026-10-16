const jwt = require('jsonwebtoken');
const { env } = require('../config/env.js');

// Sign a short-lived token that only identifies the user by id.
function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, env.JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { signToken };
