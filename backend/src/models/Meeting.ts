import mongoose, { Schema, Document } from 'mongoose';

export interface IMeeting extends Document {
  classroomId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  hostName: string;
  title: string;
  roomCode: string;
  status: 'live' | 'ended';
  startedAt: Date;
  endedAt?: Date;
  participants: {
    userId: mongoose.Types.ObjectId;
    name: string;
    role: 'teacher' | 'student';
    joinedAt: Date;
  }[];
}

const MeetingSchema: Schema = new Schema({
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  hostName: { type: String, required: true },
  title: { type: String, default: 'Class Meeting' },
  roomCode: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['live', 'ended'], default: 'live', index: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  participants: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    role: { type: String, enum: ['teacher', 'student'] },
    joinedAt: { type: Date, default: Date.now },
  }],
});

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
