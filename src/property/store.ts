import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/supabase.ts';
import type { Property } from './model.ts';
import type { Run, Store } from './runner.ts';
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
    claim: async (kind) => {
      await call('seed_property_profile', {});
      return await call<Run | null>('claim_property_run', { p_kind: kind });
    },
    renew: (r) =>
      call('renew_property_lease', { p_run: r.run_id, p_token: r.token }),
    save: (r, items, profile) =>
      call<Property[]>('save_property_batch', {
        p_run: r.run_id,
        p_token: r.token,
        p_items: items,
        p_profile: profile,
      }),
    source: (r, v) =>
      call('record_property_source', {
        p_run: r.run_id,
        p_token: r.token,
        p_source: v.source,
        p_profile: v.profile_id,
        p_count: v.count,
        p_outcome: v.outcome,
        p_error: v.error_category,
      }),
    finish: (r, state, email) =>
      call('finish_property_run', {
        p_run: r.run_id,
        p_token: r.token,
        p_state: state,
        p_email: email,
      }),
    listings: async () => {
      const all: Property[] = [];
      for (let i = 0;; i += 1000) {
        const { data, error } = await client.from('real_states').select('*')
          .order('link').range(i, i + 999);
        if (error) throw error;
        all.push(...data);
        if (data.length < 1000) return all;
      }
    },
    heartbeat: async () => {
      const { error } = await client.from('property_heartbeat').upsert({
        singleton: true,
        seen_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
  };
}
