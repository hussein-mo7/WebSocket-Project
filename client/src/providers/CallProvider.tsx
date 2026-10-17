"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { callService, CallType, CallUser, CallState } from "@/services/call.service";
import { callSounds } from "@/utils/callSounds";
import { socketService } from "@/socket/socket.service";

/**
 * =====================================================
 * CALL CONTEXT
 * =====================================================
 * 
 * Provides call functionality to all components.
 * Manages:
 * - Call state (idle, calling, ringing, connected, ended)
 * - Local and remote media streams
 * - Mute/video toggle
 * - Incoming call handling
 */

interface IncomingCallData {
  from: string;
  callType: CallType;
  conversationId: string;
  user: CallUser;
  offer: RTCSessionDescriptionInit;
}

interface CallContextValue {
  // State
  callState: CallState;
  incomingCall: IncomingCallData | null;
  
  // Refs for video elements
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  
  // Actions
  startCall: (conversationId: string, receiverId: string, receiver: CallUser, callType: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const initialCallState: CallState = {
  status: "idle",
  callType: null,
  localStream: null,
  remoteStream: null,
  caller: null,
  receiver: null,
  conversationId: null,
  isMuted: false,
  isVideoOff: false,
  callStartTime: null,
};

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const listenersInitialized = useRef(false);

  // Initialize socket listeners on mount
  useEffect(() => {
    // Set up callbacks
    callService.setOnStateChange((state) => {
      setCallState((prev) => ({ ...prev, ...state }));
    });

    callService.setOnRemoteStream((stream) => {
      setCallState((prev) => ({ ...prev, remoteStream: stream }));
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    callService.setOnCallEnded(() => {
      callSounds.playEnded();
      setCallState(initialCallState);
      setIncomingCall(null);
    });

    callService.setOnIncomingCall((data) => {
      callSounds.playRingtone();
      setIncomingCall(data);
      setCallState((prev) => ({
        ...prev,
        status: "ringing",
        callType: data.callType,
        caller: data.user,
        conversationId: data.conversationId,
      }));
    });
  }, []);

  // Initialize socket listeners when socket connects
  useEffect(() => {
    const initListeners = () => {
      if (listenersInitialized.current) return;
      
      const socket = socketService.getSocket();
      if (socket?.connected) {
        callService.initializeSocketListeners();
        listenersInitialized.current = true;
        return true;
      }
      return false;
    };

    // Try to init immediately
    if (initListeners()) return;

    // If not connected yet, poll until connected
    const checkInterval = setInterval(() => {
      if (initListeners()) {
        clearInterval(checkInterval);
      }
    }, 500);

    // Also listen for connect event as backup
    const socket = socketService.getSocket();
    const handleConnect = () => {
      initListeners();
      clearInterval(checkInterval);
    };
    socket?.on("connect", handleConnect);

    return () => {
      clearInterval(checkInterval);
      socket?.off("connect", handleConnect);
      if (listenersInitialized.current) {
        callService.removeSocketListeners();
        listenersInitialized.current = false;
      }
      callSounds.stopAll();
    };
  }, []);

  // Update video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && callState.remoteStream) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  /**
   * Start a call (as caller)
   */
  const startCall = useCallback(
    async (
      conversationId: string,
      receiverId: string,
      receiver: CallUser,
      callType: CallType
    ) => {
      try {
        setCallState((prev) => ({
          ...prev,
          status: "calling",
          callType,
          receiver,
          conversationId,
        }));

        // Play ringback tone while waiting
        callSounds.playRingback();

        const localStream = await callService.startCall(
          conversationId,
          receiverId,
          callType
        );

        if (localStream) {
          setCallState((prev) => ({ ...prev, localStream }));
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        }
      } catch (error) {
        console.error("Failed to start call:", error);
        callSounds.stopAll();
        setCallState(initialCallState);
      }
    },
    []
  );

  /**
   * Answer incoming call
   */
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      // Stop ringtone
      callSounds.stopAll();

      const localStream = await callService.answerCall(
        incomingCall.conversationId,
        incomingCall.from,
        incomingCall.offer,
        incomingCall.callType
      );

      if (localStream) {
        // Play connected sound
        callSounds.playConnected();
        
        setCallState((prev) => ({
          ...prev,
          localStream,
          status: "connected",
          callStartTime: new Date(),
        }));
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      }

      setIncomingCall(null);
    } catch (error) {
      console.error("Failed to answer call:", error);
      callSounds.stopAll();
      setCallState(initialCallState);
      setIncomingCall(null);
    }
  }, [incomingCall]);

  /**
   * Decline incoming call
   */
  const declineCall = useCallback(() => {
    callSounds.stopAll();
    if (incomingCall) {
      callService.declineCall(incomingCall.conversationId, incomingCall.from);
    }
    setIncomingCall(null);
    setCallState(initialCallState);
  }, [incomingCall]);

  /**
   * End current call
   */
  const endCall = useCallback(() => {
    callSounds.stopAll();
    callSounds.playEnded();
    
    const receiverId = callState.receiver?.id || incomingCall?.from;
    const convId = callState.conversationId || incomingCall?.conversationId;
    
    callService.endCall(receiverId, convId || undefined);
    setCallState(initialCallState);
    setIncomingCall(null);
  }, [callState.receiver, callState.conversationId, incomingCall]);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    const isMuted = callService.toggleMute();
    setCallState((prev) => ({ ...prev, isMuted }));
  }, []);

  /**
   * Toggle video
   */
  const toggleVideo = useCallback(() => {
    const isVideoOff = callService.toggleVideo();
    setCallState((prev) => ({ ...prev, isVideoOff }));
  }, []);

  const value: CallContextValue = {
    callState,
    incomingCall,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
