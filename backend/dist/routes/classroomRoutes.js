import { Router } from 'express';
import { createClassroom, joinClassroom, getClassrooms } from '../controllers/classroomController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
const router = Router();
// Secure all classroom routes
router.use(authenticateToken);
router.post('/', createClassroom);
router.post('/join', joinClassroom);
router.get('/', getClassrooms);
export default router;
