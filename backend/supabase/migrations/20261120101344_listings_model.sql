-- Fresh-install baseline. Replaces the legacy migration history after a reset.
create schema private;
revoke all on schema private from public, anon, authenticated;

create table private.app_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users(id)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('dfimoveis', 'wimoveis')),
  source_listing_id text,
  url text not null unique,
  title text not null,
  price_cents bigint check (price_cents >= 0),
  price_observed_at timestamptz,
  area_m2 numeric check (area_m2 >= 0),
  bedrooms integer check (bedrooms between 0 and 100),
  suites integer check (suites between 0 and 100),
  neighborhood text,
  photo_url text,
  has_elevator boolean,
  has_parking boolean,
  availability text not null default 'unknown' check (availability in ('active','removed','unknown')),

  last_check_result text not null default 'unknown' check (last_check_result in ('active','removed','unknown')),

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_checked_at timestamptz,
  removed_at timestamptz,
  unique (source, source_listing_id)
);
create index listings_comparison_peers on public.listings(neighborhood,bedrooms) where availability='active' and price_cents>0
  and area_m2>0;
create index listings_first_seen on public.listings(first_seen_at desc, url);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80 and char_length(trim(name)) > 0),
  enabled boolean not null default true,
  neighborhoods text[] not null check (cardinality(neighborhoods) > 0 and array_position(neighborhoods,
    null) is null and neighborhoods <@ array['asa-norte','asa-sul','octogonal']::text[]),
  bedrooms integer[] not null check (cardinality(bedrooms) > 0 and array_position(bedrooms,null) is null and 1 <= all(bedrooms)
    and 10 >= all(bedrooms)),
  min_suites integer not null check (min_suites between 0 and 10),
  min_area_m2 numeric not null check (min_area_m2 >= 0 and min_area_m2 < 'Infinity'::numeric),
  max_area_m2 numeric not null check (max_area_m2 >= min_area_m2 and max_area_m2 < 'Infinity'::numeric),

  min_price_cents bigint not null check (min_price_cents >= 0),
  max_price_cents bigint not null check (max_price_cents >= min_price_cents),
  has_elevator boolean check (has_elevator is null or has_elevator),
  has_parking boolean check (has_parking is null or has_parking),
  sources text[] not null check (cardinality(sources) > 0 and array_position(sources,null) is null and sources <@ array['dfimoveis',
    'wimoveis']::text[]),
  created_at timestamptz not null default now()
);

create table public.listing_marks (
  user_id uuid not null references auth.users(id),
  listing_id uuid not null references public.listings(id),
  status text check (status in ('favorite','contacted','discarded')),
  note text check (char_length(note) <= 2000),
  primary key (user_id,listing_id)
);
create index listing_marks_listing on public.listing_marks(listing_id);

create table public.crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id),
  request_key uuid unique,
  search_ids uuid[] not null default '{}',
  trigger text not null default 'cli' check (trigger in ('manual','scheduled','cli')),
  scheduled_at timestamptz unique,
  kind text not null default 'collect' check (kind in ('collect','validate')),
  state text not null default 'queued' check (state in ('queued','running','succeeded','partial','failed',
    'interrupted')),
  search_snapshot jsonb not null default '[]' check (jsonb_typeof(search_snapshot) = 'array'),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  email_state text not null default 'not_needed' check (email_state in ('not_needed','sent','failed')),

  error_category text
);
create unique index crawl_one_active_job on public.crawl_jobs((true)) where state in ('queued','running');
create index crawl_jobs_requested_by on public.crawl_jobs(requested_by,created_at desc);

create table private.worker_state (
  singleton boolean primary key default true check (singleton),
  token bigint not null default 0,
  job_id uuid references public.crawl_jobs(id) on delete set null,
  lease_expires_at timestamptz not null default '-infinity',
  seen_at timestamptz
);
insert into private.worker_state(singleton) values(true);

create table public.crawl_source_runs (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.crawl_jobs(id),
  source text not null check (source in ('dfimoveis','wimoveis')),
  search_id uuid references public.saved_searches(id) on delete set null,
  count integer not null default 0 check (count >= 0),
  outcome text not null check (outcome in ('succeeded','partial','failed')),
  error_category text
);
create index crawl_source_runs_job on public.crawl_source_runs(job_id);
create index crawl_source_runs_search on public.crawl_source_runs(search_id);

create table public.listing_price_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id),
  job_id uuid not null references public.crawl_jobs(id),
  price_cents bigint not null check (price_cents >= 0),
  seen_at timestamptz not null default now()
);
create index listing_price_history_listing on public.listing_price_history(listing_id,seen_at,id);
create index listing_price_history_job on public.listing_price_history(job_id);

