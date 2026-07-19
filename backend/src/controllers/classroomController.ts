import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware.js';
import Classroom from '../models/Classroom.js';

const generateJoinCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ message: 'Classroom name is required' });
      return;
    }

    if (!req.user || req.user.role !== 'teacher') {
      res.status(403).json({ message: 'Only teachers can create classrooms' });
      return;
    }

    let joinCode = generateJoinCode();
    let codeExists = await Classroom.findOne({ joinCode });
    while (codeExists) {
      joinCode = generateJoinCode();
      codeExists = await Classroom.findOne({ joinCode });
    }

    const classroom = await Classroom.create({
      name: name.trim(),
      teacherId: req.user.id,
      joinCode,
      studentIds: [],
    });

    res.status(201).json({
      message: 'Classroom created successfully',
      classroom,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create classroom', error: error.message });
  }
};

export const joinClassroom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) {
      res.status(400).json({ message: 'Join code is required' });
      return;
    }

    if (!req.user || req.user.role !== 'student') {
      res.status(403).json({ message: 'Only students can join classrooms' });
      return;
    }

    const classroom = await Classroom.findOne({ joinCode: joinCode.trim().toUpperCase() });
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found with this code' });
      return;
    }

    const studentId = req.user.id;
    const isAlreadyMember = classroom.studentIds.some(
      (id) => id.toString() === studentId
    );

    if (isAlreadyMember) {
      res.status(400).json({ message: 'You have already joined this classroom' });
      return;
    }

    classroom.studentIds.push(studentId as any);
    await classroom.save();

    res.status(200).json({
      message: 'Joined classroom successfully',
      classroom,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to join classroom', error: error.message });
  }
};

export const getClassrooms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    let classrooms;
    if (req.user.role === 'teacher') {
      classrooms = await Classroom.find({ teacherId: req.user.id }).populate('studentIds', 'name email');
    } else {
      classrooms = await Classroom.find({ studentIds: req.user.id }).populate('teacherId', 'name email');
    }

    res.status(200).json({ classrooms });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch classrooms', error: error.message });
  }
};

import mongoose from 'mongoose';
import QuizResult from '../models/QuizResult.js';

export const getClassroomAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid classroom ID' });
      return;
    }

    const classroom = await Classroom.findById(id);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found' });
      return;
    }

    const totalStudents = classroom.studentIds.length;

    // Aggregation to get stats
    const stats = await QuizResult.aggregate([
      { $match: { classroomId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$totalScore' },
          minScore: { $min: '$totalScore' },
          maxScore: { $max: '$totalScore' },
          allScores: { $push: '$totalScore' },
          totalSubmissions: { $sum: 1 }
        }
      }
    ]);

    const resultStats = stats[0] || {
      avgScore: 0,
      minScore: 0,
      maxScore: 0,
      allScores: [],
      totalSubmissions: 0
    };

    // Calculate median
    const sortedScores = (resultStats.allScores || []).sort((a: number, b: number) => a - b);
    let median = 0;
    if (sortedScores.length > 0) {
      const mid = Math.floor(sortedScores.length / 2);
      median = sortedScores.length % 2 !== 0 ? sortedScores[mid] : (sortedScores[mid - 1] + sortedScores[mid]) / 2;
    }

    // Grade Band Segmentation (assuming total points scale of 10 for basic quizzes; otherwise scale percentage out of 10 if needed)
    // Let's segment by percentage if possible, but since totalScore is absolute, let's look at the distribution of scores directly:
    // Strong: >= 8, Average: 5-7, At-Risk: < 5
    const strongCount = sortedScores.filter((s: number) => s >= 8).length;
    const avgCount = sortedScores.filter((s: number) => s >= 5 && s < 8).length;
    const atRiskCount = sortedScores.filter((s: number) => s < 5).length;

    // Trend quiz-by-quiz
    const trend = await QuizResult.aggregate([
      { $match: { classroomId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: '$assessmentId',
          avgScore: { $avg: '$totalScore' },
          submittedAt: { $first: '$submittedAt' }
        }
      },
      { $sort: { submittedAt: 1 } }
    ]);

    res.status(200).json({
      classroomName: classroom.name,
      totalStudents,
      totalSubmissions: resultStats.totalSubmissions,
      submissionRate: totalStudents > 0 ? (resultStats.totalSubmissions / totalStudents) * 100 : 0,
      averageScore: resultStats.avgScore,
      medianScore: median,
      lowestScore: resultStats.minScore,
      topScore: resultStats.maxScore,
      gradeBands: {
        strong: strongCount,
        average: avgCount,
        atRisk: atRiskCount
      },
      trend: trend.map((t, idx) => ({
        quizName: `Quiz ${idx + 1}`,
        avgScore: t.avgScore
      }))
    });
  } catch (error: any) {
    console.error('Failed to generate classroom analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
};

import User from '../models/User.js';

export const searchStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'teacher') {
      res.status(403).json({ message: 'Only teachers can search students' });
      return;
    }

    const { query } = req.query;
    const regex = new RegExp(String(query || ''), 'i');

    // Find classrooms taught by this teacher
    const classrooms = await Classroom.find({ teacherId: req.user.id });
    const uniqueStudentIds = Array.from(
      new Set(classrooms.flatMap((c) => c.studentIds.map((id) => id.toString())))
    );

    // Search matches within those student IDs
    const students = await User.find({
      _id: { $in: uniqueStudentIds },
      $or: [
        { name: regex },
        { email: regex }
      ]
    }).select('name email');

    res.status(200).json({ students });
  } catch (error: any) {
    console.error('Failed to search students:', error);
    res.status(500).json({ message: 'Failed to search students', error: error.message });
  }
};

