import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config();

// Try to load Firebase credentials from file if not in env
let firebaseCredentials;
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccountPath = join(__dirname, 'vibe-19a6b-firebase-adminsdk-fbsvc-b86f3b04ca.json');
    console.log('Attempting to load Firebase credentials from:', serviceAccountPath);
    const serviceAccountFile = readFileSync(serviceAccountPath, 'utf8');
    firebaseCredentials = JSON.parse(serviceAccountFile);
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(firebaseCredentials);
    console.log('✅ Loaded Firebase credentials from file');
  } else {
    firebaseCredentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Loaded Firebase credentials from environment');
  }
} catch (error) {
  console.error('❌ Failed to load Firebase credentials:', error.message);
}

export { firebaseCredentials }; 