import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { CollectButton } from '../features/runs/CollectButton';
import { signOut } from '../features/auth/auth.api';

const navigation = [
  ['/', 'Visão geral', 'dashboard'],
  ['/imoveis', 'Imóveis', 'home'],
  ['/buscas', 'Minhas buscas', 'search'],
  ['/execucoes', 'Execuções', 'history'],
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className='shell'>
      <div className='sidebar'>
        <Link className='brand-link' to='/'>
          <Brand />
        </Link>
        <nav className='app-nav' aria-label='Navegação principal'>
          {navigation.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className='workspace'>
        <header className='topbar'>
          <span className='workspace-location'>
            <Icon name='pin' /> Brasília, DF
          </span>
          <div className='header-actions'>
            <CollectButton />
            <button
              type='button'
              className='quiet'
              onClick={() => void signOut()}
            >
              <Icon name='logout' />
              Sair
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
