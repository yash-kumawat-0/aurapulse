// ============================================
// Central Error Handler Middleware
// ============================================

/**
 * Catches all unhandled errors from route handlers and returns
 * a consistent JSON error response.
 */
export function errorHandler(err, _req, res, _next) {
  console.error('❌ Unhandled Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

/**
 * Creates a custom error with a status code for use in controllers.
 * @param {string} message - Error message.
 * @param {number} statusCode - HTTP status code.
 * @returns {Error}
 */
export function createApiError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
