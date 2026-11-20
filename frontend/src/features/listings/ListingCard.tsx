import { Link } from 'react-router-dom';
import type { Listing } from '../../../../shared/property.ts';
import { money, source } from '../../lib/formatters';
import { PropertyPhoto } from './PropertyPhoto';

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article data-listing className='listing-card'>
      <Link to={'/imoveis/' + encodeURIComponent(listing.url)}>
        <PropertyPhoto url={listing.photo_url} />
        <div className='listing-body'>
          <div className='card-top'>
            <small>{source(listing.source)}</small>
            <span className='badge'>
              {listing.availability === 'active'
                ? 'Ativo'
                : listing.availability === 'removed'
                ? 'Removido'
                : 'Não verificado'}
            </span>
          </div>
          <h2>{money(listing.price_cents)}</h2>
          <h3>{listing.title}</h3>
          <p>{listing.neighborhood || 'Não informado'}</p>
          <div className='listing-meta'>
            <span>{listing.area_m2 ?? '—'} m²</span>
            <span>{listing.bedrooms ?? '—'} quartos</span>
          </div>
          {listing.discount_pct != null && (
            <small className='deal'>
              {Math.abs(Number(listing.discount_pct)).toFixed(1)}%{' '}
              {Number(listing.discount_pct) >= 0 ? 'abaixo' : 'acima'}{' '}
              da mediana coletada
            </small>
          )}
        </div>
      </Link>
    </article>
  );
}
