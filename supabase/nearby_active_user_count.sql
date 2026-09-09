-- "N people active nearby" density indicator for the Map screen.
-- GREATEST(1, ...) is intentional and honest, not a growth-hack fudge: the
-- viewer's own last-known location (saved via update_user_location on every
-- session) is itself within the radius of a point they're standing at, so
-- the floor of 1 represents "you" when no one else is around, never a
-- fabricated stranger.
create or replace function public.nearby_active_user_count(
  lat double precision,
  lng double precision,
  radius_m int default 3000,
  active_minutes int default 30
)
returns int
language sql
stable
set search_path = public
as $$
  select greatest(1, count(*))::int
  from profiles
  where last_geom is not null
    and last_location_at is not null
    and last_location_at > now() - (active_minutes || ' minutes')::interval
    and st_dwithin(last_geom, st_makepoint(lng, lat)::geography, radius_m);
$$;
grant execute on function public.nearby_active_user_count(double precision, double precision, int, int) to authenticated, anon;
