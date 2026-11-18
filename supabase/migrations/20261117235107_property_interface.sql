-- Additive property UI schema. Apply only after configuring the worker service key.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.property_owner(singleton boolean primary key default true check(singleton), user_id uuid not null);
create table if not exists public.real_states(link text primary key,titulo text not null,valor text not null,created_at timestamptz default now());
alter table public.real_states add column if not exists source text;
alter table public.real_states add column if not exists price_cents bigint;
alter table public.real_states add column if not exists price_observed_at timestamptz;
alter table public.real_states add column if not exists area numeric;
alter table public.real_states add column if not exists rooms integer;
alter table public.real_states add column if not exists suites integer;
alter table public.real_states add column if not exists neighborhood text;
alter table public.real_states add column if not exists photo text;
alter table public.real_states add column if not exists has_elevator boolean;
alter table public.real_states add column if not exists has_parking boolean;
alter table public.real_states add column if not exists last_seen_at timestamptz;
alter table public.real_states add column if not exists availability text not null default 'unknown' check(availability in ('active','removed','unknown'));
alter table public.real_states add column if not exists verification text not null default 'unknown';
alter table public.real_states add column if not exists median_m2 numeric;
alter table public.real_states add column if not exists peer_count integer;
alter table public.real_states add column if not exists discount_pct numeric;
alter table public.real_states add column if not exists cohort text;
alter table public.real_states add column if not exists comparison_at timestamptz;
create or replace function private.parse_brl(v text) returns bigint language sql immutable set search_path='' as $$
 select case when trim(v) ~ '^(R\$[ ]*)?([0-9]{1,3}(\.[0-9]{3})+|[0-9]+)(,[0-9]{2})?$'
 then round(replace(replace(regexp_replace(trim(v),'^R\$[ ]*',''),'.',''),',','.')::numeric*100)::bigint else null end
