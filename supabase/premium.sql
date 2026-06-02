-- ════════════════════════════════════════════════════════════════════════════
-- premium.sql — Kalıcı premium (profiles.is_premium)
-- ════════════════════════════════════════════════════════════════════════════
-- Premium daha önce sadece uygulama içi geçici state'ti (restart'ta sıfırlanıyordu)
-- ve DB'den okunmuyordu. Artık profiles.is_premium kolonundan okunuyor
-- (Map ekranı açılışta fetchIsPremium ile çekiyor).
--
-- Supabase → SQL Editor'de çalıştır.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Kolon (idempotent)
alter table profiles add column if not exists is_premium boolean not null default false;

-- ─── 2) Premium ver ─────────────────────────────────────────────────────────
-- Aşağıdakilerden SADECE bir tanesini kullan. Hangi profilin senin olduğunu
-- önce kontrol et (3. bölümdeki SELECT ile).

-- (a) Apple e-postasına göre (Apple Relay maili de olabilir: ...@privaterelay.appleid.com)
-- update profiles set is_premium = true
-- where auth_user_id = (
--   select id from auth.users where email = 'SENIN_APPLE_MAILIN' order by created_at desc limit 1
-- );

-- (b) Nickname'e göre (en kolayı — uygulamada profilinde görünen ad)
-- update profiles set is_premium = true where nickname = 'SENIN_NICKNAME';

-- (c) En son kayıt olan gerçek (bot olmayan) kullanıcıya
-- update profiles set is_premium = true
-- where id = (
--   select id from profiles where coalesce(is_bot, false) = false
--   order by created_at desc limit 1
-- );

-- ─── 3) Kontrol: tüm gerçek kullanıcılar + premium durumu ────────────────────
-- select p.id, p.nickname, p.is_premium, p.created_at, u.email
-- from profiles p
-- left join auth.users u on u.id = p.auth_user_id
-- where coalesce(p.is_bot, false) = false
-- order by p.created_at desc;
