import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

let firebaseApp;
let auth;
let db;

try {
  // Check if Firebase credentials are available
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('⚠️  FIREBASE_SERVICE_ACCOUNT environment variable not found. Firebase features will be disabled.');
  } else {
    let serviceAccount;
    try {
      // Try to parse the service account JSON, handling escaped newlines in private key
      const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
      serviceAccount = JSON.parse(
        serviceAccountString.replace(/\\n/g, '\n')
      );
      
      // Validate required fields
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Invalid service account JSON: missing required fields');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError.message);
      throw new Error('Invalid service account JSON format');
    }

    // Initialize Firebase with the service account
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    auth = admin.auth();
    db = admin.firestore();
    console.log('✅ Firebase initialized successfully with service account:', serviceAccount.project_id);
  }
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
    return await auth.createCustomToken(email);
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