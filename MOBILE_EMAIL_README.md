# CobyPicks Mobile App Email Service

## 🎯 Overview

Your React Native mobile app now has a complete email service that communicates with the web1 backend to send verification emails using Gmail SMTP.

## 📧 Email Configuration

Your mobile app is configured to use these Gmail credentials:

```bash
EMAIL_USER=kyse.quimada.swu@phinmaed.com
EMAIL_PASSWORD=eevdmjhynotvjryz
EMAIL_FROM="CobyPicks Security <noreply@cobypicks.com>"
```

## 🔧 How It Works

### Architecture
1. **Mobile App** → Calls web1 backend API endpoints
2. **Web1 Backend** → Uses nodemailer with Gmail SMTP
3. **Gmail** → Sends emails to users

### API Endpoints Used
- `POST /api/auth/send-signup-verification` - Send verification email
- `POST /api/auth/verify-signup-code` - Verify signup code
- `POST /api/auth/send-password-reset-verification` - Send password reset email
- `POST /api/auth/verify-password-reset-code` - Verify password reset code

## 🚀 Usage in Your Mobile App

### Import the Email Service
```typescript
import { emailService, emailAPI } from '../services/EmailService';
```

### Send Signup Verification Email
```typescript
const sendVerificationEmail = async (email: string, firstName: string, lastName: string) => {
  try {
    const result = await emailService.sendSignupVerification({
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });

    if (result.success) {
      console.log('✅ Verification email sent successfully');
      // Show success message to user
    } else {
      console.error('❌ Failed to send verification email:', result.error);
      // Show error message to user
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    // Handle unexpected errors
  }
};
```

### Verify Signup Code
```typescript
const verifySignupCode = async (email: string, code: string) => {
  try {
    const result = await emailService.verifySignupCode({
      email: email.trim().toLowerCase(),
      code: code.trim(),
    });

    if (result.success) {
      console.log('✅ Code verified successfully');
      // Proceed with user registration
    } else {
      console.error('❌ Invalid verification code:', result.error);
      // Show error message to user
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    // Handle unexpected errors
  }
};
```

### Using Convenience API Functions
```typescript
import { emailAPI } from '../services/EmailService';

// Send signup verification
const result1 = await emailAPI.sendSignupVerification({
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe'
});

// Verify signup code
const result2 = await emailAPI.verifySignupCode({
  email: 'user@example.com',
  code: '123456'
});

// Test connectivity
const healthCheck = await emailAPI.testConnection();
if (healthCheck.success) {
  console.log('✅ Email service is available');
}
```

## 🧪 Testing the Email Service

### Test from Command Line
```bash
cd app
npm run test:email
```

Expected output:
```
🔧 Testing CobyPicks Mobile App Email Service
=====================================

📧 API Base URL: http://localhost:3000
📧 Test Email: test@example.com

🧪 Testing Health Check...
✅ Health Check: SUCCESS
   Status: 200
   Response: {"status":"healthy",...}

🧪 Testing Send Signup Verification...
✅ Send Signup Verification: SUCCESS
   Status: 200
   Response: {"success":true,"message":"Verification code sent"}

🧪 Testing Verify Signup Code...
✅ Verify Signup Code: SUCCESS
   Status: 200

📋 Test Results Summary:
========================
✅ Health Check: PASS
✅ Send Verification: PASS
✅ Verify Code: PASS

📊 Overall: 3/3 tests passed
🎉 SUCCESS: Mobile app email service is working perfectly!
```

## ⚙️ Configuration Options

### Environment Variables
```bash
# API Base URL (defaults to localhost:3000)
EXPO_PUBLIC_API_URL=http://your-server.com
EXPO_PUBLIC_WEB1_API_URL=http://your-web1-server.com

# Retry and timeout settings
EXPO_PUBLIC_EMAIL_MAX_RETRIES=5
EXPO_PUBLIC_EMAIL_RETRY_DELAY=30000
```

