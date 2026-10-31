import { invoicesService } from './invoices.service';

let cronJob: any = null;
let intervalTimer: NodeJS.Timeout | null = null;

/**
 * Start the daily cron job for processing active subscriptions billing.
 */
export function startBillingCron(): void {
  let nodeCron: any = null;
  try {
    nodeCron = require('node-cron');
  } catch {
    nodeCron = null;
  }

  if (nodeCron) {
    if (!cronJob) {
      // Schedule to run every day at 00:00 (midnight)
      cronJob = nodeCron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Running daily subscription billing job...');
        try {
          const result = await invoicesService.runBilling();
          console.log('[CRON] Daily billing completed:', result);
        } catch (err) {
          console.error('[CRON] Daily billing encountered an error:', err);
        }
      });
      console.log('[CRON] Daily billing cron scheduled with node-cron.');
    }
  } else {
    // Fallback: 24-hour interval timer
    if (!intervalTimer) {
      intervalTimer = setInterval(async () => {
        try {
          await invoicesService.runBilling();
        } catch (err) {
          console.error('[CRON] Interval billing failed:', err);
        }
      }, 24 * 60 * 60 * 1000);
      intervalTimer.unref(); // Avoid keeping Node process alive in tests
      console.log('[CRON] Daily billing interval timer started (24h fallback).');
    }
  }
}

/**
 * Stop the billing cron job or timer.
 */
export function stopBillingCron(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

