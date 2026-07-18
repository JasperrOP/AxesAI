import { Server, Socket } from 'socket.io';
import QuizSession from '../models/QuizSession.js';
import Message from '../models/Message.js';
import Assignment from '../models/Assignment.js';
import QuizResult from '../models/QuizResult.js';

interface ActiveSession {
  assessmentId: string;
  questions: any[];
  currentIndex: number;
  timeRemaining: number;
  studentAnswers: Record<string, {
    name: string;
    answers: Record<number, string>;
    violations: { type: 'fullscreen_exit' | 'tab_switch' | 'blur'; timestamp: Date }[];
    autoSubmitted?: boolean;
  }>;
}

// In-memory trackers for active quiz sessions and timers
const activeSessions: Record<string, ActiveSession> = {};
const activeTimers: Record<string, ReturnType<typeof setInterval>> = {};

// Live attendance presence: which students are currently connected to each classroom
const roomPresence: Record<string, Record<string, { name: string; socketId: string; joinedAt: Date }>> = {};
const socketMeta: Record<string, { classroomId: string; studentId?: string; role: string; name: string }> = {};

const presenceRoster = (classroomId: string) =>
  Object.entries(roomPresence[classroomId] || {}).map(([studentId, v]) => ({
    studentId,
    name: v.name,
    joinedAt: v.joinedAt,
  }));

