import { supabase } from '../../lib/supabase';
import { check } from '../../lib/query-result';

export const signOut = () => supabase.auth.signOut();

export const isOwner = async () =>
  check(await supabase.rpc('is_app_owner')) as boolean;

export const getSession = () => supabase.auth.getSession();

export const onAuthStateChange = supabase.auth.onAuthStateChange.bind(
  supabase.auth,
);

export function sendLoginLink(email: string, target: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: location.origin + '/login?next=' +
        encodeURIComponent(target),
    },
  });
}
