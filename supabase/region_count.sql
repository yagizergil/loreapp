-- ─── region_question_count ────────────────────────────────────────────────────
--
-- Bir bölgede (lat/lng + yarıçap) kaç soru olduğunu döndürür. Ücretsiz kullanıcı
-- başka bir şehre kaydırdığında, o şehirde pin varsa tek bir büyük "teaser" pin
-- göstermek için kullanılır — içerik sızdırmadan sadece sayıyı verir.
--
-- Supabase SQL Editor'da çalıştır.

create or replace function region_question_count(
  lat      float,
  lng      float,
  radius_m float default 50000
)
returns int language sql stable as $$
  select count(*)::int
  from questions q
  where st_dwithin(q.geom, st_makepoint(lng, lat)::geography, radius_m);
$$;

grant execute on function region_question_count(float, float, float)
  to anon, authenticated, service_role;
