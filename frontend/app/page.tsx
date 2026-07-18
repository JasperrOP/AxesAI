'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { GlassButton } from '../components/GlassButton';
import { Mail, Lock, User, Sparkles, ArrowRight, ShieldCheck, Camera } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import FaceCapture from '../components/FaceCapture';

export default function LandingShowcase() {
  const router = useRouter();
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

  // GSAP animation references
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Initial entrance animations
    const ctx = gsap.context(() => {
      gsap.from(headerRef.current, {
        opacity: 0,
        y: -40,
        duration: 1,
        ease: 'power3.out',
      });
      gsap.from(formRef.current, {
        opacity: 0,
        scale: 0.95,
        y: 20,
        duration: 0.8,
        delay: 0.2,
        ease: 'back.out(1.2)',
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // When authMode changes, trigger a quick transition animation
  useEffect(() => {
    if (formRef.current) {
      gsap.fromTo(formRef.current, 
        { opacity: 0.7, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [authMode]);

  // Authentication submission
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

    // Corrected Port mismatch to 5001
    const baseUrl = 'http://localhost:5001/api/auth';
    const endpoint = authMode === 'login' ? `${baseUrl}/login` : `${baseUrl}/register`;
    const payload = authMode === 'login' 
      ? { email, password } 
      : { name, email, password, role };

    try {
      const response = await axios.post(endpoint, payload);
      setMessage({
        type: 'success',
        text: response.data.message || (authMode === 'login' ? 'Logged in successfully!' : 'Registered successfully!'),
      });
      
      if (authMode === 'login' && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // GSAP transition before routing
        gsap.to(formRef.current, {
          opacity: 0,
          scale: 0.9,
          y: -20,
          duration: 0.4,
          ease: 'power2.inOut',
          onComplete: () => {
            if (response.data.user.role === 'teacher') {
              router.push('/dashboard/teacher');
            } else {
              router.push('/dashboard/student');
            }
          }
        });
      } else {
        // Switch to login mode on successful signup
        setTimeout(() => {
          setAuthMode('login');
          setMessage(null);
          setName('');
          setEmail('');
          setPassword('');
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
      
      setMessage({
        type: 'success',
        text: response.data.message || 'Logged in successfully!',
      });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        gsap.to(formRef.current, {
          opacity: 0,
          scale: 0.9,
          y: -20,
          duration: 0.4,
          ease: 'power2.inOut',
          onComplete: () => {
            if (response.data.user.role === 'teacher') {
              router.push('/dashboard/teacher');
            } else {
              router.push('/dashboard/student');
            }
          }
        });
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
    <main ref={containerRef} className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background Graphic elements matching Liquid Glass */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] rounded-full bg-cyan-500/15 blur-[150px] pointer-events-none" />

      {/* Header / Brand */}
      <header ref={headerRef} className="relative z-10 flex flex-col items-center text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 shadow-sm">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold tracking-wider uppercase text-cyan-300">Secure AI Education Platform</span>
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-white to-gray-400 bg-clip-text text-transparent mb-3">
          AxesAI
        </h1>
        <p className="text-gray-400 max-w-md text-sm leading-relaxed">
          Log in with your credentials or register to create a new teacher/student account.
        </p>
      </header>

      {/* Main Workspace content */}
      <section className="relative z-10 w-full max-w-md flex items-center justify-center">
        <div ref={formRef} className="w-full">
          <GlassPanel className="p-8 relative overflow-hidden transition-all duration-300">
            <div className="flex flex-col items-center text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </h2>
              <p className="text-xs text-gray-400">
                {authMode === 'login' ? 'Welcome back to AxesAI' : 'Get started as a Teacher or Student'}
              </p>
            </div>

            {message && (
              <div className={`p-4 mb-5 rounded-xl border text-xs leading-relaxed ${
                message.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="glass-input w-full pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="glass-input w-full pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600"
                  />
                </div>
              </div>

              {authMode === 'login' && useFaceLogin ? (
                <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-center my-4">
                  <p className="text-xs text-gray-300 mb-3">Face ID login is enabled. Please enter your email and scan your face.</p>
                  <GlassButton
                    type="button"
                    onClick={() => {
                      if (!email) {
                        setMessage({ type: 'error', text: 'Please enter your email first.' });
                        return;
                      }
                      setShowFaceCapture(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 text-xs"
                  >
                    <Camera className="w-4 h-4 text-cyan-400" /> Scan Face
                  </GlassButton>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                    <input 
                      type="password"
                      required={!useFaceLogin}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="glass-input w-full pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600"
                    />
                  </div>
                </div>
              )}

              {authMode === 'login' && (
                <div className="flex justify-end mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setUseFaceLogin(!useFaceLogin)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold bg-transparent border-0 cursor-pointer flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {useFaceLogin ? 'Use password instead' : 'Login with FaceID'}
                  </button>
                </div>
              )}

              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-1">Select Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        role === 'student'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                        role === 'teacher'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      Teacher
                    </button>
                  </div>
                </div>
              )}

              {(!useFaceLogin || authMode === 'register') && (
                <GlassButton 
                  type="submit" 
                  variant="accent" 
                  disabled={loading}
                  className="w-full mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </GlassButton>
              )}
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setMessage(null);
                  setUseFaceLogin(false);
                }}
                className="text-xs text-cyan-400 hover:underline bg-transparent border-0 cursor-pointer"
              >
                {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>
          </GlassPanel>
        </div>
      </section>

      {/* Face Capture Overlay Modal */}
      {showFaceCapture && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <FaceCapture 
            mode="login" 
            onCaptureComplete={handleFaceCaptured} 
            onCancel={() => setShowFaceCapture(false)} 
          />
        </div>
      )}
    </main>
  );
}