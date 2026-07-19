'use client';

import React from 'react';
import { Sparkles, LayoutDashboard, BookOpen, GraduationCap, StickyNote, UserCheck, Camera, LogOut, Plus, Bot, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export type StudentView = 'home' | 'classes' | 'grades' | 'notes' | 'attendance' | 'ai' | 'settings';

interface Props {
  view: StudentView;
  setView: (v: StudentView) => void;
  studentName: string;
  onJoin: () => void;
  onFace: () => void;
  onLogout: () => void;
}

const items: { icon: React.ReactNode; label: string; view: StudentView }[] = [
  { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Home', view: 'home' },
  { icon: <BookOpen className="w-4 h-4" />, label: 'My Classes', view: 'classes' },
  { icon: <GraduationCap className="w-4 h-4" />, label: 'My Grades', view: 'grades' },
  { icon: <UserCheck className="w-4 h-4" />, label: 'Attendance', view: 'attendance' },
  { icon: <StickyNote className="w-4 h-4" />, label: 'Notes', view: 'notes' },
  { icon: <Bot className="w-4 h-4" />, label: 'AI Assistant', view: 'ai' },
  { icon: <Settings className="w-4 h-4" />, label: 'Settings', view: 'settings' },
];

export const StudentSidebar: React.FC<Props> = ({ view, setView, studentName, onJoin, onFace, onLogout }) => {
  return (
    <aside className="w-64 min-h-screen flex flex-col border-r border-white/5 bg-white/[0.02] backdrop-blur-xl flex-shrink-0 relative z-20">
      {/* Logo */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-500/20 rounded-xl border border-zinc-500/30">
            <Sparkles className="w-5 h-5 text-zinc-300" />
          </div>
          <h1 className="text-xl font-bold tracking-tight accent-gradient-text">AxesAI</h1>
        </div>
        <ThemeToggle />
      </div>

      {/* Join Classroom CTA */}
      <div className="px-4 pt-5 pb-2">
        <button
          onClick={onJoin}
          className="glass-btn-accent w-full flex items-center justify-center gap-2 py-3 px-4 text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Join Classroom
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => (
          <button
            key={item.view}
            onClick={() => setView(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              view === item.view
                ? 'bg-white/8 border border-white/10 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {item.icon} {item.label}
          </button>
        ))}

        <div className="pt-6">
          <button
            onClick={onFace}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent transition-all cursor-pointer mb-2"
          >
            <Camera className="w-4 h-4" /> Setup Face Login
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 border border-transparent transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </nav>

      {/* Profile footer */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center text-white text-sm font-bold">
            {(studentName || 'S').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{studentName || 'Student'}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Student</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default StudentSidebar;
