import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware.js';
import Meeting from '../models/Meeting.js';
import Whiteboard from '../models/Whiteboard.js';
import Classroom from '../models/Classroom.js';

const generateRoomCode = (): string => {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  const part = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part()}-${part()}-${part()}`; // e.g. "axk-9df-mq2"
};

// POST /api/meetings  — teacher starts a meeting for a classroom
export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'teacher') {
      res.status(403).json({ message: 'Only teachers can start a meeting' });
      return;
    }
    const { classroomId, title } = req.body;
    if (!mongoose.Types.ObjectId.isValid(classroomId)) {
      res.status(400).json({ message: 'Valid classroomId is required' });
      return;
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      res.status(404).json({ message: 'Classroom not found' });
      return;
    }

    // Reuse an already-live meeting instead of creating duplicates
    const existing = await Meeting.findOne({ classroomId, status: 'live' });
    if (existing) {
      res.status(200).json({ meeting: existing, reused: true });
      return;
    }

    let roomCode = generateRoomCode();
    while (await Meeting.findOne({ roomCode })) roomCode = generateRoomCode();

    const meeting = await Meeting.create({
      classroomId,
      hostId: req.user.id,
      hostName: (req.user as any).name || 'Teacher',
      title: title || `${classroom.name} — Live Class`,
      roomCode,
      status: 'live',
      participants: [],
    });

    await Whiteboard.create({ meetingId: meeting._id, classroomId, elements: [] });

    res.status(201).json({ meeting });
  } catch (error: any) {
    console.error('Failed to create meeting:', error);
    res.status(500).json({ message: 'Failed to create meeting', error: error.message });
  }
};

// GET /api/meetings/active/:classroomId — is there a live meeting to join?
export const getActiveMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classroomId = String(req.params.classroomId);
    if (!mongoose.Types.ObjectId.isValid(classroomId)) {
      res.status(400).json({ message: 'Invalid classroom ID' });
      return;
    }
    const meeting = await Meeting.findOne({ classroomId, status: 'live' });
    res.status(200).json({ meeting: meeting || null });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch active meeting', error: error.message });
  }
};

// POST /api/meetings/:id/end — host ends the meeting
export const endMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid meeting ID' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (!req.user || meeting.hostId.toString() !== req.user.id) {
      res.status(403).json({ message: 'Only the host can end this meeting' });
      return;
    }
    meeting.status = 'ended';
    meeting.endedAt = new Date();
    await meeting.save();
    res.status(200).json({ meeting });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to end meeting', error: error.message });
  }
};

// GET /api/meetings/classroom/:classroomId — past meetings
export const getMeetingHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classroomId = String(req.params.classroomId);
    if (!mongoose.Types.ObjectId.isValid(classroomId)) {
      res.status(400).json({ message: 'Invalid classroom ID' });
      return;
    }
    const meetings = await Meeting.find({ classroomId }).sort({ startedAt: -1 }).limit(25);
    res.status(200).json({ meetings });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch meetings', error: error.message });
  }
};

// GET /api/meetings/:id/whiteboard — load the saved board
export const getWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid meeting ID' });
      return;
    }
    let board = await Whiteboard.findOne({ meetingId: id });
    if (!board) {
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        res.status(404).json({ message: 'Meeting not found' });
        return;
      }
      board = await Whiteboard.create({ meetingId: id, classroomId: meeting.classroomId, elements: [] });
    }
    res.status(200).json({ whiteboard: board });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch whiteboard', error: error.message });
  }
};

// PUT /api/meetings/:id/whiteboard — persist the board (debounced from the client)
export const saveWhiteboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { elements } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid meeting ID' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    const board = await Whiteboard.findOneAndUpdate(
      { meetingId: id },
      { elements: Array.isArray(elements) ? elements : [], classroomId: meeting.classroomId, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.status(200).json({ whiteboard: board });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to save whiteboard', error: error.message });
  }
};
