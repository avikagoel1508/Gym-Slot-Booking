// AppError is an error we throw on purpose, carrying an HTTP status and a
// short machine-readable code. The error middleware knows these are safe to
// show to the client.

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Ready-made errors for the common cases.
const errors = {
  badRequest: (msg = 'Bad request.', code = 'BAD_REQUEST') =>
    new AppError(400, code, msg),
  unauthenticated: (msg = 'You must be logged in.') =>
    new AppError(401, 'UNAUTHENTICATED', msg),
  forbidden: (msg = 'You are not allowed to do this.') =>
    new AppError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Not found.', code = 'NOT_FOUND') =>
    new AppError(404, code, msg),
  conflict: (msg, code = 'CONFLICT') => new AppError(409, code, msg),
  unprocessable: (msg = 'Validation failed.', code = 'VALIDATION_ERROR') =>
    new AppError(422, code, msg),
};

module.exports = { AppError, errors };
