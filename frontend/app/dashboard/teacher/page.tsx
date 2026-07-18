'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../../../components/GlassPanel';
import { GlassButton } from '../../../components/GlassButton';
import { 
  Plus, Users, LogOut, BookOpen, FilePlus, Copy, Check, Sparkles, 
  LayoutDashboard, FileText, Settings, Library, Wrench, ChevronRight,
  Upload, Loader2, X, Minus, CheckCircle2, Download, UploadCloud, Camera, Play,
  Trash2, StickyNote, Save, FileQuestion, BookOpenCheck, UserCheck, FileSpreadsheet,
  Target, Lightbulb, GraduationCap
} from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { io, Socket } from 'socket.io-client';
import FaceCapture from '../../../components/FaceCapture';
import ClassroomChat from '../../../components/ClassroomChat';
import { ThemeToggle } from '../../../components/ThemeToggle';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line
} from 'recharts';

// ============ Types ============
interface QuestionTypeRow {
  id: string;
  type: string;
  count: number;
  marks: number;
}

interface InlineQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerKey: string;
  marks: number;
  durationSec: number;
}

const QUESTION_TYPE_OPTIONS = [
  { value: 'mcq', label: 'Multiple Choice Questions' },
  { value: 'short', label: 'Short Questions' },
  { value: 'essay', label: 'Essay / Long Answer' },
  { value: 'numerical', label: 'Numerical Problems' },
  { value: 'diagram', label: 'Diagram/Graph-Based Questions' },
];

type View = 'home' | 'classrooms' | 'assignments' | 'create-assignment' | 'view-paper' | 'ai-grading' | 'lesson-planner' | 'attendance' | 'gradebook';

