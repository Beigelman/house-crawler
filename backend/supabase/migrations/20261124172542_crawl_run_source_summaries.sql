create view public.crawl_run_source_summaries with (security_invoker = true) as
select
  sr.job_id,
  sr.source,
  min(sr.id) as id,
  sum(sr.count) as count,
  case when j.kind = 'collect' then max(sr.outcome) end as outcome,
  case when j.kind = 'collect' then max(sr.error_category) end as error_category,
  case when j.kind = 'validate'
    then coalesce(sum(sr.count) filter (where sr.outcome = 'failed'), 0)
  end as inconclusive
from public.crawl_source_runs sr
join public.crawl_jobs j on j.id = sr.job_id
-- Collection reports are per search and source. Validation reports are per listing.
group by sr.job_id, sr.source, j.kind, case when j.kind = 'collect' then sr.id end;

revoke all on public.crawl_run_source_summaries from public, anon, authenticated;
grant select on public.crawl_run_source_summaries to authenticated, service_role;
