// ============================================
// AuraPulse — Express Server Entry Point
// ============================================
import './src/config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './src/middleware/errorHandler.js';
import apiRoutes from './src/routes/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Required behind Render / Vercel / Railway / Cloudflare reverse proxies
app.set('trust proxy', 1);

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

if (process.env.VERCEL_URL) {
  configuredOrigins.push(`https://${process.env.VERCEL_URL}`);
}

const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

// --- Core Middleware ---
app.use(
  cors((req, callback) => {
    const origin = req.header('Origin');

    // Allow curl, healthchecks, and same-navigation requests with no Origin header
    if (!origin) {
      return callback(null, { origin: true, credentials: true });
    }

    // Automatically allow same-origin browser requests (e.g. unified full-stack deploy)
    try {
      if (new URL(origin).host === req.get('host')) {
        return callback(null, { origin: true, credentials: true });
      }
    } catch {
      return callback(new Error('Invalid Origin header'));
    }

    const allowed =
      configuredOrigins.includes('*') ||
      configuredOrigins.includes(origin) ||
      (process.env.NODE_ENV !== 'production' && devOrigins.includes(origin));

    return callback(allowed ? null : new Error('Origin not allowed by CORS'), {
      origin: allowed,
      credentials: true,
    });
  }),
);
app.use(express.json());

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'aurapulse-api',
    timestamp: new Date().toISOString(),
  });
});

// --- API Routes ---
app.use('/api/v1', apiRoutes);

// Explicit JSON 404 for unknown API paths before SPA fallback
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'API route not found' },
  });
});

// --- Production Static Frontend Serving ---
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
const frontendIndexHtml = path.join(frontendDistPath, 'index.html');

if (!process.env.VERCEL && fs.existsSync(frontendIndexHtml)) {
  app.use(express.static(frontendDistPath));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(frontendIndexHtml);
  });
}

// --- Central Error Handler ---
app.use(errorHandler);

// --- Start Server (skipped inside serverless runtimes such as Vercel) ---
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🌬️  AuraPulse API running on http://localhost:${PORT}`);
  });
}

export default app;
