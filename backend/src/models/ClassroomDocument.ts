import mongoose, { Schema, Document } from 'mongoose';

export interface IClassroomDocument extends Document {
  classroomId: mongoose.Types.ObjectId;
  title: string;
  fullText: string;
  pageIndex: any; // Tree structure mapping section headers to summaries & line/paragraph references
  createdAt: Date;
}

const ClassroomDocumentSchema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
  title: { type: String, required: true },
  fullText: { type: String, required: true },
  pageIndex: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IClassroomDocument>('ClassroomDocument', ClassroomDocumentSchema);
