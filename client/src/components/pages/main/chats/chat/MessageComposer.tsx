"use client";

import { type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { File, Image as ImageIcon, Paperclip, Send, Smile } from "lucide-react";

interface MessageComposerProps {
  messageText: string;
  canSend: boolean;
  showEmojiPicker: boolean;
  showAttachMenu: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onEmojiClick: (emoji: EmojiClickData) => void;
  onToggleEmoji: () => void;
  onToggleAttach: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function MessageComposer({
  messageText,
  canSend,
  showEmojiPicker,
  showAttachMenu,
  inputRef,
  fileInputRef,
  imageInputRef,
  emojiPickerRef,
  onMessageChange,
  onSend,
  onEmojiClick,
  onToggleEmoji,
  onToggleAttach,
  onFileSelect,
}: MessageComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto px-4 py-3 bg-panel border-t border-border flex-shrink-0 z-40">
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full left-4 mb-2 z-50 shadow-xl rounded-xl overflow-hidden"
        >
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme={Theme.DARK}
            width={320}
            height={400}
            searchPlaceholder="Search emojis..."
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {showAttachMenu && (
        <div className="absolute bottom-full left-4 mb-2 z-50 bg-panel border border-border rounded-xl shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-hover transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Photo</p>
              <p className="text-xs text-secondary">Share images</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-hover transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
              <File className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Document</p>
              <p className="text-xs text-secondary">Share files</p>
            </div>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFileSelect}
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={onFileSelect}
      />

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleAttach();
          }}
          className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
            showAttachMenu
              ? "bg-primaryColor/10 text-primaryColor"
              : "hover:bg-hover text-secondary hover:text-primary"
          }`}
          aria-label="Attach a file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-end bg-surface border border-border rounded-2xl transition-all focus-within:border-primaryColor/50 focus-within:ring-2 focus-within:ring-primaryColor/20">
          <button
            type="button"
            onClick={onToggleEmoji}
            className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
              showEmojiPicker
                ? "text-primaryColor"
                : "text-secondary hover:text-primary"
            }`}
            aria-label="Add an emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(event) => onMessageChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 py-2.5 pr-3 text-sm bg-transparent text-primary placeholder-secondary resize-none focus:outline-none max-h-[120px]"
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${
            canSend
              ? "bg-primaryColor text-white hover:bg-primaryColor/90 hover:scale-105 active:scale-95 shadow-lg shadow-primaryColor/25"
              : "bg-surface text-secondary cursor-not-allowed"
          }`}
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
