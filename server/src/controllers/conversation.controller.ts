import { Request, Response } from "express";
import { conversationService } from "../services/conversation.service";
import { messageService } from "../services/message.service";
import {
  getOrCreateConversationSchema,
  archiveConversationSchema,
  unarchiveConversationSchema,
  deleteConversationSchema,
  getUserConversationsQuerySchema,
  getConversationSchema,
} from "../dto/conversation.dto";
import { sendResponse } from "../utils/response.util";
import { BadRequestError, NotFoundError, AuthorizationError } from "../types/error.types";
import { asyncHandler } from "../middleware/error.middleware";

// Get or create a conversation with a friend
export const getOrCreateConversation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const { friendId } = getOrCreateConversationSchema.parse(req.body);

    if (friendId === userId) {
      throw new BadRequestError("Cannot start conversation with yourself");
    }

    const conversation = await conversationService.getOrCreateConversation(
      userId,
      friendId
    );

    sendResponse(res, 200, "Conversation retrieved or created", conversation);
  }
);

// Get all conversations for the user
export const getUserConversations = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const query = getUserConversationsQuerySchema.parse(req.query || {});
    const limit = query.limit || 20;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
    const search = query.search;

    const conversations = await conversationService.getUserConversations(
      userId,
      limit,
      skip,
      search
    );

    sendResponse(res, 200, "Conversations retrieved", conversations);
  }
);

// Get a single conversation
export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId } = getConversationSchema.parse(req.params);

  const conversation = await conversationService.getConversation(
    conversationId,
    userId
  );

  if (!conversation) {
    throw new NotFoundError("Conversation not found");
  }

  // Auto-mark all messages as read when user opens conversation
  await messageService.markMessagesAsRead(conversationId, userId);

  sendResponse(res, 200, "Conversation retrieved", conversation);
});

// Get the other user in a conversation
export const getOtherUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId } = getConversationSchema.parse(req.params);

  const otherUser = await conversationService.getOtherUser(conversationId, userId);

  if (!otherUser) {
    throw new NotFoundError("User not found in this conversation");
  }

  sendResponse(res, 200, "Other user retrieved", otherUser);
});

// Archive a conversation
export const archiveConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId } = archiveConversationSchema.parse(req.body || {});

  const conversation = await conversationService.archiveConversation(
    conversationId,
    userId
  );

  sendResponse(res, 200, "Conversation archived", conversation);
});

// Unarchive a conversation
export const unarchiveConversation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AuthorizationError("Unauthorized");
    }

    const { conversationId } = unarchiveConversationSchema.parse(req.body || {});

    const conversation = await conversationService.unarchiveConversation(
      conversationId,
      userId
    );

    sendResponse(res, 200, "Conversation unarchived", conversation);
  }
);

// Delete a conversation
export const deleteConversation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId } = deleteConversationSchema.parse(req.body || {});

  await conversationService.deleteConversation(conversationId, userId);

  sendResponse(res, 204, "Conversation deleted", null);
});
