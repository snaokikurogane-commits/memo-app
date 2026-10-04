begin;

-- Additive: existing cards retain their previous cover via a null image setting.
alter table public.people add column if not exists card_image jsonb;
alter table public.people drop constraint if exists people_card_image_check;
alter table public.people add constraint people_card_image_check check (
  card_image is null or (
    jsonb_typeof(card_image) = 'object' and
    card_image ->> 'mode' in ('auto','theme','illustration','photo') and
    case card_image ->> 'mode'
      when 'illustration' then card_image ->> 'illustrationId' in (
        'soccer','reading','hiking','golf','travel','car','running','music','coffee','fishing','cooking','gardening')
      when 'photo' then (
        split_part(card_image ->> 'path','/',1) = person_id and
        card_image ->> 'path' ~ '^[A-Za-z0-9_-]{1,180}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.jpg$' and
        jsonb_typeof(card_image -> 'x') = 'number' and
        jsonb_typeof(card_image -> 'y') = 'number' and
        jsonb_typeof(card_image -> 'zoom') = 'number' and
        (card_image ->> 'x')::numeric between 0 and 1 and
        (card_image ->> 'y')::numeric between 0 and 1 and
        (card_image ->> 'zoom')::numeric between 1 and 3)
      else true
    end
  ) is true
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('person-card-photos','person-card-photos',false,1048576,array['image/jpeg'])
on conflict (id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/jpeg'];

drop policy if exists "members can read person card photos" on storage.objects;
create policy "members can read person card photos" on storage.objects
for select to authenticated using (
  bucket_id='person-card-photos' and
  exists (select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active=true) and
  (owner_id=(select auth.uid())::text or exists (select 1 from public.people p where p.person_id=(storage.foldername(name))[1]))
);
drop policy if exists "editors can upload person card photos" on storage.objects;
create policy "editors can upload person card photos" on storage.objects
for insert to authenticated with check (
  bucket_id='person-card-photos' and
  name ~ '^[A-Za-z0-9_-]{1,180}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.jpg$' and
  exists (select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active=true and m.role in ('owner','editor'))
);
drop policy if exists "editors can remove unused person card photos" on storage.objects;
create policy "editors can remove unused person card photos" on storage.objects
for delete to authenticated using (
  bucket_id='person-card-photos' and
  exists (select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active=true and m.role in ('owner','editor')) and
  not exists (select 1 from public.people p where p.card_image @> jsonb_build_object('mode','photo','path',name))
);

notify pgrst, 'reload schema';
commit;
