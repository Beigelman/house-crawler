import { logger, withLogContext } from '../../platform/logger.ts';
import type { CrawlJob, Dependencies, EmailState } from '../ports.ts';
import type { ScrapedListing } from '../../../../shared/property.ts';

export async function notifyNewProperties(
  run: CrawlJob,
  notifications: ReadonlyMap<string, ScrapedListing[]>,
  deps: Dependencies,
  signal: AbortSignal,
): Promise<EmailState> {
  let failed = false;
  for (const [recipient, items] of notifications) {
    signal.throwIfAborted();
    await deps.store.renew(run);
    signal.throwIfAborted();
    await withLogContext({
      stage: 'notification',
      listing_urls: items.map((p) => p.url),
    }, async () => {
      try {
        const result = await deps.sendEmail(items, recipient);
        if (result.success) {
          logger.info('notification.sent', { count: items.length });
        } else {
          failed = true;
          logger.error('notification.failed', result.error);
        }
      } catch (e) {
        logger.error('notification.failed', e);
        failed = true;
      }
    });
  }
  return failed ? 'failed' : notifications.size ? 'sent' : 'not_needed';
}
