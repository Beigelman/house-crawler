import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { sendLoginLink, signInWithPassword } from './auth.api';

export function LoginPage({ session }: { session: Session | null }) {
  const [usePassword, setUsePassword] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'sent' | 'error'>(
    'idle',
  );
  const [params] = useSearchParams();
  const next = params.get('next');
  const target = next?.startsWith('/') && !next.startsWith('//') &&
      !next.startsWith('/login')
    ? next
    : '/';
  if (session) return <Navigate to={target} replace />;
  return (
    <main className='login'>
      <section className='login-form' aria-labelledby='login-title'>
        <Brand />
        <h1 id='login-title'>Bem-vindo de volta</h1>
        <p>
          {usePassword
            ? 'Acesse seu painel com seu email e senha.'
            : 'Acesse seu painel com um link enviado por email.'}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (state === 'submitting') return;
            const fields = new FormData(e.currentTarget);
            const email = String(fields.get('email')).trim();
            setState('submitting');
            try {
              if (usePassword) {
                const { error } = await signInWithPassword(
                  email,
                  String(fields.get('password')),
                );
                if (error) setState('error');
              } else {
                const { error } = await sendLoginLink(email, target);
                setState(error ? 'error' : 'sent');
              }
            } catch {
              setState('error');
            }
          }}
        >
          <label>
            Email<input
              name='email'
              type='email'
              autoComplete={usePassword ? 'username' : 'email'}
              required
            />
          </label>
          {usePassword && (
            <label>
              Senha<input
                name='password'
                type='password'
                autoComplete='current-password'
                required
              />
            </label>
          )}
          <button
            type='submit'
            className='primary'
            disabled={state === 'submitting'}
          >
            {usePassword
              ? (state === 'submitting' ? 'Entrando…' : 'Entrar')
              : (state === 'submitting'
                ? 'Enviando link…'
                : 'Enviar link de acesso')}
          </button>
          <button
            type='button'
            className='quiet'
            disabled={state === 'submitting'}
            onClick={() => {
              setUsePassword(!usePassword);
              setState('idle');
            }}
          >
            {usePassword ? 'Usar link por email' : 'Entrar com senha'}
          </button>
        </form>
        {state === 'sent' && <p role='status'>Confira seu email</p>}
        {state === 'error' && (
          <p role='alert'>
            {usePassword
              ? 'Não foi possível entrar. Confira seu email e senha e tente novamente.'
              : 'Não foi possível enviar o link. Tente novamente.'}
          </p>
        )}
        <small>Use uma conta criada pelo administrador.</small>
      </section>
      <div className='login-story'>
        <img
          src='/assets/brasilia-modernist.avif'
          alt=''
          fetchPriority='high'
        />
        <div className='login-caption'>
          <span>Brasília, DF</span>
          <p>Um lugar para encontrar o seu.</p>
        </div>
      </div>
    </main>
  );
}
