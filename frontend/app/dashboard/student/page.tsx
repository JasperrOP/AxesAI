'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../../../components/GlassPanel';
import { GlassButton } from '../../../components/GlassButton';
import { Plus, User, LogOut, BookOpen, AlertCircle, Sparkles, Camera, Check, ShieldAlert, Trophy, ShieldCheck, Play, Award, Send, MessageSquare, Loader2, HelpCircle, GraduationCap, StickyNote, UserCheck, Save } from 'lucide-react';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { StudentSidebar, StudentView } from '../../../components/StudentSidebar';
import { MeetingRoom } from '../../../components/MeetingRoom';
import { AIAssistant } from '../../../components/AIAssistant';
import { ProfileSettings } from '../../../components/ProfileSettings';
import { Video as VideoIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy-load the 3D examiner head so three.js only ships when a viva actually runs.
const VivaAvatar3D = dynamic(() => import('../../../components/VivaAvatar3D').then((m) => m.VivaAvatar3D), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>,
});
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
  const [studentView, setStudentView] = useState<StudentView>('classes');
  const [myGrades, setMyGrades] = useState<any>(null);
  const [isFetchingGrades, setIsFetchingGrades] = useState(false);
  const [personalNotes, setPersonalNotes] = useState('');
  const [notesSavedFlag, setNotesSavedFlag] = useState(false);
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
  const [currentAssessmentId, setCurrentAssessmentId] = useState<string>('');
  // AI proctoring during live quizzes
  const [proctorOn, setProctorOn] = useState(false);
  const [proctorWarning, setProctorWarning] = useState('');
  const proctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctorStreamRef = useRef<MediaStream | null>(null);
  const proctorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [violationsCount, setViolationsCount] = useState<number>(0);
  const [autoSubmitted, setAutoSubmitted] = useState<boolean>(false);
  const [scoreboard, setScoreboard] = useState<any[] | null>(null);
  const [myId, setMyId] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationWarning, setViolationWarning] = useState(false);

  // AI Doubt Solver, Live Viva and tab states
  const [activeChatTab, setActiveChatTab] = useState<'chat' | 'doubt' | 'viva'>('chat');
  const [doubtMessages, setDoubtMessages] = useState<{ sender: 'user' | 'ai'; text: string; citations?: string[] }[]>([]);
  const [doubtInput, setDoubtInput] = useState('');
  const [isAskingDoubt, setIsAskingDoubt] = useState(false);
  const [doubtError, setDoubtError] = useState('');
  const [classroomDoc, setClassroomDoc] = useState<any>(null);
  // Live meeting
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [inMeeting, setInMeeting] = useState(false);

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
  const [vivaAgentState, setVivaAgentState] = useState<'idle' | 'speaking' | 'listening' | 'thinking'>('idle');
  const [vivaInterim, setVivaInterim] = useState(''); // live speech-to-text while the student speaks
  const [awaitingContinue, setAwaitingContinue] = useState(false); // student controls when the next question is asked
  // 3D examiner avatar (Ready Player Me .glb) — configurable in-app, persisted locally
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarStatus, setAvatarStatus] = useState<'loading' | 'loaded' | 'fallback'>('loading');
  const [showAvatarSetup, setShowAvatarSetup] = useState(false);
  const [avatarInput, setAvatarInput] = useState('');
  const [vivaMicLevel, setVivaMicLevel] = useState(0); // 0..1 live mic loudness for the reactive avatar
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);

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
    setMyId(user.id);
    fetchClassrooms();

    // Initialize socket connection
    socketRef.current = io('http://localhost:5001');

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Load any saved 3D examiner avatar URL
  useEffect(() => {
    const saved = localStorage.getItem('viva_avatar_url');
    if (saved) { setAvatarUrl(saved); setAvatarInput(saved); }
  }, []);

  const saveAvatarUrl = () => {
    const url = avatarInput.trim();
    localStorage.setItem('viva_avatar_url', url);
    setAvatarUrl(url);
    setAvatarStatus('loading');
    setShowAvatarSetup(false);
  };

  // ---- AI Proctoring: watch the webcam while a live quiz is running ----
  useEffect(() => {
    if (!quizActive || !selectedClassroom) {
      // teardown
      if (proctorTimerRef.current) { clearInterval(proctorTimerRef.current); proctorTimerRef.current = null; }
      proctorStreamRef.current?.getTracks().forEach((t) => t.stop());
      proctorStreamRef.current = null;
      setProctorOn(false);
      setProctorWarning('');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        proctorStreamRef.current = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});
        proctorVideoRef.current = video;
        setProctorOn(true);

        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 240;
        const ctx = canvas.getContext('2d');

        const capture = async () => {
          if (!ctx || !proctorVideoRef.current) return;
          try {
            ctx.drawImage(proctorVideoRef.current, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL('image/jpeg', 0.6);
            const token = localStorage.getItem('token');
            const res = await axios.post('http://localhost:5001/api/proctor/check', {
              frame,
              classroomId: selectedClassroom._id,
              assessmentId: currentAssessmentId || 'live-quiz',
            }, { headers: { Authorization: `Bearer ${token}` } });

            const v: string[] = res.data?.violations || [];
            if (v.length) {
              const labels: Record<string, string> = {
                no_face: 'Face not detected — stay in front of the camera',
                multiple_faces: 'Multiple people detected in frame',
                looking_away: 'Please keep your eyes on the screen',
                identity_mismatch: 'Face does not match your enrolled profile',
              };
              setProctorWarning(labels[v[0]] || 'Proctoring flag recorded');
              setTimeout(() => setProctorWarning(''), 4000);
            }
          } catch { /* transient — ignore */ }
        };

        capture();
        proctorTimerRef.current = setInterval(capture, 8000);
      } catch {
        setProctorOn(false);
      }
    })();

    return () => {
      cancelled = true;
      if (proctorTimerRef.current) { clearInterval(proctorTimerRef.current); proctorTimerRef.current = null; }
      proctorStreamRef.current?.getTracks().forEach((t) => t.stop());
      proctorStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizActive, selectedClassroom]);

  // Gentle mount fade for the whole portal
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    }
  }, []);

  // Classy staggered entrance for the classroom workspace when one is opened
  useEffect(() => {
    if (selectedClassroom) {
      gsap.fromTo('.ws-reveal',
        { opacity: 0, y: 24, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, stagger: 0.08, ease: 'power3.out', clearProps: 'filter' }
      );
    }
  }, [selectedClassroom]);

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
      setCurrentAssessmentId(data.assessmentId || '');
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

  const fetchActiveMeeting = async (classroomId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5001/api/meetings/active/${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveMeeting(res.data.meeting);
    } catch (err) {
      console.error('Failed to fetch active meeting:', err);
    }
  };

  useEffect(() => {
    if (selectedClassroom) {
      fetchClassroomDoc(selectedClassroom._id);
      fetchActiveMeeting(selectedClassroom._id);
      setInMeeting(false);
      setDoubtMessages([]);
      setDoubtError('');
    }
  }, [selectedClassroom]);

  // Spoken Viva TTS helper — speaks the question aloud and drives the AI examiner avatar state
  const speakQuestion = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;

    // Prefer a natural English voice for the examiner
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /Google UK English Female|Samantha|Microsoft Zira|Microsoft Aria/i.test(v.name)) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setVivaAgentState('speaking');
    utterance.onend = () => setVivaAgentState((prev) => (prev === 'speaking' ? 'idle' : prev));
    utterance.onerror = () => setVivaAgentState((prev) => (prev === 'speaking' ? 'idle' : prev));
    window.speechSynthesis.speak(utterance);
  };

  const handleStartViva = async () => {
    if (!selectedClassroom) return;
    setVivaActive(true);
    setVivaError('');
    setIsSubmittingVivaAnswer(false);
    setVivaProgress(1);
    setVivaFeedback(null);
    setVivaTranscript([]);
    setAwaitingContinue(false);
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
    // Full-duplex barge-in: if the examiner is still speaking, stop it so the student can talk over it.
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setVivaAgentState('listening');
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
      setVivaAgentState('listening');
      setVivaInterim('');

      // Live two-way transcript via the browser's SpeechRecognition (Chrome/Edge).
      // Whisper still does the authoritative transcription on submit; this is for realtime feel.
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const recognition = new SR();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';
          recognition.onresult = (event: any) => {
            let text = '';
            for (let i = 0; i < event.results.length; i++) {
              text += event.results[i][0].transcript;
            }
            setVivaInterim(text.trim());
          };
          recognition.onerror = () => {};
          recognitionRef.current = recognition;
          recognition.start();
        } catch { /* SpeechRecognition optional */ }
      }

      // Live mic-loudness meter so the examiner avatar reacts to your voice.
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
          setVivaMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
          micRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { /* audio metering optional */ }
    } catch (err) {
      console.error('Microphone access denied:', err);
      setVivaError('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopVivaMeters = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (micRafRef.current) { cancelAnimationFrame(micRafRef.current); micRafRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    setVivaMicLevel(0);
  };

  const stopVivaRecording = () => {
    if (recorderRef.current && isRecordingViva) {
      recorderRef.current.stop();
      // Stop all audio tracks in the stream
      recorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecordingViva(false);
      stopVivaMeters();
    }
  };

  const uploadVivaAnswer = async (audioBlob: Blob) => {
    if (!selectedClassroom) return;
    setIsSubmittingVivaAnswer(true);
    setVivaAgentState('thinking');
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
        // Don't jump straight into the next question — let the student read their
        // feedback and press Continue when they're ready.
        setVivaQuestion(nextQuestion);
        setVivaProgress((prev) => prev + 1);
        setAwaitingContinue(true);
        setVivaAgentState('idle');
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
    stopVivaMeters();
    setVivaInterim('');
    setAwaitingContinue(false);
    setVivaActive(false);
    setIsRecordingViva(false);
    setIsSubmittingVivaAnswer(false);
    setVivaAgentState('idle');
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

  // ---- Student sidebar views: grades + personal notes ----
  const fetchMyGrades = async () => {
    setIsFetchingGrades(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5001/api/classrooms/students/me/grades', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyGrades(res.data);
    } catch (err) {
      console.error('Failed to fetch grades:', err);
    } finally {
      setIsFetchingGrades(false);
    }
  };

  useEffect(() => {
    if ((studentView === 'grades' || studentView === 'home') && !myGrades) fetchMyGrades();
    if (studentView === 'notes') setPersonalNotes(localStorage.getItem(`student_notes_${myId}`) || '');
  }, [studentView]);

  const savePersonalNotes = () => {
    localStorage.setItem(`student_notes_${myId}`, personalNotes);
    setNotesSavedFlag(true);
    setTimeout(() => setNotesSavedFlag(false), 1800);
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
    <div className="themed-surface flex min-h-screen bg-theme text-white">
      <StudentSidebar
        view={studentView}
        setView={(v) => { setStudentView(v); if (v !== 'classes') setSelectedClassroom(null); }}
        studentName={studentName}
        onJoin={() => setIsModalOpen(true)}
        onFace={() => setIsFaceSetupOpen(true)}
        onLogout={handleLogout}
      />
      <div ref={containerRef} className="relative flex-1 min-w-0 p-6 md:p-10 overflow-x-hidden">
        {/* Aesthetic ambient lighting */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-zinc-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-zinc-500/10 blur-[130px] pointer-events-none" />

      {studentView === 'classes' && (
      <>
      {/* Top Navigation */}
      <nav className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-wider uppercase">My Classes</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight accent-gradient-text">
            Welcome, {studentName}
          </h1>
        </div>
        <GlassButton onClick={() => setIsModalOpen(true)} variant="accent" className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Join Classroom
        </GlassButton>
      </nav>

      {/* Main Workspace grid */}
      <main className="relative z-10 max-w-6xl mx-auto">
        {selectedClassroom ? (
          <div className="ws-reveal">
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

            {/* ---- Live Class Meeting ---- */}
            {inMeeting && activeMeeting ? (
              <div className="mb-8">
                <MeetingRoom
                  meeting={activeMeeting}
                  socket={socketRef.current}
                  userId={myId}
                  userName={studentName}
                  role="student"
                  isHost={false}
                  onLeave={() => { setInMeeting(false); fetchActiveMeeting(selectedClassroom._id); }}
                />
              </div>
            ) : activeMeeting ? (
              <GlassPanel className="p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-red-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <VideoIcon className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live class in progress
                    </h3>
                    <p className="text-xs text-gray-400">{activeMeeting.title} · Your teacher is live now.</p>
                  </div>
                </div>
                <GlassButton variant="accent" onClick={() => setInMeeting(true)} className="flex items-center gap-2">
                  <VideoIcon className="w-4 h-4" /> Join Live Class
                </GlassButton>
              </GlassPanel>
            ) : null}

            {/* Scoreboard View */}
            {scoreboard && (
              <GlassPanel className="p-8 mb-8 border-zinc-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-8 h-8 text-yellow-400" />
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">Quiz Scoreboard</h3>
                    <p className="text-xs text-gray-400">Live ranking of participants</p>
                  </div>
                </div>

                {/* Your personal result */}
                {(() => {
                  const me = scoreboard.find((s) => s.studentId === myId);
                  if (!me) return null;
                  return (
                    <div className="mb-6 bg-gradient-to-r from-zinc-500/15 to-zinc-500/15 border border-zinc-500/30 rounded-2xl p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-300 font-semibold">Your Result</p>
                        <p className="text-3xl font-extrabold text-white mt-1">{me.score} <span className="text-base font-medium text-gray-400">pts</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Rank</p>
                        <p className="text-3xl font-extrabold text-yellow-400 mt-1">#{me.rank}</p>
                      </div>
                    </div>
                  );
                })()}

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
                        <tr key={student.studentId} className={`border-b border-white/5 transition duration-150 ${student.studentId === myId ? 'bg-zinc-500/10 hover:bg-zinc-500/15' : 'hover:bg-white/5'}`}>
                          <td className="py-4 px-4 font-bold text-zinc-400">#{student.rank}</td>
                          <td className="py-4 px-4 font-medium text-white flex items-center gap-2">
                            {student.rank === 1 && <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />}
                            {student.name}
                            {student.studentId === myId && <span className="text-[10px] bg-zinc-500/20 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-500/30">You</span>}
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
                  <GlassPanel className="p-8 border-zinc-500/30 relative">
                    {proctorWarning && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 font-medium backdrop-blur">
                        ⚠ {proctorWarning}
                      </div>
                    )}
                    {/* Header with progress and timer */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-4">
                      <div>
                        <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Live Assessment</span>
                        <h3 className="text-xl font-bold text-white mt-1">Question {currentQuestionIndex + 1}</h3>
                      </div>
                      <div className="flex items-center gap-6">
                        {/* AI proctoring indicator */}
                        {proctorOn && (
                          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-red-500/25 text-xs">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-gray-400">AI Proctoring</span>
                            <span className="font-bold text-red-400">ON</span>
                          </div>
                        )}
                        {/* Violations counter */}
                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 text-xs">
                          <ShieldCheck className="w-4 h-4 text-zinc-400" />
                          <span className="text-gray-400">Violations:</span>
                          <span className={`font-bold ${violationsCount > 1 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                            {violationsCount}/3
                          </span>
                        </div>
                        {/* Timer */}
                        <div className="flex items-center gap-2 bg-zinc-950/30 px-4 py-2 rounded-xl border border-zinc-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                          <span className="text-xs text-zinc-400 font-medium">Time Left:</span>
                          <span className={`text-xl font-extrabold font-mono leading-none ${timeRemaining < 10 ? 'text-red-500 animate-ping' : 'text-zinc-300'}`}>
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
                                      ? 'border-zinc-400 bg-zinc-950/20 text-zinc-200' 
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
                              className="w-full bg-white/5 border border-white/10 focus:border-zinc-500/50 rounded-xl p-4 text-white placeholder-gray-600 outline-none text-sm resize-none transition-all"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </GlassPanel>
                )}
              </div>
            )}

            <div className={`grid grid-cols-1 gap-6 ${activeChatTab === 'viva' ? '' : 'lg:grid-cols-3'}`}>
              <div className={`flex flex-col space-y-4 ${activeChatTab === 'viva' ? '' : 'lg:col-span-2'}`}>
                {/* Tab Switcher */}
                <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-xl w-fit">
                  <button
                    onClick={() => setActiveChatTab('chat')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                      activeChatTab === 'chat'
                        ? 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <MessageSquare className="w-4.5 h-4.5" /> Class Discussion
                  </button>
                  <button
                    onClick={() => { setActiveChatTab('doubt'); if (selectedClassroom) fetchClassroomDoc(selectedClassroom._id); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                      activeChatTab === 'doubt'
                        ? 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
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
                          <Sparkles className="w-5 h-5 text-zinc-400" /> AI Doubt Solver
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          {classroomDoc ? `Answering doubts grounded in: ${classroomDoc.title}` : 'No notes uploaded yet.'}
                        </p>
                      </div>
                      <button
                        onClick={() => selectedClassroom && fetchClassroomDoc(selectedClassroom._id)}
                        className="text-[11px] text-zinc-300 hover:text-zinc-100 border border-zinc-500/30 rounded-lg px-3 py-1.5 transition"
                        title="Re-check for notes uploaded by your teacher"
                      >
                        ↻ Refresh notes
                      </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
                      {doubtMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center h-full max-w-sm mx-auto space-y-4">
                          <HelpCircle className="w-12 h-12 text-zinc-500/30" />
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
                                ? 'bg-zinc-500/10 border border-zinc-500/20 text-white rounded-br-none'
                                : 'bg-zinc-500/10 border border-zinc-500/20 text-gray-300 rounded-bl-none'
                            }`}>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-1.5 items-center">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Sources:</span>
                                  {msg.citations.map((cite, cIdx) => (
                                    <span key={cIdx} className="text-[10px] px-2 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 font-medium">
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
                          <div className="bg-zinc-500/5 border border-zinc-500/10 rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            <span className="text-xs text-zinc-400 font-semibold animate-pulse">AI is searching notes...</span>
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
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-zinc-500/50 transition"
                      />
                      <GlassButton
                        type="submit"
                        variant="accent"
                        disabled={isAskingDoubt || !doubtInput.trim() || !classroomDoc}
                        className="flex-shrink-0 px-4 flex items-center justify-center border-zinc-500/30 hover:bg-zinc-500/10 text-zinc-400"
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
                        {/* AI Examiner — person-like reactive avatar */}
                        <div className="flex flex-col items-center mb-4">
                          {/* Large 3D examiner stage */}
                          <div
                            className="relative w-full h-[420px] rounded-3xl overflow-hidden"
                            style={{
                              background: 'radial-gradient(circle at 50% 30%, rgba(70,72,90,0.35), rgba(9,9,13,0.75))',
                              border: '1px solid rgba(255,255,255,0.08)',
                              boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)',
                            }}
                          >
                            <VivaAvatar3D
                              state={vivaAgentState}
                              micLevel={vivaMicLevel}
                              modelUrl={avatarUrl || undefined}
                              onStatus={setAvatarStatus}
                            />

                            {/* Avatar setup — shown when the human model isn't loaded */}
                            <button
                              onClick={() => setShowAvatarSetup((v) => !v)}
                              className="absolute top-3 right-3 text-[11px] px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-gray-300 hover:text-white transition cursor-pointer"
                            >
                              {avatarStatus === 'loaded' ? '⚙ Change avatar' : '⚙ Use a real human avatar'}
                            </button>

                            {avatarStatus === 'fallback' && !showAvatarSetup && (
                              <div className="absolute bottom-3 left-3 right-3 text-[11px] px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200">
                                Showing the stylized examiner — add a Ready Player Me avatar URL to get a photoreal human with lip-sync.
                              </div>
                            )}

                            {showAvatarSetup && (
                              <div className="absolute inset-x-3 bottom-3 p-3 rounded-2xl bg-black/80 border border-white/15 backdrop-blur">
                                <p className="text-[11px] text-gray-300 mb-2">
                                  1. Create a free avatar at <a href="https://readyplayer.me/avatar" target="_blank" rel="noreferrer" className="underline text-white">readyplayer.me/avatar</a> →
                                  2. copy its <strong className="text-white">.glb</strong> link → 3. paste below.
                                </p>
                                <div className="flex gap-2">
                                  <input
                                    value={avatarInput}
                                    onChange={(e) => setAvatarInput(e.target.value)}
                                    placeholder="https://models.readyplayer.me/xxxxxxxx.glb"
                                    className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-white/40"
                                  />
                                  <GlassButton variant="accent" onClick={saveAvatarUrl} className="text-xs !py-2 !px-4">Load</GlassButton>
                                </div>
                              </div>
                            )}

                            {/* live mic meter bar */}
                            {vivaAgentState === 'listening' && (
                              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-red-400 transition-[width] duration-75" style={{ width: `${Math.min(100, vivaMicLevel * 130)}%` }} />
                              </div>
                            )}
                          </div>

                          <p className="mt-3 text-sm font-bold text-white">Examiner Aria</p>
                          <p className={`text-[11px] font-medium ${
                            vivaAgentState === 'speaking' ? 'text-white' :
                            vivaAgentState === 'listening' ? 'text-red-300' :
                            vivaAgentState === 'thinking' ? 'text-gray-300' : 'text-gray-500'
                          }`}>
                            {vivaAgentState === 'speaking' ? '🔊 Speaking…' :
                             vivaAgentState === 'listening' ? '🎙️ Listening to you…' :
                             vivaAgentState === 'thinking' ? '🤔 Evaluating your answer…' :
                             'Ready when you are'}
                          </p>
                          {vivaQuestion && (
                            <button
                              onClick={() => speakQuestion(vivaQuestion)}
                              className="mt-2 text-[10px] text-gray-400 hover:text-white underline"
                            >
                              ↻ Repeat question
                            </button>
                          )}
                        </div>

                        {/* Live two-way transcript while you speak */}
                        {isRecordingViva && (
                          <div className="mb-4 p-3 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-red-300 font-semibold mb-1 flex items-center justify-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> You're speaking
                            </p>
                            <p className="text-sm text-white min-h-[20px] leading-relaxed">{vivaInterim || <span className="text-gray-500">Start speaking your answer…</span>}</p>
                          </div>
                        )}

                        {/* Upper Section: Agent Question Card */}
                        <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-red-400">
                            <span>Topic: {vivaTopic}</span>
                            <span>Question {vivaProgress} of 3</span>
                          </div>

                          {vivaQuestion && (
                            <div className="p-4 bg-zinc-500/5 border border-zinc-500/10 rounded-2xl text-sm text-white font-medium leading-relaxed flex gap-2">
                              <Sparkles className="w-5 h-5 text-zinc-400 mt-0.5 flex-shrink-0" />
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
                                <div key={idx} className={`p-2 rounded-lg ${t.role === 'agent' ? 'bg-zinc-500/5 text-zinc-300' : 'bg-zinc-500/5 text-zinc-300'}`}>
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
                              <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold animate-pulse bg-zinc-500/5 px-6 py-3 rounded-full border border-zinc-500/10">
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
                            ) : awaitingContinue ? (
                              <div className="flex flex-col items-center gap-2">
                                <button
                                  onClick={() => { setAwaitingContinue(false); speakQuestion(vivaQuestion); }}
                                  className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-full hover:opacity-90 transition cursor-pointer"
                                >
                                  <Play className="w-4.5 h-4.5" />
                                  Continue to next question
                                </button>
                                <p className="text-[11px] text-gray-500">Read your feedback above, then continue when ready.</p>
                              </div>
                            ) : (
                              vivaQuestion ? (
                                <button
                                  onClick={startVivaRecording}
                                  className="flex items-center gap-2 bg-zinc-500/20 border border-zinc-500/30 text-zinc-300 font-bold px-6 py-3 rounded-full hover:bg-zinc-500/30 transition shadow-[0_0_15px_rgba(168,85,247,0.2)] cursor-pointer"
                                >
                                  <Camera className="w-4.5 h-4.5 text-zinc-400" />
                                  {vivaAgentState === 'speaking' ? 'Interrupt & Answer' : 'Speak / Record Response'}
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
              <div className={`space-y-6 ${activeChatTab === 'viva' ? 'hidden' : ''}`}>
                <GlassPanel className="p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Classroom Details</h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-gray-400">Join Code</span>
                      <span className="font-mono text-zinc-400 font-semibold">{selectedClassroom.joinCode}</span>
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
              <BookOpen className="w-5 h-5 text-zinc-400" /> Enrolled Classrooms
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
                          <User className="w-4 h-4 text-zinc-400" /> Instructor: <span className="text-gray-200">{room.teacherId?.name || 'Assigned Instructor'}</span>
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
      </>
      )}

      {/* ===== HOME VIEW ===== */}
      {studentView === 'home' && (
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-zinc-400 mb-1"><Sparkles className="w-4 h-4" /><span className="text-xs font-semibold tracking-wider uppercase">Student Portal</span></div>
            <h1 className="text-3xl font-extrabold tracking-tight accent-gradient-text">Welcome back, {studentName} 👋</h1>
            <p className="text-gray-400 mt-1 text-sm">Here's your learning workspace at a glance.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <GlassPanel className="p-6 text-center"><p className="text-3xl font-extrabold text-white">{classrooms.length}</p><p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Enrolled Classes</p></GlassPanel>
            <GlassPanel className="p-6 text-center"><p className="text-3xl font-extrabold text-white">{myGrades ? myGrades.totalQuizzes : '—'}</p><p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Quizzes Taken</p></GlassPanel>
            <GlassPanel className="p-6 text-center"><p className="text-3xl font-extrabold text-white">{myGrades ? myGrades.averageScore.toFixed(1) : '—'}</p><p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Avg Score</p></GlassPanel>
          </div>
          <div className="flex flex-wrap gap-3">
            <GlassButton variant="accent" onClick={() => setStudentView('classes')} className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Go to My Classes</GlassButton>
            <GlassButton onClick={() => setStudentView('grades')} className="flex items-center gap-2"><GraduationCap className="w-4 h-4" /> View Grades</GlassButton>
            <GlassButton onClick={() => setStudentView('notes')} className="flex items-center gap-2"><StickyNote className="w-4 h-4" /> My Notes</GlassButton>
          </div>
        </div>
      )}

      {/* ===== GRADES VIEW ===== */}
      {studentView === 'grades' && (
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="mb-8"><h1 className="text-3xl font-extrabold accent-gradient-text flex items-center gap-3"><GraduationCap className="w-7 h-7 text-zinc-400" /> My Grades</h1><p className="text-gray-400 mt-1 text-sm">Your quiz and viva results across all classes.</p></div>
          {isFetchingGrades ? (
            <GlassPanel className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" /></GlassPanel>
          ) : myGrades ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <GlassPanel className="p-5 text-center"><p className="text-2xl font-extrabold text-white">{myGrades.totalQuizzes}</p><p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Quizzes</p></GlassPanel>
                <GlassPanel className="p-5 text-center"><p className="text-2xl font-extrabold text-white">{myGrades.averageScore.toFixed(1)}</p><p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Average</p></GlassPanel>
                <GlassPanel className="p-5 text-center"><p className="text-2xl font-extrabold text-white">{myGrades.bestScore}</p><p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Best</p></GlassPanel>
              </div>
              <GlassPanel className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Quiz Results</h3>
                {myGrades.quizzes.length ? myGrades.quizzes.map((q: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/5 text-sm">
                    <span className="text-gray-300">{q.name}</span>
                    <span className="font-semibold text-green-400">{q.score} pts{q.violations > 0 && <span className="text-red-400 text-xs ml-2">{q.violations} viol.</span>}</span>
                  </div>
                )) : <p className="text-sm text-gray-500">No quizzes taken yet.</p>}
              </GlassPanel>
              <GlassPanel className="p-6">
                <h3 className="text-lg font-bold text-white mb-4">Viva Results</h3>
                {myGrades.vivas.length ? myGrades.vivas.map((v: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/5 text-sm">
                    <span className="text-gray-300">{v.topic}</span>
                    <span className="font-semibold text-green-400">{v.score}/{v.maxScore}</span>
                  </div>
                )) : <p className="text-sm text-gray-500">No viva sessions yet.</p>}
              </GlassPanel>
            </div>
          ) : <GlassPanel className="p-10 text-center text-gray-400 text-sm">No grades recorded yet.</GlassPanel>}
        </div>
      )}

      {/* ===== ATTENDANCE VIEW ===== */}
      {studentView === 'attendance' && (
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="mb-8"><h1 className="text-3xl font-extrabold accent-gradient-text flex items-center gap-3"><UserCheck className="w-7 h-7 text-zinc-400" /> Attendance</h1><p className="text-gray-400 mt-1 text-sm">You're automatically marked present when you open a live classroom.</p></div>
          <GlassPanel className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">Your Classes</h3>
            {classrooms.length ? classrooms.map((c: any) => (
              <div key={c._id} className="flex justify-between items-center py-3 border-b border-white/5">
                <div><p className="text-sm text-white font-medium">{c.name}</p><p className="text-[11px] text-gray-500">Instructor: {c.teacherId?.name || 'Assigned'}</p></div>
                <button onClick={() => { setSelectedClassroom(c); setStudentView('classes'); }} className="text-xs text-zinc-300 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition">Open &amp; mark present</button>
              </div>
            )) : <p className="text-sm text-gray-500">You haven't joined any classes yet.</p>}
          </GlassPanel>
        </div>
      )}

      {/* ===== AI ASSISTANT VIEW ===== */}
      {studentView === 'ai' && <AIAssistant userName={studentName} role="student" />}

      {/* ===== SETTINGS VIEW ===== */}
      {studentView === 'settings' && <ProfileSettings onUpdated={(u) => setStudentName(u.name)} />}

      {/* ===== NOTES VIEW ===== */}
      {studentView === 'notes' && (
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div><h1 className="text-3xl font-extrabold accent-gradient-text flex items-center gap-3"><StickyNote className="w-7 h-7 text-zinc-400" /> My Notes</h1><p className="text-gray-400 mt-1 text-sm">Private study notes, saved on this device.</p></div>
            <GlassButton variant="accent" onClick={savePersonalNotes} className="flex items-center gap-2"><Save className="w-4 h-4" /> {notesSavedFlag ? 'Saved!' : 'Save'}</GlassButton>
          </div>
          <GlassPanel className="p-2">
            <textarea value={personalNotes} onChange={(e) => setPersonalNotes(e.target.value)} placeholder="Write your study notes here…" className="w-full h-[440px] bg-transparent outline-none resize-none p-4 text-sm text-gray-200 placeholder-gray-600 leading-relaxed" />
          </GlassPanel>
        </div>
      )}

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
    </div>
  );
}
