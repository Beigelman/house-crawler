import type { SearchRow } from '../../../../shared/search.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../platform/supabase-client.ts';
import { fromSearchRow } from '../../../../shared/search.ts';
import type { ScrapedListing } from '../../../../shared/property.ts';
import type { CrawlJob, Store } from '../ports.ts';

export function propertyStore(
  client: SupabaseClient = getSupabaseClient(),
): Store {
  async function call<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('Database operation failed: ' + error.code);
    return data as T;
  }
  return {
    schedule: () => call('enqueue_scheduled_crawl', {}),
    activeJobId: async () => {
      const { data, error } = await client.from('crawl_jobs').select('id').eq(
        'state',
        'running',
      ).order('started_at', { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
    claim: async (kind) => {
      await call('seed_saved_search', {});
      const job = await call<
        Omit<CrawlJob, 'searches'> & { searches: SearchRow[] } | null
      >('claim_crawl_job', { p_kind: kind });
      return job ? { ...job, searches: job.searches.map(fromSearchRow) } : null;
    },
    renew: (r) =>
      call('renew_worker_lease', { p_job: r.job_id, p_token: r.token }),
    save: (r, items, profile) =>
      call<ScrapedListing[]>('save_listing_batch', {
        p_job: r.job_id,
        p_token: r.token,
        p_items: items,
        p_search: profile,
      }),
    source: (r, v) =>
      call('record_crawl_source', {
        p_job: r.job_id,
        p_token: r.token,
        p_source: v.source,
        p_search: v.search_id,
        p_count: v.count,
        p_outcome: v.outcome,
        p_error: v.error_category,
      }),
    finish: (r, state, email, error) =>
      call('finish_crawl_job', {
        p_job: r.job_id,
        p_token: r.token,
        p_state: state,
        p_email: email,
        p_error: error ?? null,
      }),
    listings: async () => {
      const all: ScrapedListing[] = [];
      for (let i = 0;; i += 1000) {
        const { data, error } = await client.from('listings').select('*')
          .order('url').range(i, i + 999);
        if (error) throw error;
        all.push(...data);
        if (data.length < 1000) return all;
      }
    },
    heartbeat: async () => {
      await call('record_worker_heartbeat', {});
    },
  };
}
