import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

export const db = admin.firestore();
export const auth = admin.auth(); 