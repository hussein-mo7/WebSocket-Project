import { Request, Response } from "express";
import { messageService } from "../services/message.service";
import {
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  markAsReadSchema,
  reactToMessageSchema,
  removeReactionSchema,
} from "../dto/message.dto";
import { sendResponse } from "../utils/response.util";
import { BadRequestError, AuthorizationError } from "../types/error.types";
import { asyncHandler } from "../middleware/error.middleware";
import cloudinary from "../config/cloudinary.config";

// Send a message
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const payload = sendMessageSchema.parse(req.body);

  const message = await messageService.sendMessage(
    payload.conversationId,
    userId,
    payload.content,
    payload.type,
    payload.mediaUrls
  );

  sendResponse(res, 201, "Message sent", message);
});

// Get messages in a conversation
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId } = req.params;
  const limit = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * limit;

  const messages = await messageService.getMessages(
    conversationId,
    limit,
    skip
  );

  sendResponse(res, 200, "Messages retrieved", messages);
});

// Edit a message
export const editMessage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const payload = editMessageSchema.parse(req.body);

  const message = await messageService.editMessage(
    payload.messageId,
    userId,
    payload.newContent
  );

  sendResponse(res, 200, "Message edited", message);
});

// Delete a message (soft delete)
export const deleteMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const payload = deleteMessageSchema.parse(req.body);

    await messageService.deleteMessage(payload.messageId, userId);

    sendResponse(res, 204, "Message deleted", null);
  }
);

// Mark messages as read
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const payload = markAsReadSchema.parse(req.body);

  await messageService.markMessagesAsRead(payload.conversationId, userId);

  sendResponse(res, 200, "Messages marked as read", null);
});

// Get read receipts for a message
export const getReadReceipts = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const { messageId } = req.params;

    const receipts = await messageService.getMessageReadReceipts(messageId);

    sendResponse(res, 200, "Read receipts retrieved", receipts);
  }
);

// React to a message
export const reactToMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const payload = reactToMessageSchema.parse(req.body);

    const reaction = await messageService.reactToMessage(
      payload.messageId,
      userId,
      payload.emoji
    );

    sendResponse(res, 201, "Reaction added", reaction);
  }
);

// Remove reaction from a message
export const removeReaction = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const payload = removeReactionSchema.parse(req.body);

    await messageService.removeReaction(
      payload.messageId,
      userId,
      payload.emoji
    );

    sendResponse(res, 204, "Reaction removed", null);
  }
);

// Get all reactions for a message
export const getReactions = asyncHandler(
  async (req: Request, res: Response) => {
    const { messageId } = req.params;

    const reactions = await messageService.getMessageReactions(messageId);

    sendResponse(res, 200, "Reactions retrieved", reactions);
  }
);

// Search messages
export const searchMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const { conversationId, q } = req.query;

    if (!q || typeof q !== "string") {
      throw new BadRequestError("Search query required");
    }

    if (!conversationId || typeof conversationId !== "string") {
      throw new BadRequestError("Conversation ID required");
    }

    const messages = await messageService.searchMessages(conversationId, q);

    sendResponse(res, 200, "Messages found", messages);
  }
);

// Upload message media
export const uploadMessageMedia = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  if (!req.file) {
    throw new BadRequestError("No file uploaded");
  }

  const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "messages",
        resource_type: "auto",
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error("Upload failed"));
          return;
        }
        resolve(result);
      },
    );
    stream.end(req.file!.buffer);
  });

  sendResponse(res, 200, "File uploaded", { url: uploaded.secure_url });
});