export const initSocketConfig = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // 1. Join Classroom Room
    socket.on('room:join', ({ classroomId, role, name, studentId }) => {
      const roomName = `class_${classroomId}`;
      socket.join(roomName);
      console.log(`${name} (${role}) joined room: ${roomName}`);

      // Track presence for live attendance
      socketMeta[socket.id] = { classroomId, studentId, role, name };
      if (role === 'student' && studentId) {
        if (!roomPresence[classroomId]) roomPresence[classroomId] = {};
        roomPresence[classroomId][studentId] = { name, socketId: socket.id, joinedAt: new Date() };
      }
      // Broadcast the updated roster to everyone in the room (teacher dashboard listens)
      io.to(roomName).emit('attendance:update', { classroomId, present: presenceRoster(classroomId) });

      // Notify others in the room
      socket.to(roomName).emit('room:user_joined', { socketId: socket.id, name, role });

      // If a quiz is currently live, send the state to the joining student so they can resume
      const session = activeSessions[classroomId];
      if (session && role === 'student' && studentId) {
        const studentData = session.studentAnswers[studentId];
        const hasViolatedMax = studentData && studentData.violations.length >= 3;

        socket.emit('quiz:started', {
          assessmentId: session.assessmentId,
          currentIndex: session.currentIndex,
          timeRemaining: session.timeRemaining,
          question: {
            prompt: session.questions[session.currentIndex].prompt,
            options: session.questions[session.currentIndex].options,
            type: session.questions[session.currentIndex].type,
            difficulty: session.questions[session.currentIndex].difficulty,
            marks: session.questions[session.currentIndex].marks
          },
          violationCount: studentData ? studentData.violations.length : 0,
          isAutoSubmitted: hasViolatedMax
        });
      }
    });

    // 2. Chat messaging inside classroom
    socket.on('message:send', async ({ classroomId, senderId, senderName, senderRole, content, attachment }) => {
      const roomName = `class_${classroomId}`;
      try {
        const newMessage = await Message.create({
          classroomId,
          senderId,
          senderName,
          senderRole,
          content,
          attachmentUrl: attachment?.url,
          attachmentName: attachment?.name,
        });

        io.to(roomName).emit('message:new', newMessage);
      } catch (err) {
        console.error('Failed to save and broadcast message:', err);
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // 3. Teacher Launches the Quiz
    socket.on('quiz:launch', async ({ classroomId, assessmentId }) => {
      const roomName = `class_${classroomId}`;

      try {
        const assessment = await Assignment.findById(assessmentId);
        if (!assessment || !assessment.generatedPaper || assessment.generatedPaper.length === 0) {
          socket.emit('error', { message: 'Assessment not found or invalid' });
          return;
        }

        const questions = assessment.generatedPaper[0].questions;
        if (!questions || questions.length === 0) {
          socket.emit('error', { message: 'Assessment contains no questions' });
          return;
        }

        const durationSec = questions[0].durationSec || 60;

        let session = await QuizSession.findOne({ classroomId, assessmentId });
        if (!session) {
          session = new QuizSession({ classroomId, assessmentId, durationSec, status: 'live' });
        } else {
          session.status = 'live';
          session.durationSec = durationSec;
        }
        session.startedAt = new Date();
        await session.save();

        // Initialize active session memory
        activeSessions[classroomId] = {
          assessmentId,
          questions,
          currentIndex: 0,
          timeRemaining: durationSec,
          studentAnswers: {}
        };

        // Broadcast to all students in the room
        io.to(roomName).emit('quiz:started', {
          assessmentId,
          currentIndex: 0,
          timeRemaining: durationSec,
          question: {
            prompt: questions[0].prompt,
            options: questions[0].options,
            type: questions[0].type,
            difficulty: questions[0].difficulty,
            marks: questions[0].marks
          }
        });

        // Start server timer
        startServerTimer(io, roomName, classroomId);

      } catch (error) {
        console.error('Failed to launch quiz session:', error);
        socket.emit('error', { message: 'Failed to initialize live session.' });
      }
    });

    // 3b. Teacher Launches Inline Quiz (directly from created questions, no saved assignment)
    socket.on('quiz:launch_inline', async ({ classroomId, questions }) => {
      const roomName = `class_${classroomId}`;

      try {
        if (!questions || questions.length === 0) {
          socket.emit('error', { message: 'No questions provided for inline quiz' });
          return;
        }

        const durationSec = questions[0].durationSec || 60;
        const inlineAssessmentId = `inline_${Date.now()}`;

        let session = await QuizSession.findOne({ classroomId, status: 'live' });
        if (!session) {
          session = new QuizSession({ classroomId, assessmentId: inlineAssessmentId, durationSec, status: 'live' });
        } else {
          session.status = 'live';
          session.durationSec = durationSec;
          session.assessmentId = inlineAssessmentId;
        }
        session.startedAt = new Date();
        await session.save();

        // Initialize active session memory
        activeSessions[classroomId] = {
          assessmentId: inlineAssessmentId,
          questions,
          currentIndex: 0,
          timeRemaining: durationSec,
          studentAnswers: {}
        };

        // Broadcast to all students in the room
        io.to(roomName).emit('quiz:started', {
          assessmentId: inlineAssessmentId,
          currentIndex: 0,
          timeRemaining: durationSec,
          question: {
            prompt: questions[0].prompt,
            options: questions[0].options,
            type: questions[0].type || 'mcq',
            difficulty: questions[0].difficulty || 'Moderate',
            marks: questions[0].marks
          }
        });

        // Start server timer
        startServerTimer(io, roomName, classroomId);

      } catch (error) {
        console.error('Failed to launch inline quiz session:', error);
        socket.emit('error', { message: 'Failed to initialize inline quiz session.' });
      }
    });

    // 4. Student Submits Answer for Current Question
    socket.on('quiz:submit_answer', ({ classroomId, studentId, studentName, questionIndex, answer }) => {
      const session = activeSessions[classroomId];
      if (!session) return;

      if (!session.studentAnswers[studentId]) {
        session.studentAnswers[studentId] = {
          name: studentName,
          answers: {},
          violations: []
        };
      }

      const studentData = session.studentAnswers[studentId];
      if (studentData.autoSubmitted) return;

      studentData.answers[questionIndex] = answer;
    });

    // 5. Student Violates Anti-Cheat
    socket.on('quiz:violation', ({ classroomId, studentId, studentName, type }) => {
      const session = activeSessions[classroomId];
      if (!session) return;

      if (!session.studentAnswers[studentId]) {
        session.studentAnswers[studentId] = {
          name: studentName,
          answers: {},
          violations: []
        };
      }

      const studentData = session.studentAnswers[studentId];
      if (studentData.autoSubmitted) return;

      studentData.violations.push({
        type,
        timestamp: new Date()
      });

      // Send update back to the single student
      socket.emit('quiz:violation_logged', {
        violationCount: studentData.violations.length
      });

      if (studentData.violations.length >= 3) {
        studentData.autoSubmitted = true;
        socket.emit('quiz:auto_submitted', { reason: '3 violations reached' });
      }
    });

    // 6. Teacher Ends Quiz Early
    socket.on('quiz:end_early', async ({ classroomId }) => {
      if (activeTimers[classroomId]) {
        clearInterval(activeTimers[classroomId]);
        delete activeTimers[classroomId];
      }
      const roomName = `class_${classroomId}`;
      await endQuizSession(io, roomName, classroomId);
    });

    // 6b. Teacher requests current attendance roster on demand
    socket.on('attendance:request', ({ classroomId }) => {
      socket.emit('attendance:update', { classroomId, present: presenceRoster(classroomId) });
    });

    // 7. Disconnection clean up
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      const meta = socketMeta[socket.id];
      if (meta) {
        const { classroomId, studentId, role } = meta;
        // Only drop from presence if this exact socket owned the student slot
        if (role === 'student' && studentId && roomPresence[classroomId]?.[studentId]?.socketId === socket.id) {
          delete roomPresence[classroomId][studentId];
          io.to(`class_${classroomId}`).emit('attendance:update', { classroomId, present: presenceRoster(classroomId) });
        }
        delete socketMeta[socket.id];
      }
    });
  });
};

