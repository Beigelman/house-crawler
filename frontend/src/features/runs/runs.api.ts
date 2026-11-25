import { supabase } from '../../lib/supabase';
import { check } from '../../lib/query-result';
import { searches } from '../searches/searches.api';

export async function getRuns() {
  return ({
    jobs: check(
      await supabase.from('crawl_jobs').select(
        '*,crawl_run_source_summaries(*)',
      )
        .not('started_at', 'is', null).order('started_at', { ascending: false })
        .order('id', { referencedTable: 'crawl_run_source_summaries' })
        .limit(90),
    ) ?? [],
    activeJobs: check(
      await supabase.from('crawl_jobs').select('*').in('state', [
        'queued',
        'running',
      ]).order('created_at', { ascending: false }),
    ) ?? [],
  });
}

export async function enqueueCollection(requestKey: string) {
  const searchProfiles = await searches();
  return check(
    await supabase.rpc('enqueue_crawl', {
      request_key: requestKey,
      search_ids: searchProfiles.filter((profile) => profile.enabled).map(
        (profile) => profile.id,
      ),
    }),
  );
}
