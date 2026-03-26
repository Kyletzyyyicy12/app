import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin
admin.initializeApp();

// Configure Gmail transporter
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kyse.quimada.swu@phinmaed.com',
    pass: 'eevdmjhynotvjryz'
  }
});

// In-memory storage for verification codes (in production, use Firestore)
const verificationCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Clean up expired verification codes
 */
function cleanupExpiredCodes(): void {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(email);
    }
  }
}

/**
 * Send signup verification email
 */
export const sendSignupVerification = functions.https.onCall(async (data, context) => {
  try {
    const { email, firstName, lastName } = data;

    if (!email || !firstName || !lastName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Clean up expired codes
    cleanupExpiredCodes();

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Store verification code
    verificationCodes.set(email.toLowerCase(), {
      code,
      expiresAt,
      attempts: 0
    });

    // Send email
    const mailOptions = {
      from: 'CobyPicks Security <noreply@cobypicks.com>',
      to: email,
      subject: 'CobyPicks - Verify Your Email to Complete Registration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to CobyPicks, ${firstName}!</h2>
          <p>Please verify your email address to complete your registration.</p>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #007bff; margin: 0; font-size: 24px;">${code}</h3>
            <p style="margin: 10px 0 0 0; color: #666;">Your verification code</p>
          </div>
          <p><strong>Important:</strong> This code will expire in 10 minutes for security reasons.</p>
          <p>If you didn't request this registration, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated message from CobyPicks. Please do not reply to this email.
          </p>
        </div>
      `
    };

    await gmailTransporter.sendMail(mailOptions);

    console.log(`Verification email sent to ${email}`);
    return { success: true, message: 'Verification code sent successfully' };

  } catch (error) {
    console.error('Error sending signup verification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send verification email');
  }
});

/**
 * Verify signup code
 */
export const verifySignupCode = functions.https.onCall(async (data, context) => {
  try {
    const { email, code } = data;

    if (!email || !code) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const normalizedEmail = email.toLowerCase();
    const storedData = verificationCodes.get(normalizedEmail);

    if (!storedData) {
      throw new functions.https.HttpsError('not-found', 'No verification code found for this email');
    }

    if (storedData.expiresAt < Date.now()) {
      verificationCodes.delete(normalizedEmail);
      throw new functions.https.HttpsError('deadline-exceeded', 'Verification code has expired');
    }

    if (storedData.attempts >= 5) {
      verificationCodes.delete(normalizedEmail);
      throw new functions.https.HttpsError('resource-exhausted', 'Too many verification attempts');
    }

    storedData.attempts++;

    if (storedData.code !== code) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid verification code');
    }

    // Code is valid, remove it from storage
    verificationCodes.delete(normalizedEmail);

    console.log(`Signup verification successful for ${email}`);
    return { success: true, message: 'Email verified successfully' };

  } catch (error) {
    console.error('Error verifying signup code:', error);
    throw error;
  }
});

/**
 * Send password reset verification email
 */
export const sendPasswordResetVerification = functions.https.onCall(async (data, context) => {
  try {
    const { email } = data;

    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }

    // Clean up expired codes
    cleanupExpiredCodes();

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Store verification code
    verificationCodes.set(email.toLowerCase(), {
      code,
      expiresAt,
      attempts: 0
    });

    // Send email
    const mailOptions = {
      from: 'CobyPicks Security <noreply@cobypicks.com>',
      to: email,
      subject: 'CobyPicks - Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Password Reset Request</h2>
          <p>You have requested to reset your password for CobyPicks.</p>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #dc3545; margin: 0; font-size: 24px;">${code}</h3>
            <p style="margin: 10px 0 0 0; color: #666;">Your reset code</p>
          </div>
          <p><strong>Security Notice:</strong></p>
          <ul style="color: #666;">
            <li>This code will expire in 10 minutes</li>
            <li>You can only use this code once</li>
            <li>If you didn't request this reset, please ignore this email</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated message from CobyPicks. Please do not reply to this email.
          </p>
        </div>
      `
    };

    await gmailTransporter.sendMail(mailOptions);

    console.log(`Password reset email sent to ${email}`);
    return { success: true, message: 'Password reset code sent successfully' };

  } catch (error) {
    console.error('Error sending password reset verification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send password reset email');
  }
});

/**
 * Verify password reset code
 */
export const verifyPasswordResetCode = functions.https.onCall(async (data, context) => {
  try {
    const { email, code } = data;

    if (!email || !code) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const normalizedEmail = email.toLowerCase();
    const storedData = verificationCodes.get(normalizedEmail);

    if (!storedData) {
      throw new functions.https.HttpsError('not-found', 'No reset code found for this email');
    }

    if (storedData.expiresAt < Date.now()) {
      verificationCodes.delete(normalizedEmail);
      throw new functions.https.HttpsError('deadline-exceeded', 'Reset code has expired');
    }

    if (storedData.attempts >= 5) {
      verificationCodes.delete(normalizedEmail);
      throw new functions.https.HttpsError('resource-exhausted', 'Too many reset attempts');
    }

    storedData.attempts++;

    if (storedData.code !== code) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid reset code');
    }

    // Code is valid, remove it from storage
    verificationCodes.delete(normalizedEmail);

    console.log(`Password reset verification successful for ${email}`);
    return { success: true, message: 'Reset code verified successfully' };

  } catch (error) {
    console.error('Error verifying password reset code:', error);
    throw error;
  }
});

/**
 * Health check endpoint for testing connectivity
 */
export const healthCheck = functions.https.onCall(async (data, context) => {
  return {
    success: true,
    message: 'Email service is healthy',
    timestamp: new Date().toISOString(),
    service: 'CobyPicks Firebase Email Service'
  };
});