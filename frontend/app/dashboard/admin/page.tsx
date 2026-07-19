'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, LayoutDashboard, Users, GraduationCap, Shield, Settings as SettingsIcon,
  LogOut, Plus, Trash2, Search, Loader2, X, School, FileText, TrendingUp,
} from 'lucide-react';
import { GlassPanel } from '../../../components/GlassPanel';
import { GlassButton } from '../../../components/GlassButton';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { ProfileSettings } from '../../../components/ProfileSettings';

type AdminView = 'overview' | 'teachers' | 'students' | 'admins' | 'settings';

export default function AdminDashboard() {
  const router = useRouter();
  const [adminName, setAdminName] = useState('');
  const [view, setView] = useState<AdminView>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('token') || '';
  const roleOf = (v: AdminView) => (v === 'teachers' ? 'teacher' : v === 'students' ? 'student' : v === 'admins' ? 'admin' : 'all');

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw || !localStorage.getItem('token')) { router.push('/'); return; }
    const u = JSON.parse(raw);
    if (u.role !== 'admin') { router.push(u.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student'); return; }
    setAdminName(u.name);
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/users/admin/stats', { headers: { Authorization: `Bearer ${token()}` } });
      setStats(res.data);
    } catch (err) { console.error('Failed to load stats', err); }
  };

  const loadUsers = async (v: AdminView, q = '') => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5001/api/users', {
        params: { role: roleOf(v), search: q },
        headers: { Authorization: `Bearer ${token()}` },
      });
      setUsers(res.data.users);
    } catch (err) { console.error('Failed to load users', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (['teachers', 'students', 'admins'].includes(view)) loadUsers(view, search);
    if (view === 'overview') loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    const t = setTimeout(() => { if (['teachers', 'students', 'admins'].includes(view)) loadUsers(view, search); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    gsap.fromTo('.admin-reveal', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' });
  }, [view, stats, users]);

  const createUser = async () => {
    setError('');
    if (!form.name || !form.email || !form.password) { setError('All fields are required'); return; }
    try {
      await axios.post('http://localhost:5001/api/users', form, { headers: { Authorization: `Bearer ${token()}` } });
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'student' });
      loadUsers(view, search);
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const removeUser = async (u: any) => {
    if (!window.confirm(`Remove ${u.name} (${u.email})? This cannot be undone.`)) return;
    try {
      await axios.delete(`http://localhost:5001/api/users/${u._id}`, { headers: { Authorization: `Bearer ${token()}` } });
      loadUsers(view, search);
      loadStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove user');
    }
  };

  const logout = () => { localStorage.clear(); router.push('/'); };

  const nav: { icon: React.ReactNode; label: string; view: AdminView }[] = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Overview', view: 'overview' },
    { icon: <GraduationCap className="w-4 h-4" />, label: 'Teachers', view: 'teachers' },
    { icon: <Users className="w-4 h-4" />, label: 'Students', view: 'students' },
    { icon: <Shield className="w-4 h-4" />, label: 'Admins', view: 'admins' },
    { icon: <SettingsIcon className="w-4 h-4" />, label: 'Settings', view: 'settings' },
  ];

  const c = stats?.counts || {};

  return (
    <div className="themed-surface flex min-h-screen bg-theme text-white">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen flex flex-col border-r border-white/5 bg-white/[0.02] backdrop-blur-xl flex-shrink-0 relative z-20">
        <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/[0.06] rounded-xl border border-white/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight accent-gradient-text leading-none">AxesAI</h1>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Admin</span>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="px-4 pt-5 pb-2">
          <button onClick={() => setShowCreate(true)} className="glass-btn-accent w-full flex items-center justify-center gap-2 py-3 px-4 text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <button key={item.view} onClick={() => setView(item.view)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                view === item.view ? 'bg-white/8 border border-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}>
              {item.icon} {item.label}
            </button>
          ))}
          <div className="pt-6">
            <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 border border-transparent transition-all cursor-pointer">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center text-white text-sm font-bold">
            {(adminName || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{adminName || 'Admin'}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Administrator</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="relative flex-1 min-w-0 p-6 md:p-10 overflow-x-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/[0.03] blur-[130px] pointer-events-none" />

        {view === 'overview' && (
          <div className="relative z-10 max-w-6xl mx-auto">
            <div className="mb-8 admin-reveal">
              <h1 className="text-3xl font-extrabold accent-gradient-text">School Overview</h1>
              <p className="text-gray-400 mt-1 text-sm">Everything happening across your institution.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {[
                { label: 'Teachers', value: c.teachers ?? '—', icon: <GraduationCap className="w-5 h-5" /> },
                { label: 'Students', value: c.students ?? '—', icon: <Users className="w-5 h-5" /> },
                { label: 'Classrooms', value: c.classrooms ?? '—', icon: <School className="w-5 h-5" /> },
                { label: 'Assignments', value: c.assignments ?? '—', icon: <FileText className="w-5 h-5" /> },
                { label: 'Submissions', value: c.submissions ?? '—', icon: <TrendingUp className="w-5 h-5" /> },
                { label: 'Avg Score', value: stats ? Number(stats.averageScore).toFixed(1) : '—', icon: <Sparkles className="w-5 h-5" /> },
              ].map((s) => (
                <GlassPanel key={s.label} className="p-6 admin-reveal">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-500">{s.icon}</span>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{s.label}</p>
                </GlassPanel>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <GlassPanel className="p-6 admin-reveal">
                <h3 className="text-lg font-bold text-white mb-4">Recently Joined</h3>
                <div className="space-y-2">
                  {(stats?.recentUsers || []).map((u: any) => (
                    <div key={u._id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                      <div className="min-w-0">
                        <p className="text-white truncate">{u.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400">{u.role}</span>
                    </div>
                  ))}
                  {!stats?.recentUsers?.length && <p className="text-xs text-gray-500">No users yet.</p>}
                </div>
              </GlassPanel>

              <GlassPanel className="p-6 admin-reveal">
                <h3 className="text-lg font-bold text-white mb-4">Largest Classrooms</h3>
                <div className="space-y-3">
                  {(stats?.topClassrooms || []).map((k: any) => (
                    <div key={k._id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 flex-1 truncate">{k.name}</span>
                      <div className="w-32 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-white" style={{ width: `${Math.min(100, (k.students / Math.max(1, stats.topClassrooms[0].students)) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-white font-bold w-8 text-right">{k.students}</span>
                    </div>
                  ))}
                  {!stats?.topClassrooms?.length && <p className="text-xs text-gray-500">No classrooms yet.</p>}
                </div>
              </GlassPanel>
            </div>
          </div>
        )}

        {['teachers', 'students', 'admins'].includes(view) && (
          <div className="relative z-10 max-w-5xl mx-auto">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap admin-reveal">
              <div>
                <h1 className="text-3xl font-extrabold accent-gradient-text capitalize">{view}</h1>
                <p className="text-gray-400 mt-1 text-sm">{users.length} {view.slice(0, -1)}{users.length === 1 ? '' : 's'} registered.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…"
                  className="glass-input pl-9 pr-4 py-2.5 text-sm w-64" />
              </div>
            </div>

            <GlassPanel className="p-0 overflow-hidden admin-reveal">
              {loading ? (
                <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
              ) : users.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">No {view} found.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {users.map((u) => (
                    <div key={u._id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {u.avatarUrl ? <img src={`http://localhost:5001${u.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400">{u.role}</span>
                      <span className="text-[11px] text-gray-600 hidden sm:block">{new Date(u.createdAt).toLocaleDateString()}</span>
                      <button onClick={() => removeUser(u)} className="text-gray-500 hover:text-red-400 transition p-2 cursor-pointer" title="Remove user">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>
          </div>
        )}

        {view === 'settings' && <ProfileSettings onUpdated={(u) => setAdminName(u.name)} />}
      </div>

      {/* Create user modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <GlassPanel className="p-6 relative">
                <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                <h3 className="text-xl font-bold text-white mb-5">Add New User</h3>
                <div className="space-y-3">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="glass-input w-full px-4 py-3 text-sm" />
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="glass-input w-full px-4 py-3 text-sm" />
                  <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" type="text" className="glass-input w-full px-4 py-3 text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    {(['student', 'teacher', 'admin'] as const).map((r) => (
                      <button key={r} onClick={() => setForm({ ...form, role: r })}
                        className={`py-2.5 rounded-xl text-sm font-semibold border capitalize transition cursor-pointer ${form.role === r ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <GlassButton variant="accent" onClick={createUser} className="w-full mt-2">Create User</GlassButton>
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
