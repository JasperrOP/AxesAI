'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';
import { Camera, RefreshCw, X, ShieldAlert, Sparkles } from 'lucide-react';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  onCaptureComplete: (frames: string[]) => void;
  onCancel: () => void;
}

export default function FaceCapture({ mode, onCaptureComplete, onCancel }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100 for registration
  const [framesCaptured, setFramesCaptured] = useState(0);
  const totalFramesNeeded = mode === 'register' ? 5 : 1;

  // Initialize camera
  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error('Webcam access error:', err);
        setError('Could not access webcam. Please verify camera permissions.');
      }
    }

    startCamera();

    return () => {
      // Clean up stream on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      // Mirror image for standard webcam feel
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Reset transform
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.85);
    }
    return null;
  };

  const handleStartCapture = async () => {
    setCapturing(true);
    setError(null);
    setFramesCaptured(0);
    setProgress(0);

    const capturedList: string[] = [];

    if (mode === 'login') {
      // For login, we just need 1 frame immediately
      setTimeout(() => {
        const frame = captureFrame();
        if (frame) {
          onCaptureComplete([frame]);
        } else {
          setError('Failed to capture frame.');
          setCapturing(false);
        }
      }, 500);
    } else {
      // For registration, capture N frames over a few seconds
      let count = 0;
      const interval = setInterval(() => {
        const frame = captureFrame();
        if (frame) {
          capturedList.push(frame);
          count++;
          setFramesCaptured(count);
          setProgress(Math.round((count / totalFramesNeeded) * 100));

          if (count >= totalFramesNeeded) {
            clearInterval(interval);
            onCaptureComplete(capturedList);
          }
        } else {
          clearInterval(interval);
          setError('Failed to capture frames. Please try again.');
          setCapturing(false);
        }
      }, 600); // Wait 600ms between frames to get slightly different angles
    }
  };

  return (
    <GlassPanel className="relative p-6 max-w-md w-full border-white/10 bg-[#0F0F11]/90 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold tracking-wide uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{mode === 'register' ? 'Face Registration' : 'Face Verification'}</span>
          </div>
          <h3 className="text-lg font-bold text-white">
            {mode === 'register' ? 'Set Up Face Login' : 'Login using FaceID'}
          </h3>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <div className="p-4 mb-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black/40 mb-5 flex items-center justify-center">
        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />

        {/* Canvas for grabbing frames (hidden) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Grid Overlay / Guide for Face Placement */}
        <div className="absolute inset-0 border-[2px] border-cyan-400/20 rounded-lg pointer-events-none flex items-center justify-center">
          <div className="w-40 h-40 border-[2px] border-dashed border-cyan-400/40 rounded-full animate-pulse" />
        </div>

        {/* Capturing Status overlay */}
        {capturing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4">
            {mode === 'register' ? (
              <>
                <p className="text-sm font-semibold text-white mb-2">
                  Capturing face: {framesCaptured} / {totalFramesNeeded}
                </p>
                <p className="text-xs text-gray-400 mb-4">Tilt or turn your head slightly...</p>
                <div className="w-32 bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mb-2" />
                <p className="text-sm font-semibold text-white">Analyzing live webcam feed...</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        <GlassButton onClick={onCancel} type="button" className="text-xs">
          Cancel
        </GlassButton>
        <GlassButton
          onClick={handleStartCapture}
          variant="accent"
          disabled={capturing || !!error}
          className="flex items-center gap-1.5 text-xs"
        >
          <Camera className="w-4 h-4" />
          {mode === 'register' ? 'Capture and Register' : 'Scan Face'}
        </GlassButton>
      </div>
    </GlassPanel>
  );
}
