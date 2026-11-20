import { supabase } from '../../lib/supabase';
import { check } from '../../lib/query-result';
import { fromSearchRow, toSearchRow } from '../../../../shared/search';
import type { SavedSearch } from '../../../../shared/property.ts';

export async function searches() {
  return (check(
    await supabase.from('saved_searches').select('*').order('name').order(
      'id',
    ),
  ) ?? []).map(fromSearchRow);
}

export async function saveProfile(profile: SavedSearch) {
  check(await supabase.from('saved_searches').upsert(toSearchRow(profile)));
}
