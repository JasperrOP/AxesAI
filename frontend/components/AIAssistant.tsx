'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Loader2, Trash2, Copy, Check } from 'lucide-react';

interface Msg { role: 'user' | 'assistant'; content: string }

interface Props {
  userName: string;
  role: 'teacher' | 'student';
}

const SUGGESTIONS: Record<string, string[]> = {
  teacher: [
    'Give me a 5-question quiz on photosynthesis',
    'Write a grading rubric for a history essay',
    'How do I explain recursion to beginners?',
    'Suggest activities for a slow-learning group',
  ],
  student: [
    'Explain Newton’s laws with simple examples',
    'Help me revise for a viva on neural networks',
    'What is the difference between RAM and ROM?',
    'Give me practice questions on integration',
  ],
};

/** Renders **bold** and simple bullet lines without pulling in a markdown lib. */
const renderRich = (text: string) =>
  text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const body = parts.map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    );
    const bullet = /^\s*[-*•]\s+/.test(line);
    return (
      <p key={i} className={`${bullet ? 'pl-4 relative before:content-["•"] before:absolute before:left-0 before:text-gray-500' : ''} ${line.trim() === '' ? 'h-2' : ''}`}>
        {bullet ? body.map((b, k) => k === 0 ? <span key={k}>{String(line).replace(/^\s*[-*•]\s+/, '')}</span> : null) : body}
      </p>
    );
  });

export const AIAssistant: React.FC<Props> = ({ userName, role }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`ai_chat_${role}`);
    if (saved) { try { setMessages(JSON.parse(saved)); } catch {} }
  }, [role]);

  useEffect(() => {
    localStorage.setItem(`ai_chat_${role}`, JSON.stringify(messages.slice(-40)));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, role]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    setError('');
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5001/api/ai-chat',
        { messages: next, userName },
        { headers: { Authorization: `Bearer ${token}` } });
      setMessages([...next, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'The assistant is unavailable. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="relative z-10 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold accent-gradient-text flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-gray-300" /> AI Assistant
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {role === 'teacher'
              ? 'Your teaching co-pilot — lesson ideas, rubrics, explanations, anything.'
              : 'Your personal tutor — ask anything you’re stuck on.'}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1.5 border border-white/10 rounded-lg px-3 py-1.5 transition cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="glass-panel !p-0 overflow-hidden flex flex-col h-[600px]">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-16 h-16 rounded-3xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-5"
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>
              <p className="text-lg font-bold text-white">How can I help, {userName.split(' ')[0]}?</p>
              <p className="text-sm text-gray-500 mt-1 mb-6">Ask me anything, or start with one of these:</p>
              <div className="grid sm:grid-cols-2 gap-2.5 w-full max-w-xl">
                {(SUGGESTIONS[role] || SUGGESTIONS.student).map((s, i) => (
                  <motion.button
                    key={s}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    whileHover={{ y: -2 }}
                    onClick={() => send(s)}
                    className="text-left text-[13px] text-gray-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 rounded-xl px-4 py-3 transition cursor-pointer"
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                  <div className={`group relative max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-white text-black font-medium'
                      : 'bg-white/[0.04] border border-white/10 text-gray-200'
                  }`}>
                    <div className="space-y-1.5">{renderRich(m.content)}</div>
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => copy(m.content, i)}
                        className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition w-7 h-7 rounded-lg bg-black/70 border border-white/10 flex items-center justify-center cursor-pointer"
                        title="Copy"
                      >
                        {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-gray-300 animate-pulse" />
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </div>

        {error && <p className="px-6 pb-2 text-[11px] text-red-400">{error}</p>}

        {/* Composer */}
        <div className="border-t border-white/10 p-4">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder="Ask the AI anything…  (Enter to send, Shift+Enter for a new line)"
              className="glass-input flex-1 resize-none px-4 py-3 text-sm max-h-32"
            />
            <motion.button
              type="submit"
              whileTap={{ scale: 0.92 }}
              disabled={loading || !input.trim()}
              className="glass-btn-accent w-11 h-11 flex items-center justify-center flex-shrink-0 disabled:opacity-40 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </motion.button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
