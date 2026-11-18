import { useState } from 'react';
import type { Profile } from '../../../../shared/property.ts';
import { saveProfile } from './searches.api';
export function SearchProfileForm(
  { initial, saved }: { initial: Profile; saved: () => void },
) {
  const [p, setP] = useState(initial);
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const set = (key: string, value: unknown) =>
    setP({ ...p, params: { ...p.params, [key]: value } });
  return (
    <form
      className='panel profile'
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await saveProfile(p);
          setMessage('Busca salva');
          saved();
        } catch {
          setMessage(
            'Não foi possível salvar. Confira os campos e os limites.',
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div className='form-grid'>
        <label>
          Nome da busca<input
            required
            maxLength={80}
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <label>
          Bairros<input
            required
            aria-label='Bairros'
            value={p.params.neighborhoods.join(',')}
            onChange={(e) =>
              set(
                'neighborhoods',
                e.target.value.split(',').map((x) => x.trim()),
              )}
          />
          <small>asa-norte, asa-sul, octogonal</small>
        </label>
        <label>
          Quartos<input
            required
            value={p.params.numberOfRooms.join(',')}
            onChange={(e) =>
              set('numberOfRooms', e.target.value.split(',').map(Number))}
          />
        </label>
        {[
          ['numberOfSuites', 'Suítes mínimas'],
          ['minArea', 'Área mínima'],
          ['maxArea', 'Área máxima'],
          ['minPrice', 'Preço mínimo'],
          ['maxPrice', 'Preço máximo'],
        ].map(([k, l]) => (
          <label key={k}>
            {l}
            <input
              type='number'
              required
              min={0}
              step={k === 'numberOfSuites' ? 1 : 'any'}
              value={p.params[k as keyof typeof p.params] as number}
              onChange={(e) => set(k, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <div className='toggles'>
        {[['hasElevator', 'Exigir elevador'], ['hasParking', 'Exigir vaga']]
          .map(([k, l]) => (
            <label key={k}>
              <input
                type='checkbox'
                checked={Boolean(p.params[k as keyof typeof p.params])}
                onChange={(e) => set(k, e.target.checked)}
              />
              {l}
            </label>
          ))}
        {[['dfimoveis', 'DF Imóveis'], ['wimoveis', 'Wimoveis']].map((
          [v, l],
        ) => (
          <label key={v}>
            <input
              type='checkbox'
              checked={p.providers.includes(v)}
              onChange={(e) =>
                setP({
                  ...p,
                  providers: e.target.checked
                    ? [...p.providers, v]
                    : p.providers.filter((x) => x !== v),
                })}
            />
            {l}
          </label>
        ))}
        <label>
          <input
            type='checkbox'
            checked={p.enabled}
            onChange={(e) => setP({ ...p, enabled: e.target.checked })}
          />Busca ativa
        </label>
      </div>
      <button type='submit' disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar busca'}
      </button>
      {message && (
        <span role={message === 'Busca salva' ? 'status' : 'alert'}>
          {message}
        </span>
      )}
    </form>
  );
}
