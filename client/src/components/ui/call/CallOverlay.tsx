"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useCall } from "@/providers/CallProvider";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneIncoming,
} from "lucide-react";

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

const getInitials = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() || "?";
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// =====================================================
// INCOMING CALL MODAL
// =====================================================

export function IncomingCallModal() {
  const { incomingCall, answerCall, declineCall, callState } = useCall();

  if (!incomingCall || callState.status === "connected") return null;

  const caller = incomingCall.user;
  const isVideoCall = incomingCall.callType === "VIDEO";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-panel border border-border rounded-3xl p-8 w-[340px] shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Call type indicator */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-primaryColor/10 rounded-full">
            {isVideoCall ? (
              <Video className="w-4 h-4 text-primaryColor" />
            ) : (
              <Phone className="w-4 h-4 text-primaryColor" />
            )}
            <span className="text-sm font-medium text-primaryColor">
              Incoming {isVideoCall ? "Video" : "Voice"} Call
            </span>
          </div>
        </div>

        {/* Caller info */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-primaryColor/20 animate-pulse">
              {caller?.avatar ? (
                <Image
                  src={caller.avatar}
                  alt={caller.name || "Caller"}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primaryColor to-primaryColor/70 flex items-center justify-center text-white text-2xl font-bold">
                  {getInitials(caller?.name)}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
              <PhoneIncoming className="w-4 h-4 text-white" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-primary mb-1">
            {caller?.name || "Unknown"}
          </h3>
          <p className="text-sm text-secondary">is calling you...</p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-6">
          {/* Decline */}
          <button
            onClick={declineCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Accept */}
          <button
            onClick={answerCall}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg shadow-green-500/30"
          >
            {isVideoCall ? (
              <Video className="w-7 h-7 text-white" />
            ) : (
              <Phone className="w-7 h-7 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// ACTIVE CALL SCREEN
// =====================================================

export function ActiveCallScreen() {
  const {
    callState,
    localVideoRef,
    remoteVideoRef,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCall();

  const [now, setNow] = useState(() => Date.now());
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callDuration =
    callState.status === "connected" && callState.callStartTime
      ? Math.max(
          0,
          Math.floor((now - callState.callStartTime.getTime()) / 1000),
        )
      : 0;

  useEffect(() => {
    const audio = remoteAudioRef.current;
    const stream = callState.remoteStream;
    if (!audio || !stream) return;

    audio.srcObject = stream;
    audio.play().catch((err: unknown) => {
      console.error("Error playing remote audio:", err);
    });
  }, [callState.remoteStream]);

  useEffect(() => {
    if (callState.status !== "connected" || !callState.callStartTime) return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [callState.status, callState.callStartTime]);

  if (callState.status === "idle" || callState.status === "ringing") return null;

  const isVideoCall = callState.callType === "VIDEO";
  const otherUser = callState.caller || callState.receiver;
  const isCalling = callState.status === "calling";

  return (
    <div className="fixed inset-0 z-[100] bg-[#1a1a2e] flex flex-col">
      {/* Video Call Layout */}
      {isVideoCall ? (
        <div className="flex-1 relative">
          {/* Remote video (full screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Audio element as backup for remote audio */}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

          {/* Local video (picture-in-picture) */}
          <div className="absolute top-4 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                callState.isVideoOff ? "hidden" : ""
              }`}
            />
            {callState.isVideoOff && (
              <div className="w-full h-full bg-surface flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-secondary" />
              </div>
            )}
          </div>

          {/* Calling overlay */}
          {isCalling && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-white/20 mb-6 animate-pulse">
                {otherUser?.avatar ? (
                  <Image
                    src={otherUser.avatar}
                    alt={otherUser.name || "User"}
                    width={112}
                    height={112}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primaryColor to-primaryColor/70 flex items-center justify-center text-white text-3xl font-bold">
                    {getInitials(otherUser?.name)}
                  </div>
                )}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {otherUser?.name || "Unknown"}
              </h3>
              <p className="text-white/70">Calling...</p>
            </div>
          )}
        </div>
      ) : (
        /* Voice Call Layout */
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* User avatar */}
          <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-primaryColor/30 mb-6">
            {otherUser?.avatar ? (
              <Image
                src={otherUser.avatar}
                alt={otherUser.name || "User"}
                width={128}
                height={128}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primaryColor to-primaryColor/70 flex items-center justify-center text-white text-4xl font-bold">
                {getInitials(otherUser?.name)}
              </div>
            )}
          </div>

          {/* Name */}
          <h3 className="text-2xl font-semibold text-white mb-2">
            {otherUser?.name || "Unknown"}
          </h3>

          {/* Status */}
          <p className="text-white/70 mb-2">
            {isCalling ? "Calling..." : "Voice Call"}
          </p>

          {/* Duration */}
          {callState.status === "connected" && (
            <p className="text-primaryColor font-mono text-lg">
              {formatDuration(callDuration)}
            </p>
          )}

          {/* Audio element for remote stream (voice calls) */}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        </div>
      )}

      {/* Call info bar */}
      <div className="absolute top-4 left-4 flex items-center gap-3">
        <div className="px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full flex items-center gap-2">
          {isVideoCall ? (
            <Video className="w-4 h-4 text-white" />
          ) : (
            <Phone className="w-4 h-4 text-white" />
          )}
          <span className="text-sm text-white font-medium">
            {callState.status === "connected"
              ? formatDuration(callDuration)
              : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex justify-center gap-4">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
              callState.isMuted
                ? "bg-red-500 text-white"
                : "bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
            }`}
          >
            {callState.isMuted ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          {/* Video toggle (only for video calls) */}
          {isVideoCall && (
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                callState.isVideoOff
                  ? "bg-red-500 text-white"
                  : "bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
              }`}
            >
              {callState.isVideoOff ? (
                <VideoOff className="w-6 h-6" />
              ) : (
                <Video className="w-6 h-6" />
              )}
            </button>
          )}

          {/* End call */}
          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// CALL OVERLAY (COMBINES BOTH)
// =====================================================

export function CallOverlay() {
  return (
    <>
      <IncomingCallModal />
      <ActiveCallScreen />
    </>
  );
}
