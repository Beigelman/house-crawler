import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';

const fields = [
  ['q', 'Buscar por título', 'text'],
  ['neighborhood', 'Bairro', 'neighborhood'],
  ['source', 'Fonte', 'source'],
  ['sort', 'Ordenar', 'sort'],
] as const;

const secondaryFields = [
  ['minPrice', 'Preço mínimo', 'number'],
  ['maxPrice', 'Preço máximo', 'number'],
  ['minArea', 'Área mínima', 'number'],
  ['maxArea', 'Área máxima', 'number'],
  ['bedrooms', 'Quartos', 'number'],
  ['since', 'A partir de', 'date'],
  ['availability', 'Disponibilidade', 'availability'],
  ['mark', 'Minha seleção', 'mark'],
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
  const [expanded, setExpanded] = useState(false);
  const selected = secondaryFields.filter(([key]) => params.get(key)).length;

  function updateFilter(key: string, value: string) {
    const nextParams = new URLSearchParams(params);
    if (value) nextParams.set(key, value);
    else nextParams.delete(key);
    nextParams.delete('page');
    setParams(nextParams);
  }

  function renderFields(group: typeof fields | typeof secondaryFields) {
    return group.map(([key, label, type]) => (
      <label key={key}>
        {label}
        {options[type]
          ? (
            <select
              aria-label={label}
              value={params.get(key) || ''}
              onChange={(e) => updateFilter(key, e.target.value)}
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
              placeholder={key === 'q' ? 'Ex. com varanda' : undefined}
              min={type === 'number' ? 0 : undefined}
              value={params.get(key) || ''}
              onChange={(e) => updateFilter(key, e.target.value)}
            />
          )}
      </label>
    ));
  }

  return (
    <section className='panel' aria-labelledby='listing-filters-title'>
      <h2 className='filter-heading' id='listing-filters-title'>
        <Icon name='sliders' /> Filtros
      </h2>
      <div className='filters'>{renderFields(fields)}</div>
      <button
        type='button'
        className='filter-toggle quiet'
        aria-expanded={expanded}
        aria-controls='secondary-listing-filters'
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? 'Menos filtros' : 'Mais filtros'}
        {selected > 0 ? ` (${selected} em uso)` : ''}
        <Icon name='chevron' />
      </button>
      <div
        className='filters filter-secondary'
        id='secondary-listing-filters'
        data-expanded={expanded}
      >
        {renderFields(secondaryFields)}
      </div>
    </section>
  );
}
