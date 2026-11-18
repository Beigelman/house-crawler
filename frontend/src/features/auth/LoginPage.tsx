import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Navigate, useSearchParams } from 'react-router-dom';
import { sendLoginLink } from './auth.api';

export function LoginPage(
  { session, denied }: { session: Session | null; denied: boolean },
) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
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
            const { error } = await sendLoginLink(email, target);
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
