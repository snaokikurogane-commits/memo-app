begin;

-- Only expand the illustration catalogue. Existing data and photo permissions stay intact.
alter table public.people drop constraint if exists people_card_image_check;
alter table public.people add constraint people_card_image_check check (
  card_image is null or (
    jsonb_typeof(card_image) = 'object' and
    card_image ->> 'mode' in ('auto','theme','illustration','photo') and
    case card_image ->> 'mode'
      when 'illustration' then card_image ->> 'illustrationId' in (
        'soccer','reading','hiking','golf','travel','car','running','music','coffee','fishing','cooking','gardening',
        'baseball','gym','alcohol','movie','dog','cat','pet','idol','gacha',
        'tennis','basketball','cycling','swimming','yoga','camping','sauna',
        'camera','gaming','anime','manga','live','karaoke','sweets','food','craft','shopping','art','boardgame','parenting')
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

notify pgrst, 'reload schema';
commit;
