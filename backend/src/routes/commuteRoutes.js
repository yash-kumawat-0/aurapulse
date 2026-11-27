// Commute Routes
import { Router } from 'express';
import {
  compareCommutes,
  multiCompare,
  calculateMultiLegCommute,
  getOriginCommuteBrief,
} from '../controllers/commuteController.js';
import { validateLocationBriefBody } from '../middleware/validateRequest.js';

const router = Router();

router.post('/location-brief', validateLocationBriefBody, getOriginCommuteBrief);
router.post('/compare', compareCommutes);
router.post('/multi-compare', multiCompare);
router.post('/multi-leg', calculateMultiLegCommute);

export default router;
