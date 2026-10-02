import './workers';
import { logger } from './lib/logger';
import { enqueueFollowupTick } from './queues';

logger.info('👷 ChatNexa worker process started');
enqueueFollowupTick().catch((e) => logger.warn('followup tick schedule failed:', e.message));

process.on('SIGTERM', async () => {
  const { closeWorkers } = await import('./workers');
  await closeWorkers();
  process.exit(0);
});
