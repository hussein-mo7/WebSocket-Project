import prisma from "../config/db";
import { MessageType, MessageStatus } from "@prisma/client";
import {
  NotFoundError,
  BadRequestError,
  AuthorizationError,
} from "../types/error.types";

export class MessageService {
  /**
   * Send a message
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type?: string,
    mediaUrls?: string[]
  ) {
    // Check if conversation exists and user is part of it
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const isParticipant = conversation.participants.some((p) => p.userId === senderId);
    if (!isParticipant) {
      throw new AuthorizationError("You are not part of this conversation");
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        type: (type || "TEXT") as MessageType,
        mediaUrls: mediaUrls || [],
        status: "SENT" as MessageStatus,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Update conversation's last message time
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  /**
   * Get messages from a conversation
   */
  async getMessages(
    conversationId: string,
    limit: number = 20,
    skip: number = 0
  ) {
    // Check if conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        readBy: { select: { userId: true, readAt: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    });

    return messages;
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    if (message.senderId !== userId) {
      throw new AuthorizationError("You can only edit your own messages");
    }

    // Check if message is editable (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
      throw new BadRequestError("Message can only be edited within 5 minutes of sending");
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: newContent,
        isEdited: true,
        editedAt: new Date(),
        editedContent: message.content,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
    });

    return updated;
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    if (message.senderId !== userId) {
      throw new AuthorizationError("You can only delete your own messages");
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    return { success: true, message: "Message deleted" };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    // Get all unread messages from this conversation
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId }, // Don't mark own messages
      },
      select: { id: true },
    });

    if (unreadMessages.length === 0) {
      return;
    }

    // Mark all as read
    await prisma.messageRead.createMany({
      data: unreadMessages.map((msg) => ({
        messageId: msg.id,
        userId,
        readAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Get read receipts for a message
   */
  async getMessageReadReceipts(messageId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        readBy: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    return message.readBy;
  }

  /**
   * React to a message
   */
  async reactToMessage(messageId: string, userId: string, emoji: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    // Check if user is in the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new AuthorizationError("You are not a member of this conversation");
    }

    // Check if reaction already exists
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (existingReaction) {
      await prisma.messageReaction.delete({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
      });
      return { removed: true as const };
    }

    const reaction = await prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        emoji,
      },
    });

    return { ...reaction, removed: false as const };
  }

  /**
   * Get all reactions for a message
   */
  async getMessageReactions(messageId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Group reactions by emoji
    const grouped = reactions.reduce(
      (acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = [];
        }
        acc[reaction.emoji].push({
          userId: reaction.user.id,
          userName: reaction.user.name,
          userAvatar: reaction.user.avatar,
        });
        return acc;
      },
      {} as Record<string, Array<{ userId: string; userName: string | null; userAvatar: string | null }>>
    );

    return grouped;
  }

  /**
   * Remove user's reaction from a message
   */
  async removeReaction(messageId: string, userId: string, emoji: string) {
    const reaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (!reaction) {
      throw new NotFoundError("Reaction not found");
    }

    await prisma.messageReaction.delete({
      where: { id: reaction.id },
    });

    return { success: true, message: "Reaction removed" };
  }

  /**
   * Search messages in a conversation
   */
  async searchMessages(conversationId: string, searchText: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        content: {
          contains: searchText,
          mode: "insensitive",
        },
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return messages;
  }
}

// Export singleton instance
export const messageService = new MessageService();
