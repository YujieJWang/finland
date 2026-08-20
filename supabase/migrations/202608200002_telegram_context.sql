create table public.telegram_bot_messages (
  id bigint generated always as identity primary key,
  telegram_message_id bigint not null,
  role text not null check (role in ('user', 'assistant')),
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique (role, telegram_message_id)
);

create index telegram_bot_messages_created_idx
  on public.telegram_bot_messages (created_at desc);

alter table public.telegram_bot_messages enable row level security;

revoke all on table public.telegram_bot_messages from anon, authenticated;
revoke all on sequence public.telegram_bot_messages_id_seq from anon, authenticated;
