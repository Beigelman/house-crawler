import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '../../../../shared/database.types';
import { date, source } from '../../lib/formatters';
import { getRuns } from './runs.api';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { PageHeading } from '../../components/PageHeading';
import { Icon } from '../../components/Icon';

type SourceSummary =
  Database['public']['Views']['crawl_run_source_summaries']['Row'];

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
        title='Execuções'
        description='Acompanhe as coletas, as validações e os resultados de cada fonte.'
      />
      {runsQuery.data.activeJobs.map((r) => (
        <div className='panel active-run' key={r.id}>
          <span className='icon-tile'>
            <Icon name='pulse' />
          </span>
          <span>
            Solicitação <small>{r.id}</small>
          </span>
          <span className='badge' data-status={r.state}>{r.state}</span>
        </div>
      ))}
      {!runsQuery.data.jobs.length
        ? <EmptyState>Sem execuções</EmptyState>
        : (
          <div className='runs'>
            {runsQuery.data.jobs.map((r) => (
              <article key={r.id} className='panel'>
                <button
                  type='button'
                  className='run-heading'
                  onClick={() =>
                    setSelected(selected === r.id ? null : r.id)}
                  aria-expanded={selected === r.id}
                >
                  <span className='icon-tile'>
                    <Icon name='history' />
                  </span>
                  <span className='run-title'>
                    <strong>
                      {r.kind === 'validate' ? 'Validação' : 'Coleta'}
                    </strong>
                    <span>{date(r.started_at)}</span>
                  </span>
                  <b className='badge' data-status={r.state}>{r.state}</b>
                  <Icon name='chevron' />
                </button>
                <small>{r.id}</small>
                <p>Fim: {date(r.finished_at)} · Email: {r.email_state}</p>
                {r.crawl_run_source_summaries.map((s: SourceSummary) => {
                  const count = s.count ?? 0;
                  const inconclusive = s.inconclusive ?? 0;
                  const listingLabel = count === 1 ? 'anúncio' : 'anúncios';
                  const inconclusiveLabel = inconclusive === 1
                    ? 'inconclusivo'
                    : 'inconclusivos';
                  const outcome = r.kind === 'validate'
                    ? `${
                      inconclusive.toLocaleString('pt-BR')
                    } ${inconclusiveLabel}`
                    : [s.outcome, s.error_category].filter(Boolean).join(' ');
                  return (
                    <div className='source-row' key={s.id}>
                      <span>{source(s.source)}</span>
                      <span>
                        {count.toLocaleString('pt-BR')} {listingLabel} ·{' '}
                        {outcome}
                      </span>
                    </div>
                  );
                })}
                {selected === r.id && (
                  <pre>{JSON.stringify(r.search_snapshot,null,2)}</pre>
                )}
              </article>
            ))}
          </div>
        )}
    </>
  );
}
