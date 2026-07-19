import { Router } from 'express';
import { proctorCheck, getProctorReport } from '../controllers/proctorController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticateToken as any);

router.post('/check', proctorCheck as any);
router.get('/report/:classroomId', getProctorReport as any);

export default router;
