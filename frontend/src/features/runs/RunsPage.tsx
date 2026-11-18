import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { date, source } from '../../lib/formatters';
import { getRuns } from './runs.api';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { PageHeading } from '../../components/PageHeading';
export function RunsPage() {
  const runsQuery = useQuery({
    queryKey: ['runs'],
    refetchInterval: 10000,
    queryFn: getRuns,
  });
  const [selected, setSelected] = useState<string | null>(null);
  if (runsQuery.isPending) return <LoadingState />;
  if (runsQuery.isError) {
    return <ErrorState retry={() => void runsQuery.refetch()} />;
  }
  return (
    <>
      <PageHeading
        title='Seu radar, em movimento.'
        description='Cada coleta tem uma história. Acompanhe por aqui.'
      />
      {runsQuery.data.requests.map((r) => (
        <p className='panel' key={r.id}>Solicitação {r.id} · {r.state}</p>
      ))}
      {!runsQuery.data.runs.length
        ? <EmptyState>Sem execuções</EmptyState>
        : (
          <div className='runs'>
            {runsQuery.data.runs.map((r) => (
              <article key={r.id} className='panel'>
                <button
                  type='button'
                  className='run-heading'
                  onClick={() =>
                    setSelected(selected === r.id ? null : r.id)}
                  aria-expanded={selected === r.id}
                >
                  <span>{date(r.started_at)}</span>
                  <b>{r.state}</b>
                  <span>{r.kind === 'validate' ? 'Validação' : 'Coleta'}</span>
                </button>
                <small>{r.id}</small>
                <p>Fim: {date(r.finished_at)} · Email: {r.email_state}</p>
                {r.property_source_run.map((
                  s: {
                    id: number;
                    source: string;
                    count: number;
                    outcome: string;
                    error_category: string | null;
                  },
                ) => (
                  <div className='source-row' key={s.id}>
                    <span>{source(s.source)}</span>
                    <span>
                      {s.count} anúncios · {s.outcome} {s.error_category}
                    </span>
                  </div>
                ))}
                {selected === r.id && (
                  <pre>{JSON.stringify(r.profiles,null,2)}</pre>
                )}
              </article>
            ))}
          </div>
        )}
    </>
  );
}
