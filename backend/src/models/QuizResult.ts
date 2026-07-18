import mongoose, { Schema, Document } from 'mongoose';

export interface IQuizResult extends Document {
  classroomId: mongoose.Types.ObjectId;
  assessmentId: string; // String to support inline quizzes ("inline_<ts>") as well as saved Assessment ids
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  answers: {
    questionId: string;
    prompt?: string;
    correctAnswer?: string;
    studentAnswer: string;
    score: number;
    maxMarks?: number;
    status: 'pending_review' | 'graded';
  }[];
  violations: {
    type: 'fullscreen_exit' | 'tab_switch' | 'blur';
    timestamp: Date;
  }[];
  totalScore: number;
  maxScore: number;
  submittedAt: Date;
}

const QuizResultSchema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
  assessmentId: { type: String, required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  answers: [{
    questionId: { type: String, required: true },
    prompt: { type: String },
    correctAnswer: { type: String },
    studentAnswer: { type: String, required: false, default: '' },
    score: { type: Number, default: 0 },
    maxMarks: { type: Number },
    status: { type: String, enum: ['pending_review', 'graded'], default: 'graded' }
  }],
  violations: [{
    type: { type: String, enum: ['fullscreen_exit', 'tab_switch', 'blur'], required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  totalScore: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IQuizResult>('QuizResult', QuizResultSchema);
