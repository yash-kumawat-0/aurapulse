// ============================================
// Central Error Handler Middleware
// ============================================

/**
 * Catches all unhandled errors from route handlers and returns
 * a safe, consistent JSON error response.
 */
export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  if (!isTest && (!isProd || statusCode >= 500)) {
    console.error('❌ API Error:', err.message);
  }
  if (!isTest && !isProd && err.stack) {
    console.error(err.stack);
  }

  const safeMessage =
    isProd && statusCode >= 500 ? 'Internal Server Error' : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message: safeMessage,
      ...(!isProd && err.stack && { stack: err.stack }),
    },
  });
}

/**
 * Creates a custom error with an explicit HTTP status code.
 *
 * @param {string} message - User-safe validation or API error message.
 * @param {number} [statusCode=400] - HTTP status code.
 * @returns {Error & { statusCode: number }}
 */
export function createApiError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
