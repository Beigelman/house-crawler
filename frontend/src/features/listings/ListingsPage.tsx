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

  function goToPage(target: number) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('page', String(target));
    setParams(nextParams);
    globalThis.scrollTo(0, 0);
  }

  if (listingsQuery.isPending) {
    content = <LoadingState />;
  } else if (listingsQuery.isError) {
    content = <ErrorState retry={() => void listingsQuery.refetch()} />;
  } else if (!listingsQuery.data.rows.length) {
    content = <EmptyState>Nenhum imóvel encontrado</EmptyState>;
  } else {
    const { rows, count, page, totalPages } = listingsQuery.data;
    const visiblePageCount = Math.min(6, totalPages);
    const firstVisiblePage = Math.min(page, totalPages - visiblePageCount + 1);
    const visiblePages = Array.from(
      { length: visiblePageCount },
      (_, index) => firstVisiblePage + index,
    );

    content = (
      <>
        <div className='results-line'>
          <h2>
            {count.toLocaleString('pt-BR')}{' '}
            {count === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
          </h2>
        </div>
        <div className='listing-grid'>
          {rows.map((listing) => (
            <ListingCard key={listing.url} listing={listing} />
          ))}
        </div>
        <nav className='pagination' aria-label='Paginação de imóveis'>
          <p>Página {page} de {totalPages}</p>
          {totalPages > 1 && (
            <div className='pagination-controls'>
              <div className='pagination-group'>
                <button
                  type='button'
                  disabled={page === 1}
                  onClick={() => goToPage(1)}
                >
                  Primeira
                </button>
                <button
                  type='button'
                  disabled={page === 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Anterior
                </button>
              </div>
              <div className='pagination-group pagination-pages'>
                {visiblePages.map((number) => (
                  <button
                    key={number}
                    type='button'
                    aria-label={`Página ${number}`}
                    aria-current={number === page ? 'page' : undefined}
                    disabled={number === page}
                    onClick={() => goToPage(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
              <div className='pagination-group'>
                <button
                  type='button'
                  disabled={page === totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Próxima
                </button>
                <button
                  type='button'
                  disabled={page === totalPages}
                  onClick={() => goToPage(totalPages)}
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </nav>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title='Explorar imóveis'
        description='Filtre os anúncios de Brasília e compare os imóveis da sua seleção.'
      />
      <ListingFilters />
      {content}
    </>
  );
}
