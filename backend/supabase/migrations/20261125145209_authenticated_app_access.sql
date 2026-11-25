-- Listings, searches, and the crawl queue belong to the shared workspace.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'listings', 'saved_searches', 'crawl_jobs',
    'crawl_source_runs', 'listing_price_history'
  ] loop
    execute format('drop policy owner_read on public.%I', table_name);
    execute format(
      'create policy authenticated_read on public.%I for select to authenticated using (true)',
      table_name
    );
  end loop;
end
$$;

drop policy owner_search_insert on public.saved_searches;
drop policy owner_search_update on public.saved_searches;
create policy authenticated_search_insert on public.saved_searches
  for insert to authenticated with check (true);
create policy authenticated_search_update on public.saved_searches
  for update to authenticated using (true) with check (true);

drop policy owner_read on public.listing_marks;
drop policy owner_mark_insert on public.listing_marks;
drop policy owner_mark_update on public.listing_marks;
create policy own_marks_read on public.listing_marks
  for select to authenticated using (user_id = (select auth.uid()));
create policy own_marks_insert on public.listing_marks
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy own_marks_update on public.listing_marks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.crawl_jobs
  drop constraint crawl_jobs_request_key_key,
  add constraint crawl_jobs_requester_request_key_key unique (requested_by, request_key);

create or replace function public.enqueue_crawl(request_key uuid, search_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  requester uuid := auth.uid();
  previous_job public.crawl_jobs;
  active_job public.crawl_jobs;
  chosen uuid[];
  seconds integer;
begin
  if requester is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(8127341);
  select array_agg(distinct x order by x) into chosen from unnest(search_ids) x;
  select * into previous_job
    from public.crawl_jobs j
    where j.requested_by = requester and j.request_key = enqueue_crawl.request_key;
  if found then
    if previous_job.search_ids is distinct from chosen then
      raise sqlstate '22023' using message = 'Request key payload conflict';
    end if;
    return jsonb_build_object('job_id', previous_job.id, 'outcome', 'replayed', 'retry_after_seconds', 0);
  end if;

  if request_key is null or coalesce(cardinality(chosen), 0) = 0 or exists (
    select 1 from unnest(chosen) x
    where not exists (select 1 from public.saved_searches s where s.id = x and s.enabled)
  ) then
    raise sqlstate '22023' using message = 'Invalid searches';
  end if;

  select * into active_job from public.crawl_jobs where state in ('queued', 'running') limit 1;
  if found then
    return jsonb_build_object('job_id', active_job.id, 'outcome', 'busy', 'retry_after_seconds', 0);
  end if;

  select greatest(0, ceil(60 - extract(epoch from clock_timestamp() - max(created_at)))::integer)
    into seconds from public.crawl_jobs where requested_by = requester and trigger = 'manual';
  if seconds > 0 then
    return jsonb_build_object('job_id', null, 'outcome', 'rate_limited', 'retry_after_seconds', seconds);
  end if;

  insert into public.crawl_jobs(requested_by, request_key, search_ids, trigger)
    values (requester, request_key, chosen, 'manual') returning * into previous_job;
  return jsonb_build_object('job_id', previous_job.id, 'outcome', 'accepted', 'retry_after_seconds', 0);
end
$$;

create or replace function public.worker_health() returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  return (select seen_at from private.worker_state where singleton);
end
$$;

create or replace function public.enqueue_scheduled_crawl() returns jsonb
language plpgsql set search_path = '' as $$
declare
  slot timestamptz;
  chosen uuid[];
  job public.crawl_jobs;
begin
  perform pg_advisory_xact_lock(8127341);
  slot := private.schedule_slot(clock_timestamp());
  select * into job from public.crawl_jobs where scheduled_at = slot;
  if found then
    return jsonb_build_object('outcome', 'replayed', 'job_id', job.id, 'scheduled_at', slot);
  end if;
  if exists (select 1 from public.crawl_jobs where state in ('queued', 'running')) then
    return jsonb_build_object('outcome', 'busy');
  end if;
  select array_agg(id order by id) into chosen from public.saved_searches where enabled;
  if coalesce(cardinality(chosen), 0) = 0 then
    return jsonb_build_object('outcome', 'no_profiles');
  end if;
  insert into public.crawl_jobs(search_ids, trigger, scheduled_at)
    values (chosen, 'scheduled', slot) returning * into job;
  return jsonb_build_object('outcome', 'accepted', 'job_id', job.id, 'scheduled_at', slot);
end
$$;

drop function public.is_app_owner();
drop table private.app_owner;
