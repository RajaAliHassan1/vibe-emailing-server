import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

let firebaseApp;
let auth;
let db;

try {
  // Try to load service account from local file first
  // const serviceAccountPath = path.resolve('vibe-19a6b-firebase-adminsdk-fbsvc-b86f3b04ca.json');
  const serviceAccountPath = path.resolve('./serviceAccountKey.json');
  let serviceAccount;

  if (fs.existsSync(serviceAccountPath)) {
    console.log('📄 Found local Firebase service account file');
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Fallback to environment variable if file doesn't exist
    console.log('⚠️  Local service account file not found, falling back to environment variable');
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    serviceAccount = JSON.parse(
      serviceAccountString.replace(/\\n/g, '\n')
    );
  } else {
    console.log('⚠️  No Firebase credentials found. Firebase features will be disabled.');
    throw new Error('No Firebase credentials available');
  }

  // Validate required fields
  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Invalid service account JSON: missing required fields');
  }

  // Initialize Firebase with the service account
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  auth = admin.auth();
  db = admin.firestore();
  console.log('✅ Firebase initialized successfully with service account:', serviceAccount.project_id);
} catch (error) {
  console.error('❌ Firebase initialization failed:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  // Don't throw, just disable Firebase features
}

// Export a function to check if Firebase is available
export const isFirebaseAvailable = () => {
  if (!firebaseApp) {
    console.log('Firebase is not available - check if FIREBASE_SERVICE_ACCOUNT is properly configured');
    return false;
  }
  return true;
};

// Export a function to create custom token with fallback
export async function createCustomToken(email) {
  if (!isFirebaseAvailable()) {
    throw new Error('firebase-not-configured');
  }
  try {
    // First try to get existing user
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user if doesn't exist
        user = await auth.createUser({
          email,
          emailVerified: true // Since they verified via OTP
        });
        console.log('👤 Created new Firebase user:', user.uid);
      } else {
        throw error; // Re-throw other errors
      }
    }

    // Create token using the user's UID
    const customToken = await auth.createCustomToken(user.uid);
    console.log('🔑 Generated custom token for user:', user.uid);
    return customToken;
  } catch (error) {
    console.error('Firebase token creation failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw new Error('token-creation-failed');
  }
}

export { auth, db }; 