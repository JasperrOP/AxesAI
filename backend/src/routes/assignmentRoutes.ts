import { Router } from 'express';
import { createAssignment, getAssignment, getMyAssignments, getTeacherSummary, generateInlineQuiz } from '../controllers/assignmentController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/create', authenticateToken as any, createAssignment as any);
router.post('/generate-quiz', authenticateToken as any, generateInlineQuiz as any);
router.get('/my', authenticateToken as any, getMyAssignments as any);
router.get('/teacher-summary', authenticateToken as any, getTeacherSummary as any);
router.get('/:id', getAssignment as any);

export default router;