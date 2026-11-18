import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className='state'>
      <h2>{children}</h2>
      <p>Seu próximo imóvel começa com uma boa busca.</p>
      <Link className='button' to='/buscas'>Gerenciar buscas</Link>
    </div>
  );
}
