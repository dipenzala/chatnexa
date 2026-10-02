import { one, query, tx } from '../db/pool';

export const contactMerge = {
  /** Find duplicates by phone/email similarity */
  async findDuplicates(orgId: string) {
    return query(
      `SELECT phone, email, COUNT(*)::int AS count, ARRAY_AGG(id) AS ids, ARRAY_AGG(name) AS names
         FROM contacts
        WHERE org_id = $1
        GROUP BY phone, email
       HAVING COUNT(*) > 1
        ORDER BY count DESC LIMIT 50`,
      [orgId]
    );
  },

  /** Merge multiple contacts into primary */
  async merge(orgId: string, primaryId: string, mergedIds: string[]) {
    if (mergedIds.includes(primaryId)) throw new Error('Cannot merge into self');
    if (mergedIds.length === 0) throw new Error('No contacts to merge');

    return tx(async (client) => {
      // Move messages
      await client.query(
        `UPDATE messages SET contact_id = $1 WHERE contact_id = ANY($2::uuid[]) AND org_id = $3`,
        [primaryId, mergedIds, orgId]
      );

      // Move conversations
      await client.query(
        `UPDATE conversations SET contact_id = $1 WHERE contact_id = ANY($2::uuid[]) AND org_id = $3`,
        [primaryId, mergedIds, orgId]
      );

      // Move leads
      await client.query(
        `UPDATE leads SET contact_id = $1 WHERE contact_id = ANY($2::uuid[]) AND org_id = $3`,
        [primaryId, mergedIds, orgId]
      );

      // Move payments
      await client.query(
        `UPDATE payments SET contact_id = $1 WHERE contact_id = ANY($2::uuid[]) AND org_id = $3`,
        [primaryId, mergedIds, orgId]
      );

      // Merge tags
      const primary = await client.query(`SELECT tags FROM contacts WHERE id = $1`, [primaryId]);
      const merged = await client.query(`SELECT tags FROM contacts WHERE id = ANY($1::uuid[])`, [mergedIds]);
      const allTags = new Set<string>([...(primary.rows[0]?.tags || [])]);
      for (const row of merged.rows) for (const t of (row.tags || [])) allTags.add(t);

      await client.query(
        `UPDATE contacts SET tags = $2 WHERE id = $1`,
        [primaryId, Array.from(allTags)]
      );

      // Delete merged
      await client.query(
        `DELETE FROM contacts WHERE id = ANY($1::uuid[]) AND org_id = $2`,
        [mergedIds, orgId]
      );

      // Log
      await client.query(
        `INSERT INTO contact_merges (org_id, primary_contact_id, merged_contact_ids)
         VALUES ($1,$2,$3)`,
        [orgId, primaryId, mergedIds]
      );

      return { merged: mergedIds.length };
    });
  },
};
