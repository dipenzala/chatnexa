import { Queue, QueueOptions } from 'bullmq';
import { bullConnection } from '../redis/client';

const opts: QueueOptions = {
  connection: bullConnection as any,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: { count: 500 }, removeOnFail: { count: 1000 } },
};

export const QUEUE_NAMES = {
  CAMPAIGN: 'campaign',
  AI_REPLY: 'ai-reply',
  TRANSCRIBE: 'transcribe',
  EMAIL: 'email',
  LEAD_SCORE: 'lead-score',
  IVR: 'ivr',
  DEAL_ANALYZE: 'deal-analyze',
  FOLLOWUP_RUNNER: 'followup-runner',
} as const;

export const campaignQueue = new Queue(QUEUE_NAMES.CAMPAIGN, opts);
export const aiReplyQueue = new Queue(QUEUE_NAMES.AI_REPLY, opts);
export const transcribeQueue = new Queue(QUEUE_NAMES.TRANSCRIBE, opts);
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, opts);
export const leadScoreQueue = new Queue(QUEUE_NAMES.LEAD_SCORE, opts);
export const ivrQueue = new Queue(QUEUE_NAMES.IVR, opts);
export const dealAnalyzeQueue = new Queue(QUEUE_NAMES.DEAL_ANALYZE, opts);
export const followupQueue = new Queue(QUEUE_NAMES.FOLLOWUP_RUNNER, opts);

export async function enqueueCampaign(campaignId: string, orgId: string, delayMs = 0) {
  return campaignQueue.add('broadcast', { campaignId, orgId }, { delay: delayMs, jobId: `campaign:${campaignId}` });
}
export async function enqueueDealAnalyze(orgId: string, conversationId: string) {
  return dealAnalyzeQueue.add('analyze', { orgId, conversationId }, { removeOnComplete: true });
}
export async function enqueueFollowupTick() {
  return followupQueue.add('tick', {}, { repeat: { every: 5 * 60 * 1000 }, jobId: 'followup-tick' });
}
