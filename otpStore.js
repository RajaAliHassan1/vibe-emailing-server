import Redis from 'ioredis';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ttl = Number(process.env.OTP_TTL ?? 600);

let redis;
try {
  redis = new Redis(process.env.REDIS_URL);
  await redis.ping();                         // throws if Redis is down
  console.log('🔌  Connected to Redis');
} catch {
  console.warn('⚠️  Redis not reachable → using in-memory store');
  redis = null;
}

const memory = new Map();

/* ---------- helpers ---------- */

export function generateCode() {
  // cryptographically strong, 6 digits, no leading zero problems
  return crypto.randomInt(100000, 1000000).toString();
}

export async function saveCode(email, code) {
  if (redis) {
    await redis.setex(`otp:${email}`, ttl, code);
  } else {
    memory.set(email, { code, expires: Date.now() + ttl * 1000 });
  }
}

export async function verifyCode(email, code) {
  let stored;
  if (redis) {
    stored = await redis.get(`otp:${email}`);
    if (stored) await redis.del(`otp:${email}`);
  } else {
    const entry = memory.get(email);
    if (entry && entry.expires > Date.now()) {
      stored = entry.code;
      memory.delete(email);
    }
  }
  return stored === code;
} 