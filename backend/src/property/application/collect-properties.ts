import type { ScrapedListing } from '../../../../shared/property.ts';
import { matchesProfile } from '../domain/matches-profile.ts';
import { sanitizeDiagnostic } from '../../platform/diagnostics.ts';
import { logger, withLogContext } from '../../platform/logger.ts';
import type { CrawlJob, Dependencies } from '../ports.ts';

export async function collectProperties(
  run: CrawlJob,
  deps: Dependencies,
  signal: AbortSignal,
) {
  let successes = 0;
  let failures = 0;
  const newLinks = new Set<string>();
  const observations = new Map<
    string,
    { property: ScrapedListing; sources: Set<string> }
  >();
  for (const profile of run.searches) {
    for (const source of profile.providers) {
      await withLogContext({
        search_id: profile.id,
        provider: source,
        search_params: profile.params,
      }, async () => {
        logger.info('provider.started');
        let stage = 'collect';
        let outcomeForLog: string[] = [];
        try {
          if (signal.aborted) {
            throw signal.reason;
          }
          let outcome: {
            properties: ScrapedListing[];
            outcome: string;
            error: string | null;
          };
          try {
            outcome = await deps.providers(
              source,
              profile.params,
              signal,
            ).collect();
          } catch (e) {
            logger.error('provider.collect_failed', e);
            outcome = {
              properties: [],
              outcome: 'failed',
              error: sanitizeDiagnostic(e),
            };
          }
          outcomeForLog = outcome.properties.map((p) => p.url);
          if (outcome.outcome === 'failed') failures++;
          else {
            successes++;
            if (outcome.outcome === 'partial') failures++;
          }
          if (outcome.outcome !== 'failed') {
            stage = 'save_listings';
            const fresh = await deps.store.save(
              run,
              outcome.properties,
              profile.id,
            );
            for (const p of fresh) newLinks.add(p.url);
            for (const p of outcome.properties) {
              const sources = observations.get(p.url)?.sources ??
                new Set<string>();
              sources.add(source);
              observations.set(p.url, { property: p, sources });
            }
          }
          stage = 'save_source_outcome';
          await deps.store.source(run, {
            source,
            search_id: profile.id,
            count: outcome.properties.length,
            outcome: outcome.outcome,
            error_category: outcome.error,
          });
          logger.info('provider.completed', {
            outcome: outcome.outcome,
            count: outcome.properties.length,
            error_category: outcome.error,
          });
        } catch (e) {
          logger.error('provider.failed', e, {
            stage,
            listing_urls: outcomeForLog,
          });
          throw e;
        }
      });
    }
  }
  const notifications = new Map<string, ScrapedListing[]>();
  for (const url of newLinks) {
    const { property, sources } = observations.get(url)!;
    const recipients = new Set<string>();
    for (const profile of run.searches) {
      if (
        profile.notificationEmails.length &&
        profile.providers.some((source) => sources.has(source)) &&
        matchesProfile(property, profile.params)
      ) {
        for (const email of profile.notificationEmails) recipients.add(email);
      }
    }
    for (const recipient of recipients) {
      const items = notifications.get(recipient) ?? [];
      items.push(property);
      notifications.set(recipient, items);
    }
  }
  return { successes, failures, notifications };
}
