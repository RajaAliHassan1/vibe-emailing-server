import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,                         // 465 → SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOTP(to, code) {
  const html = `
    <p>Hello 👋,</p>
    <p>Your Vibe verification code is:</p>
    <h2 style="letter-spacing:3px">${code}</h2>
    <p>This code will expire in 10 minutes.</p>
  `;

  await transporter.sendMail({
    from: `"Vibe" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your Vibe verification code',
    html,
  });
} 