export const getStudentPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = String(req.params.studentId);
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      res.status(400).json({ message: 'Invalid student ID' });
      return;
    }

    const student = await User.findById(studentId).select('name email');
    if (!student) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }

    // Fetch quiz results
    const results = await QuizResult.find({ studentId }).sort({ submittedAt: 1 });

    const totalQuizzes = results.length;
    const totalScore = results.reduce((sum, r) => sum + r.totalScore, 0);
    const averageScore = totalQuizzes > 0 ? totalScore / totalQuizzes : 0;

    const submissions = results.map((r, idx) => ({
      quizName: `Quiz ${idx + 1}`,
      score: r.totalScore,
      violations: r.violations.length,
      submittedAt: r.submittedAt,
      feedback: r.answers.map(ans => ans.studentAnswer).join('; ') || 'Submitted answer sheet.'
    }));

    res.status(200).json({
      student,
      averageScore,
      totalQuizzes,
      submissions
    });
  } catch (error: any) {
    console.error('Failed to fetch student performance:', error);
    res.status(500).json({ message: 'Failed to fetch student performance', error: error.message });
  }
};

import { analyzeLearningGaps } from '../services/aiService.js';

// Gradebook: per-student performance rows for a classroom (for CSV/PDF export)
export const getGradebook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid classroom ID' });
      return;
    }
    const classroom = await Classroom.findById(id).populate('studentIds', 'name email');
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found' });
      return;
    }

    const results = await QuizResult.find({ classroomId: new mongoose.Types.ObjectId(id) }).sort({ submittedAt: 1 });

    // Group results by student
    const byStudent: Record<string, any> = {};
    for (const r of results) {
      const sid = r.studentId.toString();
      if (!byStudent[sid]) byStudent[sid] = { name: r.studentName, quizzes: [], totalScore: 0, totalMax: 0 };
      const max = r.maxScore || r.answers.reduce((s, a) => s + (a.maxMarks || 0), 0);
      byStudent[sid].quizzes.push({ score: r.totalScore, max, submittedAt: r.submittedAt });
      byStudent[sid].totalScore += r.totalScore;
      byStudent[sid].totalMax += max;
    }

    const rows = (classroom.studentIds as any[]).map((stu: any) => {
      const agg = byStudent[stu._id.toString()];
      const quizzesTaken = agg ? agg.quizzes.length : 0;
      const pct = agg && agg.totalMax > 0 ? Math.round((agg.totalScore / agg.totalMax) * 100) : 0;
      return {
        studentId: stu._id,
        name: stu.name,
        email: stu.email,
        quizzesTaken,
        totalScore: agg ? agg.totalScore : 0,
        totalMax: agg ? agg.totalMax : 0,
        averagePercent: pct,
        grade: pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 50 ? 'C' : quizzesTaken > 0 ? 'D' : '—',
      };
    });

    res.status(200).json({ classroomName: classroom.name, rows });
  } catch (error: any) {
    console.error('Failed to build gradebook:', error);
    res.status(500).json({ message: 'Failed to build gradebook', error: error.message });
  }
};

