import './workers';
import { logger } from './lib/logger';
import { enqueueFollowupTick, enqueueDailyCron } from './queues';

logger.info('👷 ChatNexa worker process started');
enqueueDailyCron().catch((e) => logger.warn('daily cron schedule failed:', e.message));
enqueueFollowupTick().catch((e) => logger.warn('followup tick schedule failed:', e.message));

process.on('SIGTERM', async () => {
  const { closeWorkers } = await import('./workers');
  await closeWorkers();
  process.exit(0);
});
