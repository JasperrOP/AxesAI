import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  classroomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: 'teacher' | 'student';
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, enum: ['teacher', 'student'], required: true },
  content: { type: String, default: '' },
  attachmentUrl: { type: String },
  attachmentName: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Create index for fast message history retrieval sorted by createdAt
MessageSchema.index({ classroomId: 1, createdAt: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
