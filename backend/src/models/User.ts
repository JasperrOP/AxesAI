import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string; // Optional because FaceID might skip standard passwords later
  role: 'teacher' | 'student';
  faceEmbedding?: number[]; // Array of floats from the FastAPI Python microservice
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  faceEmbedding: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>('User', UserSchema);