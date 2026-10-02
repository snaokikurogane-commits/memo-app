begin;

-- V8: optional short recap. Existing notes remain unchanged.
alter table public.conversations
  add column if not exists recap text;

alter table public.conversations
  drop constraint if exists conversations_recap_length_check;

alter table public.conversations
  add constraint conversations_recap_length_check
    check (recap is null or char_length(recap) <= 100);

commit;
