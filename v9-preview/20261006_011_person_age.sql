begin;

-- Optional person birthday/age. Existing rows and older app versions remain valid.
alter table public.people add column if not exists age_info jsonb;
create or replace function public.valid_person_age_info(info jsonb)
returns boolean language plpgsql immutable as $$
declare
  birth text := info->>'birth_date';
  birthday text := info->>'birthday';
  age numeric;
  confirmed date;
begin
  if info is null then return true; end if;
  if jsonb_typeof(info) <> 'object' or info = '{}'::jsonb then return false; end if;
  if exists (select 1 from jsonb_object_keys(info) k where k not in ('birth_date','birthday','observed_age','observed_on')) then return false; end if;
  if birth is not null then
    if jsonb_typeof(info->'birth_date') <> 'string' or info - 'birth_date' <> '{}'::jsonb or birth !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    return to_char(birth::date,'YYYY-MM-DD')=birth and extract(year from birth::date) >= 1800;
  end if;
  if info ? 'birth_date' then return false; end if;
  if birthday is not null then
    if jsonb_typeof(info->'birthday') <> 'string' or birthday !~ '^\d{2}-\d{2}$' or to_char(('2000-'||birthday)::date,'MM-DD')<>birthday then return false; end if;
  elsif info ? 'birthday' then return false;
  end if;
  if info ? 'observed_age' or info ? 'observed_on' then
    if jsonb_typeof(info->'observed_age') is distinct from 'number' or jsonb_typeof(info->'observed_on') is distinct from 'string' then return false; end if;
    age := (info->>'observed_age')::numeric;
    if age<>trunc(age) or age<0 or age>130 or (info->>'observed_on') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    confirmed := (info->>'observed_on')::date;
    return to_char(confirmed,'YYYY-MM-DD')=info->>'observed_on';
  end if;
  return birthday is not null;
exception when others then return false;
end;
$$;
alter table public.people drop constraint if exists people_age_info_check;
alter table public.people add constraint people_age_info_check check (public.valid_person_age_info(age_info));
notify pgrst, 'reload schema';
commit;

-- Read-only checks: no personal data is selected or edited.
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='people' and column_name='age_info';
select public.valid_person_age_info('{"birth_date":"1991-05-12"}'::jsonb) as full_birthday_ok,
public.valid_person_age_info('{"birthday":"05-12"}'::jsonb) as month_day_ok,
public.valid_person_age_info('{"observed_age":35,"observed_on":"2026-10-06"}'::jsonb) as age_only_ok,
not public.valid_person_age_info('{"birthday":"02-30"}'::jsonb) as invalid_date_rejected;
