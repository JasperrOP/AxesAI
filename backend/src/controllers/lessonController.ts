import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware.js';
import LessonPlan from '../models/LessonPlan.js';
import { generateLessonPlan } from '../services/aiService.js';

export const createLessonPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'teacher') {
      res.status(403).json({ error: 'Only teachers can generate lesson plans' });
      return;
    }

    const { topic, gradeLevel, durationMins, classroomId, contextText } = req.body;
    if (!topic || !String(topic).trim()) {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }

    const plan = await generateLessonPlan({
      topic: String(topic).trim(),
      gradeLevel,
      durationMins: durationMins ? Number(durationMins) : undefined,
      contextText,
    });

    const doc = await LessonPlan.create({
      classroomId: classroomId || undefined,
      createdBy: req.user.id,
      topic: String(topic).trim(),
      gradeLevel,
      durationMins: durationMins ? Number(durationMins) : undefined,
      plan,
    });

    res.status(201).json({ success: true, lessonPlan: doc });
  } catch (error: any) {
    console.error('Failed to create lesson plan:', error);
    res.status(500).json({ error: error.message || 'Failed to create lesson plan' });
  }
};

export const getMyLessonPlans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const plans = await LessonPlan.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, lessonPlans: plans });
  } catch (error: any) {
    console.error('Failed to fetch lesson plans:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch lesson plans' });
  }
};

export const deleteLessonPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    await LessonPlan.deleteOne({ _id: String(req.params.id), createdBy: req.user.id });
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete lesson plan' });
  }
};
