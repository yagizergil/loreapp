-- ════════════════════════════════════════════════════════════════════════════
-- HESAP SİLME — gerçek, kalıcı silme (App Store Guideline 5.1.1(v))
-- Supabase SQL editöründe bir kez çalıştır.
--
-- ÖNCEKİ BUG: client doğrudan `profiles.delete()` çağırıyordu ama profiles'ta
-- DELETE RLS politikası yoktu → silme sessizce engelleniyordu, profil duruyordu.
-- Apple ile tekrar girince auth_user_id eşleşip tüm veri geri geliyordu.
--
-- ÇÖZÜM: security definer RPC. Bağlı tüm veriyi (cascade'i olmayanlar dahil)
-- sırayla siler, profili siler, ve auth.users kaydını da siler ki Apple/e-posta
-- ile tekrar girişte taze profil oluşsun.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function delete_account(p_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_auth uuid;
begin
  -- Profilin bağlı auth kullanıcısını al (varsa)
  select auth_user_id into v_auth from profiles where id = p_id;

  -- Cascade'i OLMAYAN bağımlılıkları elle sil.
  -- ÖNEMLİ: reports.question_id -> questions cascade'siz; kullanıcının
  -- sorularına/cevaplarına işaret eden raporları ÖNCE silmezsek soru silme
  -- FK ihlaliyle patlar. O yüzden tüm ilgili raporları baştan temizle.
  delete from reports
    where reporter_id = p_id
       or question_id in (select id from questions where author_id = p_id)
       or answer_id   in (select id from answers   where author_id = p_id);

  delete from answers   where author_id = p_id;
  delete from questions where author_id = p_id;   -- kalan answers/notifications cascade

  -- Profili sil. Cascade ile şunlar otomatik gider:
  --   conversations (user1/user2), messages (sender), blocks, answer_upvotes,
  --   notifications.user_id, reports.reported_id; notifications.actor_id -> null
  delete from profiles where id = p_id;

  -- Auth kullanıcısını da sil ki tekrar giriş taze hesap açsın.
  -- Bazı projelerde fonksiyon sahibinin auth.users üzerinde silme yetkisi
  -- olmayabilir; bu durumda profil silme başarısını bozma, sessizce geç.
  -- (auth_user_id artık hiçbir profile bağlı olmadığı için tekrar giriş yine
  --  taze profil oluşturur.)
  if v_auth is not null then
    begin
      delete from auth.users where id = v_auth;
    exception when others then
      null;
    end;
  end if;
end;
$$;

-- Anon/authenticated rollerin RPC'yi çağırabilmesi için yetki ver.
grant execute on function delete_account(uuid) to anon, authenticated;
