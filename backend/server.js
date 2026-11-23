// ============================================
// AuraPulse — Express Server Entry Point
// ============================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './src/middleware/errorHandler.js';
import apiRoutes from './src/routes/apiRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// --- Core Middleware ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
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

// --- Central Error Handler ---
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🌬️  AuraPulse API running on http://localhost:${PORT}`);
});

export default app;
