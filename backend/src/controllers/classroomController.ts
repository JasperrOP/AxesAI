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
    const { id } = req.params;
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
    const { studentId } = req.params;
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
