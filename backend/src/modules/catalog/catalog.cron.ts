import cron from 'node-cron';
import { catalogService } from './catalog.service';

/**
 * Daily cron job: runs at midnight (00:00:00) every day.
 * Auto-closes plans whose end date has passed and auto_close is true.
 */
export function startCatalogCron() {
  // Run daily at midnight
  return cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[CATALOG CRON] Running daily plan expiration check...');
      const closed = await catalogService.checkAndAutoClosePlans();
      console.log(`[CATALOG CRON] Expired plans check completed. Closed: ${closed}`);
    } catch (err) {
      console.error('[CATALOG CRON] Error executing auto-close job:', err);
    }
  });
}
