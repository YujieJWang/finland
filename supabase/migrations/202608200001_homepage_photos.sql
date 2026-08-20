create table public.homepage_photos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  caption text check (caption is null or char_length(caption) <= 240),
  alt_text text not null check (char_length(alt_text) between 1 and 240),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index homepage_photos_position_idx on public.homepage_photos (position, created_at);

alter table public.homepage_photos enable row level security;

create policy "partners can read homepage photos" on public.homepage_photos
for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid())
);

create policy "creator can add homepage photos" on public.homepage_photos
for insert to authenticated with check (
  uploader_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'creator'
  )
);

create policy "creator can reorder homepage photos" on public.homepage_photos
for update to authenticated using (
  uploader_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'creator'
  )
) with check (uploader_id = auth.uid());

create policy "creator can remove homepage photos" on public.homepage_photos
for delete to authenticated using (
  uploader_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'creator'
  )
);

drop policy if exists "authenticated partners can view related media" on storage.objects;
create policy "authenticated partners can view related media" on storage.objects
for select to authenticated using (
  bucket_id = 'private-media' and (
    exists (
      select 1 from public.attachments a join public.cards c on c.id = a.card_id
      where a.storage_path = name
        and (c.creator_id = auth.uid() or (c.recipient_id = auth.uid() and public.card_is_unlocked(c)))
    ) or exists (
      select 1 from public.memory_attachments ma where ma.storage_path = name
    ) or exists (
      select 1 from public.homepage_photos hp
      where hp.storage_path = name
        and exists (select 1 from public.profiles where id = auth.uid())
    )
  )
);
