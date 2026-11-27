// Advice Routes
import { Router } from 'express';
import { generateAdvice, diagnoseSymptom } from '../controllers/adviceController.js';
import { adviceLimiter } from '../middleware/rateLimiter.js';
import { validateAdviceBody } from '../middleware/validateRequest.js';

const router = Router();

router.post('/generate', adviceLimiter, validateAdviceBody, generateAdvice);
router.post('/symptom-check', adviceLimiter, validateAdviceBody, diagnoseSymptom);

export default router;
