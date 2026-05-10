import escapeHtml from 'escape-html';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    throw new Error('Failed to send email');
  }
};

export const send2FACode = async (to: string, code: string, firstName: string) => {
  const subject = 'Your Verification Code';
  const safeFirstName = escapeHtml(firstName);
  const safeCode = escapeHtml(code);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${safeFirstName},</h2>
      <p>Your verification code is:</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
        ${safeCode}
      </div>
      <p>This code will expire in 5 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    </div>
  `;
  
  await sendEmail(to, subject, html);
};

export const sendStaffInvite = async (to: string, firstName: string, inviteUrl: string) => {
  const subject = 'You\'ve been invited to Be Original';
  const safeFirstName = escapeHtml(firstName);
  const safeUrl = escapeHtml(inviteUrl);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${safeFirstName},</h2>
      <p>You've been invited to join Be Original as a staff member.</p>
      <p>Click the button below to set your password and get started:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${safeUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Set Your Password
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">This link will expire in 7 days. If you weren't expecting this invitation, you can ignore this email.</p>
    </div>
  `;

  await sendEmail(to, subject, html);
};