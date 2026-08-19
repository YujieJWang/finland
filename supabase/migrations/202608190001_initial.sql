create extension if not exists pgcrypto;

create type public.user_role as enum ('creator', 'recipient');
create type public.unlock_type as enum ('immediate', 'date', 'mystery');
create type public.attachment_type as enum ('image', 'audio');
create type public.ping_direction as enum ('outbound', 'return');

create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  display_name text not null check (char_length(display_name) between 1 and 80),
  role public.user_role not null unique,
  timezone text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role public.user_role not null unique,
  timezone text not null,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  subtitle text check (char_length(subtitle) <= 240),
  emoji text not null default '💌' check (char_length(emoji) between 1 and 16),
  content text not null check (char_length(content) between 1 and 50000),
  song_url text check (song_url is null or song_url ~ '^https://'),
  unlock_type public.unlock_type not null default 'immediate',
  unlock_at timestamptz,
  opened_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creator_id <> recipient_id),
  check (unlock_type = 'immediate' or unlock_at is not null),
  check (read_at is null or opened_at is not null)
);

create table public.card_responses (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text check (message is null or char_length(message) <= 10000),
  mood text check (mood is null or mood in ('🥺', '😭', '🙂', '🥰', '❤️')),
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  response_id uuid references public.card_responses(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  type public.attachment_type not null,
  alt_text text check (alt_text is null or char_length(alt_text) <= 240),
  created_at timestamptz not null default now()
);

create table public.love_pings (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  direction public.ping_direction not null default 'outbound',
  reply_to_ping_id uuid unique references public.love_pings(id) on delete cascade,
  telegram_message_id bigint,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null check (char_length(caption) between 1 and 2000),
  memory_date date,
  location_label text check (location_label is null or char_length(location_label) <= 120),
  created_at timestamptz not null default now()
);

create table public.memory_attachments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  type public.attachment_type not null,
  alt_text text check (alt_text is null or char_length(alt_text) <= 240),
  created_at timestamptz not null default now()
);

create index cards_recipient_created_idx on public.cards (recipient_id, created_at desc);
create index cards_creator_created_idx on public.cards (creator_id, created_at desc);
create index cards_unlock_idx on public.cards (unlock_at) where unlock_at is not null;
create index responses_card_created_idx on public.card_responses (card_id, created_at);
create index attachments_card_idx on public.attachments (card_id);
create index attachments_response_idx on public.attachments (response_id) where response_id is not null;
create index love_pings_sender_created_idx on public.love_pings (sender_id, created_at desc);
create index love_pings_recipient_created_idx on public.love_pings (recipient_id, created_at desc);
create index memories_date_idx on public.memories (memory_date desc nulls last, created_at desc);

create or replace function public.card_is_unlocked(card public.cards)
returns boolean
language sql
stable
set search_path = public
as $$
  select card.unlock_type = 'immediate' or card.unlock_at <= now()
$$;

create or replace function public.guard_allowed_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or not exists (
    select 1 from public.allowed_emails where email = lower(new.email)
  ) then
    raise exception 'This private space is invitation only.';
  end if;
  return new;
end;
$$;

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, timezone)
  select new.id, display_name, role, timezone
  from public.allowed_emails
  where email = lower(new.email);
  return new;
end;
$$;

create trigger guard_allowed_user_before_signup
before insert on auth.users
for each row execute function public.guard_allowed_user();

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_touch_updated_at
before update on public.cards
for each row execute function public.touch_updated_at();

create or replace function public.protect_card_receipts()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.opened_at is distinct from old.opened_at or new.read_at is distinct from old.read_at)
    and auth.uid() is distinct from old.recipient_id then
    raise exception 'Only the recipient can change opened/read state.';
  end if;
  return new;
end;
$$;

create trigger cards_protect_receipts
before update on public.cards
for each row execute function public.protect_card_receipts();

create or replace function public.validate_attachment_card()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.response_id is not null and not exists (
    select 1 from public.card_responses r where r.id = new.response_id and r.card_id = new.card_id
  ) then raise exception 'Response attachment must belong to the same card.'; end if;
  return new;
end;
$$;

create trigger attachments_validate_card
before insert or update on public.attachments
for each row execute function public.validate_attachment_card();

alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.card_responses enable row level security;
alter table public.attachments enable row level security;
alter table public.love_pings enable row level security;
alter table public.memories enable row level security;
alter table public.memory_attachments enable row level security;

create policy "partners can see profiles" on public.profiles
for select to authenticated using (auth.uid() is not null);

create policy "creators and unlocked recipients can read cards" on public.cards
for select to authenticated using (
  creator_id = auth.uid() or (recipient_id = auth.uid() and public.card_is_unlocked(cards))
);
create policy "partners can create cards" on public.cards
for insert to authenticated with check (
  creator_id = auth.uid()
  and recipient_id <> auth.uid()
  and exists (select 1 from public.profiles where id = recipient_id)
);
create policy "creators can update cards" on public.cards
for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "creators can delete cards" on public.cards
for delete to authenticated using (creator_id = auth.uid());

create policy "partners can read responses" on public.card_responses
for select to authenticated using (exists (
  select 1 from public.cards c
  where c.id = card_id
    and (c.creator_id = auth.uid() or (c.recipient_id = auth.uid() and public.card_is_unlocked(c)))
));
create policy "partners can leave responses" on public.card_responses
for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.cards c
    where c.id = card_id
      and (c.creator_id = auth.uid() or (c.recipient_id = auth.uid() and public.card_is_unlocked(c)))
  )
);

