create table public.countdown_deliveries (
  finland_date date primary key,
  days_remaining integer not null,
  telegram_message_id bigint,
  delivered_at timestamptz not null default now()
);

alter table public.countdown_deliveries enable row level security;

revoke all on table public.countdown_deliveries from anon, authenticated;
