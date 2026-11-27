// AQI Routes
import { Router } from 'express';
import { getCurrent, getDiurnal } from '../controllers/aqiController.js';
import { aqiCacheMiddleware } from '../middleware/cacheMiddleware.js';
import { validateAqiQuery } from '../middleware/validateRequest.js';

const router = Router();

router.get('/current', validateAqiQuery, aqiCacheMiddleware, getCurrent);
router.get('/diurnal', validateAqiQuery, aqiCacheMiddleware, getDiurnal);

export default router;
