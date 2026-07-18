import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// Many ISP/router DNS servers refuse the SRV lookups that mongodb+srv:// requires,
// which surfaces as "querySrv ECONNREFUSED". Point Node's resolver at public DNS
// (Google + Cloudflare) so Atlas SRV records resolve without changing OS settings.
try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
    console.warn('Could not override DNS servers:', (e as Error).message);
}

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI as string);
        console.log(`🌿 MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.error(`❌ Error connecting to MongoDB: ${error.message}`);
        process.exit(1); // Stop the server if the database fails to connect
    }
};