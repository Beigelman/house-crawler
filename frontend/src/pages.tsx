import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  browse,
  check,
  dashboard,
  date,
  money,
  profiles,
  supabase,
} from './api';
import { Empty, Failure, Loading } from './App';
import type { Listing, Profile } from '../../src/property/model.ts';
const source = (s: string | null | undefined) =>
  s === 'dfimoveis'
    ? 'DF Imóveis'
    : s === 'wimoveis'
    ? 'Wimoveis'
    : 'Fonte desconhecida';
function Heading(
  { title, description, kicker = 'SEU RADAR' }: {
    title: string;
    description: string;
    kicker?: string;
  },
) {
  return (
    <div className='page-heading'>
      <span className='eyebrow'>{kicker}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function Dashboard() {
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboard,
    refetchInterval: 30000,
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure retry={() => void q.refetch()} />;
  const d = q.data;
  const online = d.heartbeat &&
    Date.now() - new Date(d.heartbeat).getTime() <= 120000;
  return (
    <>
      <Heading
        title='Um novo olhar para sua busca.'
        description='Acompanhe o que chegou. Guarde o que faz sentido.'
      />
      <div className='stats'>
        <article>
          <span>Imóveis ativos</span>
          <strong>{d.active}</strong>
          <small>Na sua coleção</small>
        </article>
        <article>
          <span>Novos em 7 dias</span>
          <strong>{d.recent}</strong>
          <small>Possibilidades para explorar</small>
        </article>
        <article>
          <span>Seu coletor</span>
          <strong className='status-text'>
            {online ? 'Online' : 'Offline'}
          </strong>
          <small>
            {d.heartbeat ? 'Visto em ' + date(d.heartbeat) : 'Nunca conectado'}
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
            <b>{d.df}</b>
          </div>
          <div className='source-row'>
            <span>Wimoveis</span>
            <b>{d.wi}</b>
          </div>
          <h3>Última execução</h3>
          <p>{d.run ? d.run.state : 'Sem execuções'}</p>
          <Link to='/execucoes'>Ver histórico →</Link>
        </section>
      </div>
      {d.active === 0 && <Empty>Nenhum imóvel coletado</Empty>}
    </>
  );
}
const fields = [
  ['q', 'Buscar por título', 'text'],
  ['source', 'Fonte', 'source'],
  ['minPrice', 'Preço mínimo', 'number'],
  ['maxPrice', 'Preço máximo', 'number'],
  ['minArea', 'Área mínima', 'number'],
  ['maxArea', 'Área máxima', 'number'],
  ['rooms', 'Quartos', 'number'],
  ['neighborhood', 'Bairro', 'neighborhood'],
  ['since', 'A partir de', 'date'],
  ['availability', 'Disponibilidade', 'availability'],
  ['mark', 'Minha seleção', 'mark'],
  ['sort', 'Ordenar', 'sort'],
] as const;
const options: Record<string, [string, string][]> = {
  source: [['wimoveis', 'Wimoveis'], ['dfimoveis', 'DF Imóveis']],
  neighborhood: [['asa-norte', 'Asa Norte'], ['asa-sul', 'Asa Sul'], [
    'octogonal',
    'Octogonal',
  ]],
  availability: [['active', 'Ativo'], ['removed', 'Removido'], [
    'unknown',
    'Não verificado',
  ]],
  mark: [['favorite', 'Favorito'], ['contacted', 'Contatado'], [
    'discarded',
    'Descartado',
  ]],
  sort: [['newest', 'Mais recentes'], ['price_asc', 'Menor preço'], [
    'price_desc',
    'Maior preço',
  ], ['opportunity', 'Oportunidades']],
};
function Photo({ url }: { url: string | null | undefined }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className='photo'>
      {url && !failed
        ? (
          <img
            src={url}
            alt=''
            loading='lazy'
            onError={() => setFailed(true)}
          />
        )
        : (
          <span>
            ⌂<small>Sem foto</small>
          </span>
        )}
    </div>
  );
}
export function Listings() {
  const [params, setParams] = useSearchParams();
  const q = useQuery({
    queryKey: ['listings', params.toString()],
    queryFn: () => browse(params),
  });
  return (
    <>
      <Heading
        title='Imóveis, no seu ritmo.'
        description='Filtre, compare e encontre o que combina com você.'
      />
      <section className='filters panel'>
        {fields.map(([key, label, type]) => (
          <label key={key}>
            {label}
            {options[type]
              ? (
                <select
                  aria-label={label}
                  value={params.get(key) || ''}
                  onChange={(e) => {
                    const p = new URLSearchParams(params);
                    e.target.value ? p.set(key, e.target.value) : p.delete(key);
                    p.delete('page');
                    setParams(p);
                  }}
                >
                  <option value=''>
                    {type === 'sort' ? 'Mais recentes' : 'Todos'}
                  </option>
                  {options[type].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              )
              : (
                <input
                  aria-label={label}
                  type={type}
                  min={type === 'number' ? 0 : undefined}
                  value={params.get(key) || ''}
                  onChange={(e) => {
                    const p = new URLSearchParams(params);
                    e.target.value ? p.set(key, e.target.value) : p.delete(key);
                    p.delete('page');
                    setParams(p);
                  }}
                />
              )}
          </label>
        ))}
      </section>
      {q.isPending
        ? <Loading />
        : q.isError
        ? <Failure retry={() => void q.refetch()} />
        : !q.data.rows.length
        ? <Empty>Nenhum imóvel encontrado</Empty>
        : (
          <>
            <div className='results-line'>
              <b>{q.data.count} possibilidades</b>
              <span>Uma escolha de cada vez.</span>
            </div>
            <div className='listing-grid'>
              {q.data.rows.map((p) => (
                <article data-listing key={p.link} className='listing-card'>
                  <Link to={'/imoveis/' + encodeURIComponent(p.link)}>
                    <Photo url={p.photo} />
                    <div className='listing-body'>
                      <div className='card-top'>
                        <small>{source(p.source)}</small>
                        <span className='badge'>
                          {p.availability === 'active'
                            ? 'Ativo'
                            : p.availability === 'removed'
                            ? 'Removido'
                            : 'Não verificado'}
                        </span>
                      </div>
                      <h2>{money(p.price_cents)}</h2>
                      <h3>{p.titulo}</h3>
                      <p>{p.neighborhood || 'Não informado'}</p>
                      <div className='listing-meta'>
                        <span>{p.area ?? '—'} m²</span>
                        <span>{p.rooms ?? '—'} quartos</span>
                      </div>
                      {p.discount_pct != null && (
                        <small className='deal'>
                          {Math.abs(Number(p.discount_pct)).toFixed(1)}%{' '}
                          {Number(p.discount_pct) >= 0 ? 'abaixo' : 'acima'}
                          {' '}
                          da mediana coletada
                        </small>
                      )}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
            <div className='pagination'>
              <button
                type='button'
                disabled={q.data.page === 1}
                onClick={() => {
                  params.set('page', String(q.data.page - 1));
                  setParams(params);
                }}
              >
                Anterior
              </button>
              <span>Página {q.data.page}</span>
              <button
                type='button'
                disabled={q.data.page * 30 >= q.data.count}
                onClick={() => {
                  params.set('page', String(q.data.page + 1));
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
export function ListingDetail() {
  const { encodedLink = '' } = useParams();
  const link = encodedLink;
  const q = useQuery({
    queryKey: ['detail', link],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user!;
      const [listing, history, marks] = await Promise.all([
        supabase.from('real_states').select('*').eq('link', link).maybeSingle()
          .then(check),
        supabase.from('property_price').select('*').eq('listing_link', link)
          .order('seen_at').order('id').then(check),
        supabase.from('property_mark').select('*').eq('listing_link', link).eq(
          'user_id',
          user.id,
        ).maybeSingle().then(check),
      ]);
      return { listing: listing as Listing | null, history, mark: marks };
    },
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure retry={() => void q.refetch()} />;
  if (!q.data.listing) {
    return (
      <div className='state'>
        <h1>Imóvel não encontrado</h1>
        <Link to='/imoveis'>Voltar aos imóveis</Link>
      </div>
    );
  }
  const p = q.data.listing;
  return (
    <>
      <Link className='back' to='/imoveis'>← Voltar aos imóveis</Link>
      <Heading
        title={p.titulo}
        description={p.neighborhood || 'Não informado'}
        kicker={source(p.source)}
      />
      <div className='detail-grid'>
        <section className='panel'>
          <Photo url={p.photo} />
          <h2>{p.valor}</h2>
          <dl>
            {[
              ['Área', p.area ? `${p.area} m²` : null],
              ['Quartos', p.rooms],
              ['Suítes', p.suites],
              [
                'Elevador',
                p.has_elevator == null ? null : p.has_elevator ? 'Sim' : 'Não',
              ],
              [
                'Vaga',
                p.has_parking == null ? null : p.has_parking ? 'Sim' : 'Não',
              ],
              ['Primeira coleta', date(p.created_at)],
              ['Última coleta', date(p.last_seen_at)],
              ['Preço observado em', date(p.price_observed_at)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? 'Não informado'}</dd>
              </div>
            ))}
          </dl>
          <a
            className='button primary'
            href={p.link}
            target='_blank'
            rel='noopener noreferrer'
          >
            Abrir anúncio original
          </a>
        </section>
        <div className='detail-side'>
          <Mark
            link={p.link}
            value={q.data.mark}
            onSave={() => void q.refetch()}
          />
          <section className='panel'>
            <h2>Como esse preço se compara?</h2>
            <p>Preços pedidos dos anúncios coletados</p>
            {p.median_m2 != null && p.discount_pct != null
              ? (
                <>
                  <strong className='price'>
                    {Math.abs(Number(p.discount_pct)).toFixed(1)}%{' '}
                    {Number(p.discount_pct) >= 0 ? 'abaixo' : 'acima'}{' '}
                    da mediana
                  </strong>
                  <p>
                    {money(Number(p.median_m2) * 100)}/m² · {p.peer_count}{' '}
                    anúncios
                  </p>
                  <p>{p.cohort}</p>
                </>
              )
              : <p>Dados insuficientes</p>}
            <small>Comparação calculada em {date(p.comparison_at)}</small>
          </section>
          <section className='panel'>
            <h2>Histórico de preço</h2>
            {q.data.history?.length
              ? q.data.history.map((h) => (
                <div className='history-row' data-price-observation key={h.id}>
                  <span>
                    {date(h.seen_at)}
                    {h.legacy && <small>Importação legada</small>}
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
function Mark(
  { link, value, onSave }: {
    link: string;
    value: { status: string | null; note: string | null } | null;
    onSave: () => void;
  },
) {
  const [status, setStatus] = useState(value?.status || ''),
    [note, setNote] = useState(value?.note || ''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  useEffect(() => {
    setStatus(value?.status || '');
    setNote(value?.note || '');
  }, [value]);
  return (
    <section className='panel'>
      <h2>Seu olhar sobre o imóvel</h2>
      <label>
        Status do imóvel<select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value=''>Sem seleção</option>
          <option value='favorite'>Favorito</option>
          <option value='contacted'>Contatado</option>
          <option value='discarded'>Descartado</option>
        </select>
      </label>
      <label>
        Anotações<textarea
          maxLength={2000}
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <small>{note.length}/2000</small>
      <button
        type='button'
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const user = (await supabase.auth.getUser()).data.user!;
            check(
              await supabase.from('property_mark').upsert({
                user_id: user.id,
                listing_link: link,
                status: status || null,
                note: note || null,
              }),
            );
            setMessage('Anotação salva');
            onSave();
          } catch {
            setStatus(value?.status || '');
            setNote(value?.note || '');
            setMessage('Não foi possível salvar a anotação.');
          } finally {
            setPending(false);
          }
        }}
      >
        Salvar anotação
      </button>
      {message && (
        <p role={message === 'Anotação salva' ? 'status' : 'alert'}>
          {message}
        </p>
      )}
    </section>
  );
}
export function Searches() {
  const q = useQuery({ queryKey: ['profiles'], queryFn: profiles });
  const [draft, setDraft] = useState<Profile | null>(null);
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure retry={() => void q.refetch()} />;
  return (
    <>
      <Heading
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
      {!q.data.length && !draft && <Empty>Nenhuma busca salva</Empty>}
      <div className='profiles'>
        {draft && (
          <ProfileForm
            key={draft.id}
            initial={draft}
            saved={() => {
              setDraft(null);
              void q.refetch();
            }}
          />
        )}
        {q.data.map((p) => (
          <ProfileForm
            key={p.id}
            initial={p}
            saved={() => void q.refetch()}
          />
        ))}
      </div>
    </>
  );
}
function ProfileForm(
  { initial, saved }: { initial: Profile; saved: () => void },
) {
  const [p, setP] = useState(initial),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const set = (key: string, value: unknown) =>
    setP({ ...p, params: { ...p.params, [key]: value } });
  return (
    <form
      className='panel profile'
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          check(await supabase.from('property_profile').upsert(p));
          setMessage('Busca salva');
          saved();
        } catch {
          setMessage(
            'Não foi possível salvar. Confira os campos e os limites.',
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div className='form-grid'>
        <label>
          Nome da busca<input
            required
            maxLength={80}
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <label>
          Bairros<input
            required
            aria-label='Bairros'
            value={p.params.neighborhoods.join(',')}
            onChange={(e) =>
              set(
                'neighborhoods',
                e.target.value.split(',').map((x) => x.trim()),
              )}
          />
          <small>asa-norte, asa-sul, octogonal</small>
        </label>
        <label>
          Quartos<input
            required
            value={p.params.numberOfRooms.join(',')}
            onChange={(e) =>
              set('numberOfRooms', e.target.value.split(',').map(Number))}
          />
        </label>
        {[
          ['numberOfSuites', 'Suítes mínimas'],
          ['minArea', 'Área mínima'],
          ['maxArea', 'Área máxima'],
          ['minPrice', 'Preço mínimo'],
          ['maxPrice', 'Preço máximo'],
        ].map(([k, l]) => (
          <label key={k}>
            {l}
            <input
              type='number'
              required
              min={0}
              step={k === 'numberOfSuites' ? 1 : 'any'}
              value={p.params[k as keyof typeof p.params] as number}
              onChange={(e) => set(k, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <div className='toggles'>
        {[['hasElevator', 'Exigir elevador'], ['hasParking', 'Exigir vaga']]
          .map(([k, l]) => (
            <label key={k}>
              <input
                type='checkbox'
                checked={Boolean(p.params[k as keyof typeof p.params])}
                onChange={(e) => set(k, e.target.checked)}
              />
              {l}
            </label>
          ))}
        {[['dfimoveis', 'DF Imóveis'], ['wimoveis', 'Wimoveis']].map((
          [v, l],
        ) => (
          <label key={v}>
            <input
              type='checkbox'
              checked={p.providers.includes(v)}
              onChange={(e) =>
                setP({
                  ...p,
                  providers: e.target.checked
                    ? [...p.providers, v]
                    : p.providers.filter((x) => x !== v),
                })}
            />
            {l}
          </label>
        ))}
        <label>
          <input
            type='checkbox'
            checked={p.enabled}
            onChange={(e) => setP({ ...p, enabled: e.target.checked })}
          />Busca ativa
        </label>
      </div>
      <button type='submit' disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar busca'}
      </button>
      {message && (
        <span role={message === 'Busca salva' ? 'status' : 'alert'}>
          {message}
        </span>
      )}
    </form>
  );
}
export function Runs() {
  const q = useQuery({
    queryKey: ['runs'],
    refetchInterval: 10000,
    queryFn: async () => ({
      runs: check(
        await supabase.from('property_run').select('*,property_source_run(*)')
          .order('started_at', { ascending: false }).limit(90),
      ) ?? [],
      requests: check(
        await supabase.from('property_request').select('*').in('state', [
          'queued',
          'running',
        ]).order('created_at', { ascending: false }),
      ) ?? [],
    }),
  });
  const [selected, setSelected] = useState<string | null>(null);
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure retry={() => void q.refetch()} />;
  return (
    <>
      <Heading
        title='Seu radar, em movimento.'
        description='Cada coleta tem uma história. Acompanhe por aqui.'
      />
      {q.data.requests.map((r) => (
        <p className='panel' key={r.id}>Solicitação {r.id} · {r.state}</p>
      ))}
      {!q.data.runs.length
        ? <Empty>Sem execuções</Empty>
        : (
          <div className='runs'>
            {q.data.runs.map((r) => (
              <article key={r.id} className='panel'>
                <button
                  type='button'
                  className='run-heading'
                  onClick={() => setSelected(selected === r.id ? null : r.id)}
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
