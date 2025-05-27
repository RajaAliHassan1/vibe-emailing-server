import Redis from 'ioredis';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ttl = Number(process.env.OTP_TTL ?? 600);

let redis = null;
let redisConnectionAttempted = false;

async function initializeRedis() {
  if (redisConnectionAttempted) return;
  redisConnectionAttempted = true;

  if (!process.env.REDIS_URL) {
    console.log('ℹ️  Redis URL not provided → using in-memory store');
    return;
  }

  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Disable retries
      connectTimeout: 5000, // 5 second timeout
    });

    // Handle connection errors silently
    redis.on('error', () => {
      if (redis) {
        redis.disconnect();
        redis = null;
      }
    });

    await redis.ping();
    console.log('🔌  Connected to Redis');
  } catch (err) {
    console.log('ℹ️  Redis not available → using in-memory store');
    if (redis) {
      redis.disconnect();
      redis = null;
    }
  }
}

// Initialize Redis connection
initializeRedis();

const memory = new Map();

/* ---------- helpers ---------- */

export function generateCode() {
  // cryptographically strong, 6 digits, no leading zero problems
  return crypto.randomInt(100000, 1000000).toString();
}

export async function saveCode(email, code) {
  if (redis) {
    try {
      await redis.setex(`otp:${email}`, ttl, code);
    } catch (err) {
      // Fallback to memory if Redis operation fails
      memory.set(email, { code, expires: Date.now() + ttl * 1000 });
    }
  } else {
    memory.set(email, { code, expires: Date.now() + ttl * 1000 });
  }
}

export async function verifyCode(email, code) {
  let stored;
  if (redis) {
    try {
      stored = await redis.get(`otp:${email}`);
      if (stored) await redis.del(`otp:${email}`);
    } catch (err) {
      // Fallback to memory if Redis operation fails
      const entry = memory.get(email);
      if (entry && entry.expires > Date.now()) {
        stored = entry.code;
        memory.delete(email);
      }
    }
  } else {
    const entry = memory.get(email);
    if (entry && entry.expires > Date.now()) {
      stored = entry.code;
      memory.delete(email);
    }
  }
  return stored === code;
} 