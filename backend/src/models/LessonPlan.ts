import mongoose, { Schema, Document } from 'mongoose';

export interface ILessonPlan extends Document {
  classroomId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  topic: string;
  gradeLevel?: string;
  durationMins?: number;
  plan: any; // structured JSON from the AI
  createdAt: Date;
}

const LessonPlanSchema: Schema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: String, required: true },
  gradeLevel: { type: String },
  durationMins: { type: Number },
  plan: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ILessonPlan>('LessonPlan', LessonPlanSchema);
