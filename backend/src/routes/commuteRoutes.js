// Commute Routes
import { Router } from 'express';
import {
  compareCommutes,
  multiCompare,
  calculateMultiLegCommute,
  getOriginCommuteBrief,
} from '../controllers/commuteController.js';
import { validateLocationBriefBody, validateCommutePayload } from '../middleware/validateRequest.js';

const router = Router();

router.post('/location-brief', validateLocationBriefBody, getOriginCommuteBrief);
router.post('/compare', validateCommutePayload, compareCommutes);
router.post('/multi-compare', validateCommutePayload, multiCompare);
router.post('/multi-leg', validateCommutePayload, calculateMultiLegCommute);

export default router;
