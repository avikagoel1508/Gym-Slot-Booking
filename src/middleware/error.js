// Central place that turns errors into clean JSON responses.
// Every response error looks like: { error: { code, message } }

// Runs when no route matched the request.
function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
}

// Express calls this whenever a route calls next(err) or throws.
// Must keep all 4 arguments so Express recognises it as an error handler.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Invalid JSON in the request body.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
    });
  }

  // A duplicate value from MongoDB (e.g. an email that already exists).
  if (err && err.code === 11000) {
    return res.status(409).json({
      error: { code: 'DUPLICATE', message: 'That record already exists.' },
    });
  }

  // A Mongoose schema validation error.
  if (err && err.name === 'ValidationError') {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed.' },
    });
  }

  // A malformed MongoDB id like /sessions/abc.
  if (err && err.name === 'CastError') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Resource not found.' },
    });
  }

  // Errors we throw on purpose carry a numeric status and a string code,
  // so it is safe to show their message to the client.
  const isAppError = err && err.status && typeof err.code === 'string';

  // Log the full error on the server for debugging.
  console.error(err);

  // Unexpected errors: log everything, but never leak details to the client.
  if (!isAppError) {
    return res.status(500).json({
      error: { code: 'INTERNAL', message: 'Something went wrong.' },
    });
  }

  return res.status(err.status).json({ error: { code: err.code, message: err.message } });
}

module.exports = { notFoundHandler, errorHandler };
