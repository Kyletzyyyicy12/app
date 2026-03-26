const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081', 'exp://localhost:8081'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many email requests from this IP, please try again later.'
});

// Gmail transporter configuration
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kyse.quimada.swu@phinmaed.com',
    pass: 'eevdmjhynotvjryz'
  }
});

// In-memory storage for verification codes (in production, use a database)
const verificationCodes = new Map();
const resetCodes = new Map();

// Helper functions
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(email);
    }
  }
  for (const [email, data] of resetCodes.entries()) {
    if (data.expiresAt < now) {
      resetCodes.delete(email);
    }
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CobyPicks Email Server'
  });
});

// Send signup verification email
app.post('/api/auth/send-signup-verification', emailLimiter, async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, firstName, lastName'
      });
    }

    cleanupExpiredCodes();

    const code = generateVerificationCode();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    verificationCodes.set(email.toLowerCase(), {
      code,
      expiresAt,
      attempts: 0
    });

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
    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });

  } catch (error) {
    console.error('Error sending signup verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification email'
    });
  }
});

// Verify signup code
app.post('/api/auth/verify-signup-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, code'
      });
    }

    const normalizedEmail = email.toLowerCase();
    const storedData = verificationCodes.get(normalizedEmail);

    if (!storedData) {
      return res.status(404).json({
        success: false,
        error: 'No verification code found for this email'
      });
    }

    if (storedData.expiresAt < Date.now()) {
      verificationCodes.delete(normalizedEmail);
      return res.status(410).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    if (storedData.attempts >= 5) {
      verificationCodes.delete(normalizedEmail);
      return res.status(429).json({
        success: false,
        error: 'Too many verification attempts'
      });
    }

    storedData.attempts++;

    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    verificationCodes.delete(normalizedEmail);

    console.log(`Signup verification successful for ${email}`);
    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Error verifying signup code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code'
    });
  }
});

// Send password reset verification email
app.post('/api/auth/send-password-reset', emailLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    cleanupExpiredCodes();

    const code = generateVerificationCode();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes

    resetCodes.set(email.toLowerCase(), {
      code,
      expiresAt,
      attempts: 0
    });

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
    res.json({
      success: true,
      message: 'Password reset code sent successfully'
    });

  } catch (error) {
    console.error('Error sending password reset verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send password reset email'
    });
  }
});

// Verify password reset code
app.post('/api/auth/verify-password-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, code'
      });
    }

    const normalizedEmail = email.toLowerCase();
    const storedData = resetCodes.get(normalizedEmail);

    if (!storedData) {
      return res.status(404).json({
        success: false,
        error: 'No reset code found for this email'
      });
    }

    if (storedData.expiresAt < Date.now()) {
      resetCodes.delete(normalizedEmail);
      return res.status(410).json({
        success: false,
        error: 'Reset code has expired'
      });
    }

    if (storedData.attempts >= 5) {
      resetCodes.delete(normalizedEmail);
      return res.status(429).json({
        success: false,
        error: 'Too many reset attempts'
      });
    }

    storedData.attempts++;

    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reset code'
      });
    }

    resetCodes.delete(normalizedEmail);

    console.log(`Password reset verification successful for ${email}`);
    res.json({
      success: true,
      message: 'Reset code verified successfully'
    });

  } catch (error) {
    console.error('Error verifying password reset code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify reset code'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CobyPicks Email Server running on port ${PORT}`);
  console.log(`📧 Gmail: kyse.quimada.swu@phinmaed.com`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

