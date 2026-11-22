import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className='state'>
      <span className='icon-tile'>
        <Icon name='search' />
      </span>
      <h2>{children}</h2>
      <Link className='button' to='/buscas'>Gerenciar buscas</Link>
    </div>
  );
}
