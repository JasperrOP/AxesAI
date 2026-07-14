import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import './queues/aiQueue.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import { initSocketConfig } from './services/socketService.js'; // Add this at the top
import documentRoutes from './routes/documentRoutes.js';
// Load environment variables
dotenv.config();
connectDB();


const app = express();
const PORT = process.env.PORT || 5000;
// Load environment variables

// Connect to the database

// ... rest of the code
// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // Our Next.js frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use('/api/assignments', assignmentRoutes);
app.use('/api/documents', documentRoutes);
// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO on top of the HTTP server
export const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

// Listen for real-time WebSocket connections
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});
initSocketConfig(io);
// Basic Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'AxesAI Backend is running!' });
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});