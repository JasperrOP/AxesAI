'use client';

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';
import { Send, Paperclip, File, Download, User, Sparkles, X, Loader2 } from 'lucide-react';

interface Message {
  _id: string;
  classroomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'teacher' | 'student';
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
}

interface ClassroomChatProps {
  classroomId: string;
  socket: Socket | null;
}

export default function ClassroomChat({ classroomId, socket }: ClassroomChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchHistory();
  }, [classroomId]);

  // Join the classroom socket room and listen for new messages
  useEffect(() => {
    if (!socket || !classroomId) return;

    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      // Join classroom room
      socket.emit('room:join', {
        classroomId,
        role: user.role,
        name: user.name,
      });
    }

    // Listener for new messages
    const handleNewMessage = (message: Message) => {
      if (message.classroomId === classroomId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, classroomId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5001/api/chat/${classroomId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data.messages);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load message history.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;
    if (!socket || !currentUser) return;

    setUploading(true);
    setError('');

    let attachmentPayload = null;

    try {
      // 1. Upload file first if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const token = localStorage.getItem('token');
        const uploadRes = await axios.post('http://localhost:5001/api/chat/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        });

        attachmentPayload = {
          url: uploadRes.data.url,
          name: uploadRes.data.name,
        };
      }

      // 2. Emit socket event
      socket.emit('message:send', {
        classroomId,
        senderId: currentUser.id || currentUser._id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        content: inputText.trim(),
        attachment: attachmentPayload,
      });

      // Reset state
      setInputText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        setError('File size exceeds the 15MB limit.');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  return (
    <GlassPanel className="flex flex-col h-[500px] border-white/10 bg-[#0F0F11]/60 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Live Classroom Chat</span>
        </div>
        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-500/20 uppercase font-medium">
          Connected
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {error && (
          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            {error}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
            <User className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === (currentUser?.id || currentUser?._id);
            const isTeacher = msg.senderRole === 'teacher';

            return (
              <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Sender Name & Role Badge */}
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-gray-400">
                  <span className="font-semibold">{msg.senderName}</span>
                  <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${
                    isTeacher 
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/20' 
                      : 'bg-white/5 text-gray-300 border border-white/5'
                  }`}>
                    {msg.senderRole}
                  </span>
                  <span className="text-[9px] opacity-70">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMe 
                    ? 'bg-cyan-600/90 text-white rounded-tr-none' 
                    : 'bg-white/5 border border-white/10 text-gray-100 rounded-tl-none'
                }`}>
                  {msg.content && <p className="leading-relaxed break-words">{msg.content}</p>}

                  {/* Attachment rendering */}
                  {msg.attachmentUrl && (
                    <div className={`mt-2 p-2 rounded-xl flex items-center gap-2 border ${
                      isMe 
                        ? 'bg-black/20 border-white/10 text-white' 
                        : 'bg-white/5 border-white/10 text-cyan-300'
                    }`}>
                      <File className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium truncate">{msg.attachmentName}</p>
                      </div>
                      <a
                        href={`http://localhost:5001${msg.attachmentUrl}`}
                        download={msg.attachmentName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded bg-white/10 hover:bg-white/20 transition text-white shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-white/5 space-y-3">
        {selectedFile && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs">
            <div className="flex items-center gap-2 truncate">
              <File className="w-4 h-4" />
              <span className="truncate">{selectedFile.name}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* File attachment button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition shrink-0 cursor-pointer flex items-center justify-center"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="glass-input flex-1 px-4 py-2 text-sm text-white placeholder-gray-500"
            disabled={uploading}
          />

          <GlassButton
            type="submit"
            variant="accent"
            disabled={uploading || (!inputText.trim() && !selectedFile)}
            className="shrink-0 flex items-center justify-center p-3 rounded-xl"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </GlassButton>
        </div>
      </form>
    </GlassPanel>
  );
}
