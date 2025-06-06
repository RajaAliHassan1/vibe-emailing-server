import admin from 'firebase-admin';
import { firebaseCredentials } from './config.js';

let firebaseApp;
let auth;
let db;

try {
  if (!firebaseCredentials) {
    throw new Error('No Firebase credentials available');
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(firebaseCredentials)
  });

  auth = admin.auth();
  db = admin.firestore();
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  firebaseApp = null;
}

export const isFirebaseAvailable = () => {
  if (!firebaseApp) {
    console.log('Firebase is not available - check if Firebase credentials are properly configured');
    return false;
  }
  return true;
};

export async function createCustomToken(uid) {
  if (!auth) {
    throw new Error('Firebase is not available - check if Firebase credentials are properly configured');
  }
  return auth.createCustomToken(uid);
}

export { auth, db }; 