import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { config, validateEnv } from "./config/env.config";
import { errorHandler, notFound } from "./middleware/error.middleware";
import authRoutes from "./routes/auth.route";
import googleAuthRoutes from "./routes/google-auth.route";
import userRoutes from "./routes/user.route";
import friendRoutes from "./routes/friend.route";
import conversationRoutes from "./routes/conversation.route";
import messageRoutes from "./routes/message.route";
import callRoutes from "./routes/call.route";
import "./config/google-auth.config"; 

export const app: Express = express();

validateEnv();

// Security Middleware
app.use(helmet());

// CORS Configuration
app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body Parser Middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));
// Cookie parser (for refresh token cookie)
app.use(cookieParser());

/**
 * Session Configuration for OAuth
 * 
 * Express-session stores user session data in memory
 * When user logs in via Google, we store their user ID in the session
 * This persists authentication across page reloads during OAuth flow
 * 
 * For production, replace MemoryStore with a database store (Redis, MongoDB, etc)
 * 
 * Cross-origin note: When frontend and backend are on different domains,
 * sameSite must be "none" with secure: true for cookies to work
 */
const isProduction = config.NODE_ENV === "production";
app.use(
  session({
    secret: config.JWT_SECRET, // Use same secret as JWT for consistency
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until modified
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true, // Prevent client-side JS from accessing session cookie
      sameSite: isProduction ? "none" : "strict", // "none" for cross-origin in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

/**
 * Passport Middleware
 * 
 * These middleware handle:
 * 1. passport.initialize() - Initializes Passport
 * 2. passport.session() - Restores user from session on each request
 */
app.use(passport.initialize());
app.use(passport.session());

/**
 * Health Check Route
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Root Route for Render Health Checks
 */
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "WebSocket Chat API Server",
    version: "1.0.0",
    health: "OK",
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes
 */
// Authentication Routes (traditional email/password)
app.use("/api/v1/auth", authRoutes);

// Google OAuth Routes
app.use("/api/v1/auth", googleAuthRoutes);

// User Routes
app.use("/api/v1/users", userRoutes);

// Friend Routes
app.use("/api/v1/friends", friendRoutes);

// Conversation Routes (Chat)
app.use("/api/v1/conversations", conversationRoutes);

// Message Routes
app.use("/api/v1/messages", messageRoutes);

// Call Routes (Audio/Video calls)
app.use("/api/v1/calls", callRoutes);

/**
 * 404 Handler - Not Found
 */
app.use(notFound);

/**
 * Global Error Handler Middleware
 */
app.use(errorHandler);

export default app;
