-- ════════════════════════════════════════════════════════════════════════════
-- conversations_summary.sql — one query instead of N+1 for the Conversations list
-- ════════════════════════════════════════════════════════════════════════════
-- The client previously fetched all conversations, then fetched the FULL
-- message history of every single conversation (N parallel queries) just to
-- read the last message + count unread ones. This computes both server-side
-- in one round trip. No new schema — reuses conversations/messages as-is.
--
-- Supabase SQL Editor'da bir kez çalıştır. Idempotent (tekrar çalıştırılabilir).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function conversations_with_last_message(p_profile_id uuid)
returns table (
  conversation_id   uuid,
  other_id          uuid,
  last_message_body text,
  last_message_time timestamptz,
  unread_count      bigint
)
language sql stable as $$
  select
    c.id as conversation_id,
    case when c.user1_id = p_profile_id then c.user2_id else c.user1_id end as other_id,
    lm.body as last_message_body,
    coalesce(lm.created_at, c.created_at) as last_message_time,
    (
      select count(*) from messages m2
      where m2.conversation_id = c.id
        and m2.sender_id <> p_profile_id
        and m2.read = false
    ) as unread_count
  from conversations c
  left join lateral (
    select body, created_at
    from messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where c.user1_id = p_profile_id or c.user2_id = p_profile_id
  order by last_message_time desc;
$$;

grant execute on function conversations_with_last_message(uuid) to anon, authenticated;