create policy "partners can read attachments" on public.attachments
for select to authenticated using (exists (
  select 1 from public.cards c
  where c.id = card_id
    and (c.creator_id = auth.uid() or (c.recipient_id = auth.uid() and public.card_is_unlocked(c)))
));
create policy "partners can add attachments" on public.attachments
for insert to authenticated with check (
  uploader_id = auth.uid() and exists (
    select 1 from public.cards c
    where c.id = card_id
      and (c.creator_id = auth.uid() or (c.recipient_id = auth.uid() and public.card_is_unlocked(c)))
  )
);

create policy "participants can read love pings" on public.love_pings
for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "partners can read memories" on public.memories
for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid()));
create policy "partners can create memories" on public.memories
for insert to authenticated with check (creator_id = auth.uid());
create policy "memory creators can update" on public.memories
for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "memory creators can delete" on public.memories
for delete to authenticated using (creator_id = auth.uid());

create policy "partners can read memory attachments" on public.memory_attachments
for select to authenticated using (exists (select 1 from public.profiles where id = auth.uid()));
create policy "memory creators can add attachments" on public.memory_attachments
for insert to authenticated with check (
  uploader_id = auth.uid() and exists (
    select 1 from public.memories m where m.id = memory_id and m.creator_id = auth.uid()
  )
);

revoke all on public.allowed_emails from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.love_pings from anon, authenticated;

create or replace function public.list_card_previews()
returns table (
  id uuid, creator_id uuid, recipient_id uuid, title text, subtitle text, emoji text,
  unlock_type public.unlock_type, unlock_at timestamptz, opened_at timestamptz,
  read_at timestamptz, created_at timestamptz, is_locked boolean, is_mine boolean,
  creator_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.creator_id, c.recipient_id,
    case when c.recipient_id = auth.uid() and not public.card_is_unlocked(c) and c.unlock_type = 'mystery'
      then '???' else c.title end,
    case when c.recipient_id = auth.uid() and not public.card_is_unlocked(c) and c.unlock_type = 'mystery'
      then 'Not yet, impatient 😌' else c.subtitle end,
    case when c.recipient_id = auth.uid() and not public.card_is_unlocked(c) then '🔒' else c.emoji end,
    c.unlock_type, c.unlock_at, c.opened_at, c.read_at, c.created_at,
    c.recipient_id = auth.uid() and not public.card_is_unlocked(c),
    c.creator_id = auth.uid(),
    p.display_name
  from public.cards c
  join public.profiles p on p.id = c.creator_id
  where c.creator_id = auth.uid() or c.recipient_id = auth.uid()
  order by c.created_at desc;
$$;

create or replace function public.open_card(target_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare result timestamptz;
begin
  update public.cards c
  set opened_at = coalesce(c.opened_at, now())
  where c.id = target_id and c.recipient_id = auth.uid() and public.card_is_unlocked(c)
  returning c.opened_at into result;
  if result is null then raise exception 'Card is locked or you are not its recipient.'; end if;
  return result;
end;
$$;

create or replace function public.mark_card_read(target_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare result timestamptz;
begin
  update public.cards c
  set opened_at = coalesce(c.opened_at, now()), read_at = coalesce(c.read_at, now())
  where c.id = target_id and c.recipient_id = auth.uid() and public.card_is_unlocked(c)
  returning c.read_at into result;
  if result is null then raise exception 'Card is locked or you are not its recipient.'; end if;
  return result;
end;
$$;

create or replace function public.reserve_love_ping(target_recipient uuid, cooldown_seconds integer default 300)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare ping_id uuid;
begin
  if cooldown_seconds < 30 or cooldown_seconds > 3600 then
    raise exception 'Invalid cooldown.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if auth.uid() is null or target_recipient = auth.uid() or not exists (
    select 1 from public.profiles where id = target_recipient
  ) then raise exception 'Invalid recipient.'; end if;
  if exists (
    select 1 from public.love_pings
    where sender_id = auth.uid() and direction = 'outbound'
      and created_at > now() - make_interval(secs => cooldown_seconds)
  ) then raise exception 'COOLDOWN'; end if;
  insert into public.love_pings (sender_id, recipient_id, direction)
  values (auth.uid(), target_recipient, 'outbound') returning id into ping_id;
  return ping_id;
end;
$$;

revoke all on function public.list_card_previews() from public;
revoke all on function public.open_card(uuid) from public;
revoke all on function public.mark_card_read(uuid) from public;
revoke all on function public.reserve_love_ping(uuid, integer) from public;
grant execute on function public.list_card_previews() to authenticated;
grant execute on function public.open_card(uuid) to authenticated;
grant execute on function public.mark_card_read(uuid) to authenticated;
grant execute on function public.reserve_love_ping(uuid, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-media', 'private-media', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated partners can view related media" on storage.objects
for select to authenticated using (
  bucket_id = 'private-media' and (
    exists (
      select 1 from public.attachments a join public.cards c on c.id = a.card_id
      where a.storage_path = name
        and (c.creator_id = auth.uid() or (c.recipient_id = auth.uid() and public.card_is_unlocked(c)))
    ) or exists (
      select 1 from public.memory_attachments ma where ma.storage_path = name
    )
  )
);
create policy "authenticated users upload to own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'private-media' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "uploaders manage own media" on storage.objects
for update to authenticated using (
  bucket_id = 'private-media' and owner_id = auth.uid()::text
) with check (bucket_id = 'private-media' and owner_id = auth.uid()::text);
create policy "uploaders delete own media" on storage.objects
for delete to authenticated using (
  bucket_id = 'private-media' and owner_id = auth.uid()::text
);
