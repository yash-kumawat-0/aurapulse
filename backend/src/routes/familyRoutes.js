// Family Routes
import { Router } from 'express';
import { getFamilyMembers, addFamilyMember, deleteFamilyMember } from '../controllers/familyController.js';

const router = Router();

router.get('/', getFamilyMembers);
router.post('/', addFamilyMember);
router.delete('/:id', deleteFamilyMember);

export default router;
