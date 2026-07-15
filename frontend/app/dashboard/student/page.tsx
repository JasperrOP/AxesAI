'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../../../components/GlassPanel';
import { GlassButton } from '../../../components/GlassButton';
import { Plus, User, LogOut, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';

export default function StudentDashboard() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentName, setStudentName] = useState('');

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
  }, []);

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5001/api/classrooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassrooms(res.data.classrooms);

      // Animate classroom list entry
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  // GSAP modal animations
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
              <div key={room._id} className="classroom-card opacity-0">
                <GlassPanel className="h-full flex flex-col justify-between hover:border-white/20 transition-all duration-300">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{room.name}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-4">
                      <User className="w-4 h-4 text-cyan-400" /> Instructor: <span className="text-gray-200">{room.teacherId?.name || 'Assigned Instructor'}</span>
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1.5 text-[11px] text-yellow-400/90 font-medium">
                      <AlertCircle className="w-4 h-4" /> No Active Quizzes
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
      </main>

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
    </div>
  );
}
