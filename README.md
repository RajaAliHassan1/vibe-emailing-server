# Vibe OTP Server

A production-ready Node/Express server for handling email OTP (One-Time Password) verification with Firebase integration.

## Features

- 🔐 Secure 6-digit OTP generation
- 📧 Email delivery via SMTP (Gmail)
- 🔄 Redis-backed storage with in-memory fallback
- 🔥 Firebase integration for user verification
- ⚡ Express.js API endpoints
- 🔒 CORS enabled for cross-origin requests

## API Endpoints

### 1. Send OTP
```http
POST /api/send-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### 2. Verify OTP
```http
POST /api/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file with required variables:
   ```env
   # SMTP (Gmail)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-app-password

   # Redis (optional)
   # REDIS_URL=redis://localhost:6379
   OTP_TTL=600

   # Firebase (optional)
   # GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json

   # Server
   PORT=4000
   ```

4. Start the server:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SMTP_HOST` | SMTP server host | Yes |
| `SMTP_PORT` | SMTP server port | Yes |
| `SMTP_USER` | SMTP username (email) | Yes |
| `SMTP_PASS` | SMTP password/app-password | Yes |
| `REDIS_URL` | Redis connection URL | No |
| `OTP_TTL` | OTP expiration time in seconds | No (default: 600) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase service account path | No |
| `PORT` | Server port | No (default: 4000) |

## Development

- Uses ES modules
- Hot reloading with nodemon in development
- Redis for production, in-memory store for development

## Security

- OTPs expire after 10 minutes
- Firebase custom tokens for secure authentication
- Environment variables for sensitive data
- CORS enabled for specific origins

## License

MIT 