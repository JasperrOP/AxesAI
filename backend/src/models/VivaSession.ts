import mongoose, { Schema, Document } from 'mongoose';

export interface IVivaSession extends Document {
  classroomId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  topic: string;
  currentQuestion: string;
  transcript: {
    role: 'agent' | 'student';
    text: string;
    score?: number;
    feedback?: string;
  }[];
  questionCount: number;
  createdAt: Date;
}

const VivaSessionSchema: Schema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // One active viva session per student at a time
  studentName: { type: String, required: true },
  topic: { type: String, required: true },
  currentQuestion: { type: String, required: true },
  transcript: [{
    role: { type: String, enum: ['agent', 'student'], required: true },
    text: { type: String, required: true },
    score: { type: Number },
    feedback: { type: String }
  }],
  questionCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // Auto-expire session after 1 hour
});

export default mongoose.model<IVivaSession>('VivaSession', VivaSessionSchema);
