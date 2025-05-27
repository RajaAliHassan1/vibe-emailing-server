import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateCode, saveCode, verifyCode } from './otpStore.js';
import { sendOTP } from './mailer.js';
import { auth } from './firebaseAdmin.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Send OTP ----------------------------------------------------
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid-email-format' });
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('SMTP credentials not configured');
      return res.status(500).json({ error: 'smtp-not-configured' });
    }

    const code = generateCode();
    await saveCode(email, code);
    await sendOTP(email, code);
    console.log(`📨  OTP ${code} sent to ${email}`);
    res.json({ ok: true });
  } catch (err) {
    // Log detailed error
    console.error('Email send failed:', {
      error: err.message,
      code: err.code,
      command: err.command,
      stack: err.stack
    });

    // Return specific error based on the type
    if (err.code === 'EAUTH') {
      res.status(500).json({ error: 'smtp-auth-failed' });
    } else if (err.code === 'ESOCKET') {
      res.status(500).json({ error: 'smtp-connection-failed' });
    } else {
      res.status(500).json({ 
        error: 'email-send-failed',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
});

// --- Verify OTP --------------------------------------------------
app.post('/api/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'email & code required' });

  try {
    const match = await verifyCode(email, code);
    if (!match) return res.status(400).json({ error: 'invalid-or-expired' });

    // Create a custom token for the verified email
    const customToken = await auth.createCustomToken(email);
    
    return res.json({ 
      verified: true,
      customToken // Send this token to the client for Firebase sign-in
    });
  } catch (err) {
    console.error('Firebase token creation failed:', {
      error: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ 
      error: 'token-creation-failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ---------------------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀  OTP server listening on :${PORT}`);
  console.log('Environment:', {
    nodeEnv: process.env.NODE_ENV,
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    firebaseConfigured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    redisConfigured: !!process.env.REDIS_URL
  });
}); 