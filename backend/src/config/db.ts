import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI as string);
        console.log(`🌿 MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.error(`❌ Error connecting to MongoDB: ${error.message}`);
        process.exit(1); // Stop the server if the database fails to connect
    }
};