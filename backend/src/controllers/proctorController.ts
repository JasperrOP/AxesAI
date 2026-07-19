import { Response } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/authMiddleware.js';
import ProctorEvent from '../models/ProctorEvent.js';
import User from '../models/User.js';
import { io } from '../server.js';

const SNAP_DIR = path.join(process.cwd(), 'uploads', 'proctor');

const saveSnapshot = (dataUrl: string, studentId: string): string | undefined => {
  try {
    if (!dataUrl?.startsWith('data:image')) return undefined;
    if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });
    const base64 = dataUrl.split(',')[1];
    const filename = `${studentId}_${Date.now()}.jpg`;
    fs.writeFileSync(path.join(SNAP_DIR, filename), Buffer.from(base64, 'base64'));
    return `/uploads/proctor/${filename}`;
  } catch (err) {
    console.warn('Failed to save proctor snapshot:', err);
    return undefined;
  }
};

/**
 * POST /api/proctor/check
 * Student's browser sends a webcam frame mid-quiz. We forward it to the Python
 * face-service, and persist + broadcast any integrity violations it reports.
 */
export const proctorCheck = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    const { frame, classroomId, assessmentId } = req.body;
    if (!frame || !classroomId) {
      res.status(400).json({ message: 'frame and classroomId are required' });
      return;
    }

    const user = await User.findById(req.user.id).select('name faceEmbedding');
    const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:8001';

    let analysis: any;
    try {
      const response = await fetch(`${faceServiceUrl}/proctor-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame,
          storedEmbedding: user?.faceEmbedding?.length ? user.faceEmbedding : [],
        }),
      });
      if (!response.ok) throw new Error(`face-service ${response.status}`);
      analysis = await response.json();
    } catch (err: any) {
      // Face service offline — don't break the exam, just report unavailable.
      res.status(200).json({ available: false, reason: err.message, violations: [] });
      return;
    }

    const violations: string[] = analysis.violations || [];
    const saved: any[] = [];

    if (violations.length > 0) {
      const snapshotUrl = saveSnapshot(frame, req.user.id);
      for (const type of violations) {
        const evt = await ProctorEvent.create({
          classroomId,
          assessmentId: assessmentId || 'unknown',
          studentId: req.user.id,
          studentName: user?.name || 'Student',
          type: type as any,
          snapshotUrl,
          faceCount: analysis.faceCount,
        });
        saved.push(evt);
      }

      // Live-alert the teacher watching this classroom
      io.to(`class_${classroomId}`).emit('proctor:alert', {
        studentId: req.user.id,
        studentName: user?.name || 'Student',
        violations,
        faceCount: analysis.faceCount,
        snapshotUrl,
        at: new Date(),
      });
    }

    res.status(200).json({ available: true, ...analysis, logged: saved.length });
  } catch (error: any) {
    console.error('Proctor check failed:', error);
    res.status(500).json({ message: 'Proctor check failed', error: error.message });
  }
};

// GET /api/proctor/report/:classroomId — teacher's integrity report, grouped by student
export const getProctorReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'student') {
      res.status(403).json({ message: 'Only teachers can view proctoring reports' });
      return;
    }
    const classroomId = String(req.params.classroomId);
    if (!mongoose.Types.ObjectId.isValid(classroomId)) {
      res.status(400).json({ message: 'Invalid classroom ID' });
      return;
    }

    const events = await ProctorEvent.find({ classroomId }).sort({ createdAt: -1 }).limit(500);

    const byStudent: Record<string, any> = {};
    for (const e of events) {
      const sid = e.studentId.toString();
      if (!byStudent[sid]) {
        byStudent[sid] = { studentId: sid, studentName: e.studentName, total: 0, counts: {}, events: [] };
      }
      byStudent[sid].total += 1;
      byStudent[sid].counts[e.type] = (byStudent[sid].counts[e.type] || 0) + 1;
      if (byStudent[sid].events.length < 40) {
        byStudent[sid].events.push({
          type: e.type, snapshotUrl: e.snapshotUrl, faceCount: e.faceCount, createdAt: e.createdAt,
        });
      }
    }

    const students = Object.values(byStudent).sort((a: any, b: any) => b.total - a.total);
    // Simple integrity score: 100 minus weighted violations, floored at 0
    students.forEach((s: any) => {
      const weight = (s.counts.multiple_faces || 0) * 12 + (s.counts.identity_mismatch || 0) * 15
        + (s.counts.no_face || 0) * 6 + (s.counts.looking_away || 0) * 3
        + (s.counts.tab_switch || 0) * 8;
      s.integrityScore = Math.max(0, 100 - weight);
    });

    res.status(200).json({ students, totalEvents: events.length });
  } catch (error: any) {
    console.error('Failed to build proctor report:', error);
    res.status(500).json({ message: 'Failed to build proctor report', error: error.message });
  }
};
