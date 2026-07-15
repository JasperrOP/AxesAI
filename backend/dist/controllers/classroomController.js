import Classroom from '../models/Classroom.js';
const generateJoinCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};
export const createClassroom = async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create classroom', error: error.message });
    }
};
export const joinClassroom = async (req, res) => {
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
        const isAlreadyMember = classroom.studentIds.some((id) => id.toString() === studentId);
        if (isAlreadyMember) {
            res.status(400).json({ message: 'You have already joined this classroom' });
            return;
        }
        classroom.studentIds.push(studentId);
        await classroom.save();
        res.status(200).json({
            message: 'Joined classroom successfully',
            classroom,
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to join classroom', error: error.message });
    }
};
export const getClassrooms = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }
        let classrooms;
        if (req.user.role === 'teacher') {
            classrooms = await Classroom.find({ teacherId: req.user.id }).populate('studentIds', 'name email');
        }
        else {
            classrooms = await Classroom.find({ studentIds: req.user.id }).populate('teacherId', 'name email');
        }
        res.status(200).json({ classrooms });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch classrooms', error: error.message });
    }
};
