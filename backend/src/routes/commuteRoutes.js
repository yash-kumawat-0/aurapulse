// Commute Routes
import { Router } from 'express';
import { compareCommutes, multiCompare } from '../controllers/commuteController.js';

const router = Router();

router.post('/compare', compareCommutes);
router.post('/multi-compare', multiCompare);

export default router;
