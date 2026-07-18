import mongoose, { Schema, Document } from 'mongoose';

export interface IVivaResult extends Document {
  classroomId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  topic: string;
  score: number;
  maxScore: number;
  transcript: {
    role: 'agent' | 'student';
    text: string;
    score?: number;      // Populated for student answers
    feedback?: string;   // Optional feedback per answer
  }[];
  createdAt: Date;
}

const VivaResultSchema: Schema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  topic: { type: String, required: true },
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  transcript: [{
    role: { type: String, enum: ['agent', 'student'], required: true },
    text: { type: String, required: true },
    score: { type: Number },
    feedback: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IVivaResult>('VivaResult', VivaResultSchema);