create function public.is_app_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.app_owner where user_id = auth.uid())
$$;
revoke all on function public.is_app_owner() from public,anon;
grant execute on function public.is_app_owner() to authenticated,service_role;

do $$ declare t text; begin
  foreach t in array array['listings','saved_searches','listing_marks','crawl_jobs','crawl_source_runs',
    'listing_price_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select public.is_app_owner()))',
      t);
  end loop;
end $$;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;
grant usage,select on all sequences in schema public to service_role;
grant insert,update on public.saved_searches,public.listing_marks to authenticated;
create policy owner_search_insert on public.saved_searches for insert to authenticated with check ((select public.is_app_owner()));
create policy owner_search_update on public.saved_searches for update to authenticated using ((select public.is_app_owner())) with check ((select public.is_app_owner()));
create policy owner_mark_insert on public.listing_marks for insert to authenticated with check ((select public.is_app_owner())
  and user_id = (select auth.uid()));
create policy owner_mark_update on public.listing_marks for update to authenticated using ((select public.is_app_owner())
  and user_id = (select auth.uid())) with check ((select public.is_app_owner()) and user_id = (select auth.uid()));

-- Read-time comparisons stay current when prices or availability change.
create view public.listing_comparisons with (security_invoker = true) as
select s.*, stats.median as median_m2, stats.n as peer_count,
  case when stats.median > 0 and s.price_cents > 0 and s.area_m2 > 0
    then (1-s.price_cents/100.0/s.area_m2/stats.median)*100 end as discount_pct,
  s.neighborhood || ' · ' || s.bedrooms || ' quartos' as cohort,
  statement_timestamp() as comparison_at
from public.listings s
cross join lateral (
  select count(*)::integer as n,
    case when count(*) >= 5 then percentile_cont(0.5) within group(order by p.price_cents/100.0/p.area_m2) end as median
  from public.listings p
  where p.id <> s.id and p.availability = 'active' and p.neighborhood = s.neighborhood
    and p.bedrooms = s.bedrooms and p.price_cents > 0 and p.area_m2 > 0
) stats;
revoke all on public.listing_comparisons from public,anon;
grant select on public.listing_comparisons to authenticated,service_role;

create function public.enqueue_crawl(request_key uuid, search_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare prev public.crawl_jobs; active public.crawl_jobs; chosen uuid[]; seconds integer;
begin
  if auth.uid() is null then raise insufficient_privilege using message='Authentication required'; end if;
  if not public.is_app_owner() then raise insufficient_privilege using message='Owner required'; end if;
  perform pg_advisory_xact_lock(8127341);
  select array_agg(distinct x order by x) into chosen from unnest(search_ids) x;
  select * into prev from public.crawl_jobs j where j.requested_by=auth.uid() and j.request_key=enqueue_crawl.request_key;
  if found then
    if prev.search_ids is distinct from chosen then raise sqlstate '22023' using message='Request key payload conflict'; end if;
    return jsonb_build_object('job_id',prev.id,'outcome','replayed','retry_after_seconds',0);
  end if;
  if request_key is null or coalesce(cardinality(chosen),0)=0 or exists(select 1 from unnest(chosen) x where not exists(select 1 from public.saved_searches s
    where s.id=x and s.enabled)) then raise sqlstate '22023' using message='Invalid searches'; end if;
  select * into active from public.crawl_jobs where state in ('queued','running') limit 1;
  if found then return jsonb_build_object('job_id',active.id,'outcome','busy','retry_after_seconds',0); end if;
  select greatest(0,ceil(60-extract(epoch from clock_timestamp()-max(created_at)))::integer) into seconds from public.crawl_jobs
    where requested_by=auth.uid() and trigger='manual';
  if seconds>0 then return jsonb_build_object('job_id',null,'outcome','rate_limited','retry_after_seconds',
    seconds); end if;
  insert into public.crawl_jobs(requested_by,request_key,search_ids,trigger)
  values(auth.uid(),request_key,chosen,'manual') returning * into prev;
  return jsonb_build_object('job_id',prev.id,'outcome','accepted','retry_after_seconds',0);
end $$;
revoke all on function public.enqueue_crawl(uuid,uuid[]) from public,anon;
grant execute on function public.enqueue_crawl(uuid,uuid[]) to authenticated;

create function public.seed_saved_search() returns void
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(8127342);
  insert into public.saved_searches(name,neighborhoods,bedrooms,min_suites,min_area_m2,max_area_m2,min_price_cents,
    max_price_cents,has_elevator,has_parking,sources)
  select 'Busca original',array['asa-norte','asa-sul','octogonal'],array[3,4],0,90,150,100000000,140000000,
    true,null,array['dfimoveis','wimoveis']
  where not exists(select 1 from public.saved_searches);
end $$;

create function public.claim_crawl_job(p_kind text) returns jsonb
language plpgsql set search_path = '' as $$
declare l private.worker_state; job public.crawl_jobs; snapshot jsonb;
begin
  if p_kind not in ('collect','validate','worker') then raise sqlstate '22023'; end if;
  perform pg_advisory_xact_lock(8127341);
  select * into l from private.worker_state where singleton for update;
  if l.lease_expires_at>clock_timestamp() then return null; end if;
  if l.job_id is not null then
    update public.crawl_jobs set state='interrupted',finished_at=clock_timestamp() where id=l.job_id and state='running';
  end if;
  select * into job from public.crawl_jobs where state='queued' order by created_at for update limit 1;
  if found then
    -- Explicit CLI work must not bypass already queued work.
    if p_kind <> 'worker' then return null; end if;
  elsif p_kind='worker' then return null;
  else
    insert into public.crawl_jobs(kind,state) values(p_kind,'running') returning * into job;
  end if;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) into snapshot
    from public.saved_searches s where s.enabled and (job.trigger='cli' or s.id=any(job.search_ids));
  update public.crawl_jobs set state='running',search_snapshot=snapshot,started_at=clock_timestamp() where id=job.id;
  update private.worker_state set token=token+1,job_id=job.id,lease_expires_at=clock_timestamp()+interval '120 seconds'
    where singleton returning * into l;
  return jsonb_build_object('job_id',job.id,'token',l.token,'searches',snapshot,'kind',job.kind);
