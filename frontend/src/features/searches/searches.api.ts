import { supabase } from '../../lib/supabase';
import { check } from '../../lib/query-result';
import type { Profile } from '../../../../shared/property.ts';
export async function profiles() {
  return check(
    await supabase.from('property_profile').select('*').order('name').order(
      'id',
    ),
  ) as Profile[];
}

export async function saveProfile(profile: Profile) {
  check(await supabase.from('property_profile').upsert(profile));
}
