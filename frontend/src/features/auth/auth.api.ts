import { supabase } from '../../lib/supabase';

export const signOut = () => supabase.auth.signOut();

export const onAuthStateChange = supabase.auth.onAuthStateChange.bind(
  supabase.auth,
);

export const signInWithPassword = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

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
