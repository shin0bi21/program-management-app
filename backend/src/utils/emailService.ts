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

export const sendYouthInvite = async (to: string, firstName: string, inviteUrl: string) => {
  const subject = 'Your Be Original account invitation';
  const safeFirstName = escapeHtml(firstName);
  const safeUrl = escapeHtml(inviteUrl);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${safeFirstName},</h2>
      <p>You've been invited to create your Be Original account.</p>
      <p>Set your password to get started:</p>
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

export const sendInviteEmailChanged = async (to: string, firstName: string, inviteUrl: string) => {
  const subject = 'Your Be Original invite has been resent';
  const safeFirstName = escapeHtml(firstName);
  const safeUrl = escapeHtml(inviteUrl);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${safeFirstName},</h2>
      <p>Your Be Original staff invitation has been sent to this email address.</p>
      <p>Click the button below to set your password and get started:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${safeUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Set Your Password
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">This link will expire in 7 days. If you weren't expecting this, you can ignore this email.</p>
    </div>
  `;

  await sendEmail(to, subject, html);
};

export const sendEmailChangedOldAddress = async (to: string, firstName: string, newEmail: string) => {
  const subject = 'Your Be Original login email was changed';
  const safeFirstName = escapeHtml(firstName);
  const safeNewEmail = escapeHtml(newEmail);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${safeFirstName},</h2>
      <p>An administrator has updated the login email address on your Be Original account.</p>
      <p>Your new login email is: <strong>${safeNewEmail}</strong></p>
      <p>Your password has not changed. You can log in with your new email address immediately.</p>
      <p style="color: #666; font-size: 14px;">If you did not expect this change, please contact your administrator.</p>
    </div>
  `;

  await sendEmail(to, subject, html);
};

export const sendEmailChangedNewAddress = async (to: string, firstName: string) => {
  const subject = 'Your Be Original login email has been updated';
  const safeFirstName = escapeHtml(firstName);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${safeFirstName},</h2>
      <p>This email address is now your login for Be Original.</p>
      <p>Your password has not changed — log in with this email address and your existing password.</p>
      <p style="color: #666; font-size: 14px;">If you did not expect this change, please contact your administrator.</p>
    </div>
  `;

  await sendEmail(to, subject, html);
};
