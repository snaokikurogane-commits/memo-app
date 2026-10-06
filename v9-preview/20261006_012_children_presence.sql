begin;
-- NULL preserves the existing inference from tags, family and conversation records.
-- FALSE is an explicit, reversible correction. No family records are deleted.
alter table public.people add column if not exists children_present boolean;
comment on column public.people.children_present is 'Explicit children presence: NULL uses legacy records; false suppresses the children indicator without deleting family records.';
notify pgrst, 'reload schema';
commit;

select exists(select 1 from information_schema.columns
where table_schema='public' and table_name='people'
and column_name='children_present' and data_type='boolean' and is_nullable='YES') as children_presence_ready;
