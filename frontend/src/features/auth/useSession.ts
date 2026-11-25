import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChange } from './auth.api';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
    let userId: string | undefined;
    const { data } = onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id;
      if (userId !== nextUserId) cache.clear();
      userId = nextUserId;
      setSession(nextSession);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [cache]);
  return { session, ready };
}
