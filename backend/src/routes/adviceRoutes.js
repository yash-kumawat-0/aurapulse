// Advice Routes
import { Router } from 'express';
import { generateAdvice } from '../controllers/adviceController.js';
import { adviceLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/generate', adviceLimiter, generateAdvice);

export default router;
