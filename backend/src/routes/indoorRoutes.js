// Indoor Air Routes
import { Router } from 'express';
import { simulateIndoorAir } from '../controllers/indoorAirController.js';

const router = Router();

router.post('/simulate', simulateIndoorAir);

export default router;
