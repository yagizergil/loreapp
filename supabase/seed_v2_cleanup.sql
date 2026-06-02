-- ════════════════════════════════════════════════════════════════════════════
-- seed_v2_cleanup.sql — TAM TEMİZLİK (geliştirme aşaması)
-- ════════════════════════════════════════════════════════════════════════════
-- Eski seed'ler birden çok kaynaktan geliyordu ve eski cleanup hepsini yakalamıyordu:
--   • seed.sql / seed_sf.sql / seed_answers.sql  → author a1000000-…001..005
--   • seed_v2_system.sql (İstanbul statik)       → author c0d00000-…001..008
--   • scripts/seed_questions.mjs                 → author BİLİNMEZ (profiles limit 1)
--                                                  → bu yüzden eski cleanup silemiyordu
--
-- Geliştirme aşamasında olduğumuz için bu script HER ŞEYİ siler: tüm sorular,
-- cevaplar, raporlar ve seed_drop kayıtları. Sonra seed_v2_system.sql tekrar
-- çalıştırılarak temiz zemin oluşturulur.
--
-- ⚠️ DİKKAT: Bu gerçek kullanıcı içeriğini de siler. Sadece geliştirme/seed
--    sıfırlama için. Canlıda gerçek kullanıcı varken ÇALIŞTIRMA.
--
-- Supabase → SQL Editor'de bir kez çalıştır. İdempotent.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  -- 1) Raporlar (questions/answers FK'lerine bağlı, önce bunlar)
  delete from reports;

  -- 2) Cevaplar
  delete from answers;

  -- 3) Sorular (mjs orphan seedleri dahil — hepsi gidiyor)
  delete from questions;

  -- 4) Seed drop kayıtları (questions silinince question_id null'lanırdı; net olsun)
  delete from seed_drops;

  -- 5) Bot drop throttle damgasını sıfırla → cron temiz başlasın
  update profiles set last_seed_drop_at = null where last_seed_drop_at is not null;

  raise notice 'Tam temizlik tamamlandı. Şimdi seed_v2_system.sql çalıştır.';
exception
  when undefined_table then
    -- seed_drops henüz oluşturulmamışsa (ilk kez v2'ye geçiş) atla
    raise notice 'seed_drops tablosu yok, atlandı.';
end $$;
