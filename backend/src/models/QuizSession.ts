import mongoose, { Schema, Document } from 'mongoose';

export interface IQuizSession extends Document {
  classroomId: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  status: 'scheduled' | 'live' | 'ended';
  startedAt?: Date;
  durationSec: number;
}

const QuizSessionSchema: Schema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
  status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
  startedAt: { type: Date },
  durationSec: { type: Number, required: true } // Determines the server-side countdown
});

export default mongoose.model<IQuizSession>('QuizSession', QuizSessionSchema);