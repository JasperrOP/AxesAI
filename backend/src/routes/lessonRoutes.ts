import { Router } from 'express';
import { createLessonPlan, getMyLessonPlans, deleteLessonPlan } from '../controllers/lessonController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticateToken as any);
router.post('/', createLessonPlan as any);
router.get('/', getMyLessonPlans as any);
router.delete('/:id', deleteLessonPlan as any);

export default router;
