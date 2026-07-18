import { Router } from 'express';
import { 
  createClassroom, joinClassroom, getClassrooms, getClassroomAnalytics, 
  searchStudents, getStudentPerformance 
} from '../controllers/classroomController.js';
import { 
  startViva, submitAnswer, getVivaHistory 
} from '../controllers/vivaController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Secure all classroom routes
router.use(authenticateToken as any);

router.post('/', createClassroom as any);
router.post('/join', joinClassroom as any);
router.get('/', getClassrooms as any);
router.get('/students/search', searchStudents as any);
router.get('/students/:studentId/performance', getStudentPerformance as any);
router.get('/:id/analytics', getClassroomAnalytics as any);

// Viva Oral Examination routes
router.post('/viva/start', startViva as any);
router.post('/viva/submit-answer', upload.single('audio'), submitAnswer as any);
router.get('/:classroomId/viva/history', getVivaHistory as any);

export default router;
