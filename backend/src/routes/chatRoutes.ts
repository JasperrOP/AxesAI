import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware.js';
import Message from '../models/Message.js';

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = 'uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// POST /api/chat/upload - Upload file attachment
router.post('/upload', authenticateToken as any, upload.single('file'), (req: AuthRequest, res): any => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Return relative URL so frontend can load it
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.status(200).json({
      url: fileUrl,
      name: req.file.originalname
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'File upload failed', error: error.message });
  }
});

// GET /api/chat/:classroomId/history - Fetch last 200 messages sorted oldest-first
router.get('/:classroomId/history', authenticateToken as any, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { classroomId } = req.params;
    
    const messages = await Message.find({ classroomId })
      .sort({ createdAt: -1 })
      .limit(200);
      
    // Sort oldest first for chat history rendering
    messages.reverse();
    
    res.status(200).json({ messages });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve message history', error: error.message });
  }
});

export default router;
