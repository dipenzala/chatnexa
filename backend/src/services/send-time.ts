import { many } from '../db/pool';
const DEFAULT_BY_TAG: Record<string, number> = {
  business_owner: 10, professional: 20, student: 21, housewife: 11, default: 11,
};
export const sendTime = {
  bestHourFor(contact: any): number {
    if (contact?.preferred_send_hour != null) return contact.preferred_send_hour;
    const tags: string[] = (contact?.tags || []).map((t: string) => String(t).toLowerCase());
    for (const tag of tags) {
      for (const key of Object.keys(DEFAULT_BY_TAG)) {
        if (key !== 'default' && tag.includes(key)) return DEFAULT_BY_TAG[key];
      }
    }
    return DEFAULT_BY_TAG.default;
  },
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
