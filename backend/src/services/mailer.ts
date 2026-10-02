import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../lib/logger';

let transporter: Transporter | null = null;
if (env.SMTP_HOST && env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export const mailer = {
  get enabled() { return !!transporter; },
  async send(to: string, subject: string, html: string) {
    if (!transporter) { logger.warn('SMTP not configured, skipping email'); return; }
    try { await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html }); logger.info(`email sent → ${to}`); }
    catch (e: any) { logger.error('email failed', e.message); }
  },
  async sendWelcome(to: string, name: string, orgName: string) {
    return this.send(to, `Welcome to ChatNexa, ${name}!`,
      `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#2563EB">Welcome to ChatNexa 🎉</h2>
        <p>Hi ${name}, your workspace <b>${orgName}</b> is ready.</p>
        <a href="${env.FRONTEND_URL}/dashboard" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none">Open Dashboard</a>
      </div>`);
  },
  async sendPasswordReset(to: string, name: string, token: string) {
    const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    return this.send(to, 'Reset your ChatNexa password',
      `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#2563EB">Password reset</h2>
        <p>Hi ${name}, click below to set a new password. Expires in 30 min.</p>
        <a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none">Reset password</a>
      </div>`);
  },
  async sendLowBalance(to: string, balance: number) {
    return this.send(to, '⚠️ ChatNexa wallet running low',
      `<div style="font-family:Inter,Arial,sans-serif">
        <h3>Your balance is ₹${balance.toFixed(2)}</h3>
        <p>Top up to keep campaigns running.</p>
        <a href="${env.FRONTEND_URL}/dashboard/settings">Top up now</a>
      </div>`);
  },
};
