import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateCode, saveCode, verifyCode } from './otpStore.js';
import { sendOTP } from './mailer.js';
import { createCustomToken, isFirebaseAvailable } from './firebaseAdmin.js';
import { auth } from './firebaseAdmin.js';

dotenv.config();

const app = express();

// Update CORS configuration
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// --- Check Email Existence --------------------------------------------------
app.post('/api/check-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email-required' });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid-email-format' });
  }

  if (!isFirebaseAvailable()) {
    return res.status(500).json({ error: 'firebase-not-available' });
  }

  try {
    const user = await auth.getUserByEmail(email);
    console.log('📧 Email exists:', email, 'UID:', user.uid);
    
    // Check if user has password provider
    const hasPasswordProvider = user.providerData.some(
      provider => provider.providerId === 'password'
    );

    return res.status(200).json({ 
      exists: true, 
      uid: user.uid,
      hasPasswordProvider,
      emailVerified: user.emailVerified
    });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('📧 Email available:', email);
      return res.status(200).json({ exists: false });
    }
    console.error('[check-email] Error:', error);
    return res.status(500).json({ error: 'check-failed' });
  }
});

// --- Send OTP ----------------------------------------------------
app.post('/api/send-otp', async (req, res) => {
  const { email, isSignup } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid-email-format' });
    }

    // If this is a signup attempt, check if email exists
    if (isSignup) {
      try {
        const user = await auth.getUserByEmail(email);
        console.log('📧 Email already registered:', email);
        return res.status(400).json({ 
          error: 'email-exists',
          message: 'This email is already registered. Please sign in instead.',
          hasPasswordProvider: user.providerData.some(
            provider => provider.providerId === 'password'
          )
        });
      } catch (error) {
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
        // User doesn't exist, continue with OTP
      }
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('SMTP credentials not configured');
      return res.status(500).json({ error: 'smtp-not-configured' });
    }

    const code = generateCode();
    await saveCode(email, code);
    await sendOTP(email, code);
    console.log(`📨  OTP sent to ${email}`);
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
  const { email, code, password } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'email & code required' });

  try {
    // 1. Verify OTP
    const match = await verifyCode(email, code);
    if (!match) return res.status(401).json({ error: 'invalid-or-expired' });

    // 2. Check Firebase availability
    if (!isFirebaseAvailable()) {
      return res.status(500).json({ error: 'firebase-not-configured' });
    }

    // 3. Create/get user and generate custom token
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log('👤 Found existing Firebase user:', user.uid);

      // Check if user has password provider
      const hasPasswordProvider = user.providerData.some(
        provider => provider.providerId === 'password'
      );

      if (!hasPasswordProvider && password) {
        // User exists but doesn't have password provider
        return res.status(400).json({
          error: 'password-provider-missing',
          message: 'This account was created without a password. Please use /api/recreate-user to set up password authentication.',
          uid: user.uid
        });
      }

      // If user has password provider and new password provided, update it
      if (hasPasswordProvider && password) {
        try {
          await auth.updateUser(user.uid, { password });
          console.log('🔑 Updated password for existing user:', user.uid);
        } catch (updateError) {
          console.error('Failed to update password:', updateError);
          // Continue anyway since user exists
        }
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // For new users, password is required
        if (!password) {
          return res.status(400).json({ 
            error: 'password-required',
            message: 'Password is required for new user signup'
          });
        }

        // Create new user with password
        user = await auth.createUser({
          email,
          password, // Required for new users
          emailVerified: true
        });
        console.log('👤 Created new Firebase user with password:', user.uid);
      } else {
        throw error;
      }
    }

    // 4. Generate custom token
    const customToken = await auth.createCustomToken(user.uid);
    console.log('🔑 Generated custom token for user:', user.uid);
    
    return res.json({ 
      verified: true, 
      customToken,
      isNewUser: !user.metadata.lastSignInTime,
      hasPasswordProvider: user.providerData.some(
        provider => provider.providerId === 'password'
      )
    });
  } catch (error) {
    console.error('Verify OTP failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json({ error: 'verification-failed' });
  }
});

