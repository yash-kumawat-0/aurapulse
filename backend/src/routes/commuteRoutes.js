// Commute Routes
import { Router } from 'express';
import { compareCommutes, multiCompare, calculateMultiLegCommute } from '../controllers/commuteController.js';

const router = Router();

router.post('/compare', compareCommutes);
router.post('/multi-compare', multiCompare);
router.post('/multi-leg', calculateMultiLegCommute);

export default router;
