"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { useConversationOtherUser } from "@/hooks/useConversations";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCall } from "@/providers/CallProvider";
import { messagesService } from "@/services/messages.service";
import { ChatHeader } from "./ChatHeader";
import { DateDivider } from "./DateDivider";
import { FilePreview } from "./FilePreview";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { TypingIndicator } from "./TypingIndicator";
import { groupMessagesByDate } from "./chat.utils";

const Chat = () => {
  const params = useParams();
  const conversationId = params?.conversationId as string;

  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const { data: otherUser, isLoading: isUserLoading } =
    useConversationOtherUser(conversationId);
  const { data: currentUser } = useUserProfile();
  const { startCall } = useCall();
  const {
    messages,
    isLoading: isMessagesLoading,
    sendMessage: socketSendMessage,
    editMessage: socketEditMessage,
    deleteMessage: socketDeleteMessage,
    typingUsers,
    startTyping,
    stopTyping,
  } = useChatSocket({
    conversationId,
    enabled: !!conversationId,
  });

  const groupedMessages = useMemo(
    () => groupMessagesByDate(messages),
    [messages],
  );
  const canSend = messageText.trim().length > 0 || selectedFiles.length > 0;

  const startCallWithOtherUser = useCallback(
    (callType: "AUDIO" | "VIDEO") => {
      if (!conversationId || !otherUser) return;
      startCall(
        conversationId,
        otherUser.id,
        {
          id: otherUser.id,
          name: otherUser.name || "Unknown",
          avatar: otherUser.avatar,
        },
        callType,
      );
    },
    [conversationId, otherUser, startCall],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showAttachMenu) return;

    const handleClickOutside = () => setShowAttachMenu(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showAttachMenu]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
  }, [messageText]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleTyping = useCallback(() => {
    startTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => stopTyping(), 2000);
  }, [startTyping, stopTyping]);

  const handleSendMessage = useCallback(async () => {
    if (!canSend || !conversationId || isSending) return;

    const text = messageText.trim();
    const files = selectedFiles;
    setIsSending(true);

    try {
      const mediaUrls = files.length
        ? await Promise.all(files.map((file) => messagesService.uploadMedia(file)))
        : [];
      const type =
        mediaUrls.length === 0
          ? "TEXT"
          : files.every((file) => file.type.startsWith("image/"))
            ? "IMAGE"
            : "FILE";

      socketSendMessage(text, { type, mediaUrls });
      stopTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setMessageText("");
      setSelectedFiles([]);
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Could not send that message. Try again.");
    } finally {
      setIsSending(false);
    }
  }, [
    canSend,
    conversationId,
    isSending,
    messageText,
    selectedFiles,
    socketSendMessage,
    stopTyping,
  ]);

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-main text-secondary">
        <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 opacity-40" />
        </div>
        <h3 className="text-lg font-semibold text-primary mb-1">
          Select a conversation
        </h3>
        <p className="text-sm text-secondary">
          Choose a chat from the sidebar to start messaging
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-main overflow-hidden">
      <ChatHeader
        user={otherUser}
        conversationId={conversationId}
        isLoading={isUserLoading}
        isTyping={typingUsers.length > 0}
        onCallClick={() => startCallWithOtherUser("AUDIO")}
        onVideoClick={() => startCallWithOtherUser("VIDEO")}
      />

      <div
        className="flex-1 overflow-y-auto px-4 py-2 pb-20 md:pb-2 scroll-smooth"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      >
        {isMessagesLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-2 border-primaryColor border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-secondary mt-4">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-3">
              <MessageSquare className="w-8 h-8 text-secondary/50" />
            </div>
            <p className="text-sm font-medium text-primary">No messages yet</p>
            <p className="text-xs text-secondary mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <div className="py-2">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <DateDivider date={group.messages[0].createdAt} />
                <div>
                  {group.messages.map((message, index) => {
                    const prevMessage = group.messages[index - 1];
                    const nextMessage = group.messages[index + 1];

                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={message.senderId === currentUser?.id}
                        showAvatar
                        isFirstInGroup={
                          !prevMessage || prevMessage.senderId !== message.senderId
                        }
                        isLastInGroup={
                          !nextMessage || nextMessage.senderId !== message.senderId
                        }
                        onEdit={socketEditMessage}
                        onDelete={socketDeleteMessage}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {typingUsers.length > 0 && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <FilePreview
        files={selectedFiles}
        onRemove={(index) =>
          setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
        }
      />

      <MessageComposer
        messageText={messageText}
        canSend={canSend && !isSending}
        showEmojiPicker={showEmojiPicker}
        showAttachMenu={showAttachMenu}
        inputRef={inputRef}
        fileInputRef={fileInputRef}
        imageInputRef={imageInputRef}
        emojiPickerRef={emojiPickerRef}
        onMessageChange={(value) => {
          setMessageText(value);
          handleTyping();
        }}
        onSend={handleSendMessage}
        onEmojiClick={(emojiData) => {
          setMessageText((current) => current + emojiData.emoji);
          inputRef.current?.focus();
        }}
        onToggleEmoji={() => {
          setShowEmojiPicker((open) => !open);
          setShowAttachMenu(false);
        }}
        onToggleAttach={() => {
          setShowAttachMenu((open) => !open);
          setShowEmojiPicker(false);
        }}
        onFileSelect={(event) => {
          const files = Array.from(event.target.files || []);
          setSelectedFiles((current) => [...current, ...files].slice(0, 5));
          event.target.value = "";
        }}
      />
    </div>
  );
};

export default Chat;
