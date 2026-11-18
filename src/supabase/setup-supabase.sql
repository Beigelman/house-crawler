-- Legacy bootstrap is intentionally disabled: its permissive policies would
-- reopen private listing reads after the property-interface migration.
-- Follow docs/property-interface.md and apply the reviewed migration instead.
do $$ begin
 raise exception 'Legacy setup disabled. Use supabase/migrations/*_property_interface.sql and docs/property-interface.md';
end $$;
