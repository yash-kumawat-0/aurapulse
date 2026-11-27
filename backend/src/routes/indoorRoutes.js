// Indoor Air Routes
import { Router } from 'express';
import { simulateIndoorAir } from '../controllers/indoorAirController.js';
import { validateIndoorBody } from '../middleware/validateRequest.js';

const router = Router();

router.post('/simulate', validateIndoorBody, simulateIndoorAir);

export default router;
