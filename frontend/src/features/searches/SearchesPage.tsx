import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Profile } from '../../../../backend/src/property/model.ts';
import { profiles } from './searches.api';
import { SearchProfileForm } from './SearchProfileForm';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { PageHeading } from '../../components/PageHeading';
export function SearchesPage() {
  const profilesQuery = useQuery({ queryKey: ['profiles'], queryFn: profiles });
  const [draft, setDraft] = useState<Profile | null>(null);
  if (profilesQuery.isPending) return <LoadingState />;
  if (profilesQuery.isError) {
    return <ErrorState retry={() => void profilesQuery.refetch()} />;
  }
  return (
    <>
      <PageHeading
        title='Buscas que combinam com você.'
        description='Defina o que importa. Seu radar cuida do resto.'
      />
      <button
        type='button'
        className='primary'
        onClick={() =>
          setDraft({
            id: crypto.randomUUID(),
            name: 'Nova busca',
            enabled: true,
            providers: ['wimoveis', 'dfimoveis'],
            params: {
              neighborhoods: ['asa-norte'],
              numberOfRooms: [3],
              numberOfSuites: 0,
              minArea: 90,
              maxArea: 150,
              minPrice: 1000000,
              maxPrice: 1400000,
              hasElevator: false,
              hasParking: false,
            },
          })}
      >
        ＋ Nova busca
      </button>
      {!profilesQuery.data.length && !draft && (
        <EmptyState>Nenhuma busca salva</EmptyState>
      )}
      <div className='profiles'>
        {draft && (
          <SearchProfileForm
            key={draft.id}
            initial={draft}
            saved={() => {
              setDraft(null);
              void profilesQuery.refetch();
            }}
          />
        )}
        {profilesQuery.data.map((p) => (
          <SearchProfileForm
            key={p.id}
            initial={p}
            saved={() => void profilesQuery.refetch()}
          />
        ))}
      </div>
    </>
  );
}
