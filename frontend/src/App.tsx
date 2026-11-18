import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { check, configured, profiles, supabase } from './api';
import { Dashboard, ListingDetail, Listings, Runs, Searches } from './pages';
export function Loading() {
  return <div className='state' role='status'>Carregando…</div>;
}
export function Failure({ retry }: { retry: () => void }) {
  return (
    <div className='state' role='alert'>
      <h2>Não foi possível carregar</h2>
      <p>Verifique a conexão e tente novamente.</p>
      <button type='button' onClick={retry}>Tentar novamente</button>
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className='state'>
      <h2>{children}</h2>
      <p>Seu próximo imóvel começa com uma boa busca.</p>
      <Link className='button' to='/buscas'>Gerenciar buscas</Link>
    </div>
  );
}
function Login(
  { session, denied }: { session: Session | null; denied: boolean },
) {
  const [email, setEmail] = useState(''), [state, setState] = useState('idle');
  const [params] = useSearchParams();
  const next = params.get('next');
  const target = next?.startsWith('/') && !next.startsWith('//') &&
      !next.startsWith('/login')
    ? next
    : '/';
  if (session && !denied) return <Navigate to={target} replace />;
  return (
    <main className='login'>
      <div className='login-story'>
        <span className='eyebrow'>HOUSE CRAWLER</span>
        <h1>
          Um lugar para<br />encontrar o seu.
        </h1>
        <p>
          Todos os anúncios. Suas escolhas.<br />Um olhar atento às
          oportunidades.
        </p>
        <div className='house-art' aria-hidden='true'>⌂</div>
        <small>SEU RADAR IMOBILIÁRIO · BRASÍLIA</small>
      </div>
      <section className='login-form'>
        <div className='brand'>
          ⌂ <b>Casa Radar</b>
        </div>
        <h2>Bem-vindo de volta</h2>
        <p>Acesse seu painel com um link enviado por email.</p>
        {denied && <p role='alert'>Esta conta não tem acesso ao painel.</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setState('sending');
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: {
                shouldCreateUser: false,
                emailRedirectTo: location.origin + '/login?next=' +
                  encodeURIComponent(target),
              },
            });
            setState(error ? 'error' : 'sent');
          }}
        >
          <label>
            Email<input
              type='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            type='submit'
            className='primary'
            disabled={state === 'sending'}
          >
            {state === 'sending' ? 'Enviando link…' : 'Enviar link de acesso'}
          </button>
        </form>
        {state === 'sent' && <p role='status'>Confira seu email</p>}
        {state === 'error' && (
          <p role='alert'>Não foi possível enviar o link. Tente novamente.</p>
        )}
        <small>Acesso privado. Apenas o proprietário pode entrar.</small>
      </section>
    </main>
  );
}
export function App() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [denied, setDenied] = useState(false);
  const cache = useQueryClient();
  const loc = useLocation();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) cache.clear();
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [cache]);
  const owner = useQuery({
    queryKey: ['owner', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () =>
      check(await supabase.rpc('is_property_owner')) as boolean,
  });
  useEffect(() => {
    if (session && owner.data === false) {
      setDenied(true);
      void supabase.auth.signOut();
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
        <Loading />
      </main>
    );
  }
  if (session && owner.isError) {
    return (
      <main>
        <Failure retry={() => void owner.refetch()} />
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
    return <Login session={null} denied={denied} />;
  }
  if (loc.pathname === '/login') {
    return <Login session={session} denied={false} />;
  }
  return (
    <div className='shell'>
      <aside>
        <Link className='brand' to='/'>
          ⌂ <b>Casa Radar</b>
        </Link>
        <span className='eyebrow'>SUA BUSCA, EM UM LUGAR</span>
        <nav>
          {[['/', 'Visão geral', '◫'], ['/imoveis', 'Imóveis', '⌂'], [
            '/buscas',
            'Minhas buscas',
            '⌕',
          ], ['/execucoes', 'Execuções', '↻']].map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <span aria-hidden='true'>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className='sidebar-bottom'>
          <span className='dot' /> Seu radar pessoal<br />
          <small>Brasília · DF</small>
        </div>
      </aside>
      <div className='workspace'>
        <header>
          <span>SEU PRÓXIMO ENDEREÇO</span>
          <div className='header-actions'>
            <CollectButton />
            <button
              type='button'
              className='quiet'
              onClick={() => void supabase.auth.signOut()}
            >
              Sair
            </button>
          </div>
        </header>
        <main>
          <Routes>
            <Route path='/' element={<Dashboard />} />
            <Route path='/imoveis' element={<Listings />} />
            <Route path='/imoveis/:encodedLink' element={<ListingDetail />} />
            <Route path='/buscas' element={<Searches />} />
            <Route path='/execucoes' element={<Runs />} />
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </main>
        <footer>
          CASA RADAR <span>Feito para encontrar boas possibilidades.</span>
        </footer>
      </div>
    </div>
  );
}
function CollectButton() {
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const key = useRef(crypto.randomUUID());
  const cache = useQueryClient();
  return (
    <div className='collect'>
      <button
        type='button'
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const p = await profiles();
            const r = check(
              await supabase.rpc('enqueue_property_crawl', {
                request_key: key.current,
                profile_ids: p.filter((x) => x.enabled).map((x) => x.id),
              }),
            );
            setMessage(
              r.outcome === 'rate_limited'
                ? `Aguarde ${r.retry_after_seconds}s`
                : r.outcome === 'busy'
                ? 'Já existe uma coleta pendente'
                : 'Coleta solicitada',
            );
            if (r.outcome === 'accepted' || r.outcome === 'replayed') {
              key
                .current = crypto.randomUUID();
            }
            void cache.invalidateQueries({ queryKey: ['runs'] });
          } catch {
            setMessage('Não foi possível solicitar. Verifique suas buscas.');
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? 'Solicitando…' : '↻ Coletar agora'}
      </button>
      {message && (
        <span role='status'>
          {message} <Link to='/execucoes'>Ver execuções</Link>
        </span>
      )}
    </div>
  );
}