### Update API URL at Runtime
```typescript
// Change the API endpoint if needed
emailService.updateBaseUrl('https://your-production-server.com');
```

## 🔍 Error Handling

### Common Error Scenarios

#### Network Connection Error
```typescript
try {
  const result = await emailService.sendSignupVerification(data);
} catch (error) {
  if (error.message.includes('Network request failed')) {
    // Show user-friendly message
    alert('Please check your internet connection and try again.');
  }
}
```

#### Server Unavailable
```typescript
const result = await emailService.testConnectivity();
if (!result.success) {
  alert('Email service is temporarily unavailable. Please try again later.');
}
```

#### Invalid Email Format
```typescript
// The service automatically validates email format
// and returns appropriate error messages
```

## 📧 Email Templates

The following email templates are available:

### ✅ Signup Verification Email
- **Subject**: "CobyPicks - Verify Your Email to Complete Registration"
- **Content**: 6-digit verification code, welcome message, security info
- **Expires**: 10 minutes

### ✅ Password Reset Email
- **Subject**: "CobyPicks - Password Reset Verification Code"
- **Content**: 6-digit reset code, security warnings
- **Expires**: 10 minutes

### ✅ Welcome Email
- **Subject**: "Welcome to CobyPicks - Your Account Details"
- **Content**: Login credentials, role information, setup instructions

## 🔒 Security Features

- ✅ **App Password Required** - Uses Gmail App Password (not regular password)
- ✅ **Input Validation** - Email format and code validation
- ✅ **Rate Limiting** - Prevents abuse of verification endpoints
- ✅ **Expiration** - Codes expire after 10 minutes
- ✅ **Single Use** - Codes can only be used once
- ✅ **Attempt Limits** - Max 5 attempts per code

## 🚨 Troubleshooting

### Issue: "Network request failed"
**Solution**: Make sure the web1 server is running
```bash
cd web1
npm run dev
```

### Issue: "ECONNREFUSED"
**Solution**: Check if web1 server is running on port 3000
```bash
curl http://localhost:3000/api/health
```

### Issue: Gmail authentication failed
**Solution**: Verify Gmail App Password
1. Go to Google Account settings
2. Enable 2FA if not enabled
3. Generate new App Password
4. Update `web1/.env.local` with new password

### Issue: Emails not received
**Solutions**:
1. Check spam/junk folder
2. Verify email address is correct
3. Check Gmail sending limits (500/day for free accounts)
4. Wait a few minutes for delivery

## 🎯 Integration Examples

### React Native Component Example
```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { emailService } from '../services/EmailService';

export const SignupScreen = () => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendVerification = async () => {
    if (!email || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const result = await emailService.sendSignupVerification({
        email,
        firstName,
        lastName,
      });

      if (result.success) {
        Alert.alert('Success', 'Verification email sent! Please check your inbox.');
        // Navigate to verification screen
      } else {
        Alert.alert('Error', result.error || 'Failed to send verification email');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="First Name"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        placeholder="Last Name"
        value={lastName}
        onChangeText={setLastName}
      />
      <Button
        title={isLoading ? 'Sending...' : 'Send Verification Email'}
        onPress={handleSendVerification}
        disabled={isLoading}
      />
    </View>
  );
};
```

## ✅ Success Checklist

- [ ] Web1 server is running (`npm run dev` in web1 directory)
- [ ] Gmail credentials are correct in `web1/.env.local`
- [ ] Mobile app can connect to web1 API
- [ ] Test email script passes (`npm run test:email` in app directory)
- [ ] Signup verification emails are received
- [ ] Password reset emails work
- [ ] Welcome emails are sent

## 🎉 You're All Set!

Your mobile app now has a fully functional email service that integrates seamlessly with your web1 backend. Users can receive verification emails, password reset emails, and welcome emails directly from your React Native app!

The email service is production-ready and includes proper error handling, retry logic, and security measures. 🚀