-- "Yakınında Şu An Aktif" mini-list: a free, non-premium presence signal
-- companion to nearby_active_user_count.sql. Returns up to `p_limit` other
-- profiles active nearby (never the viewer themself, unlike the count RPC's
-- honest floor-of-1). Pure presence/liveliness — no messaging capability
-- lives here; the Say Hi sheet (say_hi.sql) is the separate, premium-gated
-- path for actually starting a conversation with one of these people.
create or replace function public.nearby_active_users(
  viewer_id uuid,
  lat double precision,
  lng double precision,
  radius_m int default 3000,
  active_minutes int default 30,
  p_limit int default 6
)
returns table (
  candidate_id uuid,
  nickname text,
  avatar text,
  avatar_url text,
  gender text
)
language sql
stable
set search_path = public
as $$
  select p.id, p.nickname, p.avatar, p.avatar_url, p.gender
  from profiles p
  where p.id <> viewer_id
    and p.last_geom is not null
    and p.last_location_at is not null
    and p.last_location_at > now() - (active_minutes || ' minutes')::interval
    and st_dwithin(p.last_geom, st_makepoint(lng, lat)::geography, radius_m)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer_id)
    )
  order by p.last_location_at desc
  limit p_limit;
$$;

grant execute on function public.nearby_active_users(uuid, double precision, double precision, int, int, int) to authenticated;
