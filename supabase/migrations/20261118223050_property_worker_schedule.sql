-- The worker polls this service-only RPC; no database cron extension is needed.
create or replace function private.property_schedule_slot(p_now timestamptz)
returns timestamptz language sql stable set search_path='' as $$
 select max(slot) from (
  select ((p_now at time zone 'America/Sao_Paulo')::date - d.days + make_time(h.hour,0,0))
   at time zone 'America/Sao_Paulo' as slot
  from (values (0),(1)) d(days) cross join (values (6),(14),(22)) h(hour)
 ) slots where slot <= p_now
$$;
revoke all on function private.property_schedule_slot(timestamptz) from public,anon,authenticated;
grant execute on function private.property_schedule_slot(timestamptz) to service_role;

create or replace function public.enqueue_scheduled_property_crawl()
returns jsonb language plpgsql set search_path='' as $$
declare slot timestamptz; owner_uuid uuid; chosen uuid[]; job_key uuid; req public.property_request;
begin
 -- Serialize with manual enqueue, preserving the single active request invariant.
 perform pg_advisory_xact_lock(8127341);
 slot := private.property_schedule_slot(clock_timestamp());
 job_key := md5('property-schedule:' || extract(epoch from slot)::text)::uuid;
 select user_id into owner_uuid from private.property_owner where singleton;
 if owner_uuid is null then return jsonb_build_object('outcome','no_owner'); end if;
 select * into req from public.property_request where owner_id=owner_uuid and request_key=job_key;
 if found then return jsonb_build_object('outcome','replayed','request_id',req.id,'scheduled_at',slot); end if;
 if exists(select 1 from public.property_request where state in ('queued','running')) then
  return jsonb_build_object('outcome','busy');
 end if;
 select array_agg(id order by id) into chosen from public.property_profile where enabled;
 if coalesce(cardinality(chosen),0)=0 then return jsonb_build_object('outcome','no_profiles'); end if;
 insert into public.property_request(owner_id,request_key,profile_ids)
 values(owner_uuid,job_key,chosen) returning * into req;
 return jsonb_build_object('outcome','accepted','request_id',req.id,'scheduled_at',slot);
end $$;
revoke all on function public.enqueue_scheduled_property_crawl() from public,anon,authenticated;
grant execute on function public.enqueue_scheduled_property_crawl() to service_role;
