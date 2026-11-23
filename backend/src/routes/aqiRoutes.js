// AQI Routes
import { Router } from 'express';
import { getCurrent, getDiurnal } from '../controllers/aqiController.js';
import { aqiCacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = Router();

router.get('/current', aqiCacheMiddleware, getCurrent);
router.get('/diurnal', aqiCacheMiddleware, getDiurnal);

export default router;
