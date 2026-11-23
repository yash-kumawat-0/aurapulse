// ============================================
// API Routes Aggregator
// ============================================
import { Router } from 'express';
import { apiLimiter } from '../middleware/rateLimiter.js';
import aqiRoutes from './aqiRoutes.js';
import familyRoutes from './familyRoutes.js';
import indoorRoutes from './indoorRoutes.js';
import commuteRoutes from './commuteRoutes.js';
import adviceRoutes from './adviceRoutes.js';

const router = Router();

// Apply general rate limiter to all /api/v1 routes
router.use(apiLimiter);

// Mount sub-routers
router.use('/aqi', aqiRoutes);
router.use('/family', familyRoutes);
router.use('/indoor', indoorRoutes);
router.use('/commute', commuteRoutes);
router.use('/advice', adviceRoutes);

export default router;
