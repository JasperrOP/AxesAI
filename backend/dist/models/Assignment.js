import mongoose, { Schema } from 'mongoose';
const AssessmentSchema = new Schema({
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    config: {
        mcqCount: { type: Number, default: 0 },
        shortCount: { type: Number, default: 0 },
        essayCount: { type: Number, default: 0 },
    },
    generatedPaper: [{
            title: String,
            instruction: String,
            questions: [{
                    type: { type: String, enum: ['mcq', 'short', 'essay'], required: true },
                    prompt: { type: String, required: true },
                    options: [String],
                    answerKey: { type: String, required: true },
                    difficulty: { type: String, enum: ['Easy', 'Moderate', 'Hard'], default: 'Moderate' },
                    marks: { type: Number, required: true }
                }]
        }],
    createdAt: { type: Date, default: Date.now }
});
export default mongoose.model('Assessment', AssessmentSchema);
