import { env } from '../../config/env';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  resetUrl: string;
}

// Keep track of the last sent reset email for development/testing inspection
export let lastSentResetEmail: { email: string; token: string; resetUrl: string } | null = null;

export function clearLastSentResetEmail(): void {
  lastSentResetEmail = null;
}

/**
 * Sends a password reset email.
 * Attempts Nodemailer (SMTP or Ethereal test account in dev),
 * with a clean console fallback if Nodemailer is not installed or network is unavailable.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<EmailResult> {
  const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password?token=${token}`;

  lastSentResetEmail = { email, token, resetUrl };

  let nodemailer: any = null;
  try {
    nodemailer = require('nodemailer');
  } catch {
    nodemailer = null;
  }

  if (nodemailer && process.env.NODE_ENV !== 'test') {
    try {
      if (process.env.SMTP_HOST) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM || '"Brightloop" <no-reply@brightloop.com>',
          to: email,
          subject: 'Password Reset Request - Brightloop',
          text: `You requested a password reset. Please click the link below (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
          html: `<p>You requested a password reset.</p><p>Please click the link below (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, please ignore this email.</p>`,
        });

        return { success: true, messageId: info.messageId, resetUrl };
      } else {
        // Dev fallback with Ethereal email
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        const info = await transporter.sendMail({
          from: '"Brightloop" <no-reply@brightloop.com>',
          to: email,
          subject: 'Password Reset Request - Brightloop',
          text: `Reset link: ${resetUrl}`,
          html: `<p>Reset link: <a href="${resetUrl}">${resetUrl}</a></p>`,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`[AUTH] Ethereal email sent. Preview URL: ${previewUrl}`);
        return { success: true, messageId: info.messageId, previewUrl, resetUrl };
      }
    } catch (err) {
      console.warn('[AUTH] Nodemailer delivery failed, using console fallback:', err);
    }
  }

  // Console fallback for local dev/testing
  console.log(`[AUTH] Password reset link for ${email}: ${resetUrl}`);
  return { success: true, resetUrl };
}

