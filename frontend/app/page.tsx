'use client';

import React, { useState } from 'react';
import { GlassButton } from '../components/GlassButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { Reveal } from '../components/Reveal';
import {
  Mail, Lock, User, Sparkles, ArrowRight, Camera, X,
  ScanLine, BarChart3, Search, LayoutDashboard, Mic, MessageSquareText,
  GraduationCap, Zap, ShieldCheck, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import FaceCapture from '../components/FaceCapture';
import { AuthAside } from '../components/AuthAside';

const FEATURES = [
  { icon: ScanLine, title: 'Handwritten OCR Grading', desc: 'Snap a photo of a handwritten answer — AI reads it, grades against your rubric, and flags low-confidence scans for review.', color: '#0a84ff' },
  { icon: BarChart3, title: 'Class Performance Analytics', desc: 'Submission rates, averages, medians and strong/average/at-risk bands — computed live from every quiz.', color: '#30b0c7' },
  { icon: Search, title: 'Instant Student Search', desc: 'Find any student across all your classrooms in milliseconds, with a full grade & feedback history.', color: '#a855f7' },
  { icon: LayoutDashboard, title: 'AI Teacher Home', desc: 'See what you graded, hours saved by AI, and every assignment’s submission progress at a glance.', color: '#f59e0b' },
  { icon: MessageSquareText, title: 'AI Doubt Solver', desc: 'Vector-less PageIndex RAG reasons over your notes’ structure to answer student doubts — with citations.', color: '#22c55e' },
  { icon: Mic, title: 'Live AI Viva', desc: 'A spoken oral examiner asks, listens (Whisper), evaluates, and adapts follow-ups in real time.', color: '#ef4444' },
];

const STEPS = [
  { n: '01', title: 'Create your classroom', desc: 'Spin up a class, share a join code, and onboard students in seconds.' },
  { n: '02', title: 'Upload notes & generate', desc: 'Drop in a PDF — AI builds assessments and a doubt-solving knowledge base.' },
  { n: '03', title: 'Run live quizzes & viva', desc: 'Launch synchronized timed quizzes and spoken vivas to the whole room.' },
  { n: '04', title: 'Track performance', desc: 'Grades, analytics and time-saved land on your dashboard automatically.' },
];

const STATS = [
  { value: '6', label: 'AI-powered modules' },
  { value: '~10 min', label: 'Saved per graded paper' },
  { value: 'Real-time', label: 'Live quizzes & viva' },
  { value: '100%', label: 'Grounded, cited answers' },
];

export default function LandingShowcase() {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [useFaceLogin, setUseFaceLogin] = useState(false);
  const [showFaceCapture, setShowFaceCapture] = useState(false);

  // Auth Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setMessage(null);
    setUseFaceLogin(false);
    setShowAuth(true);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'login' && useFaceLogin) {
      if (!email) {
        setMessage({ type: 'error', text: 'Email is required for Face ID login' });
        return;
      }
      setShowFaceCapture(true);
      return;
    }

    setLoading(true);
    setMessage(null);

    const baseUrl = 'http://localhost:5001/api/auth';
    const endpoint = authMode === 'login' ? `${baseUrl}/login` : `${baseUrl}/register`;
    const payload = authMode === 'login' ? { email, password } : { name, email, password, role };

    try {
      const response = await axios.post(endpoint, payload);
      setMessage({
        type: 'success',
        text: response.data.message || (authMode === 'login' ? 'Logged in successfully!' : 'Registered successfully!'),
      });

      if (authMode === 'login' && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setTimeout(() => {
          router.push(response.data.user.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
        }, 400);
      } else {
        setTimeout(() => {
          setAuthMode('login');
          setMessage(null);
          setName(''); setEmail(''); setPassword('');
        }, 1500);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Something went wrong. Please check if backend is running.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFaceCaptured = async (frames: string[]) => {
    setShowFaceCapture(false);
    setLoading(true);
    setMessage(null);
    try {
      const response = await axios.post('http://localhost:5001/api/auth/login-face', {
        email: email.toLowerCase().trim(),
        frame: frames[0],
      });
      setMessage({ type: 'success', text: response.data.message || 'Logged in successfully!' });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setTimeout(() => {
          router.push(response.data.user.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
        }, 400);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Face login failed. Make sure Face ID is set up for this email.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }} />
      <div className="fixed bottom-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full blur-[160px] pointer-events-none" style={{ background: 'color-mix(in srgb, var(--accent-2) 18%, transparent)' }} />

      {/* ============ NAV ============ */}
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-40 w-full"
      >
        <div className="mx-auto max-w-6xl px-5">
          <div className="mt-4 glass-panel !rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#1c1c1e' }}>
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-theme">AxesAI</span>
            </div>
            <div className="hidden md:flex items-center gap-7 text-sm font-medium text-theme-muted">
              <a href="#features" className="hover:text-theme transition-colors">Features</a>
              <a href="#how" className="hover:text-theme transition-colors">How it works</a>
              <a href="#cta" className="hover:text-theme transition-colors">For schools</a>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={() => openAuth('login')} className="hidden sm:block text-sm font-semibold text-theme-muted hover:text-theme transition-colors px-3 py-2">Sign in</button>
              <GlassButton variant="accent" onClick={() => openAuth('register')} className="text-sm !py-2 !px-4 flex items-center gap-1.5">
                Get started <ArrowRight className="w-4 h-4" />
              </GlassButton>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* ============ HERO ============ */}
      <section className="relative">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="relative mx-auto max-w-4xl px-5 pt-20 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel !rounded-full mb-7"
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold tracking-wider uppercase text-theme-muted">The AI operating system for classrooms</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05] text-theme"
          >
            Teach, assess and grade<br />
            <span className="accent-gradient-text">at the speed of AI.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 text-lg text-theme-muted max-w-2xl mx-auto leading-relaxed"
          >
            AxesAI unifies AI assessment generation, live quizzes, handwritten OCR grading, grounded doubt-solving, and spoken viva — one platform built for schools and colleges.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <GlassButton variant="accent" onClick={() => openAuth('register')} className="w-full sm:w-auto text-base !px-7 !py-3.5 flex items-center justify-center gap-2">
              Start free <ArrowRight className="w-5 h-5" />
            </GlassButton>
            <GlassButton onClick={() => openAuth('login')} className="w-full sm:w-auto text-base !px-7 !py-3.5">
              Sign in
            </GlassButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-6 flex items-center justify-center gap-2 text-xs text-theme-subtle"
          >
            <ShieldCheck className="w-4 h-4" /> JWT + optional Face ID · No credit card required
          </motion.div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="relative mx-auto max-w-5xl px-5 pb-8">
        <Reveal>
          <div className="glass-panel px-6 py-7 grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold accent-gradient-text">{s.value}</div>
                <div className="text-xs text-theme-muted mt-1.5">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="relative mx-auto max-w-6xl px-5 py-24">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Everything in one place</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-theme mt-3">Six AI modules. One platform.</h2>
          <p className="text-theme-muted mt-4 text-lg">Each feature replaces hours of manual work — and they all share one classroom, one gradebook, one login.</p>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="glass-panel h-full p-7 group"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <f.icon className="w-6 h-6" style={{ color: 'var(--text)' }} />
                </div>
                <h3 className="text-lg font-bold text-theme mb-2">{f.title}</h3>
                <p className="text-sm text-theme-muted leading-relaxed">{f.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="relative mx-auto max-w-6xl px-5 py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>How it works</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-theme mt-3">From class to insights in four steps</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="glass-panel h-full p-7">
                <div className="text-4xl font-extrabold mb-4 accent-gradient-text">{s.n}</div>
                <h3 className="text-base font-bold text-theme mb-2">{s.title}</h3>
                <p className="text-sm text-theme-muted leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section id="cta" className="relative mx-auto max-w-5xl px-5 py-20">
        <Reveal>
          <div className="glass-panel relative overflow-hidden px-8 py-16 text-center">
            <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />
            <div className="relative">
              <Zap className="w-10 h-10 mx-auto mb-5" style={{ color: 'var(--accent)' }} />
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-theme">Bring AxesAI to your school</h2>
              <p className="text-theme-muted mt-4 max-w-xl mx-auto text-lg">Give every teacher an AI co-pilot and every student a fairer, faster classroom.</p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <GlassButton variant="accent" onClick={() => openAuth('register')} className="w-full sm:w-auto text-base !px-8 !py-3.5 flex items-center justify-center gap-2">
                  Create your account <ArrowRight className="w-5 h-5" />
                </GlassButton>
                <GlassButton onClick={() => openAuth('login')} className="w-full sm:w-auto text-base !px-8 !py-3.5">Sign in</GlassButton>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t mt-10" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1c1c1e' }}>
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-theme">AxesAI</span>
          </div>
          <p className="text-xs text-theme-subtle">© {new Date().getFullYear()} AxesAI · AI classroom & assessment platform.</p>
        </div>
      </footer>

      {/* ============ AUTH MODAL ============ */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowAuth(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-panel !p-0 relative overflow-hidden grid md:grid-cols-2">
                <AuthAside />
                <div className="p-8 relative">
                <button onClick={() => setShowAuth(false)} className="absolute top-4 right-4 text-theme-subtle hover:text-theme transition-colors z-10">
                  <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#1c1c1e' }}>
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-theme mb-1">{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
                  <p className="text-xs text-theme-muted">{authMode === 'login' ? 'Sign in to your AxesAI workspace' : 'Get started as a Teacher or Student'}</p>
                </div>

                {message && (
                  <div className={`p-4 mb-5 rounded-xl border text-xs leading-relaxed ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                    {message.text}
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                  {authMode === 'register' && (
                    <div>
                      <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 pl-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 w-4 h-4 text-theme-subtle" />
                        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className="glass-input w-full pl-11 pr-4 py-3 text-sm" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 pl-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-3.5 w-4 h-4 text-theme-subtle" />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" className="glass-input w-full pl-11 pr-4 py-3 text-sm" />
                    </div>
                  </div>

                  {authMode === 'login' && useFaceLogin ? (
                    <div className="p-4 rounded-xl border text-center my-4" style={{ borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)', background: 'var(--accent-soft)' }}>
                      <p className="text-xs text-theme-muted mb-3">Face ID login is enabled. Enter your email and scan your face.</p>
                      <GlassButton type="button" onClick={() => { if (!email) { setMessage({ type: 'error', text: 'Please enter your email first.' }); return; } setShowFaceCapture(true); }} className="w-full flex items-center justify-center gap-2 text-xs">
                        <Camera className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Scan Face
                      </GlassButton>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 pl-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 w-4 h-4 text-theme-subtle" />
                        <input type="password" required={!useFaceLogin} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="glass-input w-full pl-11 pr-4 py-3 text-sm" />
                      </div>
                    </div>
                  )}

                  {authMode === 'login' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setUseFaceLogin(!useFaceLogin)} className="text-[11px] font-semibold cursor-pointer flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                        <Camera className="w-3.5 h-3.5" />
                        {useFaceLogin ? 'Use password instead' : 'Login with Face ID'}
                      </button>
                    </div>
                  )}

                  {authMode === 'register' && (
                    <div>
                      <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 pl-1">Select Role</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(['student', 'teacher'] as const).map((r) => (
                          <button key={r} type="button" onClick={() => setRole(r)}
                            className={`py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${role === r ? 'text-white' : 'text-theme-muted'}`}
                            style={role === r ? { background: 'var(--text)', color: 'var(--bg-solid)', borderColor: 'transparent' } : { background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                            {r === 'student' ? <User className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!useFaceLogin || authMode === 'register') && (
                    <GlassButton type="submit" variant="accent" disabled={loading} className="w-full mt-2 flex items-center justify-center gap-2">
                      {loading ? 'Please wait…' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
                      {!loading && <ArrowRight className="w-4 h-4" />}
                    </GlassButton>
                  )}
                </form>

                <div className="mt-6 text-center">
                  <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setMessage(null); setUseFaceLogin(false); }} className="text-xs cursor-pointer text-theme-muted hover:text-theme transition-colors">
                    {authMode === 'login' ? (<>Don’t have an account? <span style={{ color: 'var(--accent)' }} className="font-semibold">Sign Up</span></>) : (<>Already have an account? <span style={{ color: 'var(--accent)' }} className="font-semibold">Sign In</span></>)}
                  </button>
                </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Face Capture Overlay */}
      {showFaceCapture && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <FaceCapture mode="login" onCaptureComplete={handleFaceCaptured} onCancel={() => setShowFaceCapture(false)} />
        </div>
      )}
    </main>
  );
}
