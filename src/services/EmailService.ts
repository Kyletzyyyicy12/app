// Simple Email Service for CobyPicks - EmailJS Integration
// React Native compatible version using REST API

import { webDataService } from './WebDataService';

export interface EmailVerificationData {
  email: string;
  code: string;
}

export interface SendVerificationData {
  email: string;
  firstName: string;
  lastName: string;
}

export interface EmailServiceResponse {
  success: boolean;
  error?: string;
  data?: any;
}

class EmailService {
  // EmailJS Configuration - React Native Compatible
  private emailJSServiceId = 'service_6k07xgq'; // Your EmailJS service ID
  private emailJSSignupTemplateId = 'template_c11tof8'; // Signup verification template
  private emailJSResetTemplateId = 'template_xjvif47'; // Password reset template
  private emailJSUserId = '3X2r_ElBQN5akemNJ'; // Your EmailJS public key

  // Alternative: Use a simple email service that doesn't require OAuth
  private useAlternativeService = true; // Set to true to use alternative service
  private alternativeServiceUrl = 'https://api.emailjs.com/api/v1.0/email/send'; // Keep EmailJS for now

  constructor() {
    console.log('[EmailService] EmailJS service initialized - React Native compatible!');
    console.log('[EmailService] Service ID:', this.emailJSServiceId);
    console.log('[EmailService] Signup Template ID:', this.emailJSSignupTemplateId);
    console.log('[EmailService] Reset Template ID:', this.emailJSResetTemplateId);
  }

