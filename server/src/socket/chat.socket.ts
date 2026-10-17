import { Server, Socket } from "socket.io";
import { messageService } from "../services/message.service";
import * as userService from "../services/user.service";
import {
  parseCallSignal,
  parseDeleteMessage,
  parseEditMessage,
  parseReaction,
  parseReadReceipt,
  parseSendMessage,
} from "./socket.payloads";

export function setupChatSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string | undefined;

    if (!userId) {
      socket.disconnect();
      return;
    }

    socket.join(userId);

    socket.on("conversation:open", async (conversationId: unknown) => {
      try {
        if (typeof conversationId !== "string" || !conversationId) {
          socket.emit("error", { message: "Invalid conversation" });
          return;
        }

        socket.join(conversationId);
        await messageService.markMessagesAsRead(conversationId, userId);
        socket.to(conversationId).emit("messages:read", {
          conversationId,
          userId,
          readAt: new Date(),
        });
      } catch (error) {
        console.error("Error in conversation:open:", error);
        socket.emit("error", { message: "Failed to mark messages as read" });
      }
    });

    socket.on("conversation:close", (conversationId: unknown) => {
      if (typeof conversationId === "string" && conversationId) {
        socket.leave(conversationId);
      }
    });

    socket.on("message:send", async (data: unknown) => {
      try {
        const payload = parseSendMessage(data);
        if (!payload) {
          socket.emit("error", { message: "Invalid message payload" });
          return;
        }

        const message = await messageService.sendMessage(
          payload.conversationId,
          userId,
          payload.content,
          payload.type,
          payload.mediaUrls,
        );

        io.to(payload.conversationId).emit("message:received", {
          id: message.id,
          conversationId: payload.conversationId,
          senderId: userId,
          content: message.content,
          type: message.type,
          mediaUrls: message.mediaUrls || [],
          status: "SENT",
          createdAt: message.createdAt,
          sender: {
            id: userId,
            name: message.sender?.name,
            avatar: message.sender?.avatar,
          },
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("message:edit", async (data: unknown) => {
      try {
        const payload = parseEditMessage(data);
        if (!payload) {
          socket.emit("error", { message: "Invalid edit payload" });
          return;
        }

        const updatedMessage = await messageService.editMessage(
          payload.messageId,
          userId,
          payload.newContent,
        );

        io.to(payload.conversationId).emit("message:edited", {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          newContent: updatedMessage.content,
          isEdited: true,
          editedAt: updatedMessage.editedAt,
        });
      } catch (error) {
        console.error("Error editing message:", error);
        socket.emit("error", { message: "Failed to edit message" });
      }
    });

    socket.on("message:delete", async (data: unknown) => {
      try {
        const payload = parseDeleteMessage(data);
        if (!payload) {
          socket.emit("error", { message: "Invalid delete payload" });
          return;
        }

        await messageService.deleteMessage(payload.messageId, userId);
        io.to(payload.conversationId).emit("message:deleted", {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
        });
      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    socket.on("typing:start", (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !conversationId) return;
      socket.to(conversationId).emit("user:typing", {
        conversationId,
        userId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", (conversationId: unknown) => {
      if (typeof conversationId !== "string" || !conversationId) return;
      socket.to(conversationId).emit("user:typing", {
        conversationId,
        userId,
        isTyping: false,
      });
    });

    socket.on("message:read", (data: unknown) => {
      const payload = parseReadReceipt(data);
      if (!payload) return;

      socket.to(payload.conversationId).emit("user:read-receipt", {
        conversationId: payload.conversationId,
        userId,
        messageIds: payload.messageIds,
        readAt: new Date(),
      });
    });

    socket.on("message:react", async (data: unknown) => {
      try {
        const payload = parseReaction(data);
        if (!payload) {
          socket.emit("error", { message: "Invalid reaction payload" });
          return;
        }

        const reaction = await messageService.reactToMessage(
          payload.messageId,
          userId,
          payload.emoji,
        );

        io.to(payload.conversationId).emit("message:reaction", {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          userId,
          emoji: payload.emoji,
          removed: reaction.removed,
        });
      } catch (error) {
        console.error("Error reacting to message:", error);
        socket.emit("error", { message: "Failed to react to message" });
      }
    });

    socket.on("user:online", async () => {
      try {
        await userService.updateUserStatus(userId, "online");
        io.emit("user:status", { userId, status: "online" });
      } catch (error) {
        console.error("Error updating user status to online:", error);
      }
    });

    socket.on("call:offer", async (data: unknown) => {
      try {
        const payload = parseCallSignal(data);
        if (!payload?.offer) {
          socket.emit("error", { message: "Invalid call offer" });
          return;
        }

        const caller = await userService.getUserById(userId);
        io.to(payload.to).emit("call:offer", {
          from: userId,
          offer: payload.offer,
          callType: payload.callType,
          conversationId: payload.conversationId,
          user: caller
            ? {
                id: caller.id,
                name: caller.name,
                avatar: caller.avatar,
              }
            : null,
        });
      } catch (error) {
        console.error("Error in call:offer:", error);
        socket.emit("error", { message: "Failed to initiate call" });
      }
    });

    socket.on("call:answer", (data: unknown) => {
      const payload = parseCallSignal(data);
      if (!payload?.answer) {
        socket.emit("error", { message: "Invalid call answer" });
        return;
      }

      io.to(payload.to).emit("call:answer", {
        from: userId,
        answer: payload.answer,
        conversationId: payload.conversationId,
      });
    });

    socket.on("call:ice-candidate", (data: unknown) => {
      const payload = parseCallSignal(data);
      if (!payload?.candidate) return;

      io.to(payload.to).emit("call:ice-candidate", {
        from: userId,
        candidate: payload.candidate,
        conversationId: payload.conversationId,
      });
    });

    socket.on("call:decline", (data: unknown) => {
      const payload = parseCallSignal(data);
      if (!payload) return;

      io.to(payload.to).emit("call:declined", {
        from: userId,
        conversationId: payload.conversationId,
      });
    });

    socket.on("call:end", (data: unknown) => {
      const payload = parseCallSignal(data);
      if (!payload) return;

      io.to(payload.to).emit("call:ended", {
        from: userId,
        conversationId: payload.conversationId,
      });
    });

    socket.on("disconnect", async () => {
      try {
        await userService.updateUserStatus(userId, "offline");
        io.emit("user:status", { userId, status: "offline" });
      } catch (error) {
        console.error("Error updating user status to offline:", error);
      }
    });
  });
}
