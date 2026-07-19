import mongoose, { Schema, Document } from 'mongoose';

export type ProctorViolation =
  | 'no_face'
  | 'multiple_faces'
  | 'looking_away'
  | 'identity_mismatch'
  | 'tab_switch'
  | 'fullscreen_exit';

export interface IProctorEvent extends Document {
  classroomId: mongoose.Types.ObjectId;
  assessmentId: string;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  type: ProctorViolation;
  /** Relative URL of the snapshot saved at the moment of the violation. */
  snapshotUrl?: string;
  faceCount?: number;
  createdAt: Date;
}

const ProctorEventSchema: Schema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  assessmentId: { type: String, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentName: { type: String, required: true },
  type: {
    type: String,
    enum: ['no_face', 'multiple_faces', 'looking_away', 'identity_mismatch', 'tab_switch', 'fullscreen_exit'],
    required: true,
  },
  snapshotUrl: { type: String },
  faceCount: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IProctorEvent>('ProctorEvent', ProctorEventSchema);
