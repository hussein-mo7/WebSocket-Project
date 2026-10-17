"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { socketService } from "./socket.service";
import { Message } from "@/services/messages.service";

/**
 * =====================================================
 * SOCKET CONTEXT - React Context for Socket.IO
 * =====================================================
 * 
 * This context provides socket functionality to all components.
 * It handles:
 * - Connection lifecycle (connect on mount, disconnect on unmount)
 * - Event subscriptions
 * - Real-time message state
 * - Typing indicators
 * - User online status
 * 
 * HOW IT WORKS:
 * 1. SocketProvider wraps your app (in providers/index.tsx)
 * 2. Components use useSocket() hook to access socket functionality
 * 3. Socket events automatically update React state
 * 4. Components re-render when state changes
 */

// =====================================================
// TYPES
// =====================================================

interface TypingUser {
  userId: string;
  conversationId: string;
}

interface UserStatus {
  userId: string;
  status: "online" | "offline" | "away";
}

interface SocketContextValue {
  // Connection state
  isConnected: boolean;
  
  // Messages for current conversation
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  
  // Typing indicators
  typingUsers: TypingUser[];
  
  // User statuses (online/offline)
  userStatuses: Record<string, "online" | "offline" | "away">;
  
  // Methods
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    type?: string,
    mediaUrls?: string[],
  ) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  editMessage: (messageId: string, conversationId: string, content: string) => void;
  deleteMessage: (messageId: string, conversationId: string) => void;
  
  // Current conversation
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
}

// Create context with default values
const SocketContext = createContext<SocketContextValue | null>(null);

// =====================================================
// SOCKET PROVIDER COMPONENT
// =====================================================

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  // Connection state - initialize as false, will update via connect event
  const [isConnected, setIsConnected] = useState(false);
  
  // Messages state - stores messages for current conversation
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Typing users
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // User online statuses
  const [userStatuses, setUserStatuses] = useState<Record<string, "online" | "offline" | "away">>({});
  
  // Current conversation ID
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // Ref to track if we've set up listeners
  const listenersSetup = useRef(false);

  // =====================================================
  // SOCKET CONNECTION SETUP
  // =====================================================
  
  useEffect(() => {
    // Connect to socket
    const socket = socketService.connect();
    
    if (!socket) {
      console.warn("Failed to connect to socket");
      return;
    }

    // Avoid setting up listeners multiple times
    if (listenersSetup.current) return;
    listenersSetup.current = true;

    // =====================================================
    // EVENT HANDLERS
    // =====================================================

    /**
     * Connection established
     */
    const handleConnect = () => {
      setIsConnected(true);
    };

    /**
     * Connection lost
     */
    const handleDisconnect = () => {
      setIsConnected(false);
    };

    /**
     * New message received
     * This is the main event for real-time chat
     */
    const handleMessageReceived = (message: Message) => {
      // Add message to state (only if it's for current conversation)
      setMessages((prev) => {
        // Check if message already exists (to avoid duplicates)
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        // Add new message at the end
        return [...prev, message];
      });
    };

    /**
     * Message was edited
     */
    const handleMessageEdited = (data: {
      messageId: string;
      conversationId: string;
      newContent: string;
      isEdited: boolean;
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, content: data.newContent, isEdited: true }
            : m
        )
      );
    };

    /**
     * Message was deleted
     */
    const handleMessageDeleted = (data: {
      messageId: string;
      conversationId: string;
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, isDeleted: true } : m
        )
      );
    };

    /**
     * User typing indicator
     */
    const handleUserTyping = (data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (data.isTyping) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, conversationId: data.conversationId }];
        });
      } else {
        setTypingUsers((prev) =>
          prev.filter((u) => u.userId !== data.userId)
        );
      }
    };

    /**
     * User status changed (online/offline)
     */
    const handleUserStatus = (data: UserStatus) => {
      setUserStatuses((prev) => ({
        ...prev,
        [data.userId]: data.status,
      }));
    };

    /**
     * Messages marked as read
     */
    const handleMessagesRead = () => {
      // Read receipts are applied when the conversation is reopened.
    };

    // =====================================================
    // REGISTER EVENT LISTENERS
    // =====================================================

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("message:received", handleMessageReceived);
    socket.on("message:edited", handleMessageEdited);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("user:typing", handleUserTyping);
    socket.on("user:status", handleUserStatus);
    socket.on("messages:read", handleMessagesRead);

    // =====================================================
    // CLEANUP ON UNMOUNT
    // =====================================================
    
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("message:received", handleMessageReceived);
      socket.off("message:edited", handleMessageEdited);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("user:typing", handleUserTyping);
      socket.off("user:status", handleUserStatus);
      socket.off("messages:read", handleMessagesRead);
      
      listenersSetup.current = false;
    };
  }, []);

  // =====================================================
  // METHODS
  // =====================================================

  /**
   * Join a conversation room
   * - Joins socket room for real-time messages
   * - Auto-marks messages as read
   */
  const joinConversation = useCallback((conversationId: string) => {
    socketService.joinConversation(conversationId);
    setCurrentConversationId(conversationId);
  }, []);

  /**
   * Leave a conversation room
   */
  const leaveConversation = useCallback((conversationId: string) => {
    socketService.leaveConversation(conversationId);
    setCurrentConversationId(null);
    setMessages([]); // Clear messages when leaving
  }, []);

  /**
   * Send a message via socket
   */
  const sendMessage = useCallback(
    (
      conversationId: string,
      content: string,
      type: string = "TEXT",
      mediaUrls: string[] = [],
    ) => {
      socketService.sendMessage({
        conversationId,
        content,
        type,
        mediaUrls,
      });
    },
    [],
  );

  /**
   * Start typing indicator
   */
  const startTyping = useCallback((conversationId: string) => {
    socketService.startTyping(conversationId);
  }, []);

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback((conversationId: string) => {
    socketService.stopTyping(conversationId);
  }, []);

  /**
   * Edit a message
   */
  const editMessage = useCallback(
    (messageId: string, conversationId: string, content: string) => {
      socketService.editMessage({
        messageId,
        conversationId,
        newContent: content,
      });
    },
    []
  );

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(
    (messageId: string, conversationId: string) => {
      socketService.deleteMessage({ messageId, conversationId });
    },
    []
  );

  // =====================================================
  // CONTEXT VALUE
  // =====================================================

  const value: SocketContextValue = {
    isConnected,
    messages,
    setMessages,
    typingUsers,
    userStatuses,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    editMessage,
    deleteMessage,
    currentConversationId,
    setCurrentConversationId,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

// =====================================================
// HOOK TO USE SOCKET CONTEXT
// =====================================================

export function useSocket() {
  const context = useContext(SocketContext);
  
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  
  return context;
}
