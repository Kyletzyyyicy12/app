# CobyPicks Email Server

A free email server for CobyPicks app using Gmail SMTP. Completely free to deploy and operate.

## 🚀 Quick Deploy

### Option 1: Railway (Recommended - Free Tier)
1. Go to [Railway.app](https://railway.app)
2. Sign up/Login with GitHub
3. Click "New Project" → "Deploy from GitHub"
4. Connect your repository
5. Railway will automatically detect and deploy the server
6. Your server URL will be something like: `https://cobypicks-email-server.onrender.com`

### Option 2: Vercel (Free Tier)
1. Go to [Vercel.com](https://vercel.com)
2. Sign up/Login
3. Import your repository
4. Add environment variable: `NODE_ENV=production`
5. Deploy

### Option 3: Render (Free Tier)
1. Go to [Render.com](https://render.com)
2. Sign up/Login
3. Click "New" → "Web Service"
4. Connect your repository
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Deploy

## 📧 Email Configuration

The server uses Gmail SMTP with these credentials:
- **Email:** kyse.quimada.swu@phinmaed.com
- **Password:** eevdmjhynotvjryz (App Password)

## 🔗 API Endpoints

### Health Check
```
GET /health
```

### Send Signup Verification
```
POST /api/auth/send-signup-verification
Content-Type: application/json

{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Verify Signup Code
```
POST /api/auth/verify-signup-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

### Send Password Reset
```
POST /api/auth/send-password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Verify Password Reset Code
```
POST /api/auth/verify-password-reset-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Development mode with auto-restart
npm run dev
```

Server will run on `http://localhost:3001`

## 📱 Mobile App Integration

In your React Native app, update the `EmailService.ts`:

```typescript
// Replace this line with your deployed server URL
private emailServerUrl = 'https://your-deployed-server.com';
```

## 🛡️ Security Features

- Rate limiting (5 requests per 15 minutes per IP)
- CORS protection
- Input validation
- Code expiration (10 minutes)
- Attempt limits (5 attempts max)

## 📧 Email Templates

The server sends professional HTML emails with:
- CobyPicks branding
- Responsive design
- Clear instructions
- Security notices

## 🚀 Production Ready

This server is production-ready and includes:
- ✅ Error handling
- ✅ Logging
- ✅ Environment variables support
- ✅ HTTPS support
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Input validation

## 💰 Cost

**Completely FREE** to deploy and operate:
- Railway: 512MB RAM, 1GB storage free
- Vercel: 100GB bandwidth free
- Render: 750 hours free per month

## 🐛 Troubleshooting

1. **Emails not sending?**
   - Check Gmail credentials
   - Verify app password is correct
   - Check server logs

2. **CORS errors?**
   - Update CORS origins in server.js
   - Add your app's URL to allowed origins

3. **Rate limiting?**
   - Wait 15 minutes or adjust rate limits

## 📞 Support

For issues, check the server logs or create an issue in the repository.