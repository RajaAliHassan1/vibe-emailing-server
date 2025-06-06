# Vibe Email Server

A Node.js server for handling email verification and Firebase authentication.

## Features

- Email verification using OTP
- Firebase Authentication integration
- SMTP email sending
- Redis caching (optional)

## Prerequisites

- Node.js (v14 or higher)
- Firebase project with Admin SDK
- SMTP server (e.g., Gmail)
- Redis (optional)

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd VibeEmailingServer
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase and SMTP credentials
   - For Firebase, you'll need:
     - Firebase service account JSON
     - Firebase Web API Key
   - For SMTP, you'll need:
     - SMTP host and port
     - SMTP user and password (app password for Gmail)

4. Start the server:
```bash
npm start
```

## Environment Variables

- `SMTP_HOST`: SMTP server host (e.g., smtp.gmail.com)
- `SMTP_PORT`: SMTP server port (e.g., 465)
- `SMTP_USER`: SMTP username/email
- `SMTP_PASS`: SMTP password/app password
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON
- `FIREBASE_API_KEY`: Firebase Web API Key
- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment (development/production)
- `REDIS_URL`: Redis connection URL (optional)
- `OTP_TTL`: OTP expiration time in seconds (default: 600)

## API Endpoints

- `POST /api/check-email`: Check if email exists
- `POST /api/send-otp`: Send OTP to email
- `POST /api/verify-otp`: Verify OTP and create/update user
- `POST /api/recreate-user`: Recreate user with password
- `POST /api/update-password`: Update user password
- `POST /api/sign-in`: Sign in with email/password
- `POST /api/delete-user`: Delete user from Firebase

## Security Notes

- Never commit `.env` file or Firebase service account JSON
- Use environment variables for sensitive data
- Keep your Firebase API keys secure
- Use app passwords for Gmail SMTP

## License

MIT 