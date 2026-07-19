import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import { chatWithAssistant } from '../services/aiService.js';

const router = Router();

router.use(authenticateToken as any);

// POST /api/ai-chat — general-purpose AI assistant for teachers & students
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const { messages, userName } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const result = await chatWithAssistant({
      messages,
      role: req.user.role === 'teacher' ? 'teacher' : 'student',
      userName: userName || 'there',
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('AI chat failed:', error);
    res.status(500).json({ error: error.message || 'AI assistant failed' });
  }
});

export default router;
