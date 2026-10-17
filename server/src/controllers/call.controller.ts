import { Request, Response } from "express";
import { callService } from "../services/call.service";
import { sendResponse } from "../utils/response.util";
import { BadRequestError, AuthorizationError } from "../types/error.types";
import { asyncHandler } from "../middleware/error.middleware";

// Initiate a call
export const initiateCall = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId, receiverId, callType } = req.body;

  if (!conversationId || !receiverId || !callType) {
    throw new BadRequestError(
      "conversationId, receiverId, and callType are required"
    );
  }

  if (!["AUDIO", "VIDEO"].includes(callType)) {
    throw new BadRequestError("callType must be AUDIO or VIDEO");
  }

  const call = await callService.initiateCall(
    conversationId,
    userId,
    receiverId,
    callType
  );

  sendResponse(res, 201, "Call initiated", call);
});

// Update call status
export const updateCallStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { callId, status } = req.body;

  if (!callId || !status) {
    throw new BadRequestError("callId and status are required");
  }

  const validStatuses = [
    "INITIATING",
    "RINGING",
    "ACTIVE",
    "ENDED",
    "DECLINED",
    "MISSED",
    "CANCELED",
  ];
  if (!validStatuses.includes(status)) {
    throw new BadRequestError(
      `status must be one of: ${validStatuses.join(", ")}`
    );
  }

  const call = await callService.updateCallStatus(callId, status);

  sendResponse(res, 200, "Call status updated", call);
});

// End a call
export const endCall = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { callId } = req.body;

  if (!callId) {
    throw new BadRequestError("callId is required");
  }

  const call = await callService.endCall(callId);

  sendResponse(res, 200, "Call ended", call);
});

// Decline a call
export const declineCall = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { callId } = req.body;

  if (!callId) {
    throw new BadRequestError("callId is required");
  }

  const call = await callService.declineCall(callId);

  sendResponse(res, 200, "Call declined", call);
});

// Get active call for a conversation
export const getActiveCall = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId } = req.params;

  if (!conversationId) {
    throw new BadRequestError("conversationId is required");
  }

  const call = await callService.getActiveCall(conversationId);

  if (!call) {
    sendResponse(res, 200, "No active call", null);
    return;
  }

  sendResponse(res, 200, "Active call retrieved", call);
});

// Get call history
export const getCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { conversationId } = req.params;
  const limit = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * limit;

  if (!conversationId) {
    throw new BadRequestError("conversationId is required");
  }

  const calls = await callService.getCallHistory(
    conversationId,
    userId,
    limit,
    skip
  );

  sendResponse(res, 200, "Call history retrieved", calls);
});

// Miss a call
export const missCall = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthorizationError("Unauthorized");
  }

  const { callId } = req.body;

  if (!callId) {
    throw new BadRequestError("callId is required");
  }

  const call = await callService.missCall(callId);

  sendResponse(res, 200, "Call marked as missed", call);
});
