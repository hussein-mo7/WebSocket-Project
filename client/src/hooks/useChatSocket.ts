"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/socket/SocketContext";
import { messagesService, Message } from "@/services/messages.service";

/**
 * =====================================================
 * useChatSocket HOOK
 * =====================================================
 * 
 * A specialized hook for chat functionality.
 * Combines:
 * - Initial message loading via HTTP (React Query/fetch)
 * - Real-time updates via Socket.IO
 * 
 * WHY BOTH HTTP AND SOCKET?
 * - HTTP: Load historical messages when opening a chat
 * - Socket: Receive new messages in real-time
 * 
 * USAGE:
 * ```tsx
 * const { messages, sendMessage, isTyping } = useChatSocket(conversationId);
 * ```
 */

interface UseChatSocketOptions {
  conversationId: string;
  enabled?: boolean;
}

interface UseChatSocketReturn {
  // Messages
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (
    content: string,
    options?: { type?: string; mediaUrls?: string[] },
  ) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  
  // Typing
  typingUsers: string[];
  startTyping: () => void;
  stopTyping: () => void;
  
  // Connection status
  isConnected: boolean;
}

export function useChatSocket({
  conversationId,
  enabled = true,
}: UseChatSocketOptions): UseChatSocketReturn {
  const {
    messages,
    setMessages,
    typingUsers,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage: socketSendMessage,
    editMessage: socketEditMessage,
    deleteMessage: socketDeleteMessage,
    startTyping: socketStartTyping,
    stopTyping: socketStopTyping,
  } = useSocket();

  // Track loading state locally
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to track current conversation (for cleanup)
  const currentConversationRef = useRef<string | null>(null);

  // =====================================================
  // JOIN/LEAVE CONVERSATION
  // =====================================================

  useEffect(() => {
    if (!enabled || !conversationId) return;

    // Join the conversation room
    joinConversation(conversationId);
    currentConversationRef.current = conversationId;

    // Load initial messages via HTTP
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await messagesService.getMessages(conversationId);
        
        // Set messages in context (response has { messages, hasMore })
        setMessages(response.messages || []);
      } catch (err) {
        console.error("Failed to load messages:", err);
        setError("Failed to load messages");
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();

    // Cleanup: Leave room when conversation changes or component unmounts
    return () => {
      if (currentConversationRef.current) {
        leaveConversation(currentConversationRef.current);
        currentConversationRef.current = null;
      }
    };
  }, [conversationId, enabled, joinConversation, leaveConversation, setMessages]);

  // =====================================================
  // MESSAGE ACTIONS
  // =====================================================

  /**
   * Send a new message
   */
  const sendMessage = useCallback(
    (content: string, options?: { type?: string; mediaUrls?: string[] }) => {
      const mediaUrls = options?.mediaUrls ?? [];
      if ((!content.trim() && mediaUrls.length === 0) || !conversationId) return;
      socketSendMessage(
        conversationId,
        content.trim(),
        options?.type ?? "TEXT",
        mediaUrls,
      );
    },
    [conversationId, socketSendMessage],
  );

  /**
   * Edit an existing message
   */
  const editMessage = useCallback(
    (messageId: string, content: string) => {
      if (!content.trim() || !conversationId) return;
      socketEditMessage(messageId, conversationId, content.trim());
    },
    [conversationId, socketEditMessage]
  );

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!conversationId) return;
      socketDeleteMessage(messageId, conversationId);
    },
    [conversationId, socketDeleteMessage]
  );

  // =====================================================
  // TYPING INDICATORS
  // =====================================================

  const startTyping = useCallback(() => {
    if (!conversationId) return;
    socketStartTyping(conversationId);
  }, [conversationId, socketStartTyping]);

  const stopTyping = useCallback(() => {
    if (!conversationId) return;
    socketStopTyping(conversationId);
  }, [conversationId, socketStopTyping]);

  // Filter typing users for current conversation
  const currentTypingUsers = typingUsers
    .filter((u) => u.conversationId === conversationId)
    .map((u) => u.userId);

  // =====================================================
  // RETURN
  // =====================================================

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    typingUsers: currentTypingUsers,
    startTyping,
    stopTyping,
    isConnected,
  };
}
