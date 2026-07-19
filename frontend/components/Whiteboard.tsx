'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import axios from 'axios';
import {
  Pen, Square, Circle, ArrowRight, Minus, Type, Eraser,
  Undo2, Trash2, Download, Save, Check,
} from 'lucide-react';

export type Tool = 'pen' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text' | 'eraser';

export interface BoardElement {
  id: string;
  type: 'path' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text';
  color: string;
  width: number;
  points?: number[][];
  x?: number; y?: number; w?: number; h?: number;
  text?: string;
  fontSize?: number;
  authorName?: string;
}

interface Props {
  meetingId: string;
  socket: Socket | null;
  canEdit?: boolean;
  userName?: string;
  className?: string;
}

const COLORS = ['#ffffff', '#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc', '#18181b'];
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const Whiteboard: React.FC<Props> = ({ meetingId, socket, canEdit = true, userName = 'User', className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [saved, setSaved] = useState(false);

  // Elements are kept in a ref for the draw loop, mirrored in state for re-render triggers.
  const elementsRef = useRef<BoardElement[]>([]);
  const draftRef = useRef<BoardElement | null>(null);
  const remoteDraftsRef = useRef<Record<string, BoardElement>>({});
  const cursorsRef = useRef<Record<string, { x: number; y: number; name: string; t: number }>>({});
  const drawingRef = useRef(false);
  const [, forceRender] = useState(0);
  const rerender = () => forceRender((n) => n + 1);

  // ---------- rendering ----------
  const drawElement = (ctx: CanvasRenderingContext2D, el: BoardElement) => {
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (el.type === 'path' && el.points?.length) {
      ctx.beginPath();
      ctx.moveTo(el.points[0][0], el.points[0][1]);
      for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i][0], el.points[i][1]);
      ctx.stroke();
    } else if (el.type === 'rect') {
      ctx.strokeRect(el.x!, el.y!, el.w!, el.h!);
    } else if (el.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(el.x! + el.w! / 2, el.y! + el.h! / 2, Math.abs(el.w! / 2), Math.abs(el.h! / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (el.type === 'line' || el.type === 'arrow') {
      const [x1, y1] = el.points![0];
      const [x2, y2] = el.points![1];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (el.type === 'arrow') {
        const a = Math.atan2(y2 - y1, x2 - x1);
        const h = 10 + el.width * 2;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - h * Math.cos(a - Math.PI / 6), y2 - h * Math.sin(a - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - h * Math.cos(a + Math.PI / 6), y2 - h * Math.sin(a + Math.PI / 6));
        ctx.stroke();
      }
    } else if (el.type === 'text' && el.text) {
      ctx.font = `${el.fontSize || 20}px -apple-system, Inter, sans-serif`;
      ctx.fillText(el.text, el.x!, el.y!);
    }
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.restore();

    elementsRef.current.forEach((el) => drawElement(ctx, el));
    Object.values(remoteDraftsRef.current).forEach((el) => drawElement(ctx, el));
    if (draftRef.current) drawElement(ctx, draftRef.current);

    // remote cursors
    const now = Date.now();
    Object.entries(cursorsRef.current).forEach(([, c]) => {
      if (now - c.t > 3000) return;
      ctx.save();
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.fillText(c.name, c.x + 8, c.y - 6);
      ctx.restore();
    });
  }, []);

  // ---------- sizing ----------
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current, wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [redraw]);

  // ---------- load saved board ----------
  useEffect(() => {
    if (!meetingId) return;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5001/api/meetings/${meetingId}/whiteboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        elementsRef.current = res.data.whiteboard?.elements || [];
        redraw();
      } catch { /* board may not exist yet */ }
    })();
  }, [meetingId, redraw]);

  // ---------- socket sync ----------
  useEffect(() => {
    if (!socket) return;
    const onDraw = ({ element }: any) => { elementsRef.current.push(element); redraw(); };
    const onLive = ({ socketId, stroke }: any) => {
      if (stroke) remoteDraftsRef.current[socketId] = stroke; else delete remoteDraftsRef.current[socketId];
      redraw();
    };
    const onUndo = ({ elementId }: any) => {
      elementsRef.current = elementsRef.current.filter((e) => e.id !== elementId);
      redraw();
    };
    const onClear = () => { elementsRef.current = []; remoteDraftsRef.current = {}; redraw(); };
    const onCursor = ({ socketId, x, y, name }: any) => {
      cursorsRef.current[socketId] = { x, y, name, t: Date.now() };
      redraw();
    };

    socket.on('board:draw', onDraw);
    socket.on('board:live', onLive);
    socket.on('board:undo', onUndo);
    socket.on('board:clear', onClear);
    socket.on('board:cursor', onCursor);
    return () => {
      socket.off('board:draw', onDraw);
      socket.off('board:live', onLive);
      socket.off('board:undo', onUndo);
      socket.off('board:clear', onClear);
      socket.off('board:cursor', onCursor);
    };
  }, [socket, redraw]);

  // ---------- pointer handling ----------
  const posOf = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as [number, number];
  };

  const hitTest = (x: number, y: number) => {
    // eraser: topmost element whose points/bounds are near the cursor
    for (let i = elementsRef.current.length - 1; i >= 0; i--) {
      const el = elementsRef.current[i];
      if (el.points?.length) {
        if (el.points.some(([px, py]) => Math.hypot(px - x, py - y) < 12 + el.width)) return el;
      } else if (el.x !== undefined) {
        const x1 = Math.min(el.x, el.x + (el.w || 0)), x2 = Math.max(el.x, el.x + (el.w || 0));
        const y1 = Math.min(el.y!, el.y! + (el.h || 0)), y2 = Math.max(el.y!, el.y! + (el.h || 0));
        if (x >= x1 - 8 && x <= x2 + 8 && y >= y1 - 8 && y <= y2 + 8) return el;
      }
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canEdit) return;
    const [x, y] = posOf(e);
    (e.target as Element).setPointerCapture(e.pointerId);

    if (tool === 'eraser') {
      const hit = hitTest(x, y);
      if (hit) {
        elementsRef.current = elementsRef.current.filter((el) => el.id !== hit.id);
        socket?.emit('board:undo', { meetingId, elementId: hit.id });
        redraw();
      }
      return;
    }

    if (tool === 'text') {
      const text = window.prompt('Text:');
      if (text) {
        const el: BoardElement = { id: uid(), type: 'text', color, width: strokeWidth, x, y, text, fontSize: 18 + strokeWidth * 2, authorName: userName };
        elementsRef.current.push(el);
        socket?.emit('board:draw', { meetingId, element: el });
        redraw();
      }
      return;
    }

    drawingRef.current = true;
    if (tool === 'pen') {
      draftRef.current = { id: uid(), type: 'path', color, width: strokeWidth, points: [[x, y]], authorName: userName };
    } else if (tool === 'rect' || tool === 'ellipse') {
      draftRef.current = { id: uid(), type: tool, color, width: strokeWidth, x, y, w: 0, h: 0, authorName: userName };
    } else {
      draftRef.current = { id: uid(), type: tool as 'line' | 'arrow', color, width: strokeWidth, points: [[x, y], [x, y]], authorName: userName };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const [x, y] = posOf(e);
    socket?.emit('board:cursor', { meetingId, x, y, name: userName });

    if (!drawingRef.current || !draftRef.current) return;
    const d = draftRef.current;
    if (d.type === 'path') d.points!.push([x, y]);
    else if (d.type === 'rect' || d.type === 'ellipse') { d.w = x - d.x!; d.h = y - d.y!; }
    else d.points![1] = [x, y];

    socket?.emit('board:live', { meetingId, stroke: d });
    redraw();
  };

  const finish = () => {
    if (!drawingRef.current || !draftRef.current) return;
    const el = draftRef.current;
    drawingRef.current = false;
    draftRef.current = null;
    // ignore accidental dots
    const tiny = el.type === 'path' && (el.points?.length || 0) < 2;
    if (!tiny) {
      elementsRef.current.push(el);
      socket?.emit('board:draw', { meetingId, element: el });
    }
    socket?.emit('board:live', { meetingId, stroke: null });
    redraw();
  };

  // ---------- actions ----------
  const undo = () => {
    const last = elementsRef.current.pop();
    if (last) socket?.emit('board:undo', { meetingId, elementId: last.id });
    redraw();
  };

  const clearAll = () => {
    if (!window.confirm('Clear the whole board for everyone?')) return;
    elementsRef.current = [];
    socket?.emit('board:clear', { meetingId });
    redraw();
  };

  const save = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5001/api/meetings/${meetingId}/whiteboard`,
        { elements: elementsRef.current },
        { headers: { Authorization: `Bearer ${token}` } });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) { console.error('Failed to save board', err); }
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Autosave every 15s while editing
  useEffect(() => {
    if (!canEdit || !meetingId) return;
    const t = setInterval(() => { if (elementsRef.current.length) save(); }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, meetingId]);

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen' },
    { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
    { id: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
    { id: 'rect', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { id: 'ellipse', icon: <Circle className="w-4 h-4" />, label: 'Ellipse' },
    { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
    { id: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
  ];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap mb-3 p-2 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex gap-1">
            {tools.map((t) => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => setTool(t.id)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  tool === t.id ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.icon}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <div className="flex gap-1.5 items-center">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition ${color === c ? 'border-white scale-110' : 'border-white/20'}`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <input
            type="range" min={1} max={16} value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-24 accent-white cursor-pointer"
            title={`Thickness: ${strokeWidth}`}
          />

          <div className="ml-auto flex gap-1">
            <button onClick={undo} title="Undo" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"><Undo2 className="w-4 h-4" /></button>
            <button onClick={exportPng} title="Export PNG" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"><Download className="w-4 h-4" /></button>
            <button onClick={save} title="Save board" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer">{saved ? <Check className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}</button>
            <button onClick={clearAll} title="Clear board" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={wrapRef} className="flex-1 rounded-2xl overflow-hidden border border-white/10 bg-[#0d0d11] relative min-h-[380px]">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerLeave={finish}
          className={canEdit ? (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-default'}
          style={{ touchAction: 'none', display: 'block' }}
        />
        {!canEdit && (
          <div className="absolute top-3 left-3 text-[11px] px-2.5 py-1 rounded-full bg-black/50 text-gray-300 border border-white/10">
            View only — your teacher is presenting
          </div>
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
