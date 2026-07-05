-- ════════════════════════════════════════════════════════════════════════════
-- leaderboard.sql — "Top contributors near you" this week
-- ════════════════════════════════════════════════════════════════════════════
-- Ranks real (non-bot) users by answers given in the last N days, among
-- profiles whose last known location (profiles.last_geom, already populated
-- by update_user_location in nearby_question_push.sql) is within radius_m of
-- the viewer. No new schema — reuses last_geom/is_bot already added.
--
-- Supabase SQL Editor'da bir kez çalıştır. Idempotent (tekrar çalıştırılabilir).
-- ════════════════════════════════════════════════════════════════════════════

-- Top N contributors near a point, most-answers-first.
--
-- Security note: this function is granted to `anon`, so it CANNOT rely on
-- the caller's premium status alone to withhold data — a direct RPC call
-- can pass whatever p_is_premium it likes, same trust model as the rest of
-- this app's client-supplied-identity RPCs (delete_own_question etc.),
-- pending the broader auth.uid()-based RLS overhaul already tracked
-- separately. What this DOES fix: the app's own paywall gating previously
-- fetched all p_limit rows and hid the rest client-side only, meaning the
-- "locked" rows' real nicknames/avatars/counts were already sitting in the
-- network response for anyone to read. Clamping the row count server-side
-- closes that casual bypass even though a determined caller could still lie
-- about p_is_premium.
drop function if exists city_leaderboard(float, float, float, int, int);
create or replace function city_leaderboard(
  p_lat         float,
  p_lng         float,
  p_radius_m    float   default 50000,
  p_days        int     default 7,
  p_limit       int     default 50,
  p_is_premium  boolean default false
)
returns table (
  profile_id   uuid,
  nickname     text,
  avatar       text,
  avatar_url   text,
  answer_count bigint,
  rank         bigint
)
language sql stable as $$
  select
    p.id as profile_id,
    p.nickname,
    p.avatar,
    p.avatar_url,
    count(a.id) as answer_count,
    row_number() over (order by count(a.id) desc, p.id) as rank
  from profiles p
  join answers a on a.author_id = p.id
  where coalesce(p.is_bot, false) = false
    and p.last_geom is not null
    and st_dwithin(p.last_geom, st_makepoint(p_lng, p_lat)::geography, p_radius_m)
    and a.created_at > now() - make_interval(days => p_days)
  group by p.id, p.nickname, p.avatar, p.avatar_url
  order by answer_count desc, p.id
  limit least(coalesce(p_limit, 50), case when p_is_premium then 100 else 3 end);
$$;

grant execute on function city_leaderboard(float, float, float, int, int, boolean) to anon, authenticated;

-- A single profile's rank + count within the same population, even when
-- they fall outside the top N returned above (so free users can always see
-- "you're #47" without fetching the full list).
create or replace function my_leaderboard_rank(
  p_profile_id uuid,
  p_lat        float,
  p_lng        float,
  p_radius_m   float default 50000,
  p_days       int   default 7
)
returns table (
  rank         bigint,
  answer_count bigint
)
language sql stable as $$
  with ranked as (
    select
      p.id,
      count(a.id) as answer_count,
      row_number() over (order by count(a.id) desc, p.id) as rank
    from profiles p
    join answers a on a.author_id = p.id
    where coalesce(p.is_bot, false) = false
      and p.last_geom is not null
      and st_dwithin(p.last_geom, st_makepoint(p_lng, p_lat)::geography, p_radius_m)
      and a.created_at > now() - make_interval(days => p_days)
    group by p.id
  )
  select r.rank, r.answer_count from ranked r where r.id = p_profile_id;
$$;

grant execute on function my_leaderboard_rank(uuid, float, float, float, int) to anon, authenticated;
