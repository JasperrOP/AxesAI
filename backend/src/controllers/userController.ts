import { Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import Classroom from '../models/Classroom.js';
import QuizResult from '../models/QuizResult.js';
import Assignment from '../models/Assignment.js';

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');

const saveAvatar = (dataUrl: string, userId: string): string | undefined => {
  try {
    if (!dataUrl?.startsWith('data:image')) return undefined;
    if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
    const base64 = dataUrl.split(',')[1];
    const filename = `${userId}_${Date.now()}.jpg`;
    fs.writeFileSync(path.join(AVATAR_DIR, filename), Buffer.from(base64, 'base64'));
    return `/uploads/avatars/${filename}`;
  } catch (err) {
    console.warn('Failed to save avatar:', err);
    return undefined;
  }
};

// ---------------- Profile (any signed-in user) ----------------

// GET /api/users/me
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ message: 'Authentication required' }); return; }
    const user = await User.findById(req.user.id).select('name email role avatarUrl createdAt faceEmbedding');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.status(200).json({
      user: {
        _id: user._id, name: user.name, email: user.email, role: user.role,
        avatarUrl: user.avatarUrl, createdAt: user.createdAt,
        faceEnrolled: (user.faceEmbedding?.length || 0) > 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to load profile', error: error.message });
  }
};

// PUT /api/users/me  { name?, avatar? (data URL), currentPassword?, newPassword? }
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ message: 'Authentication required' }); return; }
    const { name, avatar, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    if (typeof name === 'string' && name.trim()) user.name = name.trim();

    if (avatar) {
      const url = saveAvatar(avatar, req.user.id);
      if (url) user.avatarUrl = url;
    }

    if (newPassword) {
      if (!currentPassword) { res.status(400).json({ message: 'Current password is required' }); return; }
      const ok = user.passwordHash ? await bcrypt.compare(currentPassword, user.passwordHash) : false;
      if (!ok) { res.status(400).json({ message: 'Current password is incorrect' }); return; }
      if (String(newPassword).length < 6) { res.status(400).json({ message: 'New password must be at least 6 characters' }); return; }
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.status(200).json({
      message: 'Profile updated',
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

// ---------------- Admin ----------------

const requireAdmin = (req: AuthRequest, res: Response): boolean => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
};

// GET /api/users  ?role=&search=
export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;
    const { role, search } = req.query;
    const filter: any = {};
    if (role && role !== 'all') filter.role = role;
    if (search) {
      const rx = new RegExp(String(search), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const users = await User.find(filter).select('name email role avatarUrl createdAt').sort({ createdAt: -1 }).limit(500);
    res.status(200).json({ users });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to list users', error: error.message });
  }
};

// POST /api/users  { name, email, password, role }
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400).json({ message: 'name, email, password and role are required' });
      return;
    }
    if (!['teacher', 'student', 'admin'].includes(role)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) { res.status(400).json({ message: 'A user with this email already exists' }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role });
    res.status(201).json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
};

// DELETE /api/users/:id
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) { res.status(400).json({ message: 'Invalid user ID' }); return; }
    if (id === req.user!.id) { res.status(400).json({ message: 'You cannot delete your own admin account' }); return; }

    const user = await User.findByIdAndDelete(id);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    // Detach from classrooms so rosters stay clean
    await Classroom.updateMany({ studentIds: id }, { $pull: { studentIds: id } });
    res.status(200).json({ message: 'User removed' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
};

// GET /api/users/admin/stats — school-wide monitoring
export const getAdminStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;

    const [teachers, students, admins, classrooms, assignments, submissions] = await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      Classroom.countDocuments({}),
      Assignment.countDocuments({}),
      QuizResult.countDocuments({}),
    ]);

    const scoreAgg = await QuizResult.aggregate([
      { $group: { _id: null, avg: { $avg: '$totalScore' } } },
    ]);

    const recentUsers = await User.find({}).select('name email role createdAt').sort({ createdAt: -1 }).limit(8);

    const topClassrooms = await Classroom.aggregate([
      { $project: { name: 1, students: { $size: { $ifNull: ['$studentIds', []] } } } },
      { $sort: { students: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      counts: { teachers, students, admins, classrooms, assignments, submissions },
      averageScore: scoreAgg[0]?.avg || 0,
      recentUsers,
      topClassrooms,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to load admin stats', error: error.message });
  }
};
