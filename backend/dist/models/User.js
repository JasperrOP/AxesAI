import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    role: { type: String, enum: ['teacher', 'student'], required: true },
    faceEmbedding: { type: [Number], default: [] },
    createdAt: { type: Date, default: Date.now }
});
export default mongoose.model('User', UserSchema);
