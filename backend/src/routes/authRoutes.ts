import { Router } from 'express';
import { register, login, registerFace, loginWithFace } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/register-face', authenticateToken as any, registerFace as any);
router.post('/login-face', loginWithFace as any);

export default router;
