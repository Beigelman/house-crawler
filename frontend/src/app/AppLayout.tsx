import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CollectButton } from '../features/runs/CollectButton';
import { signOut } from '../features/auth/auth.api';
export function AppLayout({ children }: { children: ReactNode }) {
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
              onClick={() => void signOut()}
            >
              Sair
            </button>
          </div>
        </header>
        <main>
          {children}
        </main>
        <footer>
          CASA RADAR <span>Feito para encontrar boas possibilidades.</span>
        </footer>
      </div>
    </div>
  );
}