end $$;

create function private.assert_worker_lease(j uuid,t bigint) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from private.worker_state where singleton and job_id=j and token=t and lease_expires_at>clock_timestamp() for update;
  if not found then raise sqlstate '22023' using message='Worker lease lost'; end if;
end $$;
create function public.renew_worker_lease(p_job uuid,p_token bigint) returns void
language plpgsql set search_path = '' as $$
begin
  perform private.assert_worker_lease(p_job,p_token);
  update private.worker_state set lease_expires_at=clock_timestamp()+interval '120 seconds',seen_at=clock_timestamp()
    where singleton;
end $$;

create function public.save_listing_batch(p_job uuid,p_token bigint,p_items jsonb,p_search uuid default null) returns jsonb
language plpgsql set search_path = '' as $$
declare x jsonb; old public.listings; saved public.listings; new_price bigint; news jsonb:='[]'::jsonb;
begin
  perform private.assert_worker_lease(p_job,p_token);
  if p_search is not null and not exists(select 1 from public.crawl_jobs j,jsonb_array_elements(j.search_snapshot) s
    where j.id=p_job and s->>'id'=p_search::text) then raise sqlstate '22023' using message='Search not in job snapshot'; end if;
  for x in select jsonb_array_elements(p_items) loop
    select * into old from public.listings where url=x->>'url' or
      (x->>'source_listing_id' is not null and source=x->>'source' and source_listing_id=x->>'source_listing_id');
    if x->>'last_check_result' in ('active','removed','unknown') then
      update public.listings set last_check_result=x->>'last_check_result',last_checked_at=clock_timestamp(),
        availability=case when x->>'last_check_result'='unknown' then availability else x->>'last_check_result' end,
        last_seen_at=case when x->>'last_check_result'='active' then clock_timestamp() else last_seen_at end,
        removed_at=case when x->>'last_check_result'='removed' then coalesce(removed_at,clock_timestamp()) when x->>'last_check_result'='active'
          then null else removed_at end
        where id=old.id;
      continue;
    end if;
    new_price=(x->>'price_cents')::bigint;
    insert into public.listings(id,url,title,source,source_listing_id,price_cents,price_observed_at,area_m2,
      bedrooms,suites,neighborhood,photo_url,has_elevator,has_parking,last_seen_at,last_checked_at,availability,
      last_check_result)
    values(coalesce(old.id,gen_random_uuid()),x->>'url',x->>'title',x->>'source',x->>'source_listing_id',
      new_price,case when new_price is not null then clock_timestamp() end,(x->>'area_m2')::numeric,(x->>'bedrooms')::integer,
      (x->>'suites')::integer,x->>'neighborhood',x->>'photo_url',(x->>'has_elevator')::boolean,(x->>'has_parking')::boolean,
      clock_timestamp(),clock_timestamp(),'active','active')
    on conflict(id) do update set url=excluded.url,title=excluded.title,source=excluded.source,source_listing_id=coalesce(excluded.source_listing_id,
      listings.source_listing_id),
      price_cents=coalesce(excluded.price_cents,listings.price_cents),price_observed_at=case when excluded.price_cents is not null
        then excluded.price_observed_at else listings.price_observed_at end,
      area_m2=coalesce(excluded.area_m2,listings.area_m2),bedrooms=coalesce(excluded.bedrooms,listings.bedrooms),
        suites=coalesce(excluded.suites,listings.suites),neighborhood=coalesce(excluded.neighborhood,listings.neighborhood),
        photo_url=coalesce(excluded.photo_url,listings.photo_url),has_elevator=coalesce(excluded.has_elevator,
        listings.has_elevator),has_parking=coalesce(excluded.has_parking,listings.has_parking),last_seen_at=excluded.last_seen_at,
        last_checked_at=excluded.last_checked_at,availability='active',last_check_result='active',removed_at=null
    returning * into saved;
    if old.id is null then news=news||jsonb_build_array(to_jsonb(saved)); end if;
    if new_price is not null and new_price is distinct from old.price_cents then
      insert into public.listing_price_history(listing_id,job_id,price_cents) values(saved.id,p_job,new_price);
    end if;
  end loop;
  return news;
