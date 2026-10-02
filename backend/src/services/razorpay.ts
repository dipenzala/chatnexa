import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';

const configured = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
export const rzp = configured ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET }) : null;

export const payments = {
  get enabled() { return configured; },
  async createOrder(amountInr: number, receipt: string, notes: Record<string, string> = {}) {
    if (!rzp) throw new Error('Razorpay not configured');
    return rzp.orders.create({ amount: Math.round(amountInr * 100), currency: 'INR', receipt, notes, payment_capture: true } as any);
  },
  async createPaymentLink(opts: { amountInr: number; description: string; customer: { name?: string; contact?: string; email?: string }; notes?: Record<string, string> }) {
    if (!rzp) throw new Error('Razorpay not configured');
    return rzp.paymentLink.create({
      amount: Math.round(opts.amountInr * 100), currency: 'INR', accept_partial: false,
      description: opts.description, customer: opts.customer,
      notify: { sms: true, email: !!opts.customer.email }, reminder_enable: true,
      notes: opts.notes || {},
    } as any);
  },
  verifyWebhookSignature(rawBody: string, signature: string) {
    const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(rawBody).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
  },
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
    const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    return expected === signature;
  },
};
