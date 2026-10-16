// Wraps async route handlers so a rejected promise is passed to Express's
// error middleware instead of crashing the process.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
