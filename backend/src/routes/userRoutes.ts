import { Router } from 'express';
import {
  getProfile, updateProfile, listUsers, createUser, deleteUser, getAdminStats,
} from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticateToken as any);

// Profile (any signed-in user)
router.get('/me', getProfile as any);
router.put('/me', updateProfile as any);

// Admin only
router.get('/admin/stats', getAdminStats as any);
router.get('/', listUsers as any);
router.post('/', createUser as any);
router.delete('/:id', deleteUser as any);

export default router;