// AI Insights: learning gaps + recommended actions from quiz performance
export const getClassroomInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid classroom ID' });
      return;
    }
    const classroom = await Classroom.findById(id);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found' });
      return;
    }

    const results = await QuizResult.find({ classroomId: new mongoose.Types.ObjectId(id) });
    if (results.length === 0) {
      res.status(200).json({ learningGaps: [], recommendedActions: [], hasData: false });
      return;
    }

    // Aggregate miss-rate per question prompt
    const qMap: Record<string, { prompt: string; wrong: number; total: number }> = {};
    const studentAgg: Record<string, { name: string; score: number; max: number }> = {};
    for (const r of results) {
      const sid = r.studentId.toString();
      if (!studentAgg[sid]) studentAgg[sid] = { name: r.studentName, score: 0, max: 0 };
      for (const a of r.answers) {
        if (!a.prompt) continue;
        const key = a.prompt.trim().toLowerCase();
        if (!qMap[key]) qMap[key] = { prompt: a.prompt, wrong: 0, total: 0 };
        qMap[key].total += 1;
        if ((a.score || 0) <= 0) qMap[key].wrong += 1;
        studentAgg[sid].score += a.score || 0;
        studentAgg[sid].max += a.maxMarks || 0;
      }
    }

    const questionStats = Object.values(qMap)
      .map((q) => ({ prompt: q.prompt, missRate: q.total > 0 ? Math.round((q.wrong / q.total) * 100) : 0 }))
      .sort((a, b) => b.missRate - a.missRate)
      .slice(0, 12);

    const studentStats = Object.values(studentAgg).map((s) => ({
      name: s.name,
      avgPercent: s.max > 0 ? Math.round((s.score / s.max) * 100) : 0,
    }));

    if (questionStats.length === 0) {
      res.status(200).json({ learningGaps: [], recommendedActions: [], hasData: false });
      return;
    }

    const insights = await analyzeLearningGaps({ classroomName: classroom.name, questionStats, studentStats });
    res.status(200).json({ ...insights, hasData: true });
  } catch (error: any) {
    console.error('Failed to build insights:', error);
    res.status(500).json({ message: 'Failed to build insights', error: error.message });
  }
};

import VivaResult from '../models/VivaResult.js';

// A student's own consolidated grades — quiz results + viva results across all classes.
export const getMyGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    const studentId = req.user.id;

    const results = await QuizResult.find({ studentId }).sort({ submittedAt: 1 });
    const vivas = await VivaResult.find({ studentId }).sort({ createdAt: 1 });

    const totalQuizzes = results.length;
    const averageScore = totalQuizzes > 0 ? results.reduce((s, r) => s + r.totalScore, 0) / totalQuizzes : 0;
    const bestScore = totalQuizzes > 0 ? Math.max(...results.map(r => r.totalScore)) : 0;

    const quizzes = results.map((r, i) => ({
      name: `Quiz ${i + 1}`,
      score: r.totalScore,
      violations: r.violations.length,
      submittedAt: r.submittedAt,
    }));

    const vivaList = vivas.map(v => ({
      topic: v.topic,
      score: v.score,
      maxScore: v.maxScore,
      createdAt: v.createdAt,
    }));

    res.status(200).json({ averageScore, totalQuizzes, bestScore, quizzes, vivas: vivaList });
  } catch (error: any) {
    console.error('Failed to fetch my grades:', error);
    res.status(500).json({ message: 'Failed to fetch grades', error: error.message });
  }
};
