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
  return (
    <>
      <PageHeading
        title='Imóveis, no seu ritmo.'
        description='Filtre, compare e encontre o que combina com você.'
      />
      <ListingFilters />
      {listingsQuery.isPending
        ? <LoadingState />
        : listingsQuery.isError
        ? <ErrorState retry={() => void listingsQuery.refetch()} />
        : !listingsQuery.data.rows.length
        ? <EmptyState>Nenhum imóvel encontrado</EmptyState>
        : (
          <>
            <div className='results-line'>
              <b>{listingsQuery.data.count} possibilidades</b>
              <span>Uma escolha de cada vez.</span>
            </div>
            <div className='listing-grid'>
              {listingsQuery.data.rows.map((p) => (
                <ListingCard key={p.link} listing={p} />
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
        )}
    </>
  );
}
