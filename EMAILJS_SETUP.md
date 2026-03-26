# 🚀 EmailJS Setup Guide - 5 Minute Installation

Complete EmailJS setup for your CobyPicks app. **No server required!**

## 📋 Prerequisites

- Gmail account with App Password
- EmailJS account (free)

## ⚡ Step 1: Sign Up for EmailJS (30 seconds)

1. Go to [emailjs.com](https://www.emailjs.com/)
2. Click "Sign Up" (top right)
3. Choose "Continue with Google" (easiest) OR email signup
4. Verify your email

## 🔧 Step 2: Connect Your Gmail (2 minutes)

### Add Email Service:
1. In EmailJS dashboard, go to **"Email Services"**
2. Click **"Add New Service"**
3. Choose **"Gmail"**
4. Name it: `cobypicks-gmail`
5. Connect your Gmail:
   - **Email**: `kyse.quimada.swu@phinmaed.com`
   - **App Password**: `eevdmjhynotvjryz`
6. Click **"Create Service"**

### 📝 Note: Gmail App Password
If you don't have an App Password:
1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Sign in to your Gmail
3. Generate App Password for "EmailJS"
4. Use that password (not your regular Gmail password)

## 📧 Step 3: Create Email Templates (2 minutes)

### Signup Verification Template:
1. Go to **"Email Templates"**
2. Click **"Create New Template"**
3. Name: `cobypicks-signup-verification`
4. Template Content:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verify Your CobyPicks Account</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333;">Welcome to CobyPicks, {{to_name}}!</h2>

    <p>Please verify your email address to complete your registration.</p>

    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #007bff; margin: 0; font-size: 24px;">{{verification_code}}</h3>
        <p style="margin: 10px 0 0 0; color: #666;">Your verification code</p>
    </div>

    <p><strong>Important:</strong> This code will expire in 10 minutes for security reasons.</p>
    <p>If you didn't request this registration, please ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
        This is an automated message from CobyPicks. Please do not reply to this email.
    </p>
</body>
</html>
```

5. Click **"Save"**

### Password Reset Template:
1. Click **"Create New Template"** again
2. Name: `cobypicks-password-reset`
3. Template Content:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>CobyPicks Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #dc3545;">Password Reset Request</h2>

    <p>You have requested to reset your password for CobyPicks.</p>

    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #dc3545; margin: 0; font-size: 24px;">{{reset_code}}</h3>
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
</body>
</html>
```

4. Click **"Save"**

## 🔑 Step 4: Get Your Configuration Keys (30 seconds)

### Get Service ID:
1. Go to **"Email Services"**
2. Click on your Gmail service
3. Copy the **"Service ID"** (something like `service_abc123def`)

### Get Template IDs:
1. Go to **"Email Templates"**
2. Open each template
3. Copy the **Template ID** from the URL or settings

### Get Public Key:
1. Go to **"Account"** (top right)
2. Copy your **"Public Key"** (something like `abcdefghijk`)

## ⚙️ Step 5: Configure Your App (1 minute)

### Update EmailService.ts:

```typescript
class EmailService {
  // Replace these with your actual EmailJS values
  private serviceId = 'service_abc123def'; // Replace with your EmailJS service ID
  private templateIds = {
    signupVerification: 'template_signup_123', // Replace with your template ID
    passwordReset: 'template_reset_456' // Replace with your template ID
  };
  private publicKey = 'your_public_key_here'; // Replace with your EmailJS public key
  // ... rest of the code stays the same
}
```

## 🧪 Step 6: Test Your Setup (30 seconds)

### Test Email Sending:
```javascript
// In your React Native app, test the email service:
import { emailService } from '../services/EmailService';

// Test signup verification
const result = await emailService.sendSignupVerification({
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User'
});

console.log(result); // Should show success: true
```

### Check EmailJS Dashboard:
1. Go to **"Email"** tab in EmailJS
2. You should see your test emails
3. Check for any delivery errors

## 🎯 Your EmailJS Configuration Should Look Like:

```typescript
// src/services/EmailService.ts
class EmailService {
  private serviceId = 'service_your_actual_service_id';
  private templateIds = {
    signupVerification: 'template_your_signup_template_id',
    passwordReset: 'template_your_reset_template_id'
  };
  private publicKey = 'your_actual_public_key';
  // ...
}
```

## 🚨 Common Issues & Solutions

### 1. "Service ID not found"
- Check that your Service ID is correct
- Make sure the service is connected to Gmail

### 2. "Template not found"
- Verify your Template IDs are correct
- Make sure templates are saved and published

### 3. "Invalid public key"
- Copy the Public Key from EmailJS Account settings
- Make sure it matches exactly

### 4. Emails not being sent
- Check Gmail App Password is correct
- Verify 2FA is enabled on Gmail account
- Check EmailJS dashboard for error messages

### 5. Emails going to spam
- This is normal for testing
- Production emails should go to inbox

## 📊 EmailJS Limits (Free Tier)

- **200 emails/month** FREE
- **No credit card required**
- **Gmail integration**
- **Custom templates**
- **Delivery tracking**

## 🎉 You're Done!

Your CobyPicks app now has:
- ✅ **Free email sending** via Gmail
- ✅ **No server required**
- ✅ **200 emails/month** free
- ✅ **Professional templates**
- ✅ **Easy setup and maintenance**

**Your email system is now ready!** 🚀

---

## 📞 Need Help?

If you run into issues:
1. Check the EmailJS dashboard for error messages
2. Verify all IDs and keys are correct
3. Test with the diagnostic code above
4. Check this guide for your specific error

**Happy coding!** 🎊