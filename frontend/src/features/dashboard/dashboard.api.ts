import { supabase } from '../../lib/supabase';
import { check } from '../../lib/query-result';
export async function dashboard() {
  const count = async (column?: string, value?: string, since?: string) => {
    let q = supabase.from('real_states').select('link', {
      count: 'exact',
      head: true,
    });
    if (column && value) q = q.eq(column, value);
    if (since) q = q.gte('created_at', since);
    const r = await q;
    check(r);
    return r.count ?? 0;
  };
  const [active, recent, df, wi, runs, hb] = await Promise.all([
    count('availability', 'active'),
    count(
      undefined,
      undefined,
      new Date(Date.now() - 7 * 86400000).toISOString(),
    ),
    count('source', 'dfimoveis'),
    count('source', 'wimoveis'),
    supabase.from('property_run').select('*').order('started_at', {
      ascending: false,
    }).limit(1).then(check),
    supabase.from('property_heartbeat').select('*').limit(1).then(check),
  ]);
  return {
    active,
    recent,
    df,
    wi,
    run: runs?.[0],
    heartbeat: hb?.[0]?.seen_at,
  };
}
