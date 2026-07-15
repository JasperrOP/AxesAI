import { Router } from 'express';
import { createClassroom, joinClassroom, getClassrooms } from '../controllers/classroomController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// Secure all classroom routes
router.use(authenticateToken as any);

router.post('/', createClassroom as any);
router.post('/join', joinClassroom as any);
router.get('/', getClassrooms as any);

export default router;
