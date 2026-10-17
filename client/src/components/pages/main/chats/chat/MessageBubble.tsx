"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import {
  Check,
  CheckCheck,
  Copy,
  File,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Message } from "@/services/messages.service";
import { formatMessageTime, getInitials, isOnlyEmoji } from "./chat.utils";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}

function getBorderRadius(
  isOwn: boolean,
  isFirstInGroup: boolean,
  isLastInGroup: boolean,
) {
  if (isOwn) {
    if (isFirstInGroup && isLastInGroup) return "rounded-2xl rounded-br-lg";
    if (isFirstInGroup) return "rounded-2xl rounded-br-md";
    if (isLastInGroup) return "rounded-2xl rounded-tr-md rounded-br-lg";
    return "rounded-2xl rounded-r-md";
  }

  if (isFirstInGroup && isLastInGroup) return "rounded-2xl rounded-bl-lg";
  if (isFirstInGroup) return "rounded-2xl rounded-bl-md";
  if (isLastInGroup) return "rounded-2xl rounded-tl-md rounded-bl-lg";
  return "rounded-2xl rounded-l-md";
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  isFirstInGroup,
  isLastInGroup,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const onlyEmoji = isOnlyEmoji(message.content);
  const borderRadius = getBorderRadius(isOwn, isFirstInGroup, isLastInGroup);
  const canShowMenu = !message.isDeleted;

  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    if (!isEditing || !editInputRef.current) return;
    editInputRef.current.focus();
    editInputRef.current.setSelectionRange(editText.length, editText.length);
  }, [isEditing, editText.length]);

  const handleEditSubmit = () => {
    if (editText.trim() && editText !== message.content) {
      onEdit?.(message.id, editText.trim());
    }
    setIsEditing(false);
    setShowMenu(false);
  };

  const handleEditCancel = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleEditSubmit();
    }
    if (event.key === "Escape") {
      handleEditCancel();
    }
  };

  return (
    <div
      className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} ${
        isLastInGroup ? "mb-3" : "mb-0.5"
      }`}
    >
      {!isOwn && (
        <div className="flex-shrink-0 w-8 self-end">
          {showAvatar && isLastInGroup ? (
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-surface">
              {message.sender.avatar ? (
                <Image
                  src={message.sender.avatar}
                  alt={message.sender.name || "User"}
                  width={32}
                  height={32}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primaryColor to-primaryColor/70 flex items-center justify-center text-white text-xs font-semibold">
                  {getInitials(message.sender.name)}
                </div>
              )}
            </div>
          ) : (
            <div className="w-8" />
          )}
        </div>
      )}

      <div
        className={`relative max-w-[65%] flex flex-col ${
          isOwn ? "items-end" : "items-start"
        }`}
      >
        {canShowMenu && (
          <div
            ref={menuRef}
            className={`absolute top-0 ${
              isOwn
                ? "left-0 -translate-x-full pr-2"
                : "right-0 translate-x-full pl-2"
            } opacity-0 group-hover:opacity-100 transition-opacity z-10`}
          >
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg bg-surface border border-border shadow-sm hover:bg-hover transition-colors"
              aria-label="Message actions"
            >
              <MoreHorizontal className="w-4 h-4 text-secondary" />
            </button>

            {showMenu && (
              <div
                className={`absolute top-full mt-1 ${
                  isOwn ? "right-0" : "left-0"
                } bg-panel border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px] z-20`}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(message.content);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-hover transition-colors"
                >
                  <Copy className="w-4 h-4 text-secondary" />
                  <span className="text-sm text-primary">Copy</span>
                </button>

                {isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-hover transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-secondary" />
                    <span className="text-sm text-primary">Edit</span>
                  </button>
                )}

                {isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete?.(message.id);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isEditing ? (
          <div className="w-full min-w-[200px]">
            <div
              className={`px-3.5 py-2 ${borderRadius} bg-surface border-2 border-primaryColor shadow-sm`}
            >
              <textarea
                ref={editInputRef}
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full bg-transparent text-sm text-primary resize-none focus:outline-none"
                rows={Math.min(editText.split("\n").length, 5)}
              />
            </div>
            <div className="flex items-center gap-2 mt-1.5 px-1">
              <span className="text-[10px] text-secondary">
                Esc to cancel • Enter to save
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleEditCancel}
                className="text-xs text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                className="text-xs text-primaryColor hover:text-primaryColor/80 font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : onlyEmoji ? (
          <div className="text-4xl leading-tight py-1">{message.content}</div>
        ) : (
          <div
            className={`px-3.5 py-2 ${borderRadius} ${
              isOwn
                ? "bg-[#385541] text-white"
                : "bg-panel text-primary border border-border"
            } shadow-sm`}
          >
            {message.mediaUrls && message.mediaUrls.length > 0 && (
              <div className="mb-2 rounded-lg overflow-hidden">
                {message.type === "IMAGE" ? (
                  <Image
                    src={message.mediaUrls[0]}
                    alt="Shared image"
                    width={250}
                    height={200}
                    className="object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                    <File className="w-5 h-5" />
                    <span className="text-xs truncate">
                      {message.mediaUrls[0].split("/").pop()}
                    </span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
              {message.isDeleted ? (
                <span className="italic opacity-60">Message deleted</span>
              ) : (
                message.content
              )}
            </p>
          </div>
        )}

        {isLastInGroup && !isEditing && (
          <div
            className={`flex items-center gap-1 mt-1 px-1 ${
              isOwn ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <span className="text-[10px] text-secondary/70">
              {formatMessageTime(message.createdAt)}
              {message.isEdited && " · edited"}
            </span>
            {isOwn && (
              <span className="text-primaryColor">
                {message.status === "READ" ? (
                  <CheckCheck className="w-3.5 h-3.5" />
                ) : message.status === "DELIVERED" ? (
                  <CheckCheck className="w-3.5 h-3.5 opacity-50" />
                ) : (
                  <Check className="w-3.5 h-3.5 opacity-50" />
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
