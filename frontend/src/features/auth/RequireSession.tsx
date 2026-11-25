import { Fragment, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { configured } from '../../lib/supabase';
import { LoadingState } from '../../components/LoadingState';
import { useSession } from './useSession';
import { LoginPage } from './LoginPage';

export function RequireSession({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const loc = useLocation();
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
  if (!ready) {
    return (
      <main>
        <LoadingState />
      </main>
    );
  }
  if (loc.pathname === '/login') {
    return <LoginPage session={session} />;
  }
  if (!session) {
    return (
      <Navigate
        to={'/login?next=' + encodeURIComponent(loc.pathname + loc.search)}
        replace
      />
    );
  }
  return <Fragment key={session.user.id}>{children}</Fragment>;
}
