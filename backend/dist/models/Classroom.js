import mongoose, { Schema } from 'mongoose';
const ClassroomSchema = new Schema({
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    joinCode: { type: String, required: true, unique: true },
    studentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});
export default mongoose.model('Classroom', ClassroomSchema);
