// ============================================
// Rate Limiter Middleware
// ============================================
import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter: 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests. Please try again later.' },
  },
});

/**
 * Stricter limiter for Gemini advice endpoint: 20 requests per 15 min.
 * Protects against API cost spikes.
 */
export const adviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'AI advice rate limit exceeded. Please wait a few minutes.' },
  },
});
