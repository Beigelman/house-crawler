import { supabase } from '../../lib/supabase';
import { check } from '../../lib/query-result';
import { profiles } from '../searches/searches.api';

export async function getRuns() {
  return ({
    runs: check(
      await supabase.from('property_run').select('*,property_source_run(*)')
        .order('started_at', { ascending: false }).limit(90),
    ) ?? [],
    requests: check(
      await supabase.from('property_request').select('*').in('state', [
        'queued',
        'running',
      ]).order('created_at', { ascending: false }),
    ) ?? [],
  });
}

export async function enqueueCollection(requestKey: string) {
  const searchProfiles = await profiles();
  return check(
    await supabase.rpc('enqueue_property_crawl', {
      request_key: requestKey,
      profile_ids: searchProfiles.filter((profile) => profile.enabled).map(
        (profile) => profile.id,
      ),
    }),
  );
}
