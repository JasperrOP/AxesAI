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
  totalQuestions: number;
  totalMarks: number;
  additionalInstructions: string;
  contextText: string; // <-- Add this
  status: 'idle' | 'generating' | 'completed' | 'failed';
  generatedPaper: any;
  updateForm: (field: string, value: any) => void;
  setStatus: (status: any) => void;
  setResult: (id: string, paper: any) => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  totalQuestions: 0,
  totalMarks: 0,
  additionalInstructions: '',
  contextText: '', // <-- Initialize it
  status: 'idle',
  generatedPaper: null,
  updateForm: (field, value) => set((state) => ({ ...state, [field]: value })),
  setStatus: (status) => set({ status }),
  setResult: (id, paper) => set({ status: 'completed', generatedPaper: paper }),
}));