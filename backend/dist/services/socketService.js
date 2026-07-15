import QuizSession from '../models/QuizSession.js';
// In-memory tracker for active server intervals so we can clear them when the quiz ends
const activeTimers = {};
export const initSocketConfig = (io) => {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
        // 1. Join Classroom Room
        socket.on('room:join', ({ classroomId, role, name }) => {
            const roomName = `class_${classroomId}`;
            socket.join(roomName);
            console.log(`${name} (${role}) joined room: ${roomName}`);
            // Notify others in the room (e.g., updating the teacher's live roster UI)
            socket.to(roomName).emit('room:user_joined', { socketId: socket.id, name, role });
        });
        // 2. Teacher Launches the Quiz
        socket.on('quiz:launch', async ({ classroomId, assessmentId, durationSec }) => {
            const roomName = `class_${classroomId}`;
            try {
                // Initialize or update the session state in MongoDB
                let session = await QuizSession.findOne({ classroomId, assessmentId });
                if (!session) {
                    session = new QuizSession({ classroomId, assessmentId, durationSec, status: 'live' });
                }
                else {
                    session.status = 'live';
                    session.durationSec = durationSec;
                }
                session.startedAt = new Date();
                await session.save();
                // Broadcast to all students in the room to transition their UI to the quiz view
                io.to(roomName).emit('quiz:started', {
                    assessmentId,
                    durationSec,
                    sessionStatus: 'live'
                });
                // Start the server-authoritative countdown loop
                startServerTimer(io, roomName, classroomId, durationSec);
            }
            catch (error) {
                console.error('Failed to launch quiz session:', error);
                socket.emit('error', { message: 'Failed to initialize live session.' });
            }
        });
        // 3. Disconnection clean up
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
};
// Authoritative ticking mechanism running completely on the server
const startServerTimer = (io, roomName, classroomId, duration) => {
    // Clear any existing timer for this classroom to prevent duplicate intervals
    if (activeTimers[classroomId]) {
        clearInterval(activeTimers[classroomId]);
    }
    let timeRemaining = duration;
    activeTimers[classroomId] = setInterval(async () => {
        timeRemaining--;
        if (timeRemaining <= 0) {
            clearInterval(activeTimers[classroomId]);
            delete activeTimers[classroomId];
            // 1. Tell all clients to immediately freeze inputs and auto-submit their forms
            io.to(roomName).emit('quiz:time_up');
            // 2. Persist the ended status to the database
            try {
                await QuizSession.updateOne({ classroomId, status: 'live' }, { status: 'ended' });
            }
            catch (err) {
                console.error('Error auto-closing quiz session in DB:', err);
            }
            console.log(`Quiz in room ${roomName} has naturally concluded.`);
        }
        else {
            // Broadcast the exact current time remaining to everyone in the room every single second
            io.to(roomName).emit('quiz:tick', { timeRemaining });
        }
    }, 1000);
};
