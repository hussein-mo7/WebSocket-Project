export function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0][0]?.toUpperCase() || "?";
}

export function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateDivider(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffInDays <= 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function isOnlyEmoji(text: string) {
  const emojiRegex = /^[\p{Emoji}\s]+$/u;
  return emojiRegex.test(text) && text.trim().length > 0 && text.trim().length <= 8;
}

export interface DatedItem {
  createdAt: string;
}

export function groupMessagesByDate<T extends DatedItem>(messages: T[]) {
  const groups: { date: string; messages: T[] }[] = [];

  messages.forEach((message) => {
    const messageDate = new Date(message.createdAt).toDateString();
    const existingGroup = groups.find((group) => group.date === messageDate);

    if (existingGroup) {
      existingGroup.messages.push(message);
    } else {
      groups.push({ date: messageDate, messages: [message] });
    }
  });

  return groups;
}
