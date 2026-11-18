import type { Property } from '../../../../shared/property.ts';
import { matchesProfile } from '../domain/matches-profile.ts';
import { sanitizeDiagnostic } from '../../platform/diagnostics.ts';
import type { Dependencies, Run } from '../ports.ts';

export async function collectProperties(
  run: Run,
  deps: Dependencies,
  signal: AbortSignal,
) {
  let successes = 0;
  let failures = 0;
  const newLinks = new Set<string>();
  const observations = new Map<
    string,
    { property: Property; sources: Set<string> }
  >();
  for (const profile of run.profiles) {
    for (const source of profile.providers) {
      if (signal.aborted) {
        throw signal.reason;
      }
      let outcome: {
        properties: Property[];
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
        outcome = {
          properties: [],
          outcome: 'failed',
          error: sanitizeDiagnostic(e),
        };
      }
      if (outcome.outcome === 'failed') failures++;
      else {
        successes++;
        if (outcome.outcome === 'partial') failures++;
      }
      if (outcome.outcome !== 'failed') {
        const fresh = await deps.store.save(
          run,
          outcome.properties,
          profile.id,
        );
        for (const p of fresh) newLinks.add(p.link);
        for (const p of outcome.properties) {
          const sources = observations.get(p.link)?.sources ??
            new Set<string>();
          sources.add(source);
          observations.set(p.link, { property: p, sources });
        }
      }
      await deps.store.source(run, {
        source,
        profile_id: profile.id,
        count: outcome.properties.length,
        outcome: outcome.outcome,
        error_category: outcome.error,
      });
    }
  }
  const news = [...newLinks].flatMap((link) => {
    const observed = observations.get(link)!;
    return run.profiles.some((profile) =>
        profile.providers.some((source) => observed.sources.has(source)) &&
        matchesProfile(observed.property, profile.params)
      )
      ? [observed.property]
      : [];
  });
  return { successes, failures, newProperties: news };
}