// Tick timer running authoritative countdowns on the server
const startServerTimer = (io: Server, roomName: string, classroomId: string) => {
  if (activeTimers[classroomId]) {
    clearInterval(activeTimers[classroomId]);
  }

  activeTimers[classroomId] = setInterval(async () => {
    const session = activeSessions[classroomId];
    if (!session) {
      clearInterval(activeTimers[classroomId]);
      delete activeTimers[classroomId];
      return;
    }

    session.timeRemaining--;

    if (session.timeRemaining <= 0) {
      session.currentIndex++;

      if (session.currentIndex < session.questions.length) {
        const nextQ = session.questions[session.currentIndex];
        session.timeRemaining = nextQ.durationSec || 60;

        io.to(roomName).emit('quiz:question', {
          currentIndex: session.currentIndex,
          timeRemaining: session.timeRemaining,
          question: {
            prompt: nextQ.prompt,
            options: nextQ.options,
            type: nextQ.type,
            difficulty: nextQ.difficulty,
            marks: nextQ.marks
          }
        });
      } else {
        clearInterval(activeTimers[classroomId]);
        delete activeTimers[classroomId];
        await endQuizSession(io, roomName, classroomId);
      }
    } else {
      io.to(roomName).emit('quiz:tick', {
        timeRemaining: session.timeRemaining,
        currentIndex: session.currentIndex
      });
    }
  }, 1000);
};

// Grade all submissions, save them in MongoDB, rank students, and broadcast scoreboard
const endQuizSession = async (io: Server, roomName: string, classroomId: string) => {
  const session = activeSessions[classroomId];
  if (!session) return;

  try {
    await QuizSession.updateOne(
      { classroomId, status: 'live' },
      { status: 'ended' }
    );

    const scoreboardData = [];

    for (const [studentId, data] of Object.entries(session.studentAnswers)) {
      const studentAnswers = [];
      let totalScore = 0;
      let maxScore = 0;

      for (let i = 0; i < session.questions.length; i++) {
        const question = session.questions[i];
        const studentAns = data.answers[i] || '';
        let score = 0;
        let status: 'graded' | 'pending_review' = 'graded';

        if (question.type === 'mcq') {
          const isCorrect = studentAns.trim().toLowerCase() === (question.answerKey || '').trim().toLowerCase();
          score = isCorrect ? question.marks : 0;
        } else {
          status = 'pending_review';
        }

        totalScore += score;
        maxScore += question.marks || 0;
        studentAnswers.push({
          questionId: question._id?.toString() || String(i),
          prompt: question.prompt || '',
          correctAnswer: question.answerKey || '',
          studentAnswer: studentAns,
          score,
          maxMarks: question.marks || 0,
          status
        });
      }

      await QuizResult.create({
        classroomId,
        assessmentId: session.assessmentId,
        studentId,
        studentName: data.name,
        answers: studentAnswers,
        violations: data.violations,
        totalScore,
        maxScore
      });

      scoreboardData.push({
        studentId,
        name: data.name,
        score: totalScore,
        violationCount: data.violations.length
      });
    }

    // Rank students by score (descending), then violationCount (ascending)
    scoreboardData.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.violationCount - b.violationCount;
    });

    const scoreboardWithRank = scoreboardData.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));

    io.to(roomName).emit('quiz:ended', {
      scoreboard: scoreboardWithRank
    });

    delete activeSessions[classroomId];
    console.log(`Quiz session in room ${roomName} ended, scored, and saved.`);

  } catch (error) {
    console.error('Error closing quiz session:', error);
  }
};