$$;
create or replace function public.is_property_owner() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.property_owner where user_id=auth.uid())
$$;
revoke all on function public.is_property_owner() from public;
grant execute on function public.is_property_owner() to authenticated,service_role;
create or replace function private.valid_profile(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; x jsonb;
begin
 if jsonb_typeof(p) <> 'object' then return false; end if;
 if not(p ?& array['neighborhoods','numberOfRooms','numberOfSuites','minArea','maxArea','minPrice','maxPrice','hasElevator','hasParking']) then return false; end if;
 if jsonb_array_length(p->'neighborhoods')=0 or jsonb_array_length(p->'numberOfRooms')=0 then return false; end if;
 for x in select jsonb_array_elements(p->'neighborhoods') loop if jsonb_typeof(x)<>'string' or x#>>'{}' not in ('asa-norte','asa-sul','octogonal') then return false; end if; end loop;
 for x in select jsonb_array_elements(p->'numberOfRooms') loop if jsonb_typeof(x)<>'number' or (x#>>'{}')::numeric not between 1 and 10 or mod((x#>>'{}')::numeric,1)<>0 then return false; end if; end loop;
 if jsonb_typeof(p->'numberOfSuites')<>'number' or (p->>'numberOfSuites')::numeric not between 0 and 10 or mod((p->>'numberOfSuites')::numeric,1)<>0 then return false; end if;
 foreach k in array array['minArea','maxArea','minPrice','maxPrice'] loop if jsonb_typeof(p->k)<>'number' or (p->>k)::numeric<0 then return false; end if; end loop;
 if (p->>'minArea')::numeric>(p->>'maxArea')::numeric or (p->>'minPrice')::numeric>(p->>'maxPrice')::numeric then return false; end if;
 return jsonb_typeof(p->'hasElevator')='boolean' and jsonb_typeof(p->'hasParking')='boolean';
exception when others then return false;
end $$;
create table if not exists public.property_profile(id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 1 and 80 and char_length(trim(name))>0),enabled boolean not null default true,params jsonb not null check(private.valid_profile(params)),providers text[] not null check(cardinality(providers)>0 and providers <@ array['dfimoveis','wimoveis']::text[]),created_at timestamptz not null default now());
-- Upgrade an already-created profile table as well as fresh installations.
alter table public.property_profile drop constraint if exists property_profile_name_check;
alter table public.property_profile add constraint property_profile_name_check
 check(char_length(name) between 1 and 80 and char_length(trim(name))>0);
create table if not exists public.property_mark(user_id uuid not null,listing_link text not null references public.real_states(link),status text check(status in ('favorite','contacted','discarded')),note text check(char_length(note)<=2000),primary key(user_id,listing_link));
create table if not exists public.property_request(id uuid primary key default gen_random_uuid(),owner_id uuid not null,request_key uuid not null,profile_ids uuid[] not null,state text not null default 'queued' check(state in ('queued','running','succeeded','partial','failed','interrupted')),created_at timestamptz not null default now(),unique(owner_id,request_key));
create unique index if not exists property_one_active_request on public.property_request((true)) where state in ('queued','running');
create table if not exists public.property_run(id uuid primary key default gen_random_uuid(),request_id uuid unique references public.property_request(id),kind text not null,state text not null default 'running',profiles jsonb not null,started_at timestamptz not null default now(),finished_at timestamptz,email_state text not null default 'not_needed',error_category text);
create table if not exists private.property_lease(singleton boolean primary key default true check(singleton),token bigint not null default 0,run_id uuid,expires_at timestamptz not null default '-infinity');
insert into private.property_lease(singleton) values(true) on conflict do nothing;
create table if not exists public.property_heartbeat(singleton boolean primary key default true check(singleton),seen_at timestamptz not null default now());
create table if not exists public.property_source_run(id bigint generated by default as identity primary key,run_id uuid not null references public.property_run(id),source text not null,profile_id uuid references public.property_profile(id),count integer not null default 0,outcome text not null,error_category text);
create table if not exists public.property_price(id bigint generated by default as identity primary key,listing_link text not null references public.real_states(link),run_id uuid references public.property_run(id),price_cents bigint not null,seen_at timestamptz not null default now(),legacy boolean not null default false,unique(run_id,listing_link));
create unique index if not exists property_one_legacy_price on public.property_price(listing_link) where legacy;
create table if not exists public.property_match(profile_id uuid not null references public.property_profile(id),listing_link text not null references public.real_states(link),primary key(profile_id,listing_link));
create index if not exists property_listing_order on public.real_states(created_at desc,link);
create index if not exists property_price_history on public.property_price(listing_link,seen_at);
update public.real_states set price_cents=private.parse_brl(valor),price_observed_at=created_at where price_observed_at is null and private.parse_brl(valor) is not null;
insert into public.property_price(listing_link,price_cents,seen_at,legacy) select link,price_cents,created_at,true from public.real_states where price_cents is not null and not exists(select 1 from public.property_price p where p.listing_link=real_states.link) on conflict do nothing;
update public.real_states set source=case when link like '%dfimoveis.com.br/%' then 'dfimoveis' when link like '%wimoveis.com.br/%' then 'wimoveis' else null end where source is null;
-- Revoke old permissive policies as well as grants. A second execution is safe.
do $$ declare t text; p record; begin
 foreach t in array array['real_states','property_profile','property_mark','property_request','property_run','property_source_run','property_price','property_match','property_heartbeat'] loop
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using (public.is_property_owner())',t);
 end loop;
end $$;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;
grant usage,select on all sequences in schema public to service_role;
grant insert,update on public.property_profile,public.property_mark to authenticated;
create policy owner_profile_insert on public.property_profile for insert to authenticated with check(public.is_property_owner());
create policy owner_profile_update on public.property_profile for update to authenticated using(public.is_property_owner()) with check(public.is_property_owner());
create policy owner_mark_insert on public.property_mark for insert to authenticated with check(public.is_property_owner() and user_id=auth.uid());
create policy owner_mark_update on public.property_mark for update to authenticated using(public.is_property_owner() and user_id=auth.uid()) with check(public.is_property_owner() and user_id=auth.uid());
-- Constraint function requires schema access only through this controlled wrapper.
grant usage on schema private to authenticated;
grant execute on function private.valid_profile(jsonb) to authenticated;

create or replace function public.enqueue_property_crawl(request_key uuid,profile_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare prev public.property_request; active public.property_request; chosen uuid[]; seconds integer;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required'; end if;
 if not public.is_property_owner() then raise insufficient_privilege using message='Owner required'; end if;
 perform pg_advisory_xact_lock(8127341);
 select array_agg(distinct x order by x) into chosen from unnest(profile_ids) x;
 select * into prev from public.property_request r where r.owner_id=auth.uid() and r.request_key=enqueue_property_crawl.request_key;
 if found then
  if prev.profile_ids is distinct from chosen then raise sqlstate '22023' using message='Request key payload conflict'; end if;
  return jsonb_build_object('request_id',prev.id,'outcome','replayed','retry_after_seconds',0);
 end if;
 if request_key is null or coalesce(cardinality(chosen),0)=0 or exists(select 1 from unnest(chosen) x where not exists(select 1 from public.property_profile p where p.id=x and p.enabled)) then raise sqlstate '22023' using message='Invalid profiles'; end if;
 select * into active from public.property_request r where state in ('queued','running') limit 1;
 if found then return jsonb_build_object('request_id',active.id,'outcome','busy','retry_after_seconds',0); end if;
 select greatest(0,ceil(60-extract(epoch from clock_timestamp()-max(created_at)))::integer) into seconds from public.property_request where owner_id=auth.uid();
 if seconds>0 then return jsonb_build_object('request_id',null,'outcome','rate_limited','retry_after_seconds',seconds); end if;
 insert into public.property_request(owner_id,request_key,profile_ids) values(auth.uid(),request_key,chosen) returning * into prev;
 return jsonb_build_object('request_id',prev.id,'outcome','accepted','retry_after_seconds',0);
end $$;
revoke all on function public.enqueue_property_crawl(uuid,uuid[]) from public,anon;
grant execute on function public.enqueue_property_crawl(uuid,uuid[]) to authenticated;

create or replace function public.seed_property_profile() returns void language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(8127342);
 insert into public.property_profile(name,params,providers)
 select 'Busca original','{"neighborhoods":["asa-norte","asa-sul","octogonal"],"numberOfRooms":[3,4],"numberOfSuites":0,"hasElevator":true,"hasParking":false,"minArea":90,"maxArea":150,"minPrice":1000000,"maxPrice":1400000}'::jsonb,array['dfimoveis','wimoveis'] where not exists(select 1 from public.property_profile);
end $$;
create or replace function public.claim_property_run(p_kind text) returns jsonb language plpgsql set search_path='' as $$
declare l private.property_lease; req public.property_request; rid uuid; snapshot jsonb;
begin
 if p_kind not in ('collect','validate','worker') then raise sqlstate '22023'; end if;
 select * into l from private.property_lease where singleton for update;
 if l.expires_at>clock_timestamp() then return null; end if;
 if l.run_id is not null then
  update public.property_request set state='interrupted' where id=(select request_id from public.property_run where id=l.run_id) and state='running';
  update public.property_run set state='interrupted',finished_at=clock_timestamp() where id=l.run_id and state='running';
 end if;
 if p_kind='worker' then select * into req from public.property_request where state='queued' order by created_at for update limit 1; if not found then return null; end if; end if;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) into snapshot from public.property_profile p where p.enabled and (req.id is null or p.id=any(req.profile_ids));
 insert into public.property_run(request_id,kind,profiles) values(req.id,case when p_kind='worker' then 'collect' else p_kind end,snapshot) returning id into rid;
 update private.property_lease set token=token+1,run_id=rid,expires_at=clock_timestamp()+interval '120 seconds' where singleton returning * into l;
 if req.id is not null then update public.property_request set state='running' where id=req.id; end if;
 return jsonb_build_object('run_id',rid,'token',l.token,'profiles',snapshot,'kind',case when p_kind='worker' then 'collect' else p_kind end);
end $$;
create or replace function private.assert_property_lease(r uuid,t bigint) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from private.property_lease where singleton and run_id=r and token=t and expires_at>clock_timestamp() for update;
 if not found then raise sqlstate '22023' using message='Property lease lost'; end if;
end $$;
create or replace function public.renew_property_lease(p_run uuid,p_token bigint) returns void language plpgsql set search_path='' as $$
begin
 perform private.assert_property_lease(p_run,p_token);
 update private.property_lease set expires_at=clock_timestamp()+interval '120 seconds' where singleton;
end $$;
create or replace function private.property_matches(x jsonb,p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(
  (p->'neighborhoods') ? (x->>'neighborhood')
  and (p->'numberOfRooms') @> jsonb_build_array(x->'rooms')
  and (x->>'area')::numeric between (p->>'minArea')::numeric and (p->>'maxArea')::numeric
  and (x->>'price_cents')::bigint between round((p->>'minPrice')::numeric*100) and round((p->>'maxPrice')::numeric*100)
  and ((p->>'numberOfSuites')::integer=0 or (x->>'suites')::integer>=(p->>'numberOfSuites')::integer)
  and (not (p->>'hasElevator')::boolean or (x->>'has_elevator')::boolean)
  and (not (p->>'hasParking')::boolean or (x->>'has_parking')::boolean),false)
$$;
create or replace function public.save_property_batch(p_run uuid,p_token bigint,p_items jsonb,p_profile uuid default null) returns jsonb language plpgsql set search_path='' as $$
declare x jsonb; old public.real_states; new_price bigint; news jsonb:='[]'::jsonb; selected_params jsonb;
begin
 perform private.assert_property_lease(p_run,p_token);
 for x in select jsonb_array_elements(p_items) loop
  select * into old from public.real_states where link=x->>'link';
  if x->>'verification' in ('removed','unknown') then
   update public.real_states set verification=x->>'verification',availability=case when x->>'verification'='removed' then 'removed' else availability end where link=x->>'link'; continue;
  end if;
  new_price=(x->>'price_cents')::bigint;
  if old.link is null then news=news||jsonb_build_array(x); end if;
  insert into public.real_states(link,titulo,valor,source,price_cents,price_observed_at,area,rooms,suites,neighborhood,photo,has_elevator,has_parking,last_seen_at,availability,verification)
  values(x->>'link',x->>'titulo',x->>'valor',x->>'source',new_price,case when new_price is not null then clock_timestamp() end,(x->>'area')::numeric,(x->>'rooms')::integer,(x->>'suites')::integer,x->>'neighborhood',x->>'photo',(x->>'has_elevator')::boolean,(x->>'has_parking')::boolean,clock_timestamp(),'active','active')
  on conflict(link) do update set titulo=excluded.titulo,valor=excluded.valor,source=excluded.source,price_cents=coalesce(excluded.price_cents,real_states.price_cents),price_observed_at=case when excluded.price_cents is not null then excluded.price_observed_at else real_states.price_observed_at end,area=excluded.area,rooms=excluded.rooms,suites=excluded.suites,neighborhood=excluded.neighborhood,photo=excluded.photo,has_elevator=excluded.has_elevator,has_parking=excluded.has_parking,last_seen_at=excluded.last_seen_at,availability='active',verification='active';
  if new_price is not null and new_price is distinct from old.price_cents then
   insert into public.property_price(listing_link,run_id,price_cents) values(x->>'link',p_run,new_price) on conflict(run_id,listing_link) do nothing;
  end if;
  -- Reconcile only observed identities; disappearance from a search is not removal.
  delete from public.property_match m using public.property_profile p where m.listing_link=x->>'link' and m.profile_id=p.id
   and not private.property_matches(x,coalesce((select snap->'params' from public.property_run r,jsonb_array_elements(r.profiles) snap where r.id=p_run and snap->>'id'=p.id::text),p.params));
  if p_profile is not null then
   select snap->'params' into selected_params from public.property_run r,jsonb_array_elements(r.profiles) snap where r.id=p_run and snap->>'id'=p_profile::text;
   if selected_params is null then raise sqlstate '22023' using message='Profile not in run snapshot'; end if;
   if private.property_matches(x,selected_params) then insert into public.property_match(profile_id,listing_link) values(p_profile,x->>'link') on conflict do nothing; end if;
  end if;
 end loop;
 return news;
end $$;
create or replace function public.record_property_source(p_run uuid,p_token bigint,p_source text,p_profile uuid,p_count integer,p_outcome text,p_error text) returns void language plpgsql set search_path='' as $$
begin
 perform private.assert_property_lease(p_run,p_token);
 insert into public.property_source_run(run_id,source,profile_id,count,outcome,error_category) values(p_run,p_source,p_profile,p_count,p_outcome,p_error);
end $$;
create or replace function public.finish_property_run(p_run uuid,p_token bigint,p_state text,p_email text) returns void language plpgsql set search_path='' as $$
begin
 perform private.assert_property_lease(p_run,p_token);
 if p_state not in ('succeeded','partial','failed') then raise sqlstate '22023'; end if;
 update public.real_states subject set median_m2=stats.median,peer_count=stats.n,discount_pct=case when stats.median>0 and subject.price_cents>0 and subject.area>0 then (1-subject.price_cents/100.0/subject.area/stats.median)*100 end,cohort=subject.neighborhood||' · '||subject.rooms||' quartos',comparison_at=clock_timestamp()
 from (select s.link,count(peer.link)::integer n,case when count(peer.link)>=5 then percentile_cont(0.5) within group(order by peer.price_cents/100.0/peer.area) end median from public.real_states s left join public.real_states peer on peer.link<>s.link and peer.availability='active' and peer.neighborhood=s.neighborhood and peer.rooms=s.rooms and peer.price_cents>0 and peer.area>0 group by s.link) stats where stats.link=subject.link;
 update public.property_run set state=p_state,email_state=p_email,finished_at=clock_timestamp() where id=p_run;
 update public.property_request set state=p_state where id=(select request_id from public.property_run where id=p_run);
 update private.property_lease set run_id=null,expires_at='-infinity' where singleton;
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname in ('seed_property_profile','claim_property_run','renew_property_lease','save_property_batch','record_property_source','finish_property_run') loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.valid_profile(jsonb) to authenticated;
grant execute on all functions in schema private to service_role;
