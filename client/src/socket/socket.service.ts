import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";

/**
 * =====================================================
 * SOCKET SERVICE - Singleton Pattern
 * =====================================================
 * 
 * This service manages the WebSocket connection to the server.
 * It uses a singleton pattern to ensure only ONE socket connection
 * exists throughout the entire application.
 * 
 * WHY SINGLETON?
 * - Prevents multiple connections (which would cause duplicate events)
 * - Provides a single point of access for all components
 * - Manages connection state centrally
 */

// Server URL from environment
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Socket Events - These match the server's chat.socket.ts
 * 
 * CLIENT -> SERVER (emit):
 * - conversation:open    - Join a conversation room
 * - conversation:close   - Leave a conversation room
 * - message:send         - Send a new message
 * - message:edit         - Edit a message
 * - message:delete       - Delete a message
 * - message:react        - React to a message
 * - message:read         - Mark messages as read
 * - typing:start         - Start typing indicator
 * - typing:stop          - Stop typing indicator
 * - user:online          - User comes online
 * 
 * SERVER -> CLIENT (on):
 * - message:received     - New message in conversation
 * - message:edited       - Message was edited
 * - message:deleted      - Message was deleted
 * - message:reaction     - Reaction added/removed
 * - messages:read        - Messages marked as read
 * - user:typing          - Someone is typing
 * - user:read-receipt    - Read receipt notification
 * - user:status          - User online/offline status
 * - error                - Error from server
 */

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

  // Private constructor for singleton
  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Connect to the socket server
   * Called once when user logs in
   */
  connect(): Socket | null {
    // Don't create multiple connections
    if (this.socket?.connected) {
      return this.socket;
    }

    // Get auth token from cookies
    const token = Cookies.get("accessToken");
    
    if (!token) {
      console.warn("No access token found, cannot connect to socket");
      return null;
    }

    // Create socket connection with auth
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Setup connection event handlers
    this.socket.on("connect", () => {
      // Emit user online status
      this.socket?.emit("user:online");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    this.socket.on("error", (error: { message: string }) => {
      console.error("Socket error:", error.message);
    });

    return this.socket;
  }

  /**
   * Disconnect from socket server
   * Called when user logs out
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Get the current socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // =====================================================
  // CONVERSATION METHODS
  // =====================================================

  /**
   * Join a conversation room
   * Call this when user opens a chat
   */
  joinConversation(conversationId: string): void {
    this.socket?.emit("conversation:open", conversationId);
  }

  /**
   * Leave a conversation room
   * Call this when user closes/leaves a chat
   */
  leaveConversation(conversationId: string): void {
    this.socket?.emit("conversation:close", conversationId);
  }

  // =====================================================
  // MESSAGE METHODS
  // =====================================================

  /**
   * Send a message
   */
  sendMessage(data: {
    conversationId: string;
    content: string;
    type?: string;
    mediaUrls?: string[];
  }): void {
    this.socket?.emit("message:send", data);
  }

  /**
   * Edit a message
   */
  editMessage(data: {
    messageId: string;
    conversationId: string;
    newContent: string;
  }): void {
    this.socket?.emit("message:edit", data);
  }

  /**
   * Delete a message
   */
  deleteMessage(data: { messageId: string; conversationId: string }): void {
    this.socket?.emit("message:delete", data);
  }

  /**
   * React to a message
   */
  reactToMessage(data: {
    messageId: string;
    conversationId: string;
    emoji: string;
  }): void {
    this.socket?.emit("message:react", data);
  }

  /**
   * Mark messages as read
   */
  markAsRead(data: { conversationId: string; messageIds: string[] }): void {
    this.socket?.emit("message:read", data);
  }

  // =====================================================
  // TYPING INDICATORS
  // =====================================================

  /**
   * Start typing indicator
   */
  startTyping(conversationId: string): void {
    this.socket?.emit("typing:start", conversationId);
  }

  /**
   * Stop typing indicator
   */
  stopTyping(conversationId: string): void {
    this.socket?.emit("typing:stop", conversationId);
  }

  // =====================================================
  // EVENT LISTENERS
  // =====================================================

  /**
   * Subscribe to an event
   */
  on<T>(event: string, callback: (data: T) => void): void {
    this.socket?.on(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();
