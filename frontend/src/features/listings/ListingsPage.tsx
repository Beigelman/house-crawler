import { useSearchParams } from 'react-router-dom';
import { useListings } from './listings.queries';
import { ListingFilters } from './ListingFilters';
import { ListingCard } from './ListingCard';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { PageHeading } from '../../components/PageHeading';

export function ListingsPage() {
  const [params, setParams] = useSearchParams();
  const listingsQuery = useListings(params);
  let content;

  if (listingsQuery.isPending) {
    content = <LoadingState />;
  } else if (listingsQuery.isError) {
    content = <ErrorState retry={() => void listingsQuery.refetch()} />;
  } else if (!listingsQuery.data.rows.length) {
    content = <EmptyState>Nenhum imóvel encontrado</EmptyState>;
  } else {
    content = (
      <>
        <div className='results-line'>
          <b>{listingsQuery.data.count} possibilidades</b>
          <span>Uma escolha de cada vez.</span>
        </div>
        <div className='listing-grid'>
          {listingsQuery.data.rows.map((listing) => (
            <ListingCard key={listing.url} listing={listing} />
          ))}
        </div>
        <div className='pagination'>
          <button
            type='button'
            disabled={listingsQuery.data.page === 1}
            onClick={() => {
              params.set('page', String(listingsQuery.data.page - 1));
              setParams(params);
            }}
          >
            Anterior
          </button>
          <span>Página {listingsQuery.data.page}</span>
          <button
            type='button'
            disabled={listingsQuery.data.page * 30 >=
              listingsQuery.data.count}
            onClick={() => {
              params.set('page', String(listingsQuery.data.page + 1));
              setParams(params);
            }}
          >
            Próxima
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title='Imóveis, no seu ritmo.'
        description='Filtre, compare e encontre o que combina com você.'
      />
      <ListingFilters />
      {content}
    </>
  );
}
