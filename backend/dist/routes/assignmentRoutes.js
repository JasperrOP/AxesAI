import { Router } from 'express';
import { createAssignment, getAssignment, getMyAssignments } from '../controllers/assignmentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
const router = Router();
router.post('/create', authenticateToken, createAssignment);
router.get('/my', authenticateToken, getMyAssignments);
router.get('/:id', getAssignment);
export default router;
