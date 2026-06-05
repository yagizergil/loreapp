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
  dist_m       float
)
language plpgsql stable as $$
declare
  v_pt     geography := st_makepoint(p_lng, p_lat)::geography;
  v_count  int;
  v_radius float;
begin
  -- Premium yarıçapı içinde kaç soru var?
  select count(*) into v_count
  from questions q
  where st_dwithin(q.geom, v_pt, p_premium_m);

  -- Yeterliyse premium yarıçapı; seyrekse dış sınıra kadar genişlet.
  v_radius := case when v_count >= p_min then p_premium_m else p_fallback_m end;

  return query
    select
      q.id, q.author_id, q.body, q.type, q.options, q.geom,
      q.answer_count, q.created_at,
      st_y(q.geom::geometry) as lat,
      st_x(q.geom::geometry) as lng,
      st_distance(q.geom, v_pt) as dist_m
    from questions q
    where st_dwithin(q.geom, v_pt, v_radius)
    order by q.geom <-> v_pt        -- en yakın önce (KNN, gist index)
    limit p_max;
end;
$$;

grant execute on function questions_around(float, float, float, int, int, float)
  to anon, authenticated;
