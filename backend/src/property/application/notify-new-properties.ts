import { logger, withLogContext } from '../../platform/logger.ts';
import type { CrawlJob, Dependencies, EmailState } from '../ports.ts';
import type { ScrapedListing } from '../../../../shared/property.ts';

export async function notifyNewProperties(
  run: CrawlJob,
  items: ScrapedListing[],
  deps: Dependencies,
  signal: AbortSignal,
): Promise<EmailState> {
  let email: EmailState = 'not_needed';
  if (items.length) {
    if (signal.aborted) throw signal.reason;
    await deps.store.renew(run);
    return await withLogContext({
      stage: 'notification',
      listing_urls: items.map((p) => p.url),
    }, async () => {
      try {
        const result = await deps.sendEmail(items);
        email = result.success ? 'sent' : 'failed';
        if (!result.success) logger.error('notification.failed', result.error);
        else logger.info('notification.sent', { count: items.length });
      } catch (e) {
        logger.error('notification.failed', e);
        email = 'failed';
      }
      return email;
    });
  }
  return email;
}
