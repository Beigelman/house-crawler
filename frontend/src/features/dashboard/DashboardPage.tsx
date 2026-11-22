import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboard } from './dashboard.api';
import { date } from '../../lib/formatters';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { PageHeading } from '../../components/PageHeading';
import { Icon } from '../../components/Icon';

const number = new Intl.NumberFormat('pt-BR');

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboard,
    refetchInterval: 30000,
  });
  if (dashboardQuery.isPending) return <LoadingState />;
  if (dashboardQuery.isError) {
    return <ErrorState retry={() => void dashboardQuery.refetch()} />;
  }

  const { active, recent, df, wi, run, heartbeat } = dashboardQuery.data;
  const online = heartbeat &&
    Date.now() - new Date(heartbeat).getTime() <= 120000;
  const sources = [['DF Imóveis', df], ['Wimoveis', wi]] as const;
  const sourceTotal = df + wi;

  return (
    <>
      <PageHeading
        title='Visão geral'
        description='Acompanhe seus anúncios e as últimas coletas.'
      />
      <section
        className='dashboard-hero'
        aria-labelledby='dashboard-hero-title'
      >
        <div className='hero-content'>
          <h2 id='dashboard-hero-title'>Encontre seu próximo endereço.</h2>
          <p>Explore os anúncios de Brasília reunidos pelo seu radar.</p>
          <Link className='button' to='/imoveis'>
            Explorar imóveis <Icon name='arrow' />
          </Link>
        </div>
        <img src='/assets/brasilia-modernist.avif' alt='' fetchPriority='high' />
      </section>
      <div className='stats'>
        <article className='panel'>
          <span className='icon-tile'>
            <Icon name='home' />
          </span>
          <div>
            <span>Imóveis ativos</span>
            <strong>{number.format(active)}</strong>
          </div>
        </article>
        <article className='panel'>
          <span className='icon-tile'>
            <Icon name='spark' />
          </span>
          <div>
            <span>Novos em 7 dias</span>
            <strong>{number.format(recent)}</strong>
          </div>
        </article>
        <article className='panel'>
          <span className='icon-tile'>
            <Icon name='pulse' />
          </span>
          <div>
            <span>Coletor</span>
            <strong className='status-text' data-online={Boolean(online)}>
              {online ? 'Online' : 'Offline'}
            </strong>
            <small>
              {heartbeat ? 'Visto em ' + date(heartbeat) : 'Nunca conectado'}
            </small>
          </div>
        </article>
      </div>
      <div className='dashboard-grid'>
        <section className='panel'>
          <h2>Anúncios por fonte</h2>
          {sources.map(([label, count]) => (
            <div className='source-breakdown' key={label}>
              <div className='source-row'>
                <span>{label}</span>
                <b>{number.format(count)}</b>
              </div>
              <div className='source-track' aria-hidden='true'>
                <span
                  style={{
                    width: sourceTotal ? `${count / sourceTotal * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          ))}
        </section>
        <section className='panel last-run'>
          <h2>Última execução</h2>
          {run
            ? (
              <>
                <strong>{run.state}</strong>
                <p>{date(run.started_at)}</p>
              </>
            )
            : <p>Sem execuções</p>}
          <Link className='text-action' to='/execucoes'>
            Ver histórico <Icon name='arrow' />
          </Link>
        </section>
      </div>
      {active === 0 && <EmptyState>Nenhum imóvel coletado</EmptyState>}
    </>
  );
}
