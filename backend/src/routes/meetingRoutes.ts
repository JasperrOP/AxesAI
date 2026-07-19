import { Router } from 'express';
import {
  createMeeting, getActiveMeeting, endMeeting, getMeetingHistory,
  getWhiteboard, saveWhiteboard,
} from '../controllers/meetingController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticateToken as any);

router.post('/', createMeeting as any);
router.get('/active/:classroomId', getActiveMeeting as any);
router.get('/classroom/:classroomId', getMeetingHistory as any);
router.post('/:id/end', endMeeting as any);
router.get('/:id/whiteboard', getWhiteboard as any);
router.put('/:id/whiteboard', saveWhiteboard as any);

export default router;
