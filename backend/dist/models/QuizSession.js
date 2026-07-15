import mongoose, { Schema } from 'mongoose';
const QuizSessionSchema = new Schema({
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
    startedAt: { type: Date },
    durationSec: { type: Number, required: true } // Determines the server-side countdown
});
export default mongoose.model('QuizSession', QuizSessionSchema);
