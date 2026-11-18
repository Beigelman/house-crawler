import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboard } from './dashboard.api';
import { date } from '../../lib/formatters';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { PageHeading } from '../../components/PageHeading';
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
  const dashboardData = dashboardQuery.data;
  const online = dashboardData.heartbeat &&
    Date.now() - new Date(dashboardData.heartbeat).getTime() <= 120000;
  return (
    <>
      <PageHeading
        title='Um novo olhar para sua busca.'
        description='Acompanhe o que chegou. Guarde o que faz sentido.'
      />
      <div className='stats'>
        <article>
          <span>Imóveis ativos</span>
          <strong>{dashboardData.active}</strong>
          <small>Na sua coleção</small>
        </article>
        <article>
          <span>Novos em 7 dias</span>
          <strong>{dashboardData.recent}</strong>
          <small>Possibilidades para explorar</small>
        </article>
        <article>
          <span>Seu coletor</span>
          <strong className='status-text'>
            {online ? 'Online' : 'Offline'}
          </strong>
          <small>
            {dashboardData.heartbeat
              ? 'Visto em ' + date(dashboardData.heartbeat)
              : 'Nunca conectado'}
          </small>
        </article>
      </div>
      <div className='dashboard-grid'>
        <section className='panel welcome'>
          <span className='eyebrow'>PRÓXIMO PASSO</span>
          <h2>
            Seu próximo endereço<br />pode estar aqui.
          </h2>
          <p>Compare os anúncios e mantenha suas escolhas por perto.</p>
          <Link className='button primary' to='/imoveis'>
            Explorar imóveis →
          </Link>
        </section>
        <section className='panel'>
          <h2>De onde vêm os anúncios</h2>
          <div className='source-row'>
            <span>DF Imóveis</span>
            <b>{dashboardData.df}</b>
          </div>
          <div className='source-row'>
            <span>Wimoveis</span>
            <b>{dashboardData.wi}</b>
          </div>
          <h3>Última execução</h3>
          <p>{dashboardData.run ? dashboardData.run.state : 'Sem execuções'}</p>
          <Link to='/execucoes'>Ver histórico →</Link>
        </section>
      </div>
      {dashboardData.active === 0 && (
        <EmptyState>Nenhum imóvel coletado</EmptyState>
      )}
    </>
  );
}
