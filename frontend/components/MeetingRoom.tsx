'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import axios from 'axios';
import gsap from 'gsap';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, PhoneOff,
  Users, PenTool, Copy, Check, Maximize2, Minimize2,
} from 'lucide-react';
import { Whiteboard } from './Whiteboard';

interface Participant {
  socketId: string;
  userId: string;
  name: string;
  role: 'teacher' | 'student';
  audio: boolean;
  video: boolean;
  isHost: boolean;
}

interface Props {
  meeting: any;              // { _id, roomCode, title, hostId }
  socket: Socket | null;
  userId: string;
  userName: string;
  role: 'teacher' | 'student';
  isHost: boolean;
  onLeave: () => void;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

export const MeetingRoom: React.FC<Props> = ({ meeting, socket, userId, userName, role, isHost, onLeave }) => {
  const meetingId = meeting?._id;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  // ---------- WebRTC helpers ----------
  const sendSignal = useCallback((to: string, data: any) => {
    socket?.emit('meet:signal', { to, data });
  }, [socket]);

  const createPeer = useCallback((peerId: string, initiator: boolean) => {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcsRef.current[peerId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(peerId, { candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      setRemoteStreams((prev) => ({ ...prev, [peerId]: e.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete pcsRef.current[peerId];
        setRemoteStreams((prev) => { const n = { ...prev }; delete n[peerId]; return n; });
      }
    };

    if (initiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal(peerId, { sdp: pc.localDescription });
        } catch (err) { console.error('offer failed', err); }
      })();
    }

    return pc;
  }, [sendSignal]);

  // ---------- init media + join ----------
  useEffect(() => {
    if (!socket || !meetingId) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        socket.emit('meet:join', { meetingId, userId, name: userName, role, isHost });
      } catch (err: any) {
        setError('Camera/microphone access denied. Allow permissions to join with video.');
        // Still join so you can watch/use the board
        socket.emit('meet:join', { meetingId, userId, name: userName, role, isHost });
      }
    })();

    return () => {
      cancelled = true;
      socket.emit('meet:leave', { meetingId });
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenTrackRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, meetingId]);

  // ---------- signalling ----------
  useEffect(() => {
    if (!socket) return;

    const onPeers = ({ peers }: { peers: Participant[] }) => {
      setParticipants((prev) => {
        const map: Record<string, Participant> = {};
        [...prev, ...peers].forEach((p) => { map[p.socketId] = p; });
        return Object.values(map);
      });
      // We are the newcomer: initiate to everyone already here
      peers.forEach((p) => createPeer(p.socketId, true));
    };

    const onPeerJoined = ({ peer }: { peer: Participant }) => {
      setParticipants((prev) => [...prev.filter((p) => p.socketId !== peer.socketId), peer]);
      // They will send us the offer; just be ready.
    };

    const onRoster = ({ participants: list }: { participants: Participant[] }) => setParticipants(list);

    const onSignal = async ({ from, data }: { from: string; data: any }) => {
      let pc = pcsRef.current[from];
      if (!pc) pc = createPeer(from, false);
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(from, { sdp: pc.localDescription });
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) { console.error('signal error', err); }
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      pcsRef.current[socketId]?.close();
      delete pcsRef.current[socketId];
      setRemoteStreams((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    const onEnded = () => { onLeave(); };

    socket.on('meet:peers', onPeers);
    socket.on('meet:peer-joined', onPeerJoined);
    socket.on('meet:roster', onRoster);
    socket.on('meet:signal', onSignal);
    socket.on('meet:peer-left', onPeerLeft);
    socket.on('meet:ended', onEnded);

    return () => {
      socket.off('meet:peers', onPeers);
      socket.off('meet:peer-joined', onPeerJoined);
      socket.off('meet:roster', onRoster);
      socket.off('meet:signal', onSignal);
      socket.off('meet:peer-left', onPeerLeft);
      socket.off('meet:ended', onEnded);
    };
  }, [socket, createPeer, sendSignal, onLeave]);

  // ---------- entrance animation ----------
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(containerRef.current,
        { opacity: 0, y: 20, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' });
    }
  }, []);

  useEffect(() => {
    gsap.fromTo('.meet-tile',
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.45, stagger: 0.06, ease: 'back.out(1.4)' });
  }, [remoteStreams]);

