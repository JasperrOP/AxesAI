import { Queue, Worker, Job } from 'bullmq';
import redisConnection from '../config/redis.js';
import Assignment from '../models/Assignment.js';
import { io } from '../server.js'; // Bring in our WebSocket to notify the frontend

const QUEUE_NAME = 'ai-generation-queue';

// 1. Create the Queue (The waiting line for jobs)
export const aiQueue = new Queue(QUEUE_NAME, { connection: redisConnection as any });
// 2. Create the Worker (The engine that processes the line)
const worker = new Worker(QUEUE_NAME, async (job: Job) => {
    const { assignmentId, promptData } = job.data;
    console.log(`🤖 Processing AI Job for Assignment: ${assignmentId}`);

    try {
        // TODO: We will add the actual LLM API call here in the next steps!
        
        // For now, let's simulate the AI taking 5 seconds to think
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Update the database to show the paper is generated
        await Assignment.findByIdAndUpdate(assignmentId, { status: 'completed' });

        // Ping the frontend via WebSocket that this specific assignment is ready!
        io.emit(`assignment-complete-${assignmentId}`, { 
            status: 'success', 
            message: 'Paper successfully generated!' 
        });

        console.log(`✅ Job ${job.id} completed successfully!`);

    } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error);
        
        // If the AI fails, update the DB and notify the user
        await Assignment.findByIdAndUpdate(assignmentId, { status: 'failed' });
        io.emit(`assignment-complete-${assignmentId}`, { status: 'failed' });
    }
}, { connection: redisConnection as any });

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
});