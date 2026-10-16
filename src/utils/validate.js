const { AppError, errors } = require('./errors.js');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Throw a 422 when a validation rule fails. Used inside route handlers.
function fail(message, code = 'VALIDATION_ERROR') {
  throw new AppError(422, code, message);
}

// Require every listed field to be a non-empty string.
function requireString(body, field, label = field) {
  const value = body && body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} is required.`, 'REQUIRED');
  }
  return value.trim();
}

module.exports = { fail, requireString, EMAIL_RE };
