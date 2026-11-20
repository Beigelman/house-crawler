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
    try {
      const result = await deps.sendEmail(items);
      email = result.success ? 'sent' : 'failed';
    } catch {
      email = 'failed';
    }
  }
  return email;
}
