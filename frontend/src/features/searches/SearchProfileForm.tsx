import { useState } from 'react';
import type { Profile } from '../../../../shared/property.ts';
import { saveProfile } from './searches.api';

const numericFields = [
  ['numberOfSuites', 'Suítes mínimas'],
  ['minArea', 'Área mínima'],
  ['maxArea', 'Área máxima'],
  ['minPrice', 'Preço mínimo'],
  ['maxPrice', 'Preço máximo'],
] as const;

const amenityFields = [['hasElevator', 'Exigir elevador'], [
  'hasParking',
  'Exigir vaga',
]] as const;

export function SearchProfileForm(
  { initial, saved }: { initial: Profile; saved: () => void },
) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const setParam = <Key extends keyof Profile['params']>(
    key: Key,
    value: Profile['params'][Key],
  ) => setProfile({ ...profile, params: { ...profile.params, [key]: value } });
  return (
    <form
      className='panel profile'
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await saveProfile(profile);
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
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </label>
        <label>
          Bairros<input
            required
            aria-label='Bairros'
            value={profile.params.neighborhoods.join(',')}
            onChange={(e) =>
              setParam(
                'neighborhoods',
                e.target.value.split(',').map((x) => x.trim()),
              )}
          />
          <small>asa-norte, asa-sul, octogonal</small>
        </label>
        <label>
          Quartos<input
            required
            value={profile.params.numberOfRooms.join(',')}
            onChange={(e) =>
              setParam('numberOfRooms', e.target.value.split(',').map(Number))}
          />
        </label>
        {numericFields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type='number'
              required
              min={0}
              step={key === 'numberOfSuites' ? 1 : 'any'}
              value={profile.params[key]}
              onChange={(e) =>
                setParam(
                  key,
                  Number(e.target.value),
                )}
            />
          </label>
        ))}
      </div>
      <div className='toggles'>
        {amenityFields
          .map(([key, label]) => (
            <label key={key}>
              <input
                type='checkbox'
                checked={profile.params[key]}
                onChange={(e) => setParam(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        {[['dfimoveis', 'DF Imóveis'], ['wimoveis', 'Wimoveis']].map((
          [v, l],
        ) => (
          <label key={v}>
            <input
              type='checkbox'
              checked={profile.providers.includes(v)}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  providers: e.target.checked
                    ? [...profile.providers, v]
                    : profile.providers.filter((x) => x !== v),
                })}
            />
            {l}
          </label>
        ))}
        <label>
          <input
            type='checkbox'
            checked={profile.enabled}
            onChange={(e) =>
              setProfile({ ...profile, enabled: e.target.checked })}
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
