import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueCollection } from './runs.api';
import { Icon } from '../../components/Icon';

export function CollectButton() {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const key = useRef(crypto.randomUUID());
  const cache = useQueryClient();
  return (
    <div className='collect'>
      <button
        type='button'
        className='primary'
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const requestResult = await enqueueCollection(key.current);
            setMessage(
              requestResult.outcome === 'rate_limited'
                ? `Aguarde ${requestResult.retry_after_seconds}s`
                : requestResult.outcome === 'busy'
                ? 'Já existe uma coleta pendente'
                : 'Coleta solicitada',
            );
            if (
              requestResult.outcome === 'accepted' ||
              requestResult.outcome === 'replayed'
            ) {
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
        <Icon name='refresh' /> {pending ? 'Solicitando…' : 'Coletar agora'}
      </button>
      {message && (
        <span role='status'>
          {message} <Link to='/execucoes'>Ver execuções</Link>
        </span>
      )}
    </div>
  );
}
