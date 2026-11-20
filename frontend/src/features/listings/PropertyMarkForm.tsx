import { useEffect, useState } from 'react';
import { savePropertyMark } from './listings.api';

export function PropertyMarkForm(
  { listingId, value, onSave }: {
    listingId: string;
    value: { status: string | null; note: string | null } | null;
    onSave: () => void;
  },
) {
  const [status, setStatus] = useState(value?.status || '');
  const [note, setNote] = useState(value?.note || '');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setStatus(value?.status || '');
    setNote(value?.note || '');
  }, [value]);
  return (
    <section className='panel'>
      <h2>Seu olhar sobre o imóvel</h2>
      <label>
        Status do imóvel<select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value=''>Sem seleção</option>
          <option value='favorite'>Favorito</option>
          <option value='contacted'>Contatado</option>
          <option value='discarded'>Descartado</option>
        </select>
      </label>
      <label>
        Anotações<textarea
          maxLength={2000}
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <small>{note.length}/2000</small>
      <button
        type='button'
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await savePropertyMark(listingId, status, note);
            setMessage('Anotação salva');
            onSave();
          } catch {
            setStatus(value?.status || '');
            setNote(value?.note || '');
            setMessage('Não foi possível salvar a anotação.');
          } finally {
            setPending(false);
          }
        }}
      >
        Salvar anotação
      </button>
      {message && (
        <p role={message === 'Anotação salva' ? 'status' : 'alert'}>
          {message}
        </p>
      )}
    </section>
  );
}
