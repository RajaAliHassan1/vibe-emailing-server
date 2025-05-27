import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Validate SMTP configuration
const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required SMTP environment variables:', missingVars);
}

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,                         // 465 → SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Add timeout and other options
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
  debug: process.env.NODE_ENV === 'development', // Enable debug logs in development
});

// Verify SMTP connection on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP connection verification failed:', {
      error: error.message,
      code: error.code,
      command: error.command
    });
  } else {
    console.log('✅ SMTP connection verified');
  }
});

export async function sendOTP(to, code) {
  if (!to || !code) {
    throw new Error('Email and code are required');
  }

  const html = `
    <p>Hello 👋,</p>
    <p>Your Vibe verification code is:</p>
    <h2 style="letter-spacing:3px">${code}</h2>
    <p>This code will expire in 10 minutes.</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Vibe" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Your Vibe verification code',
      html,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Email preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    // Enhance error with more context
    error.message = `Failed to send email to ${to}: ${error.message}`;
    throw error;
  }
} 