  // ---------- controls ----------
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    socket?.emit('meet:media-state', { meetingId, audio: track.enabled, video: camOn });
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
    socket?.emit('meet:media-state', { meetingId, audio: micOn, video: track.enabled });
  };

  const replaceVideoTrackEverywhere = (track: MediaStreamTrack | null) => {
    Object.values(pcsRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && track) sender.replaceTrack(track);
    });
  };

  const toggleScreenShare = async () => {
    if (sharing) {
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      replaceVideoTrackEverywhere(camTrack);
      if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setSharing(false);
      socket?.emit('meet:media-state', { meetingId, audio: micOn, video: camOn, screen: false });
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      screenTrackRef.current = track;
      replaceVideoTrackEverywhere(track);
      if (localVideoRef.current) localVideoRef.current.srcObject = display;
      setSharing(true);
      socket?.emit('meet:media-state', { meetingId, audio: micOn, video: camOn, screen: true });
      track.onended = () => { toggleScreenShare(); };
    } catch { /* user cancelled */ }
  };

  const leave = async () => {
    socket?.emit('meet:leave', { meetingId });
    onLeave();
  };

  const endForAll = async () => {
    if (!window.confirm('End this meeting for everyone?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5001/api/meetings/${meetingId}/end`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) { console.error(err); }
    socket?.emit('meet:end', { meetingId });
    onLeave();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(meeting.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const remoteEntries = Object.entries(remoteStreams);
  const tileCount = remoteEntries.length + 1;
  const gridCols = tileCount <= 1 ? 'grid-cols-1' : tileCount <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div
      ref={containerRef}
      className={`glass-panel !p-0 overflow-hidden flex flex-col ${expanded ? 'fixed inset-4 z-50' : 'relative'}`}
      style={{ minHeight: expanded ? undefined : 560 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live
          </span>
          <h3 className="text-sm font-bold text-white truncate">{meeting.title}</h3>
          <button onClick={copyCode} className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white border border-white/10 rounded-lg px-2 py-1 transition cursor-pointer">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {meeting.roomCode}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPeople((v) => !v)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition cursor-pointer ${showPeople ? 'bg-white text-black border-transparent' : 'text-gray-400 border-white/10 hover:text-white'}`}>
            <Users className="w-4 h-4" /> {participants.length || 1}
          </button>
          <button onClick={() => setShowBoard((v) => !v)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition cursor-pointer ${showBoard ? 'bg-white text-black border-transparent' : 'text-gray-400 border-white/10 hover:text-white'}`}>
            <PenTool className="w-4 h-4" /> Whiteboard
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-white p-1.5 rounded-lg border border-white/10 transition cursor-pointer">
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && <p className="px-5 py-2 text-[11px] text-amber-400 bg-amber-500/5 border-b border-amber-500/10">{error}</p>}

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 p-4 min-w-0 flex flex-col">
          {showBoard ? (
            <Whiteboard
              meetingId={meetingId}
              socket={socket}
              canEdit={role === 'teacher'}
              userName={userName}
              className="flex-1"
            />
          ) : (
            <div className={`grid ${gridCols} gap-3 flex-1 auto-rows-fr`}>
              {/* Local tile */}
              <div className="meet-tile relative rounded-2xl overflow-hidden bg-[#0d0d11] border border-white/10 min-h-[180px]">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: sharing ? 'none' : 'scaleX(-1)' }} />
                {!camOn && !sharing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d11]">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold text-white">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 text-[11px] text-white">
                  {!micOn && <MicOff className="w-3 h-3 text-red-400" />}
                  {userName} (You){isHost && ' · Host'}
                </div>
              </div>

              {/* Remote tiles */}
              {remoteEntries.map(([sid, stream]) => {
                const p = participants.find((x) => x.socketId === sid);
                return (
                  <div key={sid} className="meet-tile relative rounded-2xl overflow-hidden bg-[#0d0d11] border border-white/10 min-h-[180px]">
                    <video
                      autoPlay playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 text-[11px] text-white">
                      {p && !p.audio && <MicOff className="w-3 h-3 text-red-400" />}
                      {p?.name || 'Participant'}{p?.isHost && ' · Host'}
                    </div>
                  </div>
                );
              })}

              {remoteEntries.length === 0 && (
                <div className="meet-tile rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-center p-6 min-h-[180px]">
                  <div>
                    <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 font-medium">Waiting for others to join</p>
                    <p className="text-[11px] text-gray-600 mt-1">Share code <strong className="text-gray-400">{meeting.roomCode}</strong></p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* People panel */}
        {showPeople && (
          <div className="w-64 border-l border-white/10 p-4 overflow-y-auto flex-shrink-0">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">In this meeting</h4>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.socketId} className="flex items-center gap-2.5 text-sm">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-200 truncate text-[13px]">{p.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase">{p.isHost ? 'Host' : p.role}</p>
                  </div>
                  {!p.audio && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                </div>
              ))}
              {participants.length === 0 && <p className="text-xs text-gray-500">Just you so far.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-white/10">
        <button onClick={toggleMic} title={micOn ? 'Mute' : 'Unmute'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${micOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white'}`}>
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
        <button onClick={toggleCam} title={camOn ? 'Turn camera off' : 'Turn camera on'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${camOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white'}`}>
          {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>
        <button onClick={toggleScreenShare} title={sharing ? 'Stop sharing' : 'Share screen'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${sharing ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {sharing ? <MonitorX className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
        </button>
        <button onClick={leave} title="Leave"
          className="px-5 h-11 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 text-sm font-semibold transition cursor-pointer">
          <PhoneOff className="w-5 h-5" /> Leave
        </button>
        {isHost && (
          <button onClick={endForAll} className="px-4 h-11 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition cursor-pointer">
            End for all
          </button>
        )}
      </div>
    </div>
  );
};

export default MeetingRoom;
