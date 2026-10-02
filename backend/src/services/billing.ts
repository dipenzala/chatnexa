import { env } from '../config/env';
import { one, query, tx } from '../db/pool';
import { logger } from '../lib/logger';
import { mailer } from './mailer';

export type TemplateCategory = 'MARKETING'|'UTILITY'|'AUTHENTICATION'|'SERVICE'|'AI_REPLY';

export const PRICES: Record<TemplateCategory, number> = {
  MARKETING: env.PRICE_MARKETING,
  UTILITY: env.PRICE_UTILITY,
  AUTHENTICATION: env.PRICE_AUTH,
  SERVICE: env.PRICE_SERVICE,
  AI_REPLY: Number(process.env.PRICE_AI_REPLY || 0.30),
};

export const billing = {
  priceFor(category: string): number {
    return PRICES[(category as TemplateCategory)] ?? PRICES.UTILITY;
  },
  async charge(orgId: string, category: string, description: string, refId?: string): Promise<boolean> {
    const amount = this.priceFor(category);
    if (amount <= 0) return true;
    try {
      await tx(async (c) => {
        const { rows } = await c.query(
          `UPDATE organizations SET wallet_balance = wallet_balance - $2 WHERE id = $1 AND wallet_balance >= $2 RETURNING wallet_balance`,
          [orgId, amount]
        );
        if (!rows.length) throw new Error('INSUFFICIENT_BALANCE');
        await c.query(
          `INSERT INTO wallet_transactions (org_id, type, amount, balance_after, category, description, ref_id)
           VALUES ($1,'debit',$2,$3,'message',$4,$5)`,
          [orgId, amount, rows[0].wallet_balance, description, refId ?? null]
        );
      });
      const org = await one<any>(`SELECT wallet_balance, owner_email FROM organizations WHERE id = $1`, [orgId]);
      if (org && Number(org.wallet_balance) < 50 && org.owner_email) {
        await mailer.sendLowBalance(org.owner_email, Number(org.wallet_balance)).catch(() => {});
      }
      return true;
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_BALANCE') { logger.warn(`insufficient balance org=${orgId}`); return false; }
      throw e;
    }
  },
  async credit(orgId: string, amount: number, category: 'topup'|'refund'|'subscription', description: string, refId?: string) {
    return tx(async (c) => {
      const { rows } = await c.query(`UPDATE organizations SET wallet_balance = wallet_balance + $2 WHERE id = $1 RETURNING wallet_balance`, [orgId, amount]);
      await c.query(
        `INSERT INTO wallet_transactions (org_id, type, amount, balance_after, category, description, ref_id)
         VALUES ($1,'credit',$2,$3,$4,$5,$6)`,
        [orgId, amount, rows[0].wallet_balance, category, description, refId ?? null]
      );
      return Number(rows[0].wallet_balance);
    });
  },
  async balance(orgId: string): Promise<number> {
    const r = await one<{ wallet_balance: string }>(`SELECT wallet_balance FROM organizations WHERE id = $1`, [orgId]);
    return r ? Number(r.wallet_balance) : 0;
  },
  async ledger(orgId: string, limit = 50) {
    const { rows } = await query(
      `SELECT id, type, amount, balance_after, category, description, created_at
         FROM wallet_transactions WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit]
    );
    return rows;
  },
};
