-- ════════════════════════════════════════════════════════════════════════════
-- author_karma.sql — batch karma + premium lookup for map pin rendering
-- ════════════════════════════════════════════════════════════════════════════
-- "Wax Seal Reputation": a premium author's earned karma tier (see
-- src/lib/karma.ts) shows as an extra ring around their seal on the map,
-- mirroring the same premium-gated badge already shown on their own Profile
-- screen. Karma = sum(answers.upvotes) for that author, same definition
-- fetchUserStats() already uses client-side for a single profile — this is
-- the batch version so the map can resolve it for every visible pin's
-- author in one round trip instead of N.
--
-- Supabase SQL Editor'da bir kez çalıştır. Idempotent (tekrar çalıştırılabilir).
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists batch_author_karma(uuid[]);
create or replace function batch_author_karma(p_author_ids uuid[])
returns table (
  author_id  uuid,
  karma      bigint,
  is_premium boolean
)
language sql stable as $$
  select
    p.id as author_id,
    coalesce(sum(a.upvotes), 0) as karma,
    coalesce(p.is_premium, false) as is_premium
  from profiles p
  left join answers a on a.author_id = p.id
  where p.id = any(p_author_ids)
  group by p.id, p.is_premium;
$$;

grant execute on function batch_author_karma(uuid[]) to anon, authenticated;
