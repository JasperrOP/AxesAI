'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../../../components/GlassPanel';
import { GlassButton } from '../../../components/GlassButton';
import { Plus, User, LogOut, BookOpen, AlertCircle, Sparkles, Camera, Check, ShieldAlert, Trophy, ShieldCheck, Play, Award, Send, MessageSquare, Loader2, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { io, Socket } from 'socket.io-client';
import FaceCapture from '../../../components/FaceCapture';
import ClassroomChat from '../../../components/ClassroomChat';

export default function StudentDashboard() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentName, setStudentName] = useState('');

  // Classroom selection & Chat Socket
  const [selectedClassroom, setSelectedClassroom] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // Face Login Setup state
  const [isFaceSetupOpen, setIsFaceSetupOpen] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [faceSuccess, setFaceSuccess] = useState('');

  // Quiz active states
  const [quizActive, setQuizActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [violationsCount, setViolationsCount] = useState<number>(0);
  const [autoSubmitted, setAutoSubmitted] = useState<boolean>(false);
  const [scoreboard, setScoreboard] = useState<any[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationWarning, setViolationWarning] = useState(false);

  // AI Doubt Solver, Live Viva and tab states
  const [activeChatTab, setActiveChatTab] = useState<'chat' | 'doubt' | 'viva'>('chat');
  const [doubtMessages, setDoubtMessages] = useState<{ sender: 'user' | 'ai'; text: string; citations?: string[] }[]>([]);
  const [doubtInput, setDoubtInput] = useState('');
  const [isAskingDoubt, setIsAskingDoubt] = useState(false);
  const [doubtError, setDoubtError] = useState('');
  const [classroomDoc, setClassroomDoc] = useState<any>(null);

  // Live Viva Spoken Exam states
  const [vivaActive, setVivaActive] = useState(false);
  const [vivaTopic, setVivaTopic] = useState('General Academic');
  const [vivaQuestion, setVivaQuestion] = useState('');
  const [isRecordingViva, setIsRecordingViva] = useState(false);
  const [isSubmittingVivaAnswer, setIsSubmittingVivaAnswer] = useState(false);
  const [vivaProgress, setVivaProgress] = useState(1);
  const [vivaFeedback, setVivaFeedback] = useState<any>(null);
  const [vivaError, setVivaError] = useState('');
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [vivaTranscript, setVivaTranscript] = useState<any[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Refs for GSAP
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!token || !userString) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userString);
    if (user.role !== 'student') {
      router.push('/dashboard/teacher');
      return;
    }

    setStudentName(user.name);
    fetchClassrooms();

    // Initialize socket connection
    socketRef.current = io('http://localhost:5001');

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Listen for quiz socket events when selectedClassroom changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedClassroom) {
      // Clear states if leaving classroom
      setQuizActive(false);
      setScoreboard(null);
      return;
    }

    const userString = localStorage.getItem('user');
    let studentId = '';
    let studentNameVal = '';
    if (userString) {
      const user = JSON.parse(userString);
      studentId = user.id;
      studentNameVal = user.name;
    }

    // Join classroom room and pass studentId/name
    socket.emit('room:join', {
      classroomId: selectedClassroom._id,
      role: 'student',
      name: studentNameVal,
      studentId
    });

    socket.on('quiz:started', (data: any) => {
      setQuizActive(true);
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.currentIndex);
      setTimeRemaining(data.timeRemaining);
      setScoreboard(null);
      setAutoSubmitted(data.isAutoSubmitted || false);
      setViolationsCount(data.violationCount || 0);
      setAnswers({});
      setCurrentAnswer('');
    });

    socket.on('quiz:question', (data: any) => {
      setQuizActive(true);
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.currentIndex);
      setTimeRemaining(data.timeRemaining);
      setCurrentAnswer('');
    });

    socket.on('quiz:tick', (data: any) => {
      setTimeRemaining(data.timeRemaining);
    });

    socket.on('quiz:violation_logged', (data: any) => {
      setViolationsCount(data.violationCount);
      setViolationWarning(true);
    });

    socket.on('quiz:auto_submitted', (data: any) => {
      setAutoSubmitted(true);
      setQuizActive(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    });

    socket.on('quiz:ended', (data: any) => {
      setQuizActive(false);
      setScoreboard(data.scoreboard);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    });

    return () => {
      socket.off('quiz:started');
      socket.off('quiz:question');
      socket.off('quiz:tick');
      socket.off('quiz:violation_logged');
      socket.off('quiz:auto_submitted');
      socket.off('quiz:ended');
    };
  }, [selectedClassroom]);

  const fetchClassroomDoc = async (classroomId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5001/api/documents/classroom-doc/${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassroomDoc(res.data.doc);
    } catch (err) {
      console.error('Failed to fetch classroom document:', err);
    }
  };

  const handleAskDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtInput.trim() || !selectedClassroom) return;
    setIsAskingDoubt(true);
    setDoubtError('');

    const userMessage = doubtInput.trim();
    setDoubtMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setDoubtInput('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5001/api/documents/query-classroom-doc', {
        classroomId: selectedClassroom._id,
        query: userMessage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDoubtMessages((prev) => [...prev, {
        sender: 'ai',
        text: res.data.answer,
        citations: res.data.citations
      }]);
    } catch (err: any) {
      setDoubtError(err.response?.data?.error || 'Failed to query doubt. Make sure study notes are uploaded.');
    } finally {
      setIsAskingDoubt(false);
    }
  };

  useEffect(() => {
    if (selectedClassroom) {
      fetchClassroomDoc(selectedClassroom._id);
      setDoubtMessages([]);
      setDoubtError('');
    }
  }, [selectedClassroom]);

  // Spoken Viva TTS helper
  const speakQuestion = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly slower for clarity
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStartViva = async () => {
    if (!selectedClassroom) return;
    setVivaActive(true);
    setVivaError('');
    setIsSubmittingVivaAnswer(false);
    setVivaProgress(1);
    setVivaFeedback(null);
    setVivaTranscript([]);
    setAudioChunks([]);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5001/api/classrooms/viva/start', {
        classroomId: selectedClassroom._id,
        topic: vivaTopic
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setVivaQuestion(res.data.question);
      setVivaTranscript([{ role: 'agent', text: res.data.question }]);
      speakQuestion(res.data.question);
    } catch (err: any) {
      setVivaError(err.response?.data?.error || 'Failed to start viva session.');
      setVivaActive(false);
    }
  };

  const startVivaRecording = async () => {
    setAudioChunks([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorderRef.current = recorder;

      const localChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          localChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(localChunks, { type: 'audio/webm' });
        await uploadVivaAnswer(audioBlob);
      };

      recorder.start();
      setIsRecordingViva(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setVivaError('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopVivaRecording = () => {
    if (recorderRef.current && isRecordingViva) {
      recorderRef.current.stop();
      // Stop all audio tracks in the stream
      recorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecordingViva(false);
    }
  };

  const uploadVivaAnswer = async (audioBlob: Blob) => {
    if (!selectedClassroom) return;
    setIsSubmittingVivaAnswer(true);
    setVivaError('');

    const formData = new FormData();
    formData.append('audio', audioBlob, 'viva_answer.webm');
    formData.append('classroomId', selectedClassroom._id);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5001/api/classrooms/viva/submit-answer', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      const { studentAnswer, score, feedback, nextQuestion, isFinal } = res.data;

      // Update transcript
      setVivaTranscript((prev) => [
        ...prev,
        { role: 'student', text: studentAnswer, score, feedback },
        { role: 'agent', text: nextQuestion }
      ]);

      setVivaFeedback({ score, feedback });

      if (isFinal) {
        setVivaQuestion('');
        speakQuestion("Viva completed. Well done.");
      } else {
        setVivaQuestion(nextQuestion);
        setVivaProgress((prev) => prev + 1);
        speakQuestion(nextQuestion);
      }
    } catch (err: any) {
      setVivaError(err.response?.data?.error || 'Failed to submit verbal answer. Please try again.');
    } finally {
      setIsSubmittingVivaAnswer(false);
    }
  };

  const cancelViva = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVivaActive(false);
    setIsRecordingViva(false);
    setIsSubmittingVivaAnswer(false);
  };

  // Anti-cheat detection logic
  useEffect(() => {
    if (!quizActive || autoSubmitted || !isFullscreen) return;

    const logViolation = (type: 'fullscreen_exit' | 'tab_switch' | 'blur') => {
      if (!quizActive || autoSubmitted || !selectedClassroom) return;
      const userString = localStorage.getItem('user');
      if (!userString) return;
      const user = JSON.parse(userString);

      socketRef.current?.emit('quiz:violation', {
        classroomId: selectedClassroom._id,
        studentId: user.id,
        studentName: user.name,
        type
      });
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        logViolation('fullscreen_exit');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch');
      }
    };

    const handleWindowBlur = () => {
      logViolation('blur');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [quizActive, autoSubmitted, isFullscreen, selectedClassroom]);

  const handleStartQuiz = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (err) {
      console.error('Failed to enter fullscreen:', err);
    }
  };

  const handleAnswerChange = (ans: string) => {
    if (!selectedClassroom || !socketRef.current || autoSubmitted) return;
    const userString = localStorage.getItem('user');
    if (!userString) return;
    const user = JSON.parse(userString);

    setAnswers(prev => ({ ...prev, [currentQuestionIndex]: ans }));
    setCurrentAnswer(ans);

    socketRef.current.emit('quiz:submit_answer', {
      classroomId: selectedClassroom._id,
      studentId: user.id,
      studentName: user.name,
      questionIndex: currentQuestionIndex,
      answer: ans
    });
  };

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5001/api/classrooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassrooms(res.data.classrooms);

      setTimeout(() => {
        gsap.fromTo('.classroom-card', 
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
        );
      }, 100);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch classrooms.');
    }
  };

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5001/api/classrooms/join', 
        { joinCode: joinCode.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(res.data.message || 'Joined classroom successfully!');
      setJoinCode('');
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess('');
        fetchClassrooms();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join classroom.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFace = async (frames: string[]) => {
    setFaceError('');
    setFaceSuccess('');
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5001/api/auth/register-face', 
        { frames }, 
        { headers: { Authorization: `Bearer ${token}` } }
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  useEffect(() => {
    if (isModalOpen) {
      gsap.fromTo(modalRef.current,
        { opacity: 0, scale: 0.9, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
      );
    }
  }, [isModalOpen]);

  return (
    <div ref={containerRef} className="relative min-h-screen w-full bg-[#0A0A0B] text-white p-6 md:p-12 overflow-x-hidden">
      {/* Aesthetic ambient lighting */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[130px] pointer-events-none" />

      {/* Top Navigation */}
      <nav className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-wider uppercase">AxesAI Student Portal</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Welcome, {studentName}
          </h1>
        </div>
        <div className="flex gap-3">
          <GlassButton onClick={() => setIsFaceSetupOpen(true)} className="flex items-center gap-2 border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-300">
            <Camera className="w-4 h-4" /> Setup Face Login
          </GlassButton>
          <GlassButton onClick={() => setIsModalOpen(true)} variant="accent" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Join Classroom
          </GlassButton>
          <GlassButton onClick={handleLogout} className="flex items-center gap-2 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30">
            <LogOut className="w-4 h-4 text-red-400" /> Sign Out
          </GlassButton>
        </div>
      </nav>

      {/* Main Workspace grid */}
      <main className="relative z-10 max-w-6xl mx-auto">
        {selectedClassroom ? (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <GlassButton onClick={() => setSelectedClassroom(null)} className="text-xs">
                &larr; Back to Classrooms
              </GlassButton>
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedClassroom.name}</h2>
                <p className="text-xs text-gray-400">
                  Instructor: {selectedClassroom.teacherId?.name || 'Assigned Instructor'}
                </p>
              </div>
            </div>

            {/* Scoreboard View */}
            {scoreboard && (
              <GlassPanel className="p-8 mb-8 border-cyan-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-8 h-8 text-yellow-400" />
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">Quiz Scoreboard</h3>
                    <p className="text-xs text-gray-400">Live ranking of participants</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Score</th>
                        <th className="py-3 px-4">Violations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoreboard.map((student) => (
                        <tr key={student.studentId} className="border-b border-white/5 hover:bg-white/5 transition duration-150">
                          <td className="py-4 px-4 font-bold text-cyan-400">#{student.rank}</td>
                          <td className="py-4 px-4 font-medium text-white flex items-center gap-2">
                            {student.rank === 1 && <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />}
                            {student.name}
                          </td>
                          <td className="py-4 px-4 font-semibold text-green-400">{student.score} pts</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-1 rounded text-xs ${student.violationCount > 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                              {student.violationCount} violations
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <GlassButton onClick={() => setScoreboard(null)}>Close Scoreboard</GlassButton>
                </div>
              </GlassPanel>
            )}

            {/* Disqualified / Auto-submitted due to violations */}
            {autoSubmitted && (
              <GlassPanel className="p-8 mb-8 border-red-500/30 bg-red-950/20 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
                <h3 className="text-2xl font-bold text-red-400 mb-2">Quiz Auto-Submitted</h3>
                <p className="text-gray-300 max-w-md mx-auto mb-4">
                  You have exceeded the maximum limit of 3 anti-cheat violations (exiting fullscreen, switching tabs, or clicking out of the window). Your quiz was automatically submitted.
                </p>
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 max-w-sm mx-auto text-sm text-gray-400">
                  <div className="flex justify-between mb-2">
                    <span>Violation Limit:</span>
                    <span>3</span>
                  </div>
                  <div className="flex justify-between text-red-400 font-bold">
                    <span>Your Violations:</span>
                    <span>{violationsCount}</span>
                  </div>
                </div>
              </GlassPanel>
            )}

            {/* Live Active Quiz Container */}
            {quizActive && !autoSubmitted && (
              <div className="mb-8">
                {!isFullscreen ? (
                  <GlassPanel className="p-8 text-center border-yellow-500/30 bg-yellow-950/10">
                    <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
                    <h3 className="text-2xl font-bold text-white mb-2">Live Quiz Active</h3>
                    <p className="text-gray-300 max-w-md mx-auto mb-6">
                      A live quiz is currently running. You must enter fullscreen mode to start answering. The anti-cheat system will monitor tab switching and window blurs.
                    </p>
                    <GlassButton onClick={handleStartQuiz} variant="accent" className="flex items-center gap-2 mx-auto">
                      <Play className="w-4 h-4" /> Enter Fullscreen & Join
                    </GlassButton>
                  </GlassPanel>
                ) : (
                  <GlassPanel className="p-8 border-cyan-500/30 relative">
                    {/* Header with progress and timer */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-4">
                      <div>
                        <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">Live Assessment</span>
                        <h3 className="text-xl font-bold text-white mt-1">Question {currentQuestionIndex + 1}</h3>
                      </div>
                      <div className="flex items-center gap-6">
                        {/* Violations counter */}
                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 text-xs">
                          <ShieldCheck className="w-4 h-4 text-cyan-400" />
                          <span className="text-gray-400">Violations:</span>
                          <span className={`font-bold ${violationsCount > 1 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                            {violationsCount}/3
                          </span>
                        </div>
                        {/* Timer */}
                        <div className="flex items-center gap-2 bg-cyan-950/30 px-4 py-2 rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                          <span className="text-xs text-cyan-400 font-medium">Time Left:</span>
                          <span className={`text-xl font-extrabold font-mono leading-none ${timeRemaining < 10 ? 'text-red-500 animate-ping' : 'text-cyan-300'}`}>
                            {timeRemaining}s
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Question Content */}
                    {currentQuestion && (
                      <div className="space-y-6">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-semibold bg-white/5 px-2.5 py-1 rounded text-gray-300">
                              {currentQuestion.type?.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-400">
                              Marks: {currentQuestion.marks}
                            </span>
                          </div>
                          <p className="text-lg text-white font-medium">{currentQuestion.prompt}</p>
                        </div>

                        {/* Answer Input depending on question type */}
                        {currentQuestion.type === 'mcq' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentQuestion.options?.map((opt: string, idx: number) => {
                              const isSelected = currentAnswer === opt;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleAnswerChange(opt)}
                                  className={`p-4 rounded-xl border text-left text-sm transition-all ${
                                    isSelected 
                                      ? 'border-cyan-400 bg-cyan-950/20 text-cyan-200' 
                                      : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:border-white/20'
                                  }`}
                                >
                                  <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Answer</label>
                            <textarea
                              value={currentAnswer}
                              onChange={(e) => handleAnswerChange(e.target.value)}
                              rows={5}
                              placeholder="Type your response here..."
                              className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/50 rounded-xl p-4 text-white placeholder-gray-600 outline-none text-sm resize-none transition-all"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </GlassPanel>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 flex flex-col space-y-4">
                {/* Tab Switcher */}
                <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-xl w-fit">
                  <button
                    onClick={() => setActiveChatTab('chat')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                      activeChatTab === 'chat'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare className="w-4.5 h-4.5" /> Class Discussion
                  </button>
                  <button
                    onClick={() => setActiveChatTab('doubt')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                      activeChatTab === 'doubt'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sparkles className="w-4.5 h-4.5" /> AI Doubt Solver (PageIndex RAG)
                  </button>
                  <button
                    onClick={() => setActiveChatTab('viva')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                      activeChatTab === 'viva'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Camera className="w-4.5 h-4.5" /> Live Spoken Viva (Oral Exam)
                  </button>
                </div>

                {activeChatTab === 'chat' ? (
                  <ClassroomChat classroomId={selectedClassroom._id} socket={socketRef.current} />
                ) : activeChatTab === 'doubt' ? (
                  <GlassPanel className="p-6 flex flex-col h-[550px] relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                      <div>
                        <h3 className="text-md font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-400" /> AI Doubt Solver
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          {classroomDoc ? `Answering doubts grounded in: ${classroomDoc.title}` : 'No notes uploaded yet.'}
                        </p>
                      </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
                      {doubtMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center h-full max-w-sm mx-auto space-y-4">
                          <HelpCircle className="w-12 h-12 text-purple-500/30" />
                          <div>
                            <p className="text-sm font-semibold text-gray-300">Grounded AI RAG Chatbot</p>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                              {classroomDoc 
                                ? 'Ask me questions about the uploaded study notes! I will find the relevant section, generate a grounded answer, and cite the source.' 
                                : 'Ask your teacher to upload study notes (PDF/images) in this classroom to enable the AI Doubt Solver.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        doubtMessages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                              msg.sender === 'user'
                                ? 'bg-cyan-500/10 border border-cyan-500/20 text-white rounded-br-none'
                                : 'bg-purple-500/10 border border-purple-500/20 text-gray-300 rounded-bl-none'
                            }`}>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-1.5 items-center">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Sources:</span>
                                  {msg.citations.map((cite, cIdx) => (
                                    <span key={cIdx} className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium">
                                      {cite}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      
                      {isAskingDoubt && (
                        <div className="flex justify-start">
                          <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                            <span className="text-xs text-purple-400 font-semibold animate-pulse">AI is searching notes...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {doubtError && (
                      <p className="text-xs text-red-400 mb-3 bg-red-500/5 p-2.5 rounded-xl border border-red-500/10">{doubtError}</p>
                    )}

                    {/* Input Area */}
                    <form onSubmit={handleAskDoubt} className="flex gap-2">
                      <input
                        type="text"
                        value={doubtInput}
                        onChange={(e) => setDoubtInput(e.target.value)}
                        placeholder={classroomDoc ? "Ask a doubt about notes..." : "Upload notes to ask doubts..."}
                        disabled={isAskingDoubt || !classroomDoc}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 transition"
                      />
                      <GlassButton
                        type="submit"
                        variant="accent"
                        disabled={isAskingDoubt || !doubtInput.trim() || !classroomDoc}
                        className="flex-shrink-0 px-4 flex items-center justify-center border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
                      >
                        <Send className="w-4 h-4" />
                      </GlassButton>
                    </form>
                  </GlassPanel>
                ) : (
                  <GlassPanel className="p-6 flex flex-col h-[550px] relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                      <div>
                        <h3 className="text-md font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-red-400 animate-pulse" /> AI Spoken Viva (Oral Exam)
                        </h3>
                        <p className="text-[11px] text-gray-500">Conduct a live dynamic oral examination with dynamic follow-up questions</p>
                      </div>
                      {vivaActive && (
                        <GlassButton onClick={cancelViva} className="text-xs border-red-500/30 text-red-400 py-1.5 px-3">
                          Cancel Viva
                        </GlassButton>
                      )}
                    </div>

                    {!vivaActive ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
                        <Sparkles className="w-12 h-12 text-red-400 animate-pulse" />
                        <div>
                          <p className="text-sm font-semibold text-gray-300">Live AI Spoken Viva</p>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            Prepare to test your knowledge verbally! The AI agent will speak questions, transcribe your answers using Whisper, evaluate them, and generate follow-up questions.
                          </p>
                        </div>
                        <div className="w-full space-y-3">
                          <div className="text-left">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Select/Type Viva Topic</label>
                            <input
                              type="text"
                              value={vivaTopic}
                              onChange={(e) => setVivaTopic(e.target.value)}
                              placeholder="e.g. Newton's Laws, Photosynthesis, Javascript..."
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-red-500/50 mt-1 transition"
                            />
                          </div>
                          <GlassButton onClick={handleStartViva} variant="accent" className="w-full flex items-center justify-center gap-2">
                            <Play className="w-4 h-4" /> Start Spoken Viva
                          </GlassButton>
                        </div>
                        {vivaError && (
                          <p className="text-xs text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10 w-full">{vivaError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between">
                        {/* Upper Section: Agent Question Card */}
                        <div className="space-y-4 overflow-y-auto max-h-[380px] pr-1">
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-red-400">
                            <span>Topic: {vivaTopic}</span>
                            <span>Question {vivaProgress} of 3</span>
                          </div>

                          {vivaQuestion && (
                            <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl text-sm text-white font-medium leading-relaxed flex gap-2">
                              <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                              <p>{vivaQuestion}</p>
                            </div>
                          )}

                          {vivaFeedback && (
                            <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl text-xs space-y-1.5 text-gray-300">
                              <div className="flex justify-between font-bold text-green-400">
                                <span>Previous Score:</span>
                                <span>{vivaFeedback.score} / 10</span>
                              </div>
                              <p className="leading-relaxed"><strong>Feedback:</strong> {vivaFeedback.feedback}</p>
                            </div>
                          )}

                          {/* Mini Transcript */}
                          <div className="space-y-2 mt-4 border-t border-white/5 pt-4">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Live Transcript</p>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto text-xs">
                              {vivaTranscript.map((t, idx) => (
                                <div key={idx} className={`p-2 rounded-lg ${t.role === 'agent' ? 'bg-purple-500/5 text-purple-300' : 'bg-cyan-500/5 text-cyan-300'}`}>
                                  <strong>{t.role === 'agent' ? 'AI Agent' : 'You'}:</strong> {t.text}
                                  {t.score !== undefined && <span className="float-right text-[10px] text-green-400 font-bold">{t.score}/10</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Lower Section: Controls */}
                        <div className="border-t border-white/10 pt-4 space-y-3">
                          {vivaError && (
                            <p className="text-xs text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10">{vivaError}</p>
                          )}
                          <div className="flex justify-center">
                            {isSubmittingVivaAnswer ? (
                              <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold animate-pulse bg-purple-500/5 px-6 py-3 rounded-full border border-purple-500/10">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Processing & evaluating response...</span>
                              </div>
                            ) : isRecordingViva ? (
                              <button
                                onClick={stopVivaRecording}
                                className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-400 font-bold px-6 py-3 rounded-full hover:bg-red-500/30 transition shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse cursor-pointer"
                              >
                                <span className="w-3 h-3 rounded-full bg-red-500 inline-block animate-ping" />
                                Stop & Submit Spoken Answer
                              </button>
                            ) : (
                              vivaQuestion ? (
                                <button
                                  onClick={startVivaRecording}
                                  className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold px-6 py-3 rounded-full hover:bg-purple-500/30 transition shadow-[0_0_15px_rgba(168,85,247,0.2)] cursor-pointer"
                                >
                                  <Camera className="w-4.5 h-4.5 text-purple-400" />
                                  Speak / Record Response
                                </button>
                              ) : (
                                <div className="text-center w-full space-y-3">
                                  <p className="text-sm text-green-400 font-semibold flex items-center justify-center gap-2">
                                    <Check className="w-5 h-5" /> Viva Complete!
                                  </p>
                                  <GlassButton onClick={() => { setVivaActive(false); setVivaFeedback(null); setVivaTranscript([]); }} variant="accent" className="w-full">
                                    Close Session
                                  </GlassButton>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </GlassPanel>
                )}
              </div>
              <div className="space-y-6">
                <GlassPanel className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Classroom Details</h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-gray-400">Join Code</span>
                      <span className="font-mono text-cyan-400 font-semibold">{selectedClassroom.joinCode}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-gray-400">Status</span>
                      <span className="text-green-400 font-medium">Active</span>
                    </div>
                  </div>
                </GlassPanel>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-gray-300 mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" /> Enrolled Classrooms
            </h2>

            {classrooms.length === 0 ? (
              <GlassPanel className="text-center py-16">
                <p className="text-gray-400 mb-4">You have not joined any classrooms yet.</p>
                <GlassButton onClick={() => setIsModalOpen(true)} variant="accent">
                  Join a Classroom
                </GlassButton>
              </GlassPanel>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classrooms.map((room) => (
                  <div key={room._id} className="classroom-card opacity-0 cursor-pointer" onClick={() => setSelectedClassroom(room)}>
                    <GlassPanel className="h-full flex flex-col justify-between hover:border-white/20 transition-all duration-300">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{room.name}</h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-4">
                          <User className="w-4 h-4 text-cyan-400" /> Instructor: <span className="text-gray-200">{room.teacherId?.name || 'Assigned Instructor'}</span>
                        </p>
                      </div>

                      <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5 text-[11px] text-yellow-400/90 font-medium">
                          <AlertCircle className="w-4 h-4" /> Live Classroom Portal
                        </span>
                        <span className="text-[10px] bg-white/5 py-1 px-2.5 rounded-full">
                          Status: Active
                        </span>
                      </div>
                    </GlassPanel>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Violation Warning Modal */}
      {violationWarning && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-red-950/20 border border-red-500/30 p-8 rounded-2xl text-center">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-white mb-2">Anti-Cheat Alert!</h3>
            <p className="text-sm text-gray-300 mb-6">
              A window blur, tab switch, or fullscreen exit was detected. This action has been logged on the server.
            </p>
            <div className="text-sm text-red-400 font-semibold mb-6">
              Warnings logged: {violationsCount} / 3
            </div>
            <GlassButton
              onClick={() => {
                setViolationWarning(false);
                if (violationsCount < 3) {
                  handleStartQuiz();
                }
              }}
              variant="accent"
              className="mx-auto"
            >
              Understand & Resume Fullscreen
            </GlassButton>
          </div>
        </div>
      )}

      {/* Join Classroom Glass Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div ref={modalRef} className="w-full max-w-md">
            <GlassPanel className="p-8">
              <h3 className="text-xl font-bold text-white mb-4">Join Classroom</h3>
              
              {error && (
                <div className="p-3 mb-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 mb-4 rounded-xl border border-green-500/20 bg-green-500/10 text-green-400 text-xs">
                  {success}
                </div>
              )}

              <form onSubmit={handleJoinClassroom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Classroom Join Code</label>
                  <input 
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="e.g. 6D8A9X"
                    className="glass-input w-full px-4 py-3 text-sm text-white placeholder-gray-600 uppercase"
                    maxLength={6}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <GlassButton type="button" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </GlassButton>
                  <GlassButton type="submit" variant="accent" disabled={loading}>
                    {loading ? 'Joining...' : 'Join'}
                  </GlassButton>
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
    </div>
  );
}
