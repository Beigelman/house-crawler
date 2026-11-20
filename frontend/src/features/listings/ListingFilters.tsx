import { useSearchParams } from 'react-router-dom';

const fields = [
  ['q', 'Buscar por título', 'text'],
  ['source', 'Fonte', 'source'],
  ['minPrice', 'Preço mínimo', 'number'],
  ['maxPrice', 'Preço máximo', 'number'],
  ['minArea', 'Área mínima', 'number'],
  ['maxArea', 'Área máxima', 'number'],
  ['bedrooms', 'Quartos', 'number'],
  ['neighborhood', 'Bairro', 'neighborhood'],
  ['since', 'A partir de', 'date'],
  ['availability', 'Disponibilidade', 'availability'],
  ['mark', 'Minha seleção', 'mark'],
  ['sort', 'Ordenar', 'sort'],
] as const;

const options: Record<string, [string, string][]> = {
  source: [['wimoveis', 'Wimoveis'], ['dfimoveis', 'DF Imóveis']],
  neighborhood: [['asa-norte', 'Asa Norte'], ['asa-sul', 'Asa Sul'], [
    'octogonal',
    'Octogonal',
  ]],
  availability: [['active', 'Ativo'], ['removed', 'Removido'], [
    'unknown',
    'Não verificado',
  ]],
  mark: [['favorite', 'Favorito'], ['contacted', 'Contatado'], [
    'discarded',
    'Descartado',
  ]],
  sort: [['newest', 'Mais recentes'], ['price_asc', 'Menor preço'], [
    'price_desc',
    'Maior preço',
  ], ['opportunity', 'Oportunidades']],
};

export function ListingFilters() {
  const [params, setParams] = useSearchParams();
  return (
    <section className='filters panel'>
      {fields.map(([key, label, type]) => (
        <label key={key}>
          {label}
          {options[type]
            ? (
              <select
                aria-label={label}
                value={params.get(key) || ''}
                onChange={(e) => {
                  const p = new URLSearchParams(params);
                  e.target.value ? p.set(key, e.target.value) : p.delete(key);
                  p.delete('page');
                  setParams(p);
                }}
              >
                <option value=''>
                  {type === 'sort' ? 'Mais recentes' : 'Todos'}
                </option>
                {options[type].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            )
            : (
              <input
                aria-label={label}
                type={type}
                min={type === 'number' ? 0 : undefined}
                value={params.get(key) || ''}
                onChange={(e) => {
                  const p = new URLSearchParams(params);
                  e.target.value ? p.set(key, e.target.value) : p.delete(key);
                  p.delete('page');
                  setParams(p);
                }}
              />
            )}
        </label>
      ))}
    </section>
  );
}
