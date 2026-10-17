import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config/env.config";
import { emailTemplates } from "./templates/email.templates";

/**
 * Email Transporter Configuration
 */
let transporter: Transporter;

/**
 * Initialize Email Transporter
 */
export const initializeEmailService = (): void => {
  try {
    transporter = nodemailer.createTransport({
      service: config.EMAIL_SERVICE,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASSWORD,
      },
    });

    // email service initialized (log removed)
  } catch (error) {
    console.error("❌ Failed to initialize email service:", error);
    throw new Error("Email service initialization failed");
  }
};

/**
 * Email Options Interface
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send Email
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    const mailOptions = {
      from: config.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || "",
    };

    await transporter.sendMail(mailOptions);
    // email sent (log removed)
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw new Error("Failed to send email");
  }
};

/**
 * Send Verification Email
 */
export const sendVerificationEmail = async (
  email: string,
  _verificationToken: string,
  verificationLink: string,
  name?: string
): Promise<void> => {
  const html = emailTemplates.verificationEmail(
    name || email.split("@")[0],
    verificationLink
  );

  await sendEmail({
    to: email,
    subject: "Verify Your Email Address",
    html,
  });
};

/**
 * Send Password Reset Email
 */
export const sendPasswordResetEmail = async (
  email: string,
  _resetToken: string,
  resetLink: string,
  name?: string
): Promise<void> => {
  const html = emailTemplates.passwordResetEmail(
    name || email.split("@")[0],
    resetLink
  );

  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html,
  });
};

/**
 * Send Welcome Email
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<void> => {
  const html = emailTemplates.welcomeEmail(name);

  await sendEmail({
    to: email,
    subject: "Welcome to our platform",
    html,
  });
};