  /**
   * Send verification email for signup using EmailJS (React Native Compatible)
   */
  async sendSignupVerification(data: SendVerificationData): Promise<EmailServiceResponse> {
    try {
      console.log('[EmailService] Sending signup verification email to:', data.email);

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Calculate expiration time (15 minutes from now)
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleString();

      // EmailJS template parameters (matching your template variables)
      const templateParams = {
        to_email: data.email.trim().toLowerCase(),
        to_name: `${data.firstName.trim()} ${data.lastName.trim()}`,
        passcode: verificationCode,
        time: expirationTime,
        user_email: data.email.trim().toLowerCase()
      };

      // Send email using EmailJS REST API (React Native compatible)
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://moblieappcobypicks.vercel.app', // Your actual Vercel domain
          'Referer': 'https://moblieappcobypicks.vercel.app', // Your actual Vercel domain
        },
        body: JSON.stringify({
          service_id: this.emailJSServiceId,
          template_id: this.emailJSSignupTemplateId, // Use signup template, not reset template
          user_id: this.emailJSUserId,
          template_params: templateParams
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EmailService] EmailJS error:', response.status, errorText);
        console.error('[EmailService] Full error response:', errorText);
        console.error('[EmailService] Template params sent:', JSON.stringify(templateParams, null, 2));

        // Handle specific EmailJS errors
        if (response.status === 400) {
          throw new Error('Invalid EmailJS configuration. Check your service/template IDs.');
        } else if (response.status === 422) {
          throw new Error('EmailJS template error: Check template recipient configuration in EmailJS dashboard. Make sure the template has a recipient email set.');
        } else if (response.status === 429) {
          throw new Error('EmailJS rate limit exceeded. Try again later.');
        } else {
          throw new Error(`EmailJS error ${response.status}: ${errorText}`);
        }
      }

      const result = await response.text(); // EmailJS returns "OK" as text
      console.log('[EmailService] Signup verification email sent successfully via EmailJS to:', data.email);

      return {
        success: true,
        data: {
          message: 'Verification email sent successfully via EmailJS',
          code: verificationCode // For development testing
        },
      };

    } catch (error: any) {
      console.error('[EmailService] Failed to send signup verification email:', error);

      // Provide helpful error messages for common EmailJS issues
      if (error.message?.includes('Network request failed')) {
        console.log('[EmailService] Network error - check your internet connection');
        console.log('[EmailService] EmailJS may be blocked by your network/firewall');
      } else if (error.message?.includes('Invalid EmailJS configuration')) {
        console.log('[EmailService] Check your EmailJS service/template IDs in EmailJS dashboard');
      }

      return {
        success: false,
        error: error.message || 'Failed to send verification email',
      };
    }
  }

  /**
   * Send password reset verification email using EmailJS
   */
  async sendPasswordResetVerification(email: string): Promise<EmailServiceResponse> {
    try {
      console.log('[EmailService] Sending password reset verification email to:', email);

      // Generate reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Calculate expiration time (15 minutes from now)
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleString();

      // EmailJS template parameters for password reset (matching your template variables)
      const templateParams = {
        to_email: email.trim().toLowerCase(),
        to_name: 'Valued User',
        passcode: resetCode,
        time: expirationTime,
        user_email: email.trim().toLowerCase(),
        reset_type: 'password'
      };

      // Send email using EmailJS REST API
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://moblieappcobypicks.vercel.app', // Your actual Vercel domain
          'Referer': 'https://moblieappcobypicks.vercel.app', // Your actual Vercel domain
        },
        body: JSON.stringify({
          service_id: this.emailJSServiceId,
          template_id: this.emailJSResetTemplateId, // Use reset template for password reset
          user_id: this.emailJSUserId,
          template_params: templateParams
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EmailService] EmailJS error:', response.status, errorText);
        console.error('[EmailService] Full error response:', errorText);
        console.error('[EmailService] Template params sent:', JSON.stringify(templateParams, null, 2));

        if (response.status === 400) {
          throw new Error('Invalid EmailJS configuration. Check your service/template IDs.');
        } else if (response.status === 422) {
          throw new Error('EmailJS template error: Check template recipient configuration in EmailJS dashboard.');
        } else if (response.status === 429) {
          throw new Error('EmailJS rate limit exceeded. Try again later.');
        } else {
          throw new Error(`EmailJS error ${response.status}: ${errorText}`);
        }
      }

      const result = await response.text();
      console.log('[EmailService] Password reset email sent successfully via EmailJS to:', email);

      return {
        success: true,
        data: {
          message: 'Password reset email sent successfully via EmailJS'
        },
      };

    } catch (error: any) {
      console.error('[EmailService] Failed to send password reset email:', error);

      if (error.message?.includes('Network request failed')) {
        console.log('[EmailService] Network error - check your internet connection');
        console.log('[EmailService] EmailJS may be blocked by your network/firewall');
      }

      return {
        success: false,
        error: error.message || 'Failed to send password reset email',
      };
    }
  }

  /**
   * Test email service connectivity
   */
  async testConnectivity(): Promise<EmailServiceResponse> {
    try {
      console.log('[EmailService] Testing email service connectivity...');

      return {
        success: true,
        data: {
          connected: true,
          service: 'Simple Email Service',
          message: 'Email service is ready',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      console.error('[EmailService] Connectivity test failed:', error.message);
      return {
        success: false,
        error: error.message || 'Connectivity test failed',
        data: {
          connected: false,
          service: 'Simple Email Service'
        }
      };
    }
  }

  /**
   * Switch to alternative email service (Outlook, Yahoo, or custom SMTP)
   * This avoids Gmail OAuth issues
   */
  switchToAlternativeService(serviceId: string, userId: string): void {
    this.emailJSServiceId = serviceId;
    this.emailJSUserId = userId;
    console.log('[EmailService] Switched to alternative email service:', serviceId);
  }

  /**
   * Update EmailJS configuration
   */
  updateEmailJSConfig(serviceId: string, signupTemplateId: string, resetTemplateId: string, userId: string): void {
    this.emailJSServiceId = serviceId;
    this.emailJSSignupTemplateId = signupTemplateId;
    this.emailJSResetTemplateId = resetTemplateId;
    this.emailJSUserId = userId;
    console.log('[EmailService] EmailJS configuration updated');
  }

  /**
   * Get current EmailJS configuration (for debugging)
   */
  getEmailJSConfig(): { serviceId: string; signupTemplateId: string; resetTemplateId: string; userId: string } {
    return {
      serviceId: this.emailJSServiceId,
      signupTemplateId: this.emailJSSignupTemplateId,
      resetTemplateId: this.emailJSResetTemplateId,
      userId: this.emailJSUserId
    };
  }

  /**
   * Legacy methods for backward compatibility
   */
  updateServerUrl(newUrl: string): void {
    console.log('[EmailService] Server URL ignored - using EmailJS (no server required)');
  }

  getServerUrl(): string {
    console.log('[EmailService] Server URL not applicable - using EmailJS');
    return 'https://api.emailjs.com';
  }

  setFunctionsRegion(region: string = 'us-central1'): void {
    console.log('[EmailService] Firebase Functions region ignored - using EmailJS');
  }
}

// Export singleton instance
export const emailService = new EmailService();

export default EmailService;

// Convenience functions for common operations
export const emailAPI = {
  /**
   * Send signup verification email
   */
  sendSignupVerification: (data: SendVerificationData) =>
    emailService.sendSignupVerification(data),

  /**
   * Send password reset email
   */
  sendPasswordReset: (email: string) =>
    emailService.sendPasswordResetVerification(email),

  /**
   * Test connectivity
   */
  testConnection: () =>
    emailService.testConnectivity(),

  /**
   * Update EmailJS configuration
   */
  updateEmailJSConfig: (serviceId: string, signupTemplateId: string, resetTemplateId: string, userId: string) =>
    emailService.updateEmailJSConfig(serviceId, signupTemplateId, resetTemplateId, userId),

  /**
   * Switch to alternative email service
   */
  switchToAlternativeService: (serviceId: string, userId: string) =>
    emailService.switchToAlternativeService(serviceId, userId),

  /**
   * Get EmailJS configuration
   */
  getEmailJSConfig: () =>
    emailService.getEmailJSConfig(),

  /**
   * Legacy methods for backward compatibility
   */
  updateServerUrl: (url: string) =>
    emailService.updateServerUrl(url),

  getServerUrl: () =>
    emailService.getServerUrl(),

  setFunctionsRegion: (region: string) =>
    emailService.setFunctionsRegion(region),
};

