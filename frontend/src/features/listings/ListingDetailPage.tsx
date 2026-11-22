import { Link, useParams } from 'react-router-dom';
import { date, money, source } from '../../lib/formatters';
import { PropertyPhoto } from './PropertyPhoto';
import { PropertyMarkForm } from './PropertyMarkForm';
import { useListingDetail } from './listings.queries';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { PageHeading } from '../../components/PageHeading';
import { Icon } from '../../components/Icon';

export function ListingDetailPage() {
  const { encodedLink = '' } = useParams();
  const url = encodedLink;
  const detailQuery = useListingDetail(url);
  if (detailQuery.isPending) return <LoadingState />;
  if (detailQuery.isError) {
    return <ErrorState retry={() => void detailQuery.refetch()} />;
  }
  if (!detailQuery.data.listing) {
    return (
      <div className='state'>
        <h1>Imóvel não encontrado</h1>
        <Link to='/imoveis'>Voltar aos imóveis</Link>
      </div>
    );
  }
  const listing = detailQuery.data.listing;
  return (
    <>
      <Link className='back text-action' to='/imoveis'>
        <Icon name='back' /> Voltar aos imóveis
      </Link>
      <PageHeading
        title={listing.title}
        description={listing.neighborhood || 'Não informado'}
        kicker={source(listing.source)}
      />
      <div className='detail-grid'>
        <section className='panel detail-property'>
          <PropertyPhoto url={listing.photo_url} alt={listing.title} eager />
          <div className='detail-property-body'>
            <h2>{money(listing.price_cents)}</h2>
            <dl>
              {[
                ['Área', listing.area_m2 ? `${listing.area_m2} m²` : null],
                ['Quartos', listing.bedrooms],
                ['Suítes', listing.suites],
                [
                  'Elevador',
                  listing.has_elevator == null
                    ? null
                    : listing.has_elevator
                    ? 'Sim'
                    : 'Não',
                ],
                [
                  'Vaga',
                  listing.has_parking == null
                    ? null
                    : listing.has_parking
                    ? 'Sim'
                    : 'Não',
                ],
                ['Primeira coleta', date(listing.first_seen_at)],
                ['Última coleta', date(listing.last_seen_at)],
                ['Preço observado em', date(listing.price_observed_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value ?? 'Não informado'}</dd>
                </div>
              ))}
            </dl>
            <a
              className='button primary'
              href={listing.url}
              target='_blank'
              rel='noopener noreferrer'
            >
              Abrir anúncio original <Icon name='external' />
            </a>
          </div>
        </section>
        <div className='detail-side'>
          <PropertyMarkForm
            listingId={listing.id}
            value={detailQuery.data.mark}
            onSave={() => void detailQuery.refetch()}
          />
          <section className='panel'>
            <h2>Como esse preço se compara?</h2>
            <p>Preços pedidos dos anúncios coletados</p>
            {listing.median_m2 != null && listing.discount_pct != null
              ? (
                <>
                  <strong className='price'>
                    {Math.abs(Number(listing.discount_pct)).toFixed(1)}%{' '}
                    {Number(listing.discount_pct) >= 0 ? 'abaixo' : 'acima'}
                    {' '}
                    da mediana
                  </strong>
                  <p>
                    {money(Number(listing.median_m2) * 100)}/m² ·{' '}
                    {listing.peer_count} anúncios
                  </p>
                  <p>{listing.cohort}</p>
                </>
              )
              : <p>Dados insuficientes</p>}
            <small>Comparação calculada em {date(listing.comparison_at)}</small>
          </section>
          <section className='panel'>
            <h2>Histórico de preço</h2>
            {detailQuery.data.history?.length
              ? detailQuery.data.history.map((h) => (
                <div className='history-row' data-price-observation key={h.id}>
                  <span>
                    {date(h.seen_at)}
                  </span>
                  <b>{money(h.price_cents)}</b>
                </div>
              ))
              : <p>Sem alterações registradas.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
