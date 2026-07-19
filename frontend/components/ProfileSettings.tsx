'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { User as UserIcon, Camera, Save, Check, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';

interface Props {
  onUpdated?: (user: any) => void;
}

export const ProfileSettings: React.FC<Props> = ({ onUpdated }) => {
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarData, setAvatarData] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const token = () => localStorage.getItem('token') || '';

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('http://localhost:5001/api/users/me', {
          headers: { Authorization: `Bearer ${token()}` },
        });
        setProfile(res.data.user);
        setName(res.data.user.name || '');
        if (res.data.user.avatarUrl) setAvatarPreview(`http://localhost:5001${res.data.user.avatarUrl}`);
      } catch (err) { console.error('Failed to load profile', err); }
    })();
  }, []);

  const pickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('Image must be under 4MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setAvatarPreview(dataUrl);
      setAvatarData(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const body: any = { name };
      if (avatarData) body.avatar = avatarData;
      if (newPassword) { body.newPassword = newPassword; body.currentPassword = currentPassword; }

      const res = await axios.put('http://localhost:5001/api/users/me', body, {
        headers: { Authorization: `Bearer ${token()}` },
      });

      // keep the cached user in sync so the sidebar/name updates everywhere
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const merged = { ...stored, name: res.data.user.name, avatarUrl: res.data.user.avatarUrl };
      localStorage.setItem('user', JSON.stringify(merged));

      setProfile(res.data.user);
      setAvatarData('');
      setCurrentPassword(''); setNewPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      onUpdated?.(merged);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative z-10 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold accent-gradient-text flex items-center gap-3">
          <UserIcon className="w-7 h-7 text-gray-300" /> Settings
        </h1>
        <p className="text-gray-400 mt-1 text-sm">Update your profile, photo and password.</p>
      </div>

      <div className="space-y-6">
        {/* Profile card */}
        <GlassPanel className="p-6">
          <h3 className="text-lg font-bold text-white mb-5">Profile</h3>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <motion.div whileHover={{ scale: 1.03 }} className="relative">
                <div className="w-28 h-28 rounded-full overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-3xl font-bold text-white">{(name || 'U').charAt(0).toUpperCase()}</span>}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:opacity-90 transition cursor-pointer"
                  title="Change photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </motion.div>
              <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
              <p className="text-[10px] text-gray-500">JPG/PNG · max 4MB</p>
            </div>

            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full px-4 py-3 text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
                <input value={profile?.email || ''} disabled className="glass-input w-full px-4 py-3 text-sm opacity-60 cursor-not-allowed" />
                <p className="text-[10px] text-gray-500 mt-1.5">Email can't be changed.</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 uppercase tracking-wider font-semibold">{profile?.role || '—'}</span>
                {profile?.faceEnrolled && (
                  <span className="flex items-center gap-1.5 text-green-400"><ShieldCheck className="w-3.5 h-3.5" /> Face ID enrolled</span>
                )}
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Password card */}
        <GlassPanel className="p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Lock className="w-4 h-4 text-gray-400" /> Change Password</h3>
          <p className="text-xs text-gray-500 mb-5">Leave blank to keep your current password.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password" className="glass-input w-full px-4 py-3 text-sm"
            />
            <input
              type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)" className="glass-input w-full px-4 py-3 text-sm"
            />
          </div>
        </GlassPanel>

        {error && <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl p-3">{error}</p>}

        <div className="flex justify-end">
          <GlassButton variant="accent" onClick={save} disabled={saving} className="flex items-center gap-2 !px-6">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </GlassButton>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