// --- Recreate User with Password --------------------------------------------------
app.post('/api/recreate-user', async (req, res) => {
  const { email, password, uid } = req.body;
  if (!email || !password || !uid) {
    return res.status(400).json({ 
      error: 'missing-fields',
      message: 'email, password, and uid are required'
    });
  }

  if (!isFirebaseAvailable()) {
    return res.status(500).json({ error: 'firebase-not-available' });
  }

  try {
    // 1. Verify the user exists and get their data
    const existingUser = await auth.getUser(uid);
    if (existingUser.email !== email) {
      return res.status(400).json({ 
        error: 'email-mismatch',
        message: 'Provided email does not match the user account'
      });
    }

    // 2. Check if user already has password provider
    const hasPasswordProvider = existingUser.providerData.some(
      provider => provider.providerId === 'password'
    );
    if (hasPasswordProvider) {
      return res.status(400).json({
        error: 'password-provider-exists',
        message: 'User already has password authentication'
      });
    }

    // 3. Delete the existing user
    await auth.deleteUser(uid);
    console.log('🗑️ Deleted existing user:', uid);

    // 4. Create new user with password
    const newUser = await auth.createUser({
      email,
      password,
      emailVerified: true
    });
    console.log('👤 Created new user with password:', newUser.uid);

    // 5. Generate custom token for the new user
    const customToken = await auth.createCustomToken(newUser.uid);
    console.log('🔑 Generated custom token for new user:', newUser.uid);

    return res.json({
      success: true,
      message: 'User recreated with password authentication',
      uid: newUser.uid,
      customToken
    });
  } catch (error) {
    console.error('Recreate user failed:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'user-not-found' });
    }
    return res.status(500).json({ 
      error: 'recreation-failed',
      message: error.message
    });
  }
});

// --- Update User Password --------------------------------------------------
app.post('/api/update-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email & password required' });
  }

  if (!isFirebaseAvailable()) {
    return res.status(500).json({ error: 'firebase-not-available' });
  }

  try {
    // Get user by email
    const user = await auth.getUserByEmail(email);
    
    // Update user with new password
    await auth.updateUser(user.uid, { password });
    console.log('🔑 Updated password for user:', user.uid);

    return res.json({ 
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password failed:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'user-not-found' });
    }
    return res.status(500).json({ error: 'update-failed' });
  }
});

// --- Sign In With Email and Password ----------------------------------------
app.post('/api/sign-in', async (req, res) => {
  console.log('[SignIn] Request received:', {
    body: req.body,
    headers: req.headers,
    origin: req.headers.origin
  });

  const { email, password } = req.body;
  if (!email || !password) {
    console.log('[SignIn] Missing credentials:', { email: !!email, password: !!password });
    return res.status(400).json({ error: 'email & password required' });
  }

  if (!isFirebaseAvailable()) {
    console.log('[SignIn] Firebase not available');
    return res.status(500).json({ error: 'firebase-not-available' });
  }

  try {
    // 1. Verify credentials using Firebase Auth REST API
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) {
      console.log('[SignIn] Firebase API key missing');
      return res.status(500).json({ error: 'missing-firebase-api-key' });
    }

    console.log('[SignIn] Attempting Firebase authentication');
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      }
    );

    const data = await response.json();
    console.log('[SignIn] Firebase auth response:', {
      status: response.status,
      ok: response.ok,
      hasError: !!data.error,
      errorMessage: data.error?.message
    });

    if (!response.ok) {
      return res.status(401).json({ error: data.error?.message || 'invalid-credentials' });
    }

    // 2. Create a custom token using Admin SDK
    console.log('[SignIn] Creating custom token for user:', data.localId);
    const customToken = await auth.createCustomToken(data.localId);

    // 3. Return the custom token
    console.log('[SignIn] Login successful for user:', data.localId);
    return res.json({
      token: customToken,
      uid: data.localId
    });
  } catch (error) {
    console.error('[SignIn] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'login-failed', 
      details: error.message 
    });
  }
});

// --- Delete User from Firebase Auth ------------------------------------------
app.post('/api/delete-user', async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'uid-required' });
  }

  try {
    await auth.deleteUser(uid);
    console.log('🗑️ Firebase Auth user deleted:', uid);
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting user from Firebase Auth:', error);
    return res.status(500).json({ error: 'delete-failed', details: error.message });
  }
});

// ---------------------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀  OTP server listening on :${PORT}`);
  console.log('Environment:', {
    nodeEnv: process.env.NODE_ENV,
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    firebaseConfigured: isFirebaseAvailable(),
    redisConfigured: !!process.env.REDIS_URL,
    firebaseApiKeyConfigured: !!process.env.FIREBASE_API_KEY
  });
}); 