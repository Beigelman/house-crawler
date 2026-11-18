import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { getSession, onAuthStateChange } from './auth.api';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
    getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) cache.clear();
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [cache]);
  return { session, ready };
}
