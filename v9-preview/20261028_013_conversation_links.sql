begin;

alter table public.conversations
  add column if not exists reply_to_conversation_id text,
  add column if not exists reply_to_follow_up_id text,
  add column if not exists reply_quote jsonb;
alter table public.follow_up_items
  add column if not exists source_conversation_id text,
  add column if not exists source_quote jsonb;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.conversations'::regclass and conname='conversations_reply_conversation_fk') then
    alter table public.conversations add constraint conversations_reply_conversation_fk
      foreign key(reply_to_conversation_id) references public.conversations(conversation_id) on delete set null;
    alter table public.conversations add constraint conversations_reply_follow_up_fk
      foreign key(reply_to_follow_up_id) references public.follow_up_items(follow_up_id) on delete set null;
    alter table public.follow_up_items add constraint follow_up_source_conversation_fk
      foreign key(source_conversation_id) references public.conversations(conversation_id) on delete set null;
    alter table public.conversations add constraint conversations_reply_not_self
      check(reply_to_conversation_id is null or reply_to_conversation_id<>conversation_id);
    alter table public.conversations add constraint conversations_reply_quote_check check(
      reply_quote is null or (jsonb_typeof(reply_quote)='object'
        and jsonb_typeof(reply_quote->'text')='string'
        and char_length(reply_quote->>'text') between 1 and 5000
        and (reply_quote->'occurred_at'='null'::jsonb or jsonb_typeof(reply_quote->'occurred_at')='string')) is true);
    alter table public.follow_up_items add constraint follow_up_source_quote_check check(
      source_quote is null or (jsonb_typeof(source_quote)='object'
        and jsonb_typeof(source_quote->'text')='string'
        and char_length(source_quote->>'text') between 1 and 5000
        and (source_quote->'occurred_at'='null'::jsonb or jsonb_typeof(source_quote->'occurred_at')='string')) is true);
  end if;
end $$;

create or replace function public.check_conversation_link_person()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_table_name='conversations' then
    if new.reply_to_conversation_id is not null and not exists(
      select 1 from public.conversations c where c.conversation_id=new.reply_to_conversation_id and c.person_id=new.person_id
    ) then raise exception 'Conversation links must belong to the same person'; end if;
    if new.reply_to_follow_up_id is not null and not exists(
      select 1 from public.follow_up_items f where f.follow_up_id=new.reply_to_follow_up_id and f.person_id=new.person_id
    ) then raise exception 'Follow-up links must belong to the same person'; end if;
  elsif new.source_conversation_id is not null and not exists(
    select 1 from public.conversations c where c.conversation_id=new.source_conversation_id and c.person_id=new.person_id
  ) then raise exception 'Source links must belong to the same person'; end if;
  return new;
end $$;
revoke all on function public.check_conversation_link_person() from public,anon,authenticated;
drop trigger if exists conversations_link_person_check on public.conversations;
create trigger conversations_link_person_check before insert or update on public.conversations
for each row execute function public.check_conversation_link_person();
drop trigger if exists follow_up_link_person_check on public.follow_up_items;
create trigger follow_up_link_person_check before insert or update on public.follow_up_items
for each row execute function public.check_conversation_link_person();

create index if not exists conversations_reply_source_idx on public.conversations(reply_to_conversation_id)
  where reply_to_conversation_id is not null;
create index if not exists conversations_reply_follow_up_idx on public.conversations(reply_to_follow_up_id)
  where reply_to_follow_up_id is not null;
create index if not exists follow_up_source_idx on public.follow_up_items(source_conversation_id)
  where source_conversation_id is not null;
notify pgrst,'reload schema';
commit;
