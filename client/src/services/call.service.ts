/**
 * =====================================================
 * WEBRTC CALL SERVICE
 * =====================================================
 * 
 * Handles video/voice calls using WebRTC and Socket.IO signaling.
 * 
 * FLOW:
 * 1. Caller clicks call button
 * 2. Create RTCPeerConnection
 * 3. Get user media (camera/mic)
 * 4. Create offer and send via socket
 * 5. Receiver gets offer, creates answer
 * 6. ICE candidates exchanged
 * 7. Connection established
 * 
 * NOTE: Express/server is ONLY used for signaling (exchanging SDP and ICE).
 * Actual audio/video streams are peer-to-peer via WebRTC.
 */

import { socketService } from "@/socket/socket.service";
import { callSounds } from "@/utils/callSounds";

// ICE servers for NAT traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export type CallType = "AUDIO" | "VIDEO";
export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface CallUser {
  id: string;
  name?: string | null;
  avatar?: string | null;
}

export interface CallState {
  status: CallStatus;
  callType: CallType | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  caller: CallUser | null;
  receiver: CallUser | null;
  conversationId: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callStartTime: Date | null;
}

class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  
  // Callbacks for UI updates
  private onStateChange: ((state: Partial<CallState>) => void) | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onCallEnded: (() => void) | null = null;
  private onIncomingCall: ((data: {
    from: string;
    callType: CallType;
    conversationId: string;
    user: CallUser;
    offer: RTCSessionDescriptionInit;
  }) => void) | null = null;

  /**
   * Set callback for state changes
   */
  setOnStateChange(callback: (state: Partial<CallState>) => void) {
    this.onStateChange = callback;
  }

  /**
   * Set callback for remote stream
   */
  setOnRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStream = callback;
  }

  /**
   * Set callback for call ended
   */
  setOnCallEnded(callback: () => void) {
    this.onCallEnded = callback;
  }

  /**
   * Set callback for incoming call
   */
  setOnIncomingCall(callback: (data: {
    from: string;
    callType: CallType;
    conversationId: string;
    user: CallUser;
    offer: RTCSessionDescriptionInit;
  }) => void) {
    this.onIncomingCall = callback;
  }

  /**
   * Initialize socket listeners for call events
   */
  initializeSocketListeners() {
    const socket = socketService.getSocket();
    if (!socket) {
      console.warn("📞 Cannot initialize call listeners - no socket");
      return;
    }

    // Remove any existing listeners first to prevent duplicates
    this.removeSocketListeners();


    // Incoming call offer
    socket.on("call:offer", (data) => {
      this.onIncomingCall?.(data);
    });

    // NOTE: call:answer is handled in startCall() to ensure it's set up at the right time

    // ICE candidate received
    socket.on("call:ice-candidate", async (data) => {
      if (this.peerConnection && data.candidate) {
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    // Call declined
    socket.on("call:declined", () => {
      callSounds.stopAll();
      callSounds.playDeclined();
      this.endCall();
      this.onStateChange?.({ status: "ended" });
    });

    // Call ended by other party
    socket.on("call:ended", () => {
      this.endCall();
      this.onCallEnded?.();
    });
  }

  /**
   * Remove socket listeners
   */
  removeSocketListeners() {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.off("call:offer");
    socket.off("call:answer");
    socket.off("call:ice-candidate");
    socket.off("call:declined");
    socket.off("call:ended");
  }

  /**
   * Start a call (as caller)
   */
  async startCall(
    conversationId: string,
    receiverId: string,
    callType: CallType
  ): Promise<MediaStream | null> {
    try {
      
      const socket = socketService.getSocket();
      if (!socket) {
        throw new Error("No socket connection");
      }

      // Set up answer listener BEFORE making the call
      // Remove any existing listener first
      socket.off("call:answer");
      socket.on("call:answer", async (data: { from: string; answer: RTCSessionDescriptionInit; conversationId: string }) => {
        if (this.peerConnection && data.answer) {
          try {
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            callSounds.stopAll();
            callSounds.playConnected();
            this.onStateChange?.({ status: "connected", callStartTime: new Date() });
          } catch (err) {
            console.error("📞 Error setting remote description:", err);
          }
        }
      });

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: callType === "VIDEO",
        audio: true,
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Handle remote stream
      this.remoteStream = new MediaStream();
      this.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          this.remoteStream!.addTrack(track);
        });
        this.onRemoteStream?.(this.remoteStream!);
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("call:ice-candidate", {
            conversationId,
            candidate: event.candidate,
            to: receiverId,
          });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection?.connectionState === "disconnected" ||
            this.peerConnection?.connectionState === "failed") {
          this.endCall();
          this.onCallEnded?.();
        }
      };

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      socket.emit("call:offer", {
        conversationId,
        offer,
        to: receiverId,
        callType,
      });

      this.onStateChange?.({ status: "calling" });

      return this.localStream;
    } catch (error) {
      console.error("Error starting call:", error);
      this.endCall();
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(
    conversationId: string,
    callerId: string,
    offer: RTCSessionDescriptionInit,
    callType: CallType
  ): Promise<MediaStream | null> {
    try {
      
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: callType === "VIDEO",
        audio: true,
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Handle remote stream
      this.remoteStream = new MediaStream();
      this.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          this.remoteStream!.addTrack(track);
        });
        this.onRemoteStream?.(this.remoteStream!);
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.getSocket()?.emit("call:ice-candidate", {
            conversationId,
            candidate: event.candidate,
            to: callerId,
          });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection?.connectionState === "disconnected" ||
            this.peerConnection?.connectionState === "failed") {
          this.endCall();
          this.onCallEnded?.();
        }
      };

      // Set remote description (offer)
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      socketService.getSocket()?.emit("call:answer", {
        conversationId,
        answer,
        to: callerId,
      });

      this.onStateChange?.({ status: "connected", callStartTime: new Date() });

      return this.localStream;
    } catch (error) {
      console.error("Error answering call:", error);
      this.endCall();
      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  declineCall(conversationId: string, callerId: string) {
    socketService.getSocket()?.emit("call:decline", {
      conversationId,
      to: callerId,
    });
    this.onStateChange?.({ status: "idle" });
  }

  /**
   * End the current call
   */
  endCall(receiverId?: string, conversationId?: string) {
    // Notify other party
    if (receiverId && conversationId) {
      socketService.getSocket()?.emit("call:end", {
        conversationId,
        to: receiverId,
      });
    }

    // Stop local stream tracks
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;

    // Stop remote stream tracks
    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream = null;

    // Close peer connection
    this.peerConnection?.close();
    this.peerConnection = null;

    this.onStateChange?.({ status: "idle" });
  }

  /**
   * Toggle mute
   */
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // Return true if muted
      }
    }
    return false;
  }

  /**
   * Toggle video
   */
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled; // Return true if video off
      }
    }
    return false;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}

export const callService = new CallService();
