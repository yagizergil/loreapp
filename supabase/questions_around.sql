-- ════════════════════════════════════════════════════════════════════════════
-- questions_around — performanslı, mesafe-etiketli yakın soru sorgusu
-- Supabase SQL editöründe bir kez çalıştır.
--
-- Neden: eski questions_nearby 80 km / limit 200 çekiyordu → yoğun bölgede
-- harita kasıyordu. Yeni model:
--   • premium yarıçapı (varsayılan 4 km) içindeki soruları MESAFEYE göre döner
--   • sabit üst sınır (varsayılan 60) → harita asla şişmez
--   • premium içinde p_min'den (10) az soru varsa, dış sınıra (50 km) kadar
--     en yakınlardan tamamlar (seyrek bölgeler için)
--   • her satırda dist_m döner → client kilit (free: >1 km) durumunu hesaplar
--
-- Hız: KNN operatörü (geom <-> nokta) + GiST index ile en yakın N çok hızlı.
-- ════════════════════════════════════════════════════════════════════════════

-- Premium "boost" (see question_boosts.sql) surfaces a boosted question to
-- viewers OUTSIDE their normal radius, up to p_fallback_m, sorted first —
-- that reach is what the boost actually buys.
--
-- Light algorithmic layer on top of the proximity feed (TikTok-style "base
-- filter + relevance ranking", scaled down): proximity stays the primary
-- signal (this is fundamentally a "who's near me" app), but a currently
-- "hot" question (< 6h old AND >= 3 answers — same definition as the
-- client's getQuestionBadge, replicated here) now sorts ahead of cooler
-- questions within the same 200m distance ring, instead of pure
-- distance-only ordering.
--
-- Today's shared city-wide "Question of the Day" (see daily_question.sql)
-- is unioned in from up to 100km away and always sorts first — the whole
-- point is a synchronized common trigger the entire city sees, not a
-- personalized nearby drop.
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
  is_daily_question boolean
)
language plpgsql stable as $$
declare
  v_pt     geography := st_makepoint(p_lng, p_lat)::geography;
  v_count  int;
  v_radius float;
  v_daily_radius float := 100000;
begin
  -- Premium yarıçapı içinde kaç soru var?
  select count(*) into v_count
  from questions q
  where st_dwithin(q.geom, v_pt, p_premium_m);

  -- Yeterliyse premium yarıçapı; seyrekse dış sınıra kadar genişlet.
  v_radius := case when v_count >= p_min then p_premium_m else p_fallback_m end;

  return query
    select
      c.id, c.author_id, c.body, c.type, c.options, c.geom,
      c.answer_count, c.created_at, c.lat, c.lng, c.dist_m, c.is_boosted, c.is_daily_question
    from (
      select * from (
        select
          q.id, q.author_id, q.body, q.type, q.options, q.geom,
          q.answer_count, q.created_at,
          st_y(q.geom::geometry) as lat,
          st_x(q.geom::geometry) as lng,
          st_distance(q.geom, v_pt) as dist_m,
          (q.boosted_until is not null and q.boosted_until > now()) as is_boosted,
          q.is_daily_question
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
          q.is_daily_question
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
          true as is_daily_question
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
