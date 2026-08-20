create table public.telegram_webhook_updates (
  update_id bigint primary key,
  chat_id bigint not null,
  telegram_message_id bigint,
  telegram_reply_message_id bigint,
  status text not null check (status in (
    'processing', 'generated', 'openai_failed', 'reset', 'too_long', 'cooldown', 'daily_limit'
  )),
  delivery_status text not null default 'not_started' check (delivery_status in (
    'not_started', 'pending', 'delivered', 'failed'
  )),
  reply_text text check (reply_text is null or char_length(reply_text) <= 4096),
  llm_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index telegram_webhook_updates_usage_idx
  on public.telegram_webhook_updates (chat_id, llm_started_at desc)
  where llm_started_at is not null;

create index telegram_webhook_updates_created_idx
  on public.telegram_webhook_updates (created_at);

alter table public.telegram_webhook_updates enable row level security;

revoke all on table public.telegram_webhook_updates from anon, authenticated;
grant select, insert, update, delete on table public.telegram_webhook_updates to service_role;

create or replace function public.reserve_telegram_update(
  target_update_id bigint,
  target_chat_id bigint,
  target_message_id bigint,
  count_toward_limit boolean,
  cooldown_seconds integer,
  daily_limit integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_request timestamptz;
  utc_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(target_chat_id);

  if exists (
    select 1 from public.telegram_webhook_updates where update_id = target_update_id
  ) then
    return 'duplicate';
  end if;

  if count_toward_limit then
    if (
      select count(*) >= greatest(daily_limit, 1)
      from public.telegram_webhook_updates
      where chat_id = target_chat_id and llm_started_at >= utc_day_start
    ) then
      insert into public.telegram_webhook_updates (
        update_id, chat_id, telegram_message_id, status
      ) values (
        target_update_id, target_chat_id, target_message_id, 'daily_limit'
      );
      return 'daily_limit';
    end if;

    select max(llm_started_at) into latest_request
    from public.telegram_webhook_updates
    where chat_id = target_chat_id;

    if latest_request > now() - make_interval(secs => greatest(cooldown_seconds, 0)) then
      insert into public.telegram_webhook_updates (
        update_id, chat_id, telegram_message_id, status
      ) values (
        target_update_id, target_chat_id, target_message_id, 'cooldown'
      );
      return 'cooldown';
    end if;
  end if;

  insert into public.telegram_webhook_updates (
    update_id, chat_id, telegram_message_id, status, llm_started_at
  ) values (
    target_update_id,
    target_chat_id,
    target_message_id,
    'processing',
    case when count_toward_limit then now() end
  );
  return 'allowed';
end;
$$;

revoke all on function public.reserve_telegram_update(bigint, bigint, bigint, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_telegram_update(bigint, bigint, bigint, boolean, integer, integer) to service_role;

create or replace function public.trim_telegram_context(keep_messages integer)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.telegram_bot_messages
  where id in (
    select id
    from public.telegram_bot_messages
    order by created_at desc, id desc
    offset greatest(keep_messages, 2)
  )
$$;

revoke all on function public.trim_telegram_context(integer) from public, anon, authenticated;
grant execute on function public.trim_telegram_context(integer) to service_role;
