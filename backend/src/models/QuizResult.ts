import mongoose, { Schema, Document } from 'mongoose';

export interface IQuizResult extends Document {
  classroomId: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  answers: {
    questionId: string;
    studentAnswer: string;
    score: number;
    status: 'pending_review' | 'graded';
  }[];
  violations: {
    type: 'fullscreen_exit' | 'tab_switch' | 'blur';
    timestamp: Date;
  }[];
  totalScore: number;
  submittedAt: Date;
}

const QuizResultSchema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  answers: [{
    questionId: { type: String, required: true },
    studentAnswer: { type: String, required: false, default: '' },
    score: { type: Number, default: 0 },
    status: { type: String, enum: ['pending_review', 'graded'], default: 'graded' }
  }],
  violations: [{
    type: { type: String, enum: ['fullscreen_exit', 'tab_switch', 'blur'], required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  totalScore: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IQuizResult>('QuizResult', QuizResultSchema);
