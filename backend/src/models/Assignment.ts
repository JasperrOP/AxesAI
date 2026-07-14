import mongoose, { Schema, Document } from 'mongoose';

// 1. Define TypeScript Interfaces for our data structures
export interface IQuestion {
    text: string;
    difficulty: 'Easy' | 'Moderate' | 'Hard';
    marks: number;
}

export interface ISection {
    title: string;
    instruction: string;
    questions: IQuestion[];
}

export interface IAssignment extends Document {
    dueDate: Date;
    questionTypes: string[];
    totalQuestions: number;
    totalMarks: number;
    additionalInstructions?: string;
    fileUrl?: string; 
    status: 'pending' | 'generating' | 'completed' | 'failed';
    generatedPaper?: ISection[]; 
    createdAt: Date;
}

// 2. Create the Mongoose Schemas
const QuestionSchema = new Schema<IQuestion>({
    text: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Moderate', 'Hard'], required: true },
    marks: { type: Number, required: true }
});

const SectionSchema = new Schema<ISection>({
    title: { type: String, required: true },
    instruction: { type: String, required: true },
    questions: [QuestionSchema]
});

const AssignmentSchema = new Schema<IAssignment>({
    dueDate: { type: Date, required: true },
    questionTypes: [{ type: String, required: true }],
    totalQuestions: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    additionalInstructions: { type: String },
    fileUrl: { type: String }, // For the optional PDF/Image upload
    status: { 
        type: String, 
        enum: ['pending', 'generating', 'completed', 'failed'], 
        default: 'pending' 
    },
    generatedPaper: [SectionSchema], // This will hold the structured AI output
    createdAt: { type: Date, default: Date.now }
});

// 3. Export the model
export default mongoose.model<IAssignment>('Assignment', AssignmentSchema);