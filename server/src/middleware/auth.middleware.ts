import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.util";
import { AuthenticationError } from "../types/error.types";

/**
 * Extend Express User type to include custom fields
 */
declare global {
  namespace Express {
    interface User {
      userId?: string;
      email?: string;
      role?: string;
    }
  }
}

/**
 * Authenticate Access Token Middleware (Header-based)
 * Reads accessToken from Authorization header
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("No access token provided");
    }

    const accessToken = authHeader.substring(7);

    // Verify token
    const decoded = verifyAccessToken(accessToken);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || "USER",
    };

    next();
  } catch (error: unknown) {
    // Handle specific JWT errors
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        res.status(401).json({
          success: false,
          message: "Access token has expired",
          code: "TOKEN_EXPIRED",
        });
        return;
      }

      if (error.message.includes("invalid")) {
        res.status(401).json({
          success: false,
          message: "Invalid access token",
          code: "TOKEN_INVALID",
        });
        return;
      }
    }

    // Generic unauthorized response
    res.status(401).json({
      success: false,
      message: "Unauthorized",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Optional Authenticate - Doesn't throw error if token missing
 * Useful for routes that work for both authenticated and unauthenticated users
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const accessToken = authHeader.substring(7);
      const decoded = verifyAccessToken(accessToken);

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || "USER",
      };
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    // This is intentional for optional auth
    next();
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (req: Request): boolean => {
  return !!(req.user && req.user.userId);
};

/**
 * Authorize by role
 * Use after authenticate middleware
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
      return;
    }

    const userRole = req.user.role || "USER";

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        required: allowedRoles,
        current: userRole,
      });
      return;
    }

    next();
  };
};
