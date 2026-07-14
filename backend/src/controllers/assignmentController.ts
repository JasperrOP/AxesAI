import { Request, Response } from 'express';
import Assignment from '../models/Assignment.js';
import { aiQueue } from '../queues/aiQueue.js';

// Replace your existing createAssignment function with this:
export const createAssignment = async (req: any, res: any) => {
    try {
        const { totalQuestions, additionalInstructions } = req.body;

        // Hardcoding these for testing so Mongoose validation passes
        const tempClassroomId = "67890abcdef1234567890abc"; 
        const tempUserId = "1234567890abcdef12345678";

        const newAssignment = await Assignment.create({
            title: "New AI Assessment", // Added this
            classroomId: tempClassroomId, // Added this
            createdBy: tempUserId,        // Added this
            config: {
                mcqCount: Math.floor(totalQuestions * 0.6),
                shortCount: totalQuestions - Math.floor(totalQuestions * 0.6),
                essayCount: 0
            }
        });

        res.status(201).json({ assignmentId: newAssignment._id });
    } catch (error) {
        console.error("Error creating assignment:", error);
        res.status(500).json({ error: "Failed to create assignment" });
    }
};
export const getAssignment = async (req: Request, res: Response): Promise<void> => {
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