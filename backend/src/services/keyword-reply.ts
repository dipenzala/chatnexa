import { one, query } from '../db/pool';

export const keywordReply = {
  /** Check if any keyword matches and return the reply */
  async findMatch(orgId: string, text: string): Promise<{ id: string; reply_text: string } | null> {
    if (!text || text.length < 2) return null;
    const lower = text.toLowerCase();

    const rows = await query<{ id: string; keyword: string; match_type: string; reply_text: string }>(
      `SELECT id, keyword, match_type, reply_text FROM keyword_replies
        WHERE org_id = $1 AND is_active = TRUE
        ORDER BY priority DESC, created_at ASC`,
      [orgId]
    );

    for (const kw of rows.rows) {
      const k = kw.keyword.toLowerCase();
      let match = false;
      if (kw.match_type === 'exact') match = lower === k;
      else if (kw.match_type === 'starts_with') match = lower.startsWith(k);
      else match = lower.includes(k);

      if (match) {
        // Increment hit counter
        await query(`UPDATE keyword_replies SET hits = hits + 1 WHERE id = $1`, [kw.id]);
        return { id: kw.id, reply_text: kw.reply_text };
      }
    }
    return null;
  },
};
