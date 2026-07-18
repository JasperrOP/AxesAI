import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware.js';
import Assignment from '../models/Assignment.js';
import { aiQueue } from '../queues/aiQueue.js';
import { generateQuestionPaper } from '../services/aiService.js';

interface QuestionTypeConfig {
    type: string;
    count: number;
    marks: number;
}

export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { questionTypes, additionalInstructions, contextText, classroomId } = req.body;

        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        // questionTypes is an array like: [{type: 'mcq', count: 5, marks: 1}, {type: 'short', count: 3, marks: 2}]
        const parsedTypes: QuestionTypeConfig[] = questionTypes || [];
        
        const mcqCount = parsedTypes.find(q => q.type === 'mcq')?.count || 0;
        const shortCount = parsedTypes.find(q => q.type === 'short')?.count || 0;
        const essayCount = parsedTypes.find(q => q.type === 'essay')?.count || 0;

        const totalQuestions = parsedTypes.reduce((sum, q) => sum + q.count, 0);

        // Use a real classroomId if provided, otherwise fallback for testing
        const effectiveClassroomId = classroomId || '000000000000000000000000';

        const newAssignment = await Assignment.create({
            title: additionalInstructions || 'New AI Assessment',
            classroomId: effectiveClassroomId,
            createdBy: req.user.id,
            status: 'pending',
            config: { mcqCount, shortCount, essayCount }
        });

        console.log(`📤 Pushing assignment ${newAssignment._id} to the AI Queue...`);

        await aiQueue.add('generate-paper', {
            assignmentId: newAssignment._id,
            promptData: {
                questionTypes: parsedTypes,
                totalQuestions,
                additionalInstructions,
                contextText
            }
        });

        res.status(202).json({
            message: 'Generation started in the background',
            assignmentId: newAssignment._id
        });

    } catch (error: any) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Failed to create assignment' });
    }
};

export const getAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) {
            res.status(404).json({ success: false, message: 'Assignment not found' });
            return;
        }
        res.status(200).json({ success: true, assignment });
    } catch (error) {
        console.error('Error fetching assignment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getMyAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }
        const assignments = await Assignment.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, assignments });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

import Classroom from '../models/Classroom.js';
import QuizResult from '../models/QuizResult.js';

export const getTeacherSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user || req.user.role !== 'teacher') {
            res.status(403).json({ error: 'Only teachers can access dashboard summary' });
            return;
        }

        const teacherId = req.user.id;

        // Fetch classrooms taught by this teacher
        const classrooms = await Classroom.find({ teacherId });
        const classroomIds = classrooms.map(c => c._id);

        // Fetch assignments created by this teacher
        const assignments = await Assignment.find({ createdBy: teacherId }).sort({ createdAt: -1 });

        // Total assignments graded / results across classrooms
        const totalSubmissions = await QuizResult.countDocuments({ classroomId: { $in: classroomIds } });

        // Assignments reviewed/graded in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const submissionsLast30Days = await QuizResult.countDocuments({
            classroomId: { $in: classroomIds },
            submittedAt: { $gte: thirtyDaysAgo }
        });

        // Time saved calculation (assuming 10 minutes saved per submission graded by AI)
        const totalTimeSavedMinutes = totalSubmissions * 10;
        const timeSavedHours = Math.round((totalTimeSavedMinutes / 60) * 10) / 10;

        // Format recent assignments with student submission progress
        const recentAssignments = await Promise.all(
            assignments.slice(0, 5).map(async (assign) => {
                const classObj = classrooms.find(c => c._id.toString() === assign.classroomId.toString());
                const totalStudents = classObj ? classObj.studentIds.length : 0;
                
                const submissionsCount = await QuizResult.countDocuments({
                    assessmentId: String(assign._id)
                });

                return {
                    _id: assign._id,
                    title: assign.title,
                    status: assign.status,
                    createdAt: assign.createdAt,
                    classroomName: classObj ? classObj.name : 'General',
                    submissionsCount,
                    totalStudents,
                    progressPercent: totalStudents > 0 ? (submissionsCount / totalStudents) * 100 : 0
                };
            })
        );

        res.status(200).json({
            success: true,
            summary: {
                assignmentsReviewed30Days: submissionsLast30Days,
                timeSavedHours,
                totalAssignmentsGraded: totalSubmissions,
                recentAssignments
            }
        });
    } catch (error: any) {
        console.error('Error fetching teacher summary:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
// Synchronously generate MCQ quiz questions (with options + answer key) via AI,
// so the teacher can drop them straight into the Live Quiz Control form.
export const generateInlineQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const { topic, count, contextText } = req.body;
        const n = Math.min(Math.max(parseInt(count, 10) || 5, 1), 15);

        const sections = await generateQuestionPaper({
            additionalInstructions: topic || 'General Academic Quiz',
            questionTypes: [{ type: 'mcq', count: n, marks: 1 }],
            contextText: contextText || ''
        });

        const questions = (sections as any[])
            .flatMap((s: any) => s.questions || [])
            .filter((q: any) => q.type === 'mcq')
            .map((q: any) => {
                const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
                while (opts.length < 4) opts.push('');
                return {
                    prompt: q.prompt || '',
                    options: opts,
                    answerKey: q.answerKey || opts[0] || '',
                    marks: q.marks || 1,
                    difficulty: q.difficulty || 'Moderate'
                };
            });

        res.status(200).json({ questions });
    } catch (error: any) {
        console.error('Error generating inline quiz:', error);
        res.status(500).json({ error: error.message || 'Failed to generate quiz' });
    }
};
