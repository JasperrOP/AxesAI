import { create } from 'zustand';

// Match the interfaces from our backend
interface Question {
    text: string;
    difficulty: 'Easy' | 'Moderate' | 'Hard';
    marks: number;
}

interface Section {
    title: string;
    instruction: string;
    questions: Question[];
}

interface AssignmentState {
    // Form Data
    dueDate: string;
    questionTypes: string[];
    totalQuestions: number;
    totalMarks: number;
    additionalInstructions: string;
    
    // Status & Result
    status: 'idle' | 'pending' | 'generating' | 'completed' | 'failed';
    generatedPaper: Section[] | null;
    currentAssignmentId: string | null;

    // Actions
    updateForm: (field: string, value: any) => void;
    setStatus: (status: AssignmentState['status']) => void;
    setResult: (id: string, paper: Section[]) => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
    dueDate: '',
    questionTypes: [],
    totalQuestions: 0,
    totalMarks: 0,
    additionalInstructions: '',
    status: 'idle',
    generatedPaper: null,
    currentAssignmentId: null,

    updateForm: (field, value) => set((state) => ({ ...state, [field]: value })),
    setStatus: (status) => set({ status }),
    setResult: (id, paper) => set({ currentAssignmentId: id, generatedPaper: paper, status: 'completed' }),
}));