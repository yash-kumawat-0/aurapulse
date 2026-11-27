// Advice Routes
import { Router } from 'express';
import { generateAdvice, diagnoseSymptom } from '../controllers/adviceController.js';
import { adviceLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/generate', adviceLimiter, generateAdvice);
router.post('/symptom-check', adviceLimiter, diagnoseSymptom);

export default router;
