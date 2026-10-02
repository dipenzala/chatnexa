import { many, query } from '../db/pool';

export const journey = {
  /** Log an event */
  async log(orgId: string, contactId: string, eventType: string, title: string, description?: string, refId?: string, meta: any = {}) {
    await query(
      `INSERT INTO journey_events (org_id, contact_id, event_type, title, description, ref_id, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [orgId, contactId, eventType, title, description || null, refId || null, JSON.stringify(meta)]
    );
  },

  /** Get full timeline */
  async timeline(orgId: string, contactId: string, limit = 100) {
    return many(
      `SELECT * FROM journey_events WHERE org_id = $1 AND contact_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [orgId, contactId, limit]
    );
  },
};
