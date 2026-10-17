export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type: string;
  mediaUrls: string[];
}

export interface EditMessagePayload {
  messageId: string;
  conversationId: string;
  newContent: string;
}

export interface DeleteMessagePayload {
  messageId: string;
  conversationId: string;
}

export interface ReadReceiptPayload {
  conversationId: string;
  messageIds: string[];
}

export interface ReactMessagePayload {
  messageId: string;
  conversationId: string;
  emoji: string;
}

export interface CallSignalPayload {
  conversationId: string;
  to: string;
  offer?: unknown;
  answer?: unknown;
  candidate?: unknown;
  callType?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseSendMessage(data: unknown): SendMessagePayload | null {
  if (!isRecord(data)) return null;
  const conversationId = readString(data.conversationId);
  if (!conversationId || typeof data.content !== "string") return null;

  return {
    conversationId,
    content: data.content,
    type: readString(data.type) ?? "TEXT",
    mediaUrls: readStringList(data.mediaUrls),
  };
}

export function parseEditMessage(data: unknown): EditMessagePayload | null {
  if (!isRecord(data)) return null;
  const messageId = readString(data.messageId);
  const conversationId = readString(data.conversationId);
  if (!messageId || !conversationId || typeof data.newContent !== "string") {
    return null;
  }

  return { messageId, conversationId, newContent: data.newContent };
}

export function parseDeleteMessage(data: unknown): DeleteMessagePayload | null {
  if (!isRecord(data)) return null;
  const messageId = readString(data.messageId);
  const conversationId = readString(data.conversationId);
  if (!messageId || !conversationId) return null;
  return { messageId, conversationId };
}

export function parseReadReceipt(data: unknown): ReadReceiptPayload | null {
  if (!isRecord(data)) return null;
  const conversationId = readString(data.conversationId);
  if (!conversationId || !Array.isArray(data.messageIds)) return null;

  return {
    conversationId,
    messageIds: readStringList(data.messageIds),
  };
}

export function parseReaction(data: unknown): ReactMessagePayload | null {
  if (!isRecord(data)) return null;
  const messageId = readString(data.messageId);
  const conversationId = readString(data.conversationId);
  const emoji = readString(data.emoji);
  if (!messageId || !conversationId || !emoji) return null;
  return { messageId, conversationId, emoji };
}

export function parseCallSignal(data: unknown): CallSignalPayload | null {
  if (!isRecord(data)) return null;
  const conversationId = readString(data.conversationId);
  const to = readString(data.to);
  if (!conversationId || !to) return null;

  return {
    conversationId,
    to,
    offer: data.offer,
    answer: data.answer,
    candidate: data.candidate,
    callType: readString(data.callType) ?? undefined,
  };
}
