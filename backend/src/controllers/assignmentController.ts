import { Request, Response } from 'express';
import Assignment from '../models/Assignment.js';
import { aiQueue } from '../queues/aiQueue.js';

export const createAssignment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { dueDate, questionTypes, totalQuestions, totalMarks, additionalInstructions } = req.body;

        // 1. Save the initial assignment to MongoDB
        const newAssignment = await Assignment.create({
            dueDate,
            questionTypes,
            totalQuestions,
            totalMarks,
            additionalInstructions,
            status: 'pending'
        });

        // 2. Add the generation job to the Redis Queue
        // We pass the database ID so the background worker knows which record to update
        await aiQueue.add('generate-paper', {
            assignmentId: newAssignment._id,
            promptData: { questionTypes, totalQuestions, totalMarks, additionalInstructions }
        });

        // 3. Immediately respond to the frontend (don't wait for the AI!)
        res.status(201).json({
            success: true,
            message: 'Assignment created and added to generation queue.',
            assignmentId: newAssignment._id
        });

    } catch (error: any) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ success: false, message: 'Server error while creating assignment' });
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