end $$;

create function public.record_crawl_source(p_job uuid,p_token bigint,p_source text,p_search uuid,p_count integer,
  p_outcome text,p_error text) returns void
language plpgsql set search_path = '' as $$
begin
  perform private.assert_worker_lease(p_job,p_token);
  insert into public.crawl_source_runs(job_id,source,search_id,count,outcome,error_category) values(p_job,
    p_source,p_search,p_count,p_outcome,p_error);
end $$;
create function public.finish_crawl_job(p_job uuid,p_token bigint,p_state text,p_email text) returns void
language plpgsql set search_path = '' as $$
begin
  perform private.assert_worker_lease(p_job,p_token);
  if p_state not in ('succeeded','partial','failed') then raise sqlstate '22023'; end if;
  update public.crawl_jobs set state=p_state,email_state=p_email,finished_at=clock_timestamp() where id=p_job;
  update private.worker_state set job_id=null,lease_expires_at='-infinity' where singleton;
end $$;

create function public.record_worker_heartbeat() returns void
language sql set search_path = '' as $$
  update private.worker_state set seen_at=clock_timestamp() where singleton
$$;
create function public.worker_health() returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_owner() then raise insufficient_privilege using message='Owner required'; end if;
  return (select seen_at from private.worker_state where singleton);
end $$;
revoke all on function public.worker_health() from public,anon;
grant execute on function public.worker_health() to authenticated;

create function private.schedule_slot(p_now timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  select max(slot) from (
    select ((p_now at time zone 'America/Sao_Paulo')::date-d.days+make_time(h.hour,0,0)) at time zone 'America/Sao_Paulo' as slot
    from (values (0),(1)) d(days) cross join (values (6),(14),(22)) h(hour)
  ) slots where slot <= p_now
$$;
create function public.enqueue_scheduled_crawl() returns jsonb
language plpgsql set search_path = '' as $$
declare slot timestamptz; chosen uuid[]; job public.crawl_jobs;
begin
  perform pg_advisory_xact_lock(8127341);
  slot:=private.schedule_slot(clock_timestamp());
  if not exists(select 1 from private.app_owner) then return jsonb_build_object('outcome','no_owner'); end if;
  select * into job from public.crawl_jobs where scheduled_at=slot;
  if found then return jsonb_build_object('outcome','replayed','job_id',job.id,'scheduled_at',slot); end if;
  if exists(select 1 from public.crawl_jobs where state in ('queued','running')) then return jsonb_build_object('outcome',
    'busy'); end if;
  select array_agg(id order by id) into chosen from public.saved_searches where enabled;
  if coalesce(cardinality(chosen),0)=0 then return jsonb_build_object('outcome','no_profiles'); end if;
  insert into public.crawl_jobs(search_ids,trigger,scheduled_at) values(chosen,'scheduled',slot) returning * into job;
  return jsonb_build_object('outcome','accepted','job_id',job.id,'scheduled_at',slot);
end $$;

-- Worker operations are callable only with the server credential.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public'
    and p.proname in ('seed_saved_search','claim_crawl_job','renew_worker_lease','save_listing_batch',
    'record_crawl_source','finish_crawl_job','record_worker_heartbeat','enqueue_scheduled_crawl') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
