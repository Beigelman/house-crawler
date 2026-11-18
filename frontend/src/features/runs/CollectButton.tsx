import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueCollection } from './runs.api';
export function CollectButton() {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
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
            const r = await enqueueCollection(key.current);
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
