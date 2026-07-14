import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Connect to local Redis 
const redisConnection = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null // Required specifically by BullMQ
});

redisConnection.on('connect', () => {
    console.log('📦 Redis Connected for Background Jobs');
});

export default redisConnection;