export default function TeacherDashboard() {
  const router = useRouter();
  const [teacherName, setTeacherName] = useState('');
  const [activeView, setActiveView] = useState<View>('home');
  
  // Classrooms
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [newClassroomName, setNewClassroomName] = useState('');
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<any>(null);

  // Face Login Setup state
  const [isFaceSetupOpen, setIsFaceSetupOpen] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [faceSuccess, setFaceSuccess] = useState('');
  
  // Assignments
  const [assignments, setAssignments] = useState<any[]>([]);
  const [viewingPaper, setViewingPaper] = useState<any>(null);
  
  // Live Quiz State
  const [liveQuizActive, setLiveQuizActive] = useState(false);
  const [liveQuizQuestionIndex, setLiveQuizQuestionIndex] = useState(0);
  const [liveQuizTimeRemaining, setLiveQuizTimeRemaining] = useState(0);
  const [liveQuizScoreboard, setLiveQuizScoreboard] = useState<any[] | null>(null);

  // Inline Quiz Creator State
  const [inlineQuizQuestions, setInlineQuizQuestions] = useState<InlineQuizQuestion[]>([
    { id: '1', prompt: '', options: ['', '', '', ''], answerKey: '', marks: 1, durationSec: 60 }
  ]);

  // AI Quiz Generation State
  const [aiQuizTopic, setAiQuizTopic] = useState('');
  const [aiQuizCount, setAiQuizCount] = useState(5);
  const [isGeneratingAIQuiz, setIsGeneratingAIQuiz] = useState(false);
  const [aiQuizError, setAiQuizError] = useState('');

  // Classroom Notes State
  const [classroomNotes, setClassroomNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  // Classroom Analytics State
  const [classroomAnalytics, setClassroomAnalytics] = useState<any>(null);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);

  // Create Assignment Form
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeRow[]>([
    { id: '1', type: 'mcq', count: 5, marks: 1 },
    { id: '2', type: 'short', count: 3, marks: 2 },
  ]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [contextText, setContextText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // AI Grading state
  const [gradingQuestion, setGradingQuestion] = useState('');
  const [gradingRubric, setGradingRubric] = useState('Accuracy: 5 marks, Clarity: 5 marks');
  const [gradingFile, setGradingFile] = useState<File | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<any>(null);
  const [gradingError, setGradingError] = useState('');

  // Student Search + Performance state
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null); // null = not searching, [] = searched, no matches
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudentPerf, setSelectedStudentPerf] = useState<any>(null);
  const [isFetchingStudentPerf, setIsFetchingStudentPerf] = useState(false);

  // Home Dashboard Summary state
  const [homeSummary, setHomeSummary] = useState<any>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);

  // Classroom documents states
  const [classroomDoc, setClassroomDoc] = useState<any>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');

  // Spoken Viva history states
  const [vivaHistory, setVivaHistory] = useState<any[]>([]);
  const [selectedVivaReview, setSelectedVivaReview] = useState<any>(null);

  // AI Lesson Planner state
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonGrade, setLessonGrade] = useState('');
  const [lessonDuration, setLessonDuration] = useState(45);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [lessonError, setLessonError] = useState('');
  const [lessonPlans, setLessonPlans] = useState<any[]>([]);
  const [activeLessonPlan, setActiveLessonPlan] = useState<any>(null);

  // Attendance state
  const [attendanceClassroom, setAttendanceClassroom] = useState<any>(null);
  const [presentRoster, setPresentRoster] = useState<any[]>([]);

  // Gradebook state
  const [gradebookClassroom, setGradebookClassroom] = useState<any>(null);
  const [gradebook, setGradebook] = useState<any>(null);
  const [isFetchingGradebook, setIsFetchingGradebook] = useState(false);

  // Analytics AI insights state
  const [insights, setInsights] = useState<any>(null);
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!token || !userString) { router.push('/'); return; }
    const user = JSON.parse(userString);
    if (user.role !== 'teacher') { router.push('/dashboard/student'); return; }
    setTeacherName(user.name);
    
    socketRef.current = io('http://localhost:5001');
    
    fetchClassrooms();
    fetchAssignments();
    
    return () => { socketRef.current?.disconnect(); };
  }, []);

  // Listen for classroom specific live quiz events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedClassroom) {
      setLiveQuizActive(false);
      setLiveQuizScoreboard(null);
      return;
    }

    const userString = localStorage.getItem('user');
    let teacherNameVal = '';
    if (userString) {
      teacherNameVal = JSON.parse(userString).name;
    }

    socket.emit('room:join', {
      classroomId: selectedClassroom._id,
      role: 'teacher',
      name: teacherNameVal
    });

    socket.on('quiz:started', (data: any) => {
      setLiveQuizActive(true);
      setLiveQuizQuestionIndex(data.currentIndex);
      setLiveQuizTimeRemaining(data.timeRemaining);
      setLiveQuizScoreboard(null);
    });

    socket.on('quiz:question', (data: any) => {
      setLiveQuizQuestionIndex(data.currentIndex);
      setLiveQuizTimeRemaining(data.timeRemaining);
    });

    socket.on('quiz:tick', (data: any) => {
      setLiveQuizTimeRemaining(data.timeRemaining);
    });

    socket.on('quiz:ended', (data: any) => {
      setLiveQuizActive(false);
      setLiveQuizScoreboard(data.scoreboard);
    });

    return () => {
      socket.off('quiz:started');
      socket.off('quiz:question');
      socket.off('quiz:tick');
      socket.off('quiz:ended');
    };
  }, [selectedClassroom]);

  const handleLaunchQuiz = (assessmentId: string) => {
    if (!selectedClassroom || !socketRef.current) return;
    socketRef.current.emit('quiz:launch', {
      classroomId: selectedClassroom._id,
      assessmentId
    });
  };

  const handleEndQuizEarly = () => {
    if (!selectedClassroom || !socketRef.current) return;
    socketRef.current.emit('quiz:end_early', {
      classroomId: selectedClassroom._id
    });
  };

  // ============ Inline Quiz Handlers ============
  const addInlineQuestion = () => {
    setInlineQuizQuestions(prev => [...prev, {
      id: Date.now().toString(),
      prompt: '',
      options: ['', '', '', ''],
      answerKey: '',
      marks: 1,
      durationSec: 60
    }]);
  };

  const removeInlineQuestion = (id: string) => {
    if (inlineQuizQuestions.length <= 1) return;
    setInlineQuizQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateInlineQuestion = (id: string, field: keyof InlineQuizQuestion, value: any) => {
    setInlineQuizQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const updateInlineOption = (questionId: string, optionIndex: number, value: string) => {
    setInlineQuizQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q;
      const newOptions = [...q.options];
      newOptions[optionIndex] = value;
      return { ...q, options: newOptions };
    }));
  };

  const handleLaunchInlineQuiz = () => {
    if (!selectedClassroom || !socketRef.current) return;
    const valid = inlineQuizQuestions.every(q => 
      q.prompt.trim() && q.options.every(o => o.trim()) && q.answerKey.trim()
    );
    if (!valid) {
      alert('Please fill in all questions, options, and correct answers before launching.');
      return;
    }
    const questions = inlineQuizQuestions.map(q => ({
      type: 'mcq',
      prompt: q.prompt,
      options: q.options,
      answerKey: q.answerKey,
      marks: q.marks,
      durationSec: q.durationSec,
      difficulty: 'Moderate'
    }));
    socketRef.current.emit('quiz:launch_inline', {
      classroomId: selectedClassroom._id,
      questions
    });
  };

  const resetInlineQuiz = () => {
    setInlineQuizQuestions([
      { id: '1', prompt: '', options: ['', '', '', ''], answerKey: '', marks: 1, durationSec: 60 }
    ]);
  };

  // ============ AI Quiz Generation ============
  const handleGenerateAIQuiz = async () => {
    setAiQuizError('');
    setIsGeneratingAIQuiz(true);
    try {
      const notes = selectedClassroom ? (localStorage.getItem(`notes_${selectedClassroom._id}`) || '') : '';
      const res = await axios.post('http://localhost:5001/api/assignments/generate-quiz', {
        topic: aiQuizTopic || 'General Academic Quiz',
        count: aiQuizCount,
        contextText: notes
      }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });

      const generated = res.data.questions || [];
      if (generated.length === 0) {
        setAiQuizError('AI returned no questions. Try a more specific topic.');
        return;
      }

      setInlineQuizQuestions(generated.map((q: any, idx: number) => ({
        id: `${Date.now()}_${idx}`,
        prompt: q.prompt,
        options: q.options && q.options.length === 4 ? q.options : ['', '', '', ''],
        answerKey: q.answerKey,
        marks: q.marks || 1,
        durationSec: 60
      })));
    } catch (err: any) {
      setAiQuizError(err.response?.data?.error || 'Failed to generate quiz. Is the backend running?');
    } finally {
      setIsGeneratingAIQuiz(false);
    }
  };

  // ============ Notes Handlers ============
  // Load notes when classroom changes
  useEffect(() => {
    if (selectedClassroom) {
      const saved = localStorage.getItem(`notes_${selectedClassroom._id}`);
      setClassroomNotes(saved || '');
      setNotesSaved(false);
    }
  }, [selectedClassroom]);

  const handleSaveNotes = () => {
    if (!selectedClassroom) return;
    localStorage.setItem(`notes_${selectedClassroom._id}`, classroomNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  // Fetch classroom analytics
  const fetchClassroomAnalytics = async (classroomId: string) => {
    setIsFetchingAnalytics(true);
    try {
      const res = await axios.get(`http://localhost:5001/api/classrooms/${classroomId}/analytics`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setClassroomAnalytics(res.data);
      fetchInsights(classroomId);
    } catch (err) {
      console.error('Failed to fetch classroom analytics:', err);
    } finally {
      setIsFetchingAnalytics(false);
    }
  };

  const fetchClassroomDoc = async (classroomId: string) => {
    try {
      const res = await axios.get(`http://localhost:5001/api/documents/classroom-doc/${classroomId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setClassroomDoc(res.data.doc);
    } catch (err) {
      console.error('Failed to fetch classroom document:', err);
    }
  };

  const handleUploadDoc = async (file: File) => {
    if (!selectedClassroom) return;
    setIsUploadingDoc(true);
    setDocUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('classroomId', selectedClassroom._id);

    try {
      const res = await axios.post('http://localhost:5001/api/documents/upload-classroom-doc', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${getToken()}`
        }
      });
      setClassroomDoc({
        title: res.data.title,
        pageIndex: res.data.pageIndex
      });
    } catch (err: any) {
      setDocUploadError(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const fetchVivaHistory = async (classroomId: string) => {
    try {
      const res = await axios.get(`http://localhost:5001/api/classrooms/${classroomId}/viva/history`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setVivaHistory(res.data.results);
    } catch (err) {
      console.error('Failed to fetch viva history:', err);
    }
  };

  // Fetch analytics, doc and viva history on selected classroom change
  useEffect(() => {
    if (selectedClassroom) {
      fetchClassroomAnalytics(selectedClassroom._id);
      fetchClassroomDoc(selectedClassroom._id);
      fetchVivaHistory(selectedClassroom._id);
    }
  }, [selectedClassroom]);

  // Debounced server-side student search (indexed, across all the teacher's classrooms)
  useEffect(() => {
    const q = studentSearchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await axios.get(`http://localhost:5001/api/classrooms/students/search`, {
          params: { query: q },
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        setSearchResults(res.data.students || []);
      } catch (err) {
        console.error('Failed to search students:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [studentSearchQuery]);

  const fetchStudentPerformance = async (studentId: string) => {
    setIsFetchingStudentPerf(true);
    try {
      const res = await axios.get(`http://localhost:5001/api/classrooms/students/${studentId}/performance`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setSelectedStudentPerf(res.data);
    } catch (err) {
      console.error('Failed to fetch student performance:', err);
    } finally {
      setIsFetchingStudentPerf(false);
    }
  };

  const fetchHomeSummary = async () => {
    setIsFetchingSummary(true);
    try {
      const res = await axios.get('http://localhost:5001/api/assignments/teacher-summary', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setHomeSummary(res.data.summary);
    } catch (err) {
      console.error('Failed to fetch home summary:', err);
    } finally {
      setIsFetchingSummary(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
    fetchAssignments();
    fetchHomeSummary();
  }, []);

  // Fetch summary when activeView switches to 'home'
  useEffect(() => {
    if (activeView === 'home') {
      fetchHomeSummary();
    }
  }, [activeView]);

  // Animate content on view change
  useEffect(() => {
    if (mainContentRef.current) {
      gsap.fromTo(mainContentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [activeView]);

  const getToken = () => localStorage.getItem('token') || '';

  // ============ AI Lesson Planner ============
  const fetchLessonPlans = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/lessons', { headers: { Authorization: `Bearer ${getToken()}` } });
      setLessonPlans(res.data.lessonPlans || []);
    } catch (err) { console.error('Failed to fetch lesson plans:', err); }
  };

  const handleGenerateLesson = async () => {
    if (!lessonTopic.trim()) { setLessonError('Please enter a topic.'); return; }
    setIsGeneratingLesson(true);
    setLessonError('');
    try {
      const res = await axios.post('http://localhost:5001/api/lessons', {
        topic: lessonTopic, gradeLevel: lessonGrade, durationMins: lessonDuration,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      setActiveLessonPlan(res.data.lessonPlan);
      setLessonPlans((prev) => [res.data.lessonPlan, ...prev]);
      setLessonTopic('');
    } catch (err: any) {
      setLessonError(err.response?.data?.error || 'Failed to generate lesson plan.');
    } finally { setIsGeneratingLesson(false); }
  };

  const handleDeleteLesson = async (id: string) => {
    try {
      await axios.delete(`http://localhost:5001/api/lessons/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setLessonPlans((prev) => prev.filter((p) => p._id !== id));
      if (activeLessonPlan?._id === id) setActiveLessonPlan(null);
    } catch (err) { console.error('Failed to delete lesson plan:', err); }
  };

  // ============ Attendance ============
  const openAttendance = (classroom: any) => {
    setAttendanceClassroom(classroom);
    setPresentRoster([]);
    const socket = socketRef.current;
    if (socket) {
      socket.emit('room:join', { classroomId: classroom._id, role: 'teacher', name: teacherName });
      socket.emit('attendance:request', { classroomId: classroom._id });
    }
  };

  // ============ Gradebook ============
  const fetchGradebook = async (classroom: any) => {
    setGradebookClassroom(classroom);
    setIsFetchingGradebook(true);
    setGradebook(null);
    try {
      const res = await axios.get(`http://localhost:5001/api/classrooms/${classroom._id}/gradebook`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setGradebook(res.data);
    } catch (err) { console.error('Failed to fetch gradebook:', err); }
    finally { setIsFetchingGradebook(false); }
  };

  const exportGradebookCSV = () => {
    if (!gradebook) return;
    const header = ['Name', 'Email', 'Quizzes Taken', 'Total Score', 'Total Max', 'Average %', 'Grade'];
    const lines = gradebook.rows.map((r: any) => [r.name, r.email, r.quizzesTaken, r.totalScore, r.totalMax, r.averagePercent, r.grade].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gradebook_${gradebook.classroomName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportGradebookPDF = async () => {
    if (!gradebook) return;
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Gradebook — ${gradebook.classroomName}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 25);
    autoTable(doc, {
      startY: 30,
      head: [['Name', 'Email', 'Quizzes', 'Score', 'Max', 'Avg %', 'Grade']],
      body: gradebook.rows.map((r: any) => [r.name, r.email, r.quizzesTaken, r.totalScore, r.totalMax, `${r.averagePercent}%`, r.grade]),
      headStyles: { fillColor: [39, 39, 42] },
    });
    doc.save(`gradebook_${gradebook.classroomName}.pdf`);
  };

  // ============ Analytics AI insights ============
  const fetchInsights = async (classroomId: string) => {
    setIsFetchingInsights(true);
    setInsights(null);
    try {
      const res = await axios.get(`http://localhost:5001/api/classrooms/${classroomId}/insights`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setInsights(res.data);
    } catch (err) { console.error('Failed to fetch insights:', err); }
    finally { setIsFetchingInsights(false); }
  };

  useEffect(() => {
    if (activeView === 'lesson-planner') fetchLessonPlans();
  }, [activeView]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = (data: any) => {
      if (attendanceClassroom && data.classroomId === attendanceClassroom._id) {
        setPresentRoster(data.present || []);
      }
    };
    socket.on('attendance:update', handler);
    return () => { socket.off('attendance:update', handler); };
  }, [attendanceClassroom]);

  const fetchClassrooms = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/classrooms', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setClassrooms(res.data.classrooms);
    } catch (err) { console.error(err); }
  };

  const handleRegisterFace = async (frames: string[]) => {
    setFaceError('');
    setFaceSuccess('');
    try {
      await axios.post('http://localhost:5001/api/auth/register-face', 
        { frames }, 
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setFaceSuccess('Face login registered successfully!');
      setTimeout(() => {
        setIsFaceSetupOpen(false);
        setFaceSuccess('');
      }, 1500);
    } catch (err: any) {
      setFaceError(err.response?.data?.message || 'Failed to set up face login.');
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/assignments/my', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setAssignments(res.data.assignments || []);
    } catch (err) { console.error(err); }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassroomName.trim()) return;
    setLoading(true);
    try {
      await axios.post('http://localhost:5001/api/classrooms', 
        { name: newClassroomName },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setNewClassroomName('');
      setIsClassroomModalOpen(false);
      fetchClassrooms();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create classroom.');
    } finally { setLoading(false); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ============ Question Type Row Handlers ============
  const addQuestionType = () => {
    setQuestionTypes(prev => [...prev, {
      id: Date.now().toString(),
      type: 'short',
      count: 3,
      marks: 2,
    }]);
  };

  const removeQuestionType = (id: string) => {
    if (questionTypes.length <= 1) return;
    setQuestionTypes(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestionType = (id: string, field: keyof QuestionTypeRow, value: any) => {
    setQuestionTypes(prev => prev.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const totalQuestions = questionTypes.reduce((s, q) => s + q.count, 0);
  const totalMarks = questionTypes.reduce((s, q) => s + (q.count * q.marks), 0);

  // ============ File Upload ============
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post('http://localhost:5001/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setContextText(response.data.fullText || response.data.sampleChunk || '');
      setUploadedFileName(file.name);
    } catch (err) {
      setGenError('Failed to process the PDF.');
    } finally { setIsUploading(false); }
  };

  // ============ Generate Assignment ============
  const handleGenerate = async () => {
    if (totalQuestions <= 0) {
      setGenError('Please add at least one question type.');
      return;
    }
    setIsGenerating(true);
    setGenError('');
    try {
      const res = await axios.post('http://localhost:5001/api/assignments/create', {
        questionTypes,
        additionalInstructions,
        contextText,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });

      const assignmentId = res.data.assignmentId;

      // Listen for WebSocket completion
      socketRef.current?.on(`assignment-complete-${assignmentId}`, async (data: any) => {
        if (data.status === 'success') {
          const result = await axios.get(`http://localhost:5001/api/assignments/${assignmentId}`);
          setViewingPaper(result.data.assignment);
          setActiveView('view-paper');
          fetchAssignments();
          socketRef.current?.off(`assignment-complete-${assignmentId}`);
        } else {
          setGenError('AI generation failed. Please try again.');
          socketRef.current?.off(`assignment-complete-${assignmentId}`);
        }
        setIsGenerating(false);
      });

      // Timeout fallback — poll after 30s
      setTimeout(async () => {
        if (isGenerating) {
          try {
            const result = await axios.get(`http://localhost:5001/api/assignments/${assignmentId}`);
            if (result.data.assignment?.status === 'completed') {
              setViewingPaper(result.data.assignment);
              setActiveView('view-paper');
              fetchAssignments();
            }
          } catch {}
          setIsGenerating(false);
        }
      }, 30000);

    } catch (err: any) {
      setGenError(err.response?.data?.error || 'Failed to start generation.');
      setIsGenerating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const resetForm = () => {
    setQuestionTypes([
      { id: '1', type: 'mcq', count: 5, marks: 1 },
      { id: '2', type: 'short', count: 3, marks: 2 },
    ]);
    setAdditionalInstructions('');
    setContextText('');
    setUploadedFileName('');
    setGenError('');
  };

  // ============ GSAP modal ============
  useEffect(() => {
    if (isClassroomModalOpen && modalRef.current) {
      gsap.fromTo(modalRef.current,
        { opacity: 0, scale: 0.9, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
      );
    }
  }, [isClassroomModalOpen]);

  // ============ NAV ITEMS ============
  const navItems: { icon: React.ReactNode; label: string; view: View }[] = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Home', view: 'home' },
    { icon: <Users className="w-4 h-4" />, label: 'My Classrooms', view: 'classrooms' },
    { icon: <FileText className="w-4 h-4" />, label: 'Assignments', view: 'assignments' },
    { icon: <FileQuestion className="w-4 h-4" />, label: 'AI Grading (OCR)', view: 'ai-grading' },
    { icon: <BookOpenCheck className="w-4 h-4" />, label: 'AI Lesson Planner', view: 'lesson-planner' },
    { icon: <UserCheck className="w-4 h-4" />, label: 'Attendance', view: 'attendance' },
    { icon: <Download className="w-4 h-4" />, label: 'Gradebook', view: 'gradebook' },
  ];

  return (
    <div ref={containerRef} className="themed-surface flex min-h-screen bg-theme text-white overflow-hidden">
      {/* ======== SIDEBAR ======== */}
      <aside className="w-64 min-h-screen flex flex-col border-r border-white/5 bg-white/[0.02] backdrop-blur-xl flex-shrink-0 relative z-20">
        {/* Logo */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-500/20 rounded-xl border border-zinc-500/30">
              <Sparkles className="w-5 h-5 text-zinc-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight accent-gradient-text">
              AxesAI
            </h1>
          </div>
          <ThemeToggle />
        </div>

        {/* Create Assignment CTA */}
        <div className="px-4 pt-5 pb-2">
          <button 
            onClick={() => { resetForm(); setActiveView('create-assignment'); }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-zinc-500 to-zinc-500 text-white text-sm font-semibold hover:from-zinc-600 hover:to-zinc-600 transition-all shadow-lg shadow-zinc-500/20 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Create Assignment
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeView === item.view
                  ? 'bg-white/8 border border-white/10 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}

          <div className="pt-6">
            <button
              onClick={() => setIsFaceSetupOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-300 hover:bg-zinc-500/5 border border-transparent transition-all cursor-pointer mb-2"
            >
              <Camera className="w-4 h-4" /> Setup Face Login
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 border border-transparent transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </nav>

        {/* Profile footer */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-400 flex items-center justify-center text-white text-sm font-bold">
              {teacherName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{teacherName}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Teacher</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ======== MAIN CONTENT ======== */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Ambient Lights */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-zinc-500/8 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-zinc-500/8 blur-[120px] pointer-events-none" />

        <main ref={mainContentRef} className="relative z-10 p-6 md:p-10 max-w-5xl mx-auto">

          {/* ======== HOME VIEW ======== */}
          {activeView === 'home' && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Welcome back, {teacherName} 👋</h2>
              <p className="text-sm text-gray-400 mb-8">Here's an overview of your workspace.</p>
              
              {/* Primary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <GlassPanel className="text-center py-8">
                  <p className="text-3xl font-bold text-white">{classrooms.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Classrooms</p>
                </GlassPanel>
                <GlassPanel className="text-center py-8">
                  <p className="text-3xl font-bold text-white">{assignments.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Assignments Created</p>
                </GlassPanel>
                <GlassPanel className="text-center py-8">
                  <p className="text-3xl font-bold text-white">{classrooms.reduce((s: number, c: any) => s + (c.studentIds?.length || 0), 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">Total Enrolled Students</p>
                </GlassPanel>
              </div>

              {/* AI IMPACT METRICS PANEL */}
              {homeSummary && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" /> AI Assistant Impact Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <GlassPanel className="p-6 flex items-center gap-4 border-yellow-500/10">
                      <div className="p-3 bg-yellow-500/10 rounded-2xl">
                        <Sparkles className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{homeSummary.timeSavedHours} hrs</p>
                        <p className="text-xs text-gray-400 mt-0.5">Estimated Time Saved by AI</p>
                      </div>
                    </GlassPanel>
                    
                    <GlassPanel className="p-6 flex items-center gap-4 border-zinc-500/10">
                      <div className="p-3 bg-zinc-500/10 rounded-2xl">
                        <CheckCircle2 className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{homeSummary.assignmentsReviewed30Days}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Graded in Last 30 Days</p>
                      </div>
                    </GlassPanel>

                    <GlassPanel className="p-6 flex items-center gap-4 border-zinc-500/10">
                      <div className="p-3 bg-zinc-500/10 rounded-2xl">
                        <FileText className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{homeSummary.totalAssignmentsGraded}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Total AI Graded Submissions</p>
                      </div>
                    </GlassPanel>
                  </div>
                </div>
              )}

              {/* Recent Assignments / Progress Tracking */}
              <div>
                <h3 className="text-lg font-bold text-gray-300 mb-4">Recent Assessments & Submission Progress</h3>
                {homeSummary && homeSummary.recentAssignments && homeSummary.recentAssignments.length > 0 ? (
                  <div className="space-y-4">
                    {homeSummary.recentAssignments.map((a: any) => (
                      <GlassPanel key={a._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                            <span className="text-[10px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-full">
                              {a.classroomName}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">Created: {new Date(a.createdAt).toLocaleDateString()}</p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full md:w-60 flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-zinc-500 to-zinc-400 rounded-full transition-all" 
                              style={{ width: `${a.progressPercent}%` }} 
                            />
                          </div>
                          <span className="text-xs font-mono text-zinc-300 whitespace-nowrap min-w-[45px] text-right">
                            {a.submissionsCount}/{a.totalStudents} ({a.progressPercent.toFixed(0)}%)
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold border ${
                            a.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            a.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                            'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>{a.status}</span>
                          <GlassButton 
                            onClick={async () => {
                              try {
                                const res = await axios.get(`http://localhost:5001/api/assignments/${a._id}`);
                                setViewingPaper(res.data.assignment);
                                setActiveView('view-paper');
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="text-xs py-1.5 px-3"
                          >
                            View
                          </GlassButton>
                        </div>
                      </GlassPanel>
                    ))}
                  </div>
                ) : (
                  <GlassPanel className="text-center py-16">
                    <p className="text-lg font-semibold text-gray-300 mb-2">No assignments yet</p>
                    <p className="text-sm text-gray-500 mb-6">Create your first assignment to start generating AI-powered question papers.</p>
                    <GlassButton onClick={() => { resetForm(); setActiveView('create-assignment'); }} variant="accent" className="inline-flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Create Your First Assignment
                    </GlassButton>
                  </GlassPanel>
                )}
              </div>
            </div>
          )}

          {/* ======== CLASSROOMS VIEW ======== */}
          {activeView === 'classrooms' && (
            <div>
              {selectedClassroom ? (
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <GlassButton onClick={() => setSelectedClassroom(null)} className="text-xs">
                      &larr; Back to Classrooms
                    </GlassButton>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedClassroom.name}</h2>
                      <p className="text-xs text-gray-400">Instructor: {teacherName} · Join Code: <strong className="text-zinc-300">{selectedClassroom.joinCode}</strong></p>
                    </div>
                  </div>

                  {/* ---- Row 1: Chat + Sidebar ---- */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <ClassroomChat classroomId={selectedClassroom._id} socket={socketRef.current} />
                    </div>
                    <div className="space-y-6">
                      {/* Classroom Details Card */}
                      <GlassPanel className="p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Classroom Details</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Join Code</span>
                            <span className="font-bold text-zinc-300 tracking-wider">{selectedClassroom.joinCode}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Status</span>
                            <span className="font-bold text-green-400">Active</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Students</span>
                            <span className="font-bold text-white">{selectedClassroom.studentIds?.length || 0}</span>
                          </div>
                        </div>
                      </GlassPanel>

                      {/* Classroom Documents Card */}
                      <GlassPanel className="p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-zinc-400" /> Classroom Documents
                        </h3>
                        {classroomDoc ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-500/5 border border-zinc-500/10 text-sm text-gray-300">
                              <FileText className="w-5 h-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-white truncate text-xs">{classroomDoc.title}</p>
                                <p className="text-[10px] text-gray-500">Indexed successfully</p>
                              </div>
                            </div>
                            
                            <div className="text-[11px] text-gray-400 max-h-[150px] overflow-y-auto space-y-1.5 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                              <p className="font-semibold text-gray-300">PageIndex structure:</p>
                              {classroomDoc.pageIndex?.sections?.map((sec: any, sIdx: number) => (
                                <div key={sIdx} className="pl-1">
                                  <p className="font-medium text-zinc-300 truncate">{sec.title}</p>
                                  {sec.subsections?.map((sub: any, subIdx: number) => (
                                    <p key={subIdx} className="pl-3 text-[10px] text-gray-500 truncate">- {sub.title}</p>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mb-4">No notes uploaded yet. Upload study notes (PDF/image) to enable the student AI Doubt Solver chatbot.</p>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Upload Study Notes</label>
                          <div className="flex flex-col gap-2">
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleUploadDoc(e.target.files[0]);
                                }
                              }}
                              disabled={isUploadingDoc}
                              className="hidden"
                              id="classroom-doc-file"
                            />
                            <label
                              htmlFor="classroom-doc-file"
                              className={`flex items-center justify-center gap-2 cursor-pointer border border-dashed rounded-xl p-3 text-xs font-semibold transition ${
                                isUploadingDoc 
                                  ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                                  : 'bg-zinc-500/5 border-zinc-500/20 text-zinc-400 hover:bg-zinc-500/10 hover:border-zinc-500/30'
                              }`}
                            >
                              {isUploadingDoc ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Indexing...</>
                              ) : (
                                <><Upload className="w-4 h-4" /> Select & Upload File</>
                              )}
                            </label>
                            {docUploadError && (
                              <p className="text-[10px] text-red-400">{docUploadError}</p>
                            )}
                          </div>
                        </div>
                      </GlassPanel>

                      {/* Live Quiz Control Panel */}
                      <GlassPanel className="p-6 border-zinc-500/20">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-zinc-400" /> Live Quiz Control
                        </h3>
                        {liveQuizActive ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold uppercase tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                              <span>Session Live</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Current Question:</span>
                                <span className="font-bold text-white">#{liveQuizQuestionIndex + 1}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Time Remaining:</span>
                                <span className="font-bold text-zinc-300 font-mono">{liveQuizTimeRemaining}s</span>
                              </div>
                            </div>
                            <GlassButton onClick={handleEndQuizEarly} className="w-full border-red-500/30 hover:bg-red-500/10 text-red-400">
                              End Quiz Early
                            </GlassButton>
                          </div>
                        ) : liveQuizScoreboard ? (
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-green-400">Quiz Completed!</h4>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {liveQuizScoreboard.map((item) => (
                                <div key={item.studentId} className="flex justify-between items-center text-xs text-gray-300 border-b border-white/5 pb-1">
                                  <span>#{item.rank} {item.name}</span>
                                  <span className="font-mono text-zinc-300">{item.score} pts ({item.violationCount} v)</span>
                                </div>
                              ))}
                            </div>
                            <GlassButton onClick={() => { setLiveQuizScoreboard(null); resetInlineQuiz(); }} className="w-full text-xs">
                              Reset Controls
                            </GlassButton>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-xs text-gray-400">Create MCQ questions below and launch as a live quiz for all students in this room.</p>

                            {/* AI Quiz Generator */}
                            <div className="bg-gradient-to-br from-zinc-500/10 to-zinc-500/10 border border-zinc-500/20 rounded-xl p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-zinc-400" />
                                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Generate with AI</span>
                              </div>
                              <input
                                type="text"
                                value={aiQuizTopic}
                                onChange={(e) => setAiQuizTopic(e.target.value)}
                                placeholder="Topic (e.g. Photosynthesis) — leave blank to use uploaded notes"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-zinc-500/50 transition"
                              />
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-400"># Questions</span>
                                  <button onClick={() => setAiQuizCount(Math.max(1, aiQuizCount - 1))} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-md text-gray-300 hover:bg-white/10"><Minus className="w-3 h-3" /></button>
                                  <span className="text-sm text-white w-5 text-center">{aiQuizCount}</span>
                                  <button onClick={() => setAiQuizCount(Math.min(15, aiQuizCount + 1))} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded-md text-gray-300 hover:bg-white/10"><Plus className="w-3 h-3" /></button>
                                </div>
                                <GlassButton onClick={handleGenerateAIQuiz} disabled={isGeneratingAIQuiz} className="flex-1 text-xs flex items-center justify-center gap-2">
                                  {isGeneratingAIQuiz ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>) : (<><Sparkles className="w-3.5 h-3.5" /> Generate Questions</>)}
                                </GlassButton>
                              </div>
                              {aiQuizError && <p className="text-[11px] text-red-400">{aiQuizError}</p>}
                              <p className="text-[10px] text-gray-500">AI writes the questions, 4 options, and marks the correct answer. Review/edit them below before launching.</p>
                            </div>

                            {/* Inline MCQ Creator */}
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                              {inlineQuizQuestions.map((q, qIdx) => (
                                <div key={q.id} className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Q{qIdx + 1}</span>
                                    {inlineQuizQuestions.length > 1 && (
                                      <button onClick={() => removeInlineQuestion(q.id)} className="text-gray-500 hover:text-red-400 transition cursor-pointer">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  
                                  <input
                                    type="text"
                                    value={q.prompt}
                                    onChange={(e) => updateInlineQuestion(q.id, 'prompt', e.target.value)}
                                    placeholder="Enter question..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-zinc-500/50 transition"
                                  />
                                  
                                  <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((opt, oIdx) => (
                                      <div key={oIdx} className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => updateInlineQuestion(q.id, 'answerKey', q.options[oIdx])}
                                          className={`w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-bold flex-shrink-0 cursor-pointer transition-all ${
                                            q.answerKey === opt && opt !== '' 
                                              ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                                              : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/30'
                                          }`}
                                        >
                                          {String.fromCharCode(65 + oIdx)}
                                        </button>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const oldVal = q.options[oIdx];
                                            updateInlineOption(q.id, oIdx, e.target.value);
                                            if (q.answerKey === oldVal) {
                                              updateInlineQuestion(q.id, 'answerKey', e.target.value);
                                            }
                                          }}
                                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-zinc-500/50 transition min-w-0"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Marks</label>
                                      <div className="flex items-center gap-1 mt-1">
                                        <button onClick={() => updateInlineQuestion(q.id, 'marks', Math.max(1, q.marks - 1))} className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"><Minus className="w-3 h-3" /></button>
                                        <span className="w-6 text-center text-xs font-medium">{q.marks}</span>
                                        <button onClick={() => updateInlineQuestion(q.id, 'marks', q.marks + 1)} className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"><Plus className="w-3 h-3" /></button>
                                      </div>
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Time (sec)</label>
                                      <div className="flex items-center gap-1 mt-1">
                                        <button onClick={() => updateInlineQuestion(q.id, 'durationSec', Math.max(10, q.durationSec - 10))} className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"><Minus className="w-3 h-3" /></button>
                                        <span className="w-8 text-center text-xs font-medium font-mono">{q.durationSec}</span>
                                        <button onClick={() => updateInlineQuestion(q.id, 'durationSec', q.durationSec + 10)} className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"><Plus className="w-3 h-3" /></button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <button onClick={addInlineQuestion} className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition cursor-pointer py-2 border border-dashed border-zinc-500/20 rounded-xl hover:border-zinc-500/40">
                              <Plus className="w-3.5 h-3.5" /> Add Question
                            </button>

                            <div className="text-right text-xs text-gray-500">
                              {inlineQuizQuestions.length} question{inlineQuizQuestions.length !== 1 ? 's' : ''} · {inlineQuizQuestions.reduce((s, q) => s + q.marks, 0)} marks total
                            </div>

                            <GlassButton 
                              onClick={handleLaunchInlineQuiz}
                              variant="accent" 
                              className="w-full flex items-center justify-center gap-1.5"
                            >
                              <Play className="w-4 h-4" /> Launch Quiz
                            </GlassButton>
                          </div>
                        )}
                      </GlassPanel>

                      {/* Enrolled Students */}
                      <GlassPanel className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white">Enrolled Students ({selectedClassroom.studentIds?.length || 0})</h3>
                        </div>
                        
                        <div className="relative mb-4">
                          <input
                            type="text"
                            value={studentSearchQuery}
                            onChange={(e) => setStudentSearchQuery(e.target.value)}
                            placeholder="Search all your students by name or email..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-zinc-500/50 transition"
                          />
                          {isSearching && (
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          )}
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {searchResults !== null ? (
                            // Server-side search results (across every classroom this teacher owns)
                            searchResults.length > 0 ? (
                              searchResults.map((student: any) => (
                                <div
                                  key={student._id}
                                  onClick={() => fetchStudentPerformance(student._id)}
                                  className="flex justify-between items-center text-sm text-gray-300 border-b border-white/5 pb-2 cursor-pointer hover:text-zinc-300 hover:border-zinc-500/20 transition-all"
                                >
                                  <span>{student.name}</span>
                                  <span className="text-xs text-gray-500">{student.email}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-500">{isSearching ? 'Searching…' : 'No students match your search.'}</p>
                            )
                          ) : selectedClassroom.studentIds && selectedClassroom.studentIds.length > 0 ? (
                            // Default: students enrolled in the selected classroom
                            selectedClassroom.studentIds.map((student: any) => (
                              <div
                                key={student._id}
                                onClick={() => fetchStudentPerformance(student._id)}
                                className="flex justify-between items-center text-sm text-gray-300 border-b border-white/5 pb-2 cursor-pointer hover:text-zinc-300 hover:border-zinc-500/20 transition-all"
                              >
                                <span>{student.name}</span>
                                <span className="text-xs text-gray-500">{student.email}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-500">No students enrolled yet.</p>
                          )}
                        </div>
                      </GlassPanel>

                      {/* Live Viva Reviews Card */}
                      <GlassPanel className="p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-red-400" /> Spoken Viva Reviews
                        </h3>
                        
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {vivaHistory && vivaHistory.length > 0 ? (
                            vivaHistory.map((viva: any) => (
                              <div key={viva._id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-sm flex justify-between items-center">
                                <div className="min-w-0 flex-1 mr-2">
                                  <p className="font-semibold text-white truncate">{viva.studentName}</p>
                                  <p className="text-[10px] text-gray-500 truncate">{viva.topic} · Score: <strong className="text-green-400">{viva.score}/{viva.maxScore}</strong></p>
                                </div>
                                <GlassButton onClick={() => setSelectedVivaReview(viva)} className="text-[10px] py-1 px-2.5 flex-shrink-0">
                                  Review
                                </GlassButton>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-500">No viva sessions recorded yet.</p>
                          )}
                        </div>
                      </GlassPanel>
                    </div>
                  </div>

                  {/* ---- Classroom Performance Analytics Section ---- */}
                  <div className="mt-8">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <LayoutDashboard className="w-5 h-5 text-zinc-400" /> Class Performance Analytics
                    </h3>
                    
                    {isFetchingAnalytics ? (
                      <GlassPanel className="p-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400 mb-2" />
                        <p className="text-sm text-gray-400">Computing real-time analytics...</p>
                      </GlassPanel>
                    ) : classroomAnalytics ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT: performance summary */}
                        <div className="lg:col-span-2 space-y-6">
                          <GlassPanel className="p-6">
                            <h4 className="text-sm font-bold text-white mb-5 text-center">Overall Class Performance Summary</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-center">
                              {/* Submission gauge */}
                              <div className="flex flex-col items-center justify-center">
                                <svg viewBox="0 0 160 92" className="w-40">
                                  <defs>
                                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                                      <stop offset="0%" stopColor="#a1a1aa" />
                                      <stop offset="100%" stopColor="#d4d4d8" />
                                    </linearGradient>
                                  </defs>
                                  <path d="M12 82 A68 68 0 0 1 148 82" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" />
                                  <path d="M12 82 A68 68 0 0 1 148 82" fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round"
                                    strokeDasharray={`${(Math.min(classroomAnalytics.submissionRate, 100) / 100) * 213.6} 213.6`} />
                                </svg>
                                <div className="-mt-6 text-center">
                                  <p className="text-2xl font-extrabold text-white">{classroomAnalytics.totalSubmissions}<span className="text-sm text-gray-500">/{classroomAnalytics.totalStudents}</span></p>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Submissions ({classroomAnalytics.submissionRate.toFixed(0)}%)</p>
                                </div>
                              </div>
                              {/* Metric tiles */}
                              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl p-4 text-center bg-green-500/10 border border-green-500/20">
                                  <p className="text-2xl font-extrabold text-green-400">{classroomAnalytics.averageScore ? classroomAnalytics.averageScore.toFixed(1) : '0'}</p>
                                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Average Score</p>
                                </div>
                                <div className="rounded-2xl p-4 text-center bg-zinc-500/10 border border-zinc-500/20">
                                  <p className="text-2xl font-extrabold text-zinc-300">{classroomAnalytics.topScore || '0'}</p>
                                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Top Score</p>
                                </div>
                                <div className="rounded-2xl p-4 text-center bg-white/[0.03] border border-white/10">
                                  <p className="text-2xl font-extrabold text-white">{classroomAnalytics.medianScore ? classroomAnalytics.medianScore.toFixed(1) : '0'}</p>
                                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Class Median</p>
                                </div>
                                <div className="rounded-2xl p-4 text-center bg-red-500/10 border border-red-500/20">
                                  <p className="text-2xl font-extrabold text-red-400">{classroomAnalytics.lowestScore || '0'}</p>
                                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Lowest Score</p>
                                </div>
                              </div>
                            </div>
                          </GlassPanel>

                          {/* Student Segmentation */}
                          <GlassPanel className="p-6">
                            <h4 className="text-sm font-bold text-white mb-4">Student Segmentation (by score band)</h4>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: 'Strong', sub: '≥ 8', count: classroomAnalytics.gradeBands?.strong || 0, cls: 'from-green-500/20 to-green-500/5 border-green-500/30 text-green-400' },
                                { label: 'Average', sub: '5 – 7', count: classroomAnalytics.gradeBands?.average || 0, cls: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400' },
                                { label: 'At-Risk', sub: '< 5', count: classroomAnalytics.gradeBands?.atRisk || 0, cls: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400' },
                              ].map((b) => (
                                <div key={b.label} className={`rounded-2xl p-5 text-center bg-gradient-to-b border ${b.cls}`}>
                                  <p className="text-3xl font-extrabold">{b.count}</p>
                                  <p className="text-sm font-bold text-white mt-1">{b.label}</p>
                                  <p className="text-[10px] text-gray-400">{b.sub} marks</p>
                                </div>
                              ))}
                            </div>
                          </GlassPanel>

                          {/* Trend */}
                          {classroomAnalytics.trend && classroomAnalytics.trend.length > 0 && (
                            <GlassPanel className="p-6">
                              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Quiz Score Trend</h4>
                              <div className="h-52 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={classroomAnalytics.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="quizName" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1a1826', borderColor: '#33314a', color: '#FFF', borderRadius: 12 }} />
                                    <Line type="monotone" dataKey="avgScore" name="Avg Score" stroke="#a1a1aa" strokeWidth={3} dot={{ fill: '#d4d4d8', r: 4 }} activeDot={{ r: 7 }} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </GlassPanel>
                          )}
                        </div>

                        {/* RIGHT: AI insights */}
                        <div className="space-y-6">
                          <GlassPanel className="p-6">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-zinc-400" /> Learning Gaps</h4>
                            {isFetchingInsights ? (
                              <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-400" /><p className="text-[11px] text-gray-500 mt-2">AI analysing performance…</p></div>
                            ) : insights?.learningGaps?.length > 0 ? (
                              <div className="space-y-3">
                                {insights.learningGaps.map((g: any, i: number) => (
                                  <div key={i}>
                                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">{g.concept}</span><span className="font-bold text-zinc-300">{g.missRate}%</span></div>
                                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-500" style={{ width: `${Math.min(g.missRate, 100)}%` }} /></div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">Run a quiz to unlock AI-detected learning gaps.</p>
                            )}
                          </GlassPanel>

                          <GlassPanel className="p-6">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-400" /> Recommended Actions</h4>
                            {isFetchingInsights ? (
                              <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-400" /></div>
                            ) : insights?.recommendedActions?.length > 0 ? (
                              <ol className="space-y-2.5">
                                {insights.recommendedActions.map((a: string, i: number) => (
                                  <li key={i} className="flex gap-2.5 text-xs text-gray-300">
                                    <span className="w-5 h-5 rounded-full bg-zinc-500/20 text-zinc-300 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">{i + 1}</span>
                                    <span className="leading-relaxed">{a}</span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-xs text-gray-500">AI teaching recommendations appear here after quizzes are taken.</p>
                            )}
                          </GlassPanel>
                        </div>
                      </div>
                    ) : (
                      <GlassPanel className="p-8 text-center text-sm text-gray-500">
                        No submissions or performance data available for this classroom yet.
                      </GlassPanel>
                    )}
                  </div>

                  {/* ---- Row 2: Assignments Section ---- */}
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-zinc-400" /> Assignments
                      </h3>
                      <GlassButton onClick={() => { resetForm(); setActiveView('create-assignment'); }} className="text-xs flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Create New
                      </GlassButton>
                    </div>
                    {assignments.length === 0 ? (
                      <GlassPanel className="text-center py-10">
                        <FileQuestion className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-400 mb-4">No assignments yet. Create your first AI-generated assessment.</p>
                        <GlassButton onClick={() => { resetForm(); setActiveView('create-assignment'); }} variant="accent" className="inline-flex items-center gap-2 text-xs">
                          <Plus className="w-3.5 h-3.5" /> Create Assignment
                        </GlassButton>
                      </GlassPanel>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignments.map((a: any) => (
                          <GlassPanel key={a._id} className="p-5 cursor-pointer hover:border-white/20 transition-all"
                            onClick={() => { setViewingPaper(a); setActiveView('view-paper'); }}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{new Date(a.createdAt).toLocaleDateString()}</p>
                              </div>
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 ml-3 ${
                                a.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                a.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>{a.status}</span>
                            </div>
                          </GlassPanel>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ---- Row 3: Notes Section ---- */}
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <StickyNote className="w-5 h-5 text-amber-400" /> Notes
                      </h3>
                      <button
                        onClick={handleSaveNotes}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                          notesSaved
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {notesSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {notesSaved ? 'Saved!' : 'Save'}
                      </button>
                    </div>
                    <GlassPanel className="p-6">
                      <textarea
                        value={classroomNotes}
                        onChange={(e) => { setClassroomNotes(e.target.value); setNotesSaved(false); }}
                        placeholder="Write your classroom notes, reminders, lesson plans, or any other information here..."
                        className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 min-h-[180px] resize-y outline-none leading-relaxed"
                      />
                    </GlassPanel>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold">My Classrooms</h2>
                      <p className="text-sm text-gray-400">Manage your classrooms and share join codes with students.</p>
                    </div>
                    <GlassButton onClick={() => setIsClassroomModalOpen(true)} variant="accent" className="flex items-center gap-2">
                      <Plus className="w-4 h-4" /> New Classroom
                    </GlassButton>
                  </div>

                  {classrooms.length === 0 ? (
                    <GlassPanel className="text-center py-16">
                      <p className="text-gray-400 mb-4">No classrooms created yet.</p>
                      <GlassButton onClick={() => setIsClassroomModalOpen(true)} variant="accent">Create Classroom</GlassButton>
                    </GlassPanel>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                      {classrooms.map((room: any) => (
                        <GlassPanel key={room._id} className="hover:border-white/20 transition-all cursor-pointer" onClick={() => setSelectedClassroom(room)}>
                          <h3 className="text-lg font-bold text-white mb-2">{room.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 bg-white/5 py-1.5 px-3 rounded-full w-fit">
                            <span>Join Code: <strong className="text-zinc-300 tracking-wider">{room.joinCode}</strong></span>
                            <button onClick={(e) => { e.stopPropagation(); copyCode(room.joinCode); }} className="cursor-pointer text-gray-400 hover:text-white transition">
                              {copiedCode === room.joinCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 gap-1">
                            <Users className="w-4 h-4" /> {room.studentIds?.length || 0} students enrolled
                          </div>
                        </GlassPanel>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ======== ASSIGNMENTS LIST VIEW ======== */}
          {activeView === 'assignments' && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Assignments</h2>
                  <p className="text-sm text-gray-400">View all generated assessment papers.</p>
                </div>
                <GlassButton onClick={() => { resetForm(); setActiveView('create-assignment'); }} variant="accent" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create Assignment
                </GlassButton>
              </div>

              {assignments.length === 0 ? (
                <GlassPanel className="text-center py-16">
                  <p className="text-lg font-semibold text-gray-300 mb-2">No assignments yet</p>
                  <p className="text-sm text-gray-500 mb-6">Create your first assignment to start collecting and grading student submissions.</p>
                  <GlassButton onClick={() => { resetForm(); setActiveView('create-assignment'); }} variant="accent" className="inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Your First Assignment
                  </GlassButton>
                </GlassPanel>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a: any) => (
                    <GlassPanel key={a._id} className="flex items-center justify-between py-4 px-6 cursor-pointer hover:border-white/20 transition-all"
                      onClick={() => { setViewingPaper(a); setActiveView('view-paper'); }}>
                      <div>
                        <p className="text-sm font-semibold text-white">{a.title}</p>
                        <p className="text-xs text-gray-500">Created: {new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold border ${
                          a.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          a.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>{a.status}</span>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </div>
                    </GlassPanel>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======== CREATE ASSIGNMENT VIEW ======== */}
          {activeView === 'create-assignment' && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-400" /> Create Assignment
                </h2>
                <p className="text-sm text-gray-400">Set up a new assignment for your students.</p>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full bg-white/5 rounded-full mb-8 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-zinc-500 to-zinc-400 rounded-full transition-all" style={{ width: '100%' }} />
              </div>

              <GlassPanel className="p-8">
                <h3 className="text-lg font-bold text-white mb-1">Assignment Details</h3>
                <p className="text-xs text-gray-500 mb-6">Basic information about your assignment</p>

                {/* File Upload */}
                <div className="mb-6">
                  <div className="p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-zinc-500/30 transition-all bg-white/[0.02] flex flex-col items-center justify-center relative cursor-pointer group">
                    <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-3 text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-sm font-medium">Extracting text from document...</span>
                      </div>
                    ) : uploadedFileName ? (
                      <div className="flex flex-col items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-8 h-8 mb-1" />
                        <span className="text-sm font-medium">{uploadedFileName}</span>
                        <span className="text-xs text-green-500/70">AI will ground questions using this content.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="p-3 bg-white/5 rounded-full mb-3 group-hover:bg-zinc-500/10 transition-all">
                          <UploadCloud className="w-6 h-6 text-gray-400 group-hover:text-zinc-400" />
                        </div>
                        <p className="text-sm font-medium text-white mb-1">Choose a file or drag & drop it here</p>
                        <p className="text-xs text-gray-500">PDF, TXT — upto 10MB</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 mt-2 text-center">Upload your notes/textbook so the AI can generate questions from it</p>
                </div>

                {/* Question Type Configurator */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-white mb-3">Question Type</h4>
                  
                  <div className="space-y-3">
                    {/* Header row */}
                    <div className="grid grid-cols-12 gap-3 items-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-1">
                      <div className="col-span-5">Type</div>
                      <div className="col-span-1"></div>
                      <div className="col-span-3 text-center">No. of Questions</div>
                      <div className="col-span-3 text-center">Marks Each</div>
                    </div>

                    {questionTypes.map(qt => (
                      <div key={qt.id} className="grid grid-cols-12 gap-3 items-center bg-white/[0.03] rounded-xl p-3 border border-white/5">
                        {/* Type Dropdown */}
                        <select
                          value={qt.type}
                          onChange={(e) => updateQuestionType(qt.id, 'type', e.target.value)}
                          className="col-span-5 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-zinc-500/50"
                        >
                          {QUESTION_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
                          ))}
                        </select>

                        {/* Remove */}
                        <button onClick={() => removeQuestionType(qt.id)} className="col-span-1 text-gray-500 hover:text-red-400 transition cursor-pointer flex justify-center">
                          <X className="w-4 h-4" />
                        </button>

                        {/* Count +/- */}
                        <div className="col-span-3 flex items-center justify-center gap-1.5">
                          <button onClick={() => updateQuestionType(qt.id, 'count', Math.max(1, qt.count - 1))} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{qt.count}</span>
                          <button onClick={() => updateQuestionType(qt.id, 'count', qt.count + 1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Marks +/- */}
                        <div className="col-span-3 flex items-center justify-center gap-1.5">
                          <button onClick={() => updateQuestionType(qt.id, 'marks', Math.max(1, qt.marks - 1))} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{qt.marks}</span>
                          <button onClick={() => updateQuestionType(qt.id, 'marks', qt.marks + 1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={addQuestionType} className="mt-3 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition cursor-pointer">
                    <Plus className="w-4 h-4" /> Add Question Type
                  </button>

                  <div className="mt-4 text-right space-y-0.5">
                    <p className="text-sm text-gray-400">Total Questions: <strong className="text-white">{totalQuestions}</strong></p>
                    <p className="text-sm text-gray-400">Total Marks: <strong className="text-white">{totalMarks}</strong></p>
                  </div>
                </div>

                {/* Additional Instructions */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-white mb-2">Additional Information (For better output)</h4>
                  <textarea
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="glass-input w-full px-4 py-3 text-sm text-white placeholder-gray-600 min-h-[100px] resize-none"
                    placeholder="e.g. Generate a question paper for 3 hour exam duration focusing on thermodynamics..."
                  />
                </div>

                {genError && (
                  <div className="p-3 mb-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs">{genError}</div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <GlassButton onClick={() => setActiveView('home')} className="flex items-center gap-2">
                    ← Back
                  </GlassButton>
                  <GlassButton onClick={handleGenerate} variant="accent" disabled={isGenerating} className="flex items-center gap-2">
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                    ) : (
                      <>Generate Paper →</>
                    )}
                  </GlassButton>
                </div>
              </GlassPanel>
            </div>
          )}

          {/* ======== VIEW PAPER VIEW ======== */}
          {activeView === 'view-paper' && viewingPaper && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Generated Assessment</h2>
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" /> Successfully generated via Groq
                  </p>
                </div>
                <div className="flex gap-3">
                  <GlassButton onClick={() => { resetForm(); setActiveView('create-assignment'); }}>Create Another</GlassButton>
                  <GlassButton variant="accent" className="flex items-center gap-2">
                    <Download className="w-4 h-4" /> Export PDF
                  </GlassButton>
                </div>
              </div>

              <GlassPanel className="p-8">
                {/* Paper Header */}
                <div className="text-center mb-8 pb-6 border-b border-white/10">
                  <h3 className="text-2xl font-bold text-white mb-1">AxesAI Academy</h3>
                  <h4 className="text-base text-gray-300 mb-4">Subject: {viewingPaper.title || 'AI Generated Assessment'}</h4>
                  <div className="flex justify-between text-sm text-gray-400 mb-4">
                    <p>Time Allowed: 3 Hours</p>
                    <p>Maximum Marks: {totalMarks || 'N/A'}</p>
                  </div>
                  <div className="flex gap-4 justify-between text-left text-sm mt-4">
                    <div className="flex-1"><span className="text-gray-500">Name:</span><div className="border-b border-gray-600 mt-2 h-4" /></div>
                    <div className="flex-1"><span className="text-gray-500">Roll No:</span><div className="border-b border-gray-600 mt-2 h-4" /></div>
                    <div className="flex-1"><span className="text-gray-500">Section:</span><div className="border-b border-gray-600 mt-2 h-4" /></div>
                  </div>
                </div>

                {/* Render Sections */}
                {viewingPaper.generatedPaper?.map((section: any, sIndex: number) => (
                  <div key={sIndex} className="mb-10">
                    <div className="mb-4 bg-white/5 p-4 rounded-xl border border-white/5">
                      <h4 className="text-lg font-bold text-white mb-1">{section.title}</h4>
                      <p className="text-sm text-gray-400 italic">{section.instruction}</p>
                    </div>

                    <div className="space-y-6 pl-2">
                      {section.questions?.map((q: any, qIndex: number) => (
                        <div key={qIndex} className="flex gap-4 group">
                          <span className="text-gray-500 font-medium text-lg min-w-[24px]">{qIndex + 1}.</span>
                          <div className="flex-1">
                            <p className="text-gray-200 mb-3 leading-relaxed text-[15px]">{q.prompt}</p>
                            
                            {q.options && q.options.length > 0 && (
                              <div className="space-y-2 mb-4 pl-2">
                                {q.options.map((opt: string, i: number) => (
                                  <div key={i} className="flex items-center gap-3 text-[14px] text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] p-3 rounded-lg border border-white/5 transition-all">
                                    <span className="font-semibold text-gray-500 bg-black/20 w-6 h-6 flex items-center justify-center rounded-md text-xs border border-white/5">
                                      {String.fromCharCode(65 + i)}
                                    </span>
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-2">
                              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold border ${
                                q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                q.difficulty === 'Moderate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>{q.difficulty}</span>
                            </div>

                            {/* Answer Key (teacher-only) */}
                            {q.answerKey && (
                              <div className="mt-3 flex items-start gap-2 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-lg px-3 py-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Answer Key</span>
                                  <p className="text-[14px] text-emerald-100 leading-relaxed whitespace-pre-wrap">{q.answerKey}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-gray-500 font-medium whitespace-nowrap text-sm mt-1">
                            [{q.marks} Marks]
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {(!viewingPaper.generatedPaper || viewingPaper.generatedPaper.length === 0) && (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-4" />
                    <p className="text-gray-400">Paper is still being generated. Please check back shortly.</p>
                  </div>
                )}
              </GlassPanel>
            </div>
          )}

          {/* ======== AI GRADING VIEW ======== */}
          {activeView === 'ai-grading' && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Handwritten Answer OCR & AI Grading
                </h2>
                <p className="text-sm text-gray-400">Upload a handwritten answer sheet (Image/PDF) to perform OCR and grade with AI.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassPanel className="p-8 space-y-6 h-fit">
                  <h3 className="text-lg font-bold text-white">Grading Parameters</h3>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Question Prompt</label>
                    <textarea
                      value={gradingQuestion}
                      onChange={(e) => setGradingQuestion(e.target.value)}
                      placeholder="e.g. Explain Newton's Third Law of Motion with an example."
                      className="glass-input w-full px-4 py-3 text-sm text-white placeholder-gray-600 min-h-[80px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Grading Rubric / Criteria</label>
                    <textarea
                      value={gradingRubric}
                      onChange={(e) => setGradingRubric(e.target.value)}
                      placeholder="e.g. Concept: 3 marks, Example: 2 marks. Total: 5 marks."
                      className="glass-input w-full px-4 py-3 text-sm text-white placeholder-gray-600 min-h-[80px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Upload Student Sheet (Image/PDF)</label>
                    <div className="p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-amber-500/30 transition-all bg-white/[0.02] flex flex-col items-center justify-center relative cursor-pointer group">
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        onChange={(e) => setGradingFile(e.target.files?.[0] || null)} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                      />
                      {gradingFile ? (
                        <div className="flex flex-col items-center gap-2 text-amber-400">
                          <CheckCircle2 className="w-8 h-8 mb-1" />
                          <span className="text-sm font-medium">{gradingFile.name}</span>
                          <span className="text-xs text-amber-500/70">{(gradingFile.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <div className="p-3 bg-white/5 rounded-full mb-3 group-hover:bg-amber-500/10 transition-all">
                            <UploadCloud className="w-6 h-6 text-gray-400 group-hover:text-amber-400" />
                          </div>
                          <p className="text-sm font-medium text-white mb-1">Choose a file or drag & drop it here</p>
                          <p className="text-xs text-gray-500">PNG, JPG, JPEG, PDF — up to 10MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {gradingError && (
                    <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs">{gradingError}</div>
                  )}

                  <GlassButton
                    onClick={async () => {
                      if (!gradingFile || !gradingQuestion || !gradingRubric) {
                        setGradingError('Please fill in all inputs and upload a file.');
                        return;
                      }
                      setGradingError('');
                      setGradingResult(null);
                      setIsGrading(true);

                      const formData = new FormData();
                      formData.append('file', gradingFile);
                      formData.append('question', gradingQuestion);
                      formData.append('rubric', gradingRubric);

                      try {
                        const res = await axios.post('http://localhost:5001/api/documents/grade-handwritten', formData, {
                          headers: { 
                            'Content-Type': 'multipart/form-data',
                            Authorization: `Bearer ${getToken()}`
                          }
                        });
                        setGradingResult(res.data);
                      } catch (err: any) {
                        setGradingError(err.response?.data?.error || 'Grading failed. Please try again.');
                      } finally {
                        setIsGrading(false);
                      }
                    }}
                    variant="accent"
                    disabled={isGrading}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {isGrading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing OCR & Grading...</>
                    ) : (
                      <>Run AI Grading</>
                    )}
                  </GlassButton>
                </GlassPanel>

                <div className="space-y-6">
                  {gradingResult ? (
                    <GlassPanel className="p-8 space-y-6">
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="text-lg font-bold text-white">Grading Result</h3>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total Score</p>
                          <p className="text-2xl font-bold text-zinc-400">{gradingResult.totalScore}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-300">OCR Confidence Score</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            gradingResult.confidence >= 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            gradingResult.confidence >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {gradingResult.confidence.toFixed(1)}% {gradingResult.confidence < 60 && '⚠️ Low Quality'}
                          </span>
                        </div>
                        {gradingResult.confidence < 60 && (
                          <p className="text-[11px] text-yellow-500 bg-yellow-500/5 p-3 rounded-lg border border-yellow-500/10">
                            <strong>Note:</strong> Low OCR confidence detected. Please verify the extracted text below for correct grading.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Extracted Answer Text</span>
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-gray-300 max-h-[150px] overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono">
                          {gradingResult.extractedText}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Criterion Score Breakdown</span>
                        <div className="space-y-2">
                          {Object.entries(gradingResult.criteriaScores || {}).map(([criterion, score]: any) => (
                            <div key={criterion} className="flex justify-between items-center text-sm text-gray-300 bg-white/[0.01] p-3 rounded-lg border border-white/5">
                              <span className="font-medium">{criterion}</span>
                              <span className="font-bold text-zinc-400">{score}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Feedback / Suggestions</span>
                        <p className="text-sm text-gray-300 bg-zinc-500/5 p-4 rounded-xl border border-zinc-500/10 leading-relaxed">
                          {gradingResult.feedback}
                        </p>
                      </div>
                    </GlassPanel>
                  ) : (
                    <GlassPanel className="p-8 flex flex-col items-center justify-center text-center h-[400px]">
                      <FileQuestion className="w-12 h-12 text-gray-600 mb-4" />
                      <p className="text-sm text-gray-400 max-w-xs">Upload a student answer sheet on the left side to see the AI analysis here.</p>
                    </GlassPanel>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======== AI LESSON PLANNER ======== */}
          {activeView === 'lesson-planner' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3"><BookOpenCheck className="w-7 h-7 text-zinc-400" /> AI Lesson Planner</h2>
                <p className="text-gray-400 mt-1">Generate a structured, ready-to-teach lesson plan for any topic in seconds.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-5">
                  <GlassPanel className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Topic</label>
                      <input value={lessonTopic} onChange={(e) => setLessonTopic(e.target.value)} placeholder="e.g. Newton's Laws of Motion" className="glass-input w-full px-4 py-3 text-sm text-white placeholder-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Level (optional)</label>
                      <input value={lessonGrade} onChange={(e) => setLessonGrade(e.target.value)} placeholder="e.g. Grade 10 / Undergraduate" className="glass-input w-full px-4 py-3 text-sm text-white placeholder-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Duration: {lessonDuration} min</label>
                      <input type="range" min={15} max={120} step={5} value={lessonDuration} onChange={(e) => setLessonDuration(Number(e.target.value))} className="w-full accent-zinc-500" />
                    </div>
                    <GlassButton variant="accent" onClick={handleGenerateLesson} disabled={isGeneratingLesson} className="w-full flex items-center justify-center gap-2">
                      {isGeneratingLesson ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>) : (<><Sparkles className="w-4 h-4" /> Generate Lesson Plan</>)}
                    </GlassButton>
                    {lessonError && <p className="text-xs text-red-400">{lessonError}</p>}
                  </GlassPanel>

                  {lessonPlans.length > 0 && (
                    <GlassPanel className="p-5">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Saved Plans</h4>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {lessonPlans.map((p) => (
                          <div key={p._id} className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer border ${activeLessonPlan?._id === p._id ? 'bg-zinc-500/10 border-zinc-500/30' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}`} onClick={() => setActiveLessonPlan(p)}>
                            <span className="text-sm text-gray-200 truncate mr-2">{p.topic}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteLesson(p._id); }} className="text-gray-500 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </GlassPanel>
                  )}
                </div>

                <div className="lg:col-span-2">
                  {activeLessonPlan ? (
                    <GlassPanel className="p-7 space-y-6">
                      <div>
                        <h3 className="text-2xl font-bold text-white">{activeLessonPlan.plan?.title || activeLessonPlan.topic}</h3>
                        <p className="text-sm text-gray-400 mt-1">{activeLessonPlan.plan?.summary}</p>
                      </div>
                      {activeLessonPlan.plan?.objectives?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2"><Target className="w-4 h-4" /> Learning Objectives</h4>
                          <ul className="space-y-1.5">{activeLessonPlan.plan.objectives.map((o: string, i: number) => <li key={i} className="text-sm text-gray-300 flex gap-2"><Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />{o}</li>)}</ul>
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 gap-4">
                        {activeLessonPlan.plan?.prerequisites?.length > 0 && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Prerequisites</h4>
                            <ul className="space-y-1">{activeLessonPlan.plan.prerequisites.map((m: string, i: number) => <li key={i} className="text-xs text-gray-300">• {m}</li>)}</ul>
                          </div>
                        )}
                        {activeLessonPlan.plan?.materials?.length > 0 && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Materials</h4>
                            <ul className="space-y-1">{activeLessonPlan.plan.materials.map((m: string, i: number) => <li key={i} className="text-xs text-gray-300">• {m}</li>)}</ul>
                          </div>
                        )}
                      </div>
                      {activeLessonPlan.plan?.outline?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-zinc-300 mb-3">Lesson Flow</h4>
                          <div className="space-y-3">
                            {activeLessonPlan.plan.outline.map((ph: any, i: number) => (
                              <div key={i} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <div className="w-8 h-8 rounded-full bg-zinc-500/20 border border-zinc-500/30 flex items-center justify-center text-xs font-bold text-zinc-300">{i + 1}</div>
                                  {i < activeLessonPlan.plan.outline.length - 1 && <div className="w-px flex-1 bg-white/10 my-1" />}
                                </div>
                                <div className="flex-1 pb-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-white">{ph.phase}</span>
                                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{ph.durationMins} min</span>
                                  </div>
                                  <ul className="mt-1.5 space-y-1">{(ph.activities || []).map((a: string, j: number) => <li key={j} className="text-xs text-gray-400">— {a}</li>)}</ul>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 gap-4">
                        {activeLessonPlan.plan?.assessmentIdeas?.length > 0 && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assessment Ideas</h4>
                            <ul className="space-y-1">{activeLessonPlan.plan.assessmentIdeas.map((m: string, i: number) => <li key={i} className="text-xs text-gray-300">• {m}</li>)}</ul>
                          </div>
                        )}
                        {activeLessonPlan.plan?.homework?.length > 0 && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Homework</h4>
                            <ul className="space-y-1">{activeLessonPlan.plan.homework.map((m: string, i: number) => <li key={i} className="text-xs text-gray-300">• {m}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    </GlassPanel>
                  ) : (
                    <GlassPanel className="p-8 flex flex-col items-center justify-center text-center h-[400px]">
                      <Lightbulb className="w-12 h-12 text-gray-600 mb-4" />
                      <p className="text-sm text-gray-400 max-w-xs">Enter a topic and generate a full lesson plan, or pick a saved plan.</p>
                    </GlassPanel>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======== ATTENDANCE ======== */}
          {activeView === 'attendance' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3"><UserCheck className="w-7 h-7 text-zinc-400" /> Live Attendance</h2>
                <p className="text-gray-400 mt-1">Students are marked present in real time when they open the classroom. Select a class to view the live roster.</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {classrooms.map((c) => (
                  <button key={c._id} onClick={() => openAttendance(c)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${attendanceClassroom?._id === c._id ? 'bg-zinc-500/20 border-zinc-500/40 text-zinc-200' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:text-white'}`}>{c.name}</button>
                ))}
              </div>
              {attendanceClassroom ? (
                <GlassPanel className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-white">{attendanceClassroom.name}</h3>
                    <span className="text-sm"><span className="text-green-400 font-bold">{presentRoster.length}</span> <span className="text-gray-500">/ {attendanceClassroom.studentIds?.length || 0} present</span></span>
                  </div>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {(attendanceClassroom.studentIds || []).length === 0 ? (
                      <p className="text-sm text-gray-500">No students enrolled yet.</p>
                    ) : (attendanceClassroom.studentIds || []).map((s: any) => {
                      const present = presentRoster.some((p) => p.studentId === s._id);
                      return (
                        <div key={s._id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${present ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-600'}`} />
                            <div><p className="text-sm text-white font-medium">{s.name}</p><p className="text-[11px] text-gray-500">{s.email}</p></div>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${present ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-white/5 text-gray-500 border border-white/5'}`}>{present ? 'Present' : 'Absent'}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlassPanel>
              ) : (
                <GlassPanel className="p-8 text-center text-gray-400 text-sm h-[300px] flex items-center justify-center">Select a classroom above to see live attendance.</GlassPanel>
              )}
            </div>
          )}

          {/* ======== GRADEBOOK ======== */}
          {activeView === 'gradebook' && (
            <div className="animate-fade-in">
              <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3"><FileSpreadsheet className="w-7 h-7 text-zinc-400" /> Gradebook</h2>
                  <p className="text-gray-400 mt-1">Consolidated grades across all quizzes. Export to CSV or PDF.</p>
                </div>
                {gradebook && gradebook.rows?.length > 0 && (
                  <div className="flex gap-2">
                    <GlassButton onClick={exportGradebookCSV} className="text-xs flex items-center gap-1.5"><Download className="w-4 h-4" /> CSV</GlassButton>
                    <GlassButton variant="accent" onClick={exportGradebookPDF} className="text-xs flex items-center gap-1.5"><Download className="w-4 h-4" /> PDF</GlassButton>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {classrooms.map((c) => (
                  <button key={c._id} onClick={() => fetchGradebook(c)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${gradebookClassroom?._id === c._id ? 'bg-zinc-500/20 border-zinc-500/40 text-zinc-200' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:text-white'}`}>{c.name}</button>
                ))}
              </div>
              {isFetchingGradebook ? (
                <GlassPanel className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" /></GlassPanel>
              ) : gradebook ? (
                <GlassPanel className="p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="py-3.5 px-5">Student</th><th className="py-3.5 px-5">Quizzes</th><th className="py-3.5 px-5">Score</th><th className="py-3.5 px-5">Average</th><th className="py-3.5 px-5">Grade</th>
                      </tr></thead>
                      <tbody>
                        {gradebook.rows.map((r: any) => (
                          <tr key={r.studentId} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="py-3.5 px-5"><p className="text-white font-medium">{r.name}</p><p className="text-[11px] text-gray-500">{r.email}</p></td>
                            <td className="py-3.5 px-5 text-gray-300">{r.quizzesTaken}</td>
                            <td className="py-3.5 px-5 text-gray-300">{r.totalScore}/{r.totalMax}</td>
                            <td className="py-3.5 px-5"><span className="font-bold text-white">{r.averagePercent}%</span></td>
                            <td className="py-3.5 px-5"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${r.grade === 'A' ? 'bg-green-500/15 text-green-400' : r.grade === 'B' ? 'bg-zinc-500/15 text-zinc-300' : r.grade === 'C' ? 'bg-yellow-500/15 text-yellow-400' : r.grade === 'D' ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-gray-500'}`}>{r.grade}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassPanel>
              ) : (
                <GlassPanel className="p-8 text-center text-gray-400 text-sm h-[300px] flex items-center justify-center">Select a classroom above to load its gradebook.</GlassPanel>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ======== CLASSROOM MODAL ======== */}
      {isClassroomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div ref={modalRef} className="w-full max-w-md">
            <GlassPanel className="p-8">
              <h3 className="text-xl font-bold text-white mb-4">Create New Classroom</h3>
              <form onSubmit={handleCreateClassroom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Classroom Name</label>
                  <input type="text" required value={newClassroomName} onChange={(e) => setNewClassroomName(e.target.value)}
                    placeholder="e.g. Advanced Physics (Grade 12)" className="glass-input w-full px-4 py-3 text-sm text-white placeholder-gray-600" />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <GlassButton type="button" onClick={() => setIsClassroomModalOpen(false)}>Cancel</GlassButton>
                  <GlassButton type="submit" variant="accent" disabled={loading}>{loading ? 'Creating...' : 'Create'}</GlassButton>
                </div>
              </form>
            </GlassPanel>
          </div>
        </div>
      )}

      {/* Face Login Registration Modal */}
      {isFaceSetupOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md flex flex-col gap-4">
            {faceError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {faceError}
              </div>
            )}
            {faceSuccess && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{faceSuccess}</span>
              </div>
            )}
            <FaceCapture
              mode="register"
              onCaptureComplete={handleRegisterFace}
              onCancel={() => setIsFaceSetupOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Student Performance Profile Modal */}
      {selectedStudentPerf && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <GlassPanel className="p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedStudentPerf.student.name}</h3>
                  <p className="text-xs text-gray-400">{selectedStudentPerf.student.email}</p>
                </div>
                <button 
                  onClick={() => setSelectedStudentPerf(null)}
                  className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Statistics & Trend */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassPanel className="p-4 text-center">
                  <p className="text-xl font-bold text-zinc-400">{(selectedStudentPerf.averageScore || 0).toFixed(1)}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Average Score</p>
                </GlassPanel>
                <GlassPanel className="p-4 text-center">
                  <p className="text-xl font-bold text-zinc-400">{selectedStudentPerf.totalQuizzes}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Quizzes Taken</p>
                </GlassPanel>
                <GlassPanel className="p-4 text-center">
                  <p className="text-xl font-bold text-white">
                    {selectedStudentPerf.submissions.length > 0 
                      ? selectedStudentPerf.submissions[selectedStudentPerf.submissions.length - 1].score 
                      : '0'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Last Score</p>
                </GlassPanel>
              </div>

              {/* Score Trend Line Chart */}
              <GlassPanel className="p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Score Progress Trend</h4>
                <div className="h-40 w-full">
                  {selectedStudentPerf.submissions.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={selectedStudentPerf.submissions}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="quizName" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#FFF' }} />
                        <Line type="monotone" dataKey="score" name="Score" stroke="#a1a1aa" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-gray-500">
                      No quiz submission history available.
                    </div>
                  )}
                </div>
              </GlassPanel>

              {/* Submissions & AI Feedback Table */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Submission History & Feedback</span>
                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                  {selectedStudentPerf.submissions.length > 0 ? (
                    selectedStudentPerf.submissions.map((sub: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-white">{sub.quizName}</span>
                          <span className="font-mono text-zinc-400">Score: {sub.score} · Violations: {sub.violations}</span>
                        </div>
                        <p className="text-xs text-gray-400 italic">"{sub.feedback}"</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No submissions recorded.</p>
                  )}
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}

      {/* Spoken Viva review modal */}
      {selectedVivaReview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <GlassPanel className="p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Viva Session Dialogue Review</h3>
                  <p className="text-xs text-gray-400">Student: {selectedVivaReview.studentName} · Topic: {selectedVivaReview.topic}</p>
                </div>
                <button 
                  onClick={() => setSelectedVivaReview(null)}
                  className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-between items-center bg-zinc-500/5 border border-zinc-500/10 rounded-xl p-4">
                <span className="text-sm font-semibold text-gray-300">Overall Oral Score</span>
                <span className="text-xl font-bold text-zinc-400">{selectedVivaReview.score} / {selectedVivaReview.maxScore}</span>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Dialogue Exchange & Evaluation</span>
                <div className="max-h-[300px] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {selectedVivaReview.transcript.map((exchange: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-xl border ${
                      exchange.role === 'agent' 
                        ? 'bg-zinc-500/5 border-zinc-500/10' 
                        : 'bg-zinc-500/5 border-zinc-500/10'
                    }`}>
                      <div className="flex justify-between items-center mb-1 text-xs font-bold uppercase">
                        <span className={exchange.role === 'agent' ? 'text-zinc-400' : 'text-zinc-400'}>
                          {exchange.role === 'agent' ? '🤖 AI Examiner' : '👨‍🎓 Student'}
                        </span>
                        {exchange.score !== undefined && (
                          <span className="text-green-400">Score: {exchange.score} / 10</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{exchange.text}</p>
                      {exchange.feedback && (
                        <div className="mt-2 pt-2 border-t border-white/5 text-xs text-gray-400 italic">
                          <strong>Examiner Feedback:</strong> "{exchange.feedback}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  );
}
