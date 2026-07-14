import mongoose, { Schema, Document } from 'mongoose';

export interface IClassroom extends Document {
  teacherId: mongoose.Types.ObjectId;
  name: string;
  joinCode: string;
  studentIds: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const ClassroomSchema: Schema = new Schema({
  teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  joinCode: { type: String, required: true, unique: true },
  studentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IClassroom>('Classroom', ClassroomSchema);