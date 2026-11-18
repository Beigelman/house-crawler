import { type ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { configured } from '../../lib/supabase';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { useSession } from './useSession';
import { isOwner, signOut } from './auth.api';
import { LoginPage } from './LoginPage';
export function RequireOwner({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const [denied, setDenied] = useState(false);
  const loc = useLocation();
  const owner = useQuery({
    queryKey: ['owner', session?.user.id],
    enabled: Boolean(session),
    queryFn: isOwner,
  });
  useEffect(() => {
    if (session && owner.data === false) {
      setDenied(true);
      void signOut();
    }
  }, [session, owner.data]);
  if (!configured) {
    return (
      <main className='state'>
        <h1>Configure o Casa Radar</h1>
        <p>
          Defina a URL e a chave pública do Supabase conforme o guia de
          instalação.
        </p>
      </main>
    );
  }
  if (!ready || session && owner.isPending) {
    return (
      <main>
        <LoadingState />
      </main>
    );
  }
  if (session && owner.isError) {
    return (
      <main>
        <ErrorState retry={() => void owner.refetch()} />
      </main>
    );
  }
  if (!session || !owner.data) {
    if (loc.pathname !== '/login') {
      return (
        <Navigate
          to={'/login?next=' + encodeURIComponent(loc.pathname + loc.search)}
          replace
        />
      );
    }
    return <LoginPage session={null} denied={denied} />;
  }
  if (loc.pathname === '/login') {
    return <LoginPage session={session} denied={false} />;
  }
  return children;
}
