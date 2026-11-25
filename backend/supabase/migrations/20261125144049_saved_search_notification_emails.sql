create function private.valid_notification_emails(addresses text[])
returns boolean
language sql immutable
set search_path = ''
as $validation$
  select coalesce(array_ndims(addresses), 1) = 1 and not exists (
    select 1
    from unnest(addresses) as entry(email)
    where email is null or char_length(email) > 254 or
      email !~ $email$^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$$email$
  );
$validation$;

revoke all on function private.valid_notification_emails(text[]) from public, anon;
grant execute on function private.valid_notification_emails(text[]) to authenticated, service_role;

alter table public.saved_searches
  add column notification_emails text[] not null default '{}',
  add constraint saved_searches_notification_emails_check
    check (private.valid_notification_emails(notification_emails));
