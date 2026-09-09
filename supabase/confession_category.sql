-- Anonymous confession / gündem category (viral growth feature #5).
--
-- Rationale: anonymity is Lore's core differentiator, and confession/AITA-
-- format posts ("itiraf ediyorum ki...", "haksız mıyım") are one of the
-- highest-engagement formats on anonymous platforms (Reddit AITA, Yik Yak
-- confessions, Sarahah-era apps) because the format itself invites judgment/
-- reaction from readers. This is a lightweight topical tag a user opts into
-- at posting time — it does not change moderation, visibility radius, or
-- answer format (still vote/choice/open); it only earns a distinct "İtiraf"
-- badge on the pin/sheet and can be used for a future confession-only feed
-- filter without any further schema change.
alter table public.questions add column if not exists is_confession boolean not null default false;
comment on column public.questions.is_confession is 'User opted in at posting time — "İtiraf" (confession/AITA-style) category, leaning into anonymity. Purely a topical tag; type (vote/choice/open) still governs answer format.';

-- questions_around now also returns is_confession so the map/pin/sheet can
-- render the badge without a second round trip.
drop function if exists questions_around(float, float, float, int, int, float);
create or replace function questions_around(
  p_lat        float,
  p_lng        float,
  p_premium_m  float default 4000,
  p_min        int   default 10,
  p_max        int   default 60,
  p_fallback_m float default 50000
)
returns table (
  id           uuid,
  author_id    uuid,
  body         text,
  type         text,
  options      jsonb,
  geom         geography,
  answer_count int,
  created_at   timestamptz,
  lat          float,
  lng          float,
  dist_m       float,
  is_boosted   boolean,
  is_daily_question boolean,
  is_confession boolean
)
language plpgsql stable as $$
declare
  v_pt     geography := st_makepoint(p_lng, p_lat)::geography;
  v_count  int;
  v_radius float;
  v_daily_radius float := 100000;
begin
  select count(*) into v_count
  from questions q
  where st_dwithin(q.geom, v_pt, p_premium_m);

  v_radius := case when v_count >= p_min then p_premium_m else p_fallback_m end;

  return query
    select
      c.id, c.author_id, c.body, c.type, c.options, c.geom,
      c.answer_count, c.created_at, c.lat, c.lng, c.dist_m, c.is_boosted, c.is_daily_question, c.is_confession
    from (
      select * from (
        select
          q.id, q.author_id, q.body, q.type, q.options, q.geom,
          q.answer_count, q.created_at,
          st_y(q.geom::geometry) as lat,
          st_x(q.geom::geometry) as lng,
          st_distance(q.geom, v_pt) as dist_m,
          (q.boosted_until is not null and q.boosted_until > now()) as is_boosted,
          q.is_daily_question,
          q.is_confession
        from questions q
        where st_dwithin(q.geom, v_pt, v_radius)

        union

        select
          q.id, q.author_id, q.body, q.type, q.options, q.geom,
          q.answer_count, q.created_at,
          st_y(q.geom::geometry) as lat,
          st_x(q.geom::geometry) as lng,
          st_distance(q.geom, v_pt) as dist_m,
          true as is_boosted,
          q.is_daily_question,
          q.is_confession
        from questions q
        where q.boosted_until is not null
          and q.boosted_until > now()
          and st_dwithin(q.geom, v_pt, p_fallback_m)

        union

        select
          q.id, q.author_id, q.body, q.type, q.options, q.geom,
          q.answer_count, q.created_at,
          st_y(q.geom::geometry) as lat,
          st_x(q.geom::geometry) as lng,
          st_distance(q.geom, v_pt) as dist_m,
          (q.boosted_until is not null and q.boosted_until > now()) as is_boosted,
          true as is_daily_question,
          q.is_confession
        from questions q
        where q.is_daily_question = true
          and q.created_at > now() - interval '20 hours'
          and st_dwithin(q.geom, v_pt, v_daily_radius)
      ) combined
    ) c
    order by
      c.is_daily_question desc,
      c.is_boosted desc,
      floor(c.dist_m / 200) asc,
      (c.created_at > now() - interval '6 hours' and c.answer_count >= 3) desc,
      c.dist_m asc
    limit p_max;
end;
$$;

grant execute on function questions_around(float, float, float, int, int, float)
  to anon, authenticated;
