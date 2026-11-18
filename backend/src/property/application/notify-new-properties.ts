import type { Dependencies, EmailState, Run } from '../ports.ts';
import type { Property } from '../../../../shared/property.ts';

export async function notifyNewProperties(
  run: Run,
  items: Property[],
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
