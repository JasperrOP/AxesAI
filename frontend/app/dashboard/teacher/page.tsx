'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../../../components/GlassPanel';
import { GlassButton } from '../../../components/GlassButton';
import { 
  Plus, Users, LogOut, BookOpen, FilePlus, Copy, Check, Sparkles, 
  LayoutDashboard, FileText, Settings, Library, Wrench, ChevronRight,
  Upload, Loader2, X, Minus, CheckCircle2, Download, UploadCloud
} from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { io, Socket } from 'socket.io-client';

// ============ Types ============
interface QuestionTypeRow {
  id: string;
  type: string;
  count: number;
  marks: number;
}

const QUESTION_TYPE_OPTIONS = [
  { value: 'mcq', label: 'Multiple Choice Questions' },
  { value: 'short', label: 'Short Questions' },
  { value: 'essay', label: 'Essay / Long Answer' },
  { value: 'numerical', label: 'Numerical Problems' },
  { value: 'diagram', label: 'Diagram/Graph-Based Questions' },
];

type View = 'home' | 'classrooms' | 'assignments' | 'create-assignment' | 'view-paper';

export default function TeacherDashboard() {
  const router = useRouter();
  const [teacherName, setTeacherName] = useState('');
  const [activeView, setActiveView] = useState<View>('home');
  
  // Classrooms
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [newClassroomName, setNewClassroomName] = useState('');
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Assignments
  const [assignments, setAssignments] = useState<any[]>([]);
  const [viewingPaper, setViewingPaper] = useState<any>(null);
  
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

  const fetchClassrooms = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/classrooms', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setClassrooms(res.data.classrooms);
    } catch (err) { console.error(err); }
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
  ];

  return (
    <div ref={containerRef} className="flex min-h-screen bg-[#0A0A0B] text-white overflow-hidden">
      {/* ======== SIDEBAR ======== */}
      <aside className="w-64 min-h-screen flex flex-col border-r border-white/5 bg-white/[0.02] backdrop-blur-xl flex-shrink-0 relative z-20">
        {/* Logo */}
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            AxesAI
          </h1>
        </div>

        {/* Create Assignment CTA */}
        <div className="px-4 pt-5 pb-2">
          <button 
            onClick={() => { resetForm(); setActiveView('create-assignment'); }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20 cursor-pointer active:scale-95"
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
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
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
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/8 blur-[120px] pointer-events-none" />

        <main ref={mainContentRef} className="relative z-10 p-6 md:p-10 max-w-5xl mx-auto">

          {/* ======== HOME VIEW ======== */}
          {activeView === 'home' && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Welcome back, {teacherName} 👋</h2>
              <p className="text-sm text-gray-400 mb-8">Here's an overview of your workspace.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                <GlassPanel className="text-center py-8">
                  <p className="text-3xl font-bold text-white">{classrooms.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Classrooms</p>
                </GlassPanel>
                <GlassPanel className="text-center py-8">
                  <p className="text-3xl font-bold text-white">{assignments.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Assignments</p>
                </GlassPanel>
                <GlassPanel className="text-center py-8">
                  <p className="text-3xl font-bold text-white">{classrooms.reduce((s: number, c: any) => s + (c.studentIds?.length || 0), 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">Total Students</p>
                </GlassPanel>
              </div>

              {assignments.length === 0 ? (
                <GlassPanel className="text-center py-16">
                  <p className="text-lg font-semibold text-gray-300 mb-2">No assignments yet</p>
                  <p className="text-sm text-gray-500 mb-6">Create your first assignment to start generating AI-powered question papers.</p>
                  <GlassButton onClick={() => { resetForm(); setActiveView('create-assignment'); }} variant="accent" className="inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Your First Assignment
                  </GlassButton>
                </GlassPanel>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-gray-300 mb-4">Recent Assignments</h3>
                  <div className="space-y-3">
                    {assignments.slice(0, 5).map((a: any) => (
                      <GlassPanel key={a._id} className="flex items-center justify-between py-4 px-6 cursor-pointer hover:border-white/20 transition-all"
                        onClick={() => { setViewingPaper(a); setActiveView('view-paper'); }}>
                        <div>
                          <p className="text-sm font-semibold text-white">{a.title}</p>
                          <p className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</p>
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
                </div>
              )}
            </div>
          )}

          {/* ======== CLASSROOMS VIEW ======== */}
          {activeView === 'classrooms' && (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {classrooms.map((room: any) => (
                    <GlassPanel key={room._id} className="hover:border-white/20 transition-all">
                      <h3 className="text-lg font-bold text-white mb-2">{room.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 bg-white/5 py-1.5 px-3 rounded-full w-fit">
                        <span>Join Code: <strong className="text-cyan-300 tracking-wider">{room.joinCode}</strong></span>
                        <button onClick={() => copyCode(room.joinCode)} className="cursor-pointer text-gray-400 hover:text-white transition">
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
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> Create Assignment
                </h2>
                <p className="text-sm text-gray-400">Set up a new assignment for your students.</p>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full bg-white/5 rounded-full mb-8 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" style={{ width: '100%' }} />
              </div>

              <GlassPanel className="p-8">
                <h3 className="text-lg font-bold text-white mb-1">Assignment Details</h3>
                <p className="text-xs text-gray-500 mb-6">Basic information about your assignment</p>

                {/* File Upload */}
                <div className="mb-6">
                  <div className="p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-cyan-500/30 transition-all bg-white/[0.02] flex flex-col items-center justify-center relative cursor-pointer group">
                    <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-3 text-cyan-400">
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
                        <div className="p-3 bg-white/5 rounded-full mb-3 group-hover:bg-cyan-500/10 transition-all">
                          <UploadCloud className="w-6 h-6 text-gray-400 group-hover:text-cyan-400" />
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
                          className="col-span-5 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-500/50"
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

                  <button onClick={addQuestionType} className="mt-3 flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition cursor-pointer">
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
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
                    <p className="text-gray-400">Paper is still being generated. Please check back shortly.</p>
                  </div>
                )}
              </GlassPanel>
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
    </div>
  );
}
