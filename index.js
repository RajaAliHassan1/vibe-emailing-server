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
    const code = generateCode();
    await saveCode(email, code);
    await sendOTP(email, code);
    console.log(`📨  OTP ${code} sent to ${email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'email-send-failed' });
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
    console.error('Firebase token creation failed:', err);
    res.status(500).json({ error: 'token-creation-failed' });
  }
});

// ---------------------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀  OTP server listening on :${PORT}`)); 