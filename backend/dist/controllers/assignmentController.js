import Assignment from '../models/Assignment.js';
import { aiQueue } from '../queues/aiQueue.js';
export const createAssignment = async (req, res) => {
    try {
        const { questionTypes, additionalInstructions, contextText, classroomId } = req.body;
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        // questionTypes is an array like: [{type: 'mcq', count: 5, marks: 1}, {type: 'short', count: 3, marks: 2}]
        const parsedTypes = questionTypes || [];
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
    }
    catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Failed to create assignment' });
    }
};
export const getAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) {
            res.status(404).json({ success: false, message: 'Assignment not found' });
            return;
        }
        res.status(200).json({ success: true, assignment });
    }
    catch (error) {
        console.error('Error fetching assignment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
export const getMyAssignments = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }
        const assignments = await Assignment.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, assignments });
    }
    catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
