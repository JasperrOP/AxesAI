'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ScanLine, BarChart3, Mic, MessageSquareText, Check } from 'lucide-react';

/**
 * Animated brand panel shown beside the auth form on desktop.
 * Pure SVG + framer-motion (no images) so it stays crisp and theme-independent.
 */
const orbitIcons = [ScanLine, BarChart3, Mic, MessageSquareText];

export const AuthAside: React.FC = () => {
  return (
    <div
      className="relative hidden md:flex flex-col justify-between p-8 overflow-hidden"
      style={{ background: 'linear-gradient(155deg, #26262b 0%, #101013 100%)' }}
    >
      {/* Soft light blooms */}
      <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-white/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-10 w-64 h-64 rounded-full bg-black/10 blur-3xl" />

      {/* Animated orbit system */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 400 400" className="w-[340px] h-[340px] opacity-90">
          {[80, 130, 180].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="4 6" />
          ))}
        </svg>

        {/* Rotating ring carrying feature icons */}
        <motion.div
          className="absolute w-[360px] h-[360px]"
          animate={{ rotate: 360 }}
          transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
        >
          {orbitIcons.map((Icon, i) => {
            const angle = (i / orbitIcons.length) * Math.PI * 2;
            const radius = 130;
            const x = 180 + radius * Math.cos(angle);
            const y = 180 + radius * Math.sin(angle);
            return (
              <motion.div
                key={i}
                className="absolute w-11 h-11 rounded-2xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
                style={{ left: x, top: y }}
                animate={{ rotate: -360 }}
                transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
              >
                <Icon className="w-5 h-5" style={{ color: '#1c1c1e' }} />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Center brand mark with gentle float */}
        <motion.div
          className="absolute w-20 h-20 rounded-[26px] bg-white flex items-center justify-center shadow-2xl"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <GraduationCap className="w-10 h-10" style={{ color: '#1c1c1e' }} />
        </motion.div>
      </div>

      {/* Copy */}
      <div className="relative z-10">
        <span className="text-xs font-semibold tracking-widest uppercase text-white/80">AxesAI Platform</span>
      </div>

      <div className="relative z-10 text-white">
        <h3 className="text-2xl font-extrabold leading-snug">One AI workspace for the whole classroom.</h3>
        <ul className="mt-5 space-y-2.5">
          {['AI assessments & OCR grading', 'Live quizzes, analytics & viva', 'Grounded doubt-solving with citations'].map((t) => (
            <li key={t} className="flex items-center gap-2.5 text-sm text-white/90">
              <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AuthAside;
