import { Icon } from './Icon';

export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className='state' role='alert'>
      <span className='icon-tile'>
        <Icon name='alert' />
      </span>
      <h2>Não foi possível carregar</h2>
      <p>Verifique a conexão e tente novamente.</p>
      <button type='button' onClick={retry}>Tentar novamente</button>
    </div>
  );
}
