import { many } from '../db/pool';

export const sendTime = {
  /** Best hours by audience type (IST) */
  DEFAULT_BY_TAG: Record<string, number> = {
    business_owner: 10,
    professional: 20,
    student: 21,
    housewife: 11,
    default: 11,
  },

  /** Get best hour for a contact */
  bestHourFor(contact: any): number {
    if (contact.preferred_send_hour != null) return contact.preferred_send_hour;

    const tags: string[] = (contact.tags || []).map((t: string) => t.toLowerCase());
    for (const tag of tags) {
      for (const key of Object.keys(this.DEFAULT_BY_TAG)) {
        if (tag.includes(key)) return this.DEFAULT_BY_TAG[key];
      }
    }
    return this.DEFAULT_BY_TAG.default;
  },

  /** Group contacts by recommended send hour */
  async groupByHour(orgId: string, contactIds: string[]) {
    const contacts = await many<any>(
      `SELECT id, tags, preferred_send_hour FROM contacts WHERE org_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, contactIds]
    );

    const groups: Record<number, string[]> = {};
    for (const c of contacts) {
      const hour = this.bestHourFor(c);
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(c.id);
    }
    return groups;
  },
};
