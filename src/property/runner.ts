import { matchesProfile, type Profile, type Property } from './model.ts';
export type Run = {
  run_id: string;
  token: number;
  kind: string;
  profiles: Profile[];
};
export interface Store {
  activeRunId?(): Promise<string | null>;
  schedule?(): Promise<{ outcome: string; scheduled_at?: string }>;
  claim(kind: string): Promise<Run | null>;
  renew(run: Run): Promise<unknown>;
  save(
    run: Run,
    items: Property[],
    profile: string | null,
  ): Promise<Property[]>;
  source(
    run: Run,
    value: {
      source: string;
      profile_id: string | null;
      count: number;
      outcome: string;
      error_category: string | null;
    },
  ): Promise<unknown>;
  finish(run: Run, state: string, email: string): Promise<unknown>;
  listings(): Promise<Property[]>;
  heartbeat(): Promise<unknown>;
}
export interface Provider {
  collect(): Promise<
    { properties: Property[]; outcome: string; error: string | null }
  >;
  verify(url: string): Promise<{ verification: string }>;
}
export type Dependencies = {
  schedule?: Store['schedule'];
  sleep?: (ms: number) => Promise<void>;
  store: Store;
  providers: (
    id: string,
    params: Profile['params'],
    signal?: AbortSignal,
  ) => Provider;
  sendEmail: (
    items: Property[],
  ) => Promise<{ success: boolean; error?: string }>;
};
export function sanitizeDiagnostic(e: unknown): string {
  const s = e instanceof Error ? e.message : '';
  return /403/.test(s)
    ? 'blocked'
    : /timeout|timed out/i.test(s)
    ? 'timeout'
    : /database/i.test(s)
    ? 'database'
    : /network|fetch/i.test(s)
    ? 'network'
    : /HTTP/.test(s)
    ? 'http'
    : /parse|extract/i.test(s)
    ? 'parse'
    : 'internal';
}
export const exitCode = (state: string) =>
  state === 'succeeded' ? 0 : state === 'busy' ? 2 : 1;
export async function executeRun(kind: string, deps: Dependencies) {
  const run = await deps.store.claim(kind);
  if (!run) {
    const activeId = kind === 'worker'
      ? null
      : await deps.store.activeRunId?.() ?? null;
    return {
      run_id: activeId,
      state: kind === 'worker' ? 'idle' : 'busy',
      summary: kind === 'worker'
        ? 'Coletor ocioso'
        : `Execução ${activeId ?? 'não iniciada'}: busy`,
    };
  }
  const controller = new AbortController();
  let renewal: Promise<unknown> = Promise.resolve();
  const timer = setInterval(() => {
    renewal = renewal.then(async () => {
      await deps.store.renew(run);
      await deps.store.heartbeat();
    }).catch((e) => {
      controller.abort(e);
    });
  }, 30000);
  let successes = 0, failures = 0;
  const newLinks = new Set<string>();
  const observations = new Map<
    string,
    { property: Property; sources: Set<string> }
  >();
  let email = 'not_needed';
  try {
    if (run.kind === 'validate') {
      for (const p of await deps.store.listings()) {
        if (controller.signal.aborted) throw controller.signal.reason;
        const id = p.link.includes('dfimoveis.com.br')
          ? 'dfimoveis'
          : p.link.includes('wimoveis.com.br')
          ? 'wimoveis'
          : null;
        if (!id) {
          await deps.store.save(run, [{ ...p, verification: 'unknown' }], null);
          failures++;
          continue;
        }
        const provider = deps.providers(
          id,
          run.profiles[0]?.params ??
            {
              neighborhoods: [],
              numberOfRooms: [],
              numberOfSuites: 0,
              minArea: 0,
              maxArea: 0,
              minPrice: 0,
              maxPrice: 0,
              hasElevator: false,
              hasParking: false,
            },
          controller.signal,
        );
        const result = await provider.verify(p.link);
        await deps.store.save(run, [{ ...p, ...result }], null);
        result.verification === 'unknown' ? failures++ : successes++;
        await deps.store.source(run, {
          source: id,
          profile_id: null,
          count: 1,
          outcome: result.verification,
          error_category: result.verification === 'unknown'
            ? 'verification_unknown'
            : null,
        });
        await (deps.sleep ??
          ((ms: number) => new Promise((r) => setTimeout(r, ms))))(1500);
      }
    } else {
      for (const profile of run.profiles) {
        for (const source of profile.providers) {
          if (controller.signal.aborted) {
            throw controller.signal.reason;
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
              controller.signal,
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
    if (news.length) {
      if (controller.signal.aborted) throw controller.signal.reason;
      await deps.store.renew(run);
      try {
        const result = await deps.sendEmail(news);
        email = result.success ? 'sent' : 'failed';
      } catch {
        email = 'failed';
      }
    }
    const state = failures ? (successes ? 'partial' : 'failed') : 'succeeded';
    await deps.store.finish(run, state, email);
    return {
      run_id: run.run_id,
      state,
      summary: `Execução ${run.run_id}: ${state}`,
    };
  } catch (e) {
    if (!controller.signal.aborted) {
      try {
        await deps.store.source(run, {
          source: 'system',
          profile_id: null,
          count: 0,
          outcome: 'failed',
          error_category: sanitizeDiagnostic(e),
        });
        await deps.store.finish(run, 'failed', email);
      } catch { /* Lost leases cannot commit diagnostic writes. */ }
    }
    throw e;
  } finally {
    clearInterval(timer);
    await renewal;
  }
}
export async function pollWorker(
  deps: Dependencies & {
    sleep?: (ms: number) => Promise<void>;
    shouldStop?: () => boolean;
  },
) {
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  while (!deps.shouldStop?.()) {
    try {
      await deps.store.heartbeat();
      try {
        const scheduled = await deps.schedule?.();
        if (scheduled?.outcome === 'accepted') {
          console.log(`Coleta agendada: ${scheduled.scheduled_at}`);
        }
      } catch (e) {
        // An unavailable scheduler must not prevent manual queue processing.
        console.error('Erro do agendamento:', sanitizeDiagnostic(e));
      }
      const r = await executeRun('worker', deps);
      if (r.state !== 'idle') console.log(r.summary);
    } catch (e) {
      console.error('Erro do coletor:', sanitizeDiagnostic(e));
    }
    if (!deps.shouldStop?.()) await sleep(30000);
  }
}
