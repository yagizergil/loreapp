-- ════════════════════════════════════════════════════════════════════════════
-- KENDİ GÖNDERİNİ ANINDA SİLME — App Store Guideline 1.2
-- "A mechanism for users to immediately remove posts from the feed"
-- Supabase SQL editöründe bir kez çalıştır.
--
-- RLS doğrudan delete'i engellediği için security-definer RPC kullanıyoruz.
-- Her iki fonksiyon da sahiplik (author_id = p_profile) doğrular; başka birinin
-- içeriğini silemezsin.
-- ════════════════════════════════════════════════════════════════════════════

-- Kendi soruyu sil (cevapları, raporları, bildirimleri dahil)
create or replace function delete_own_question(p_question uuid, p_profile uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from questions where id = p_question;
  if v_author is null then return; end if;            -- zaten yok
  if v_author <> p_profile then
    raise exception 'not_owner';                       -- başkasının sorusu
  end if;

  -- reports.question_id cascade'siz → önce temizle
  delete from reports where question_id = p_question;
  -- soruya bağlı cevaplara işaret eden raporlar (answer_id cascade ama garanti)
  delete from reports where answer_id in (select id from answers where question_id = p_question);

  -- soruyu sil → answers / notifications / answer_upvotes cascade ile gider
  delete from questions where id = p_question;
end;
$$;

-- Kendi cevabını sil
create or replace function delete_own_answer(p_answer uuid, p_profile uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from answers where id = p_answer;
  if v_author is null then return; end if;
  if v_author <> p_profile then
    raise exception 'not_owner';
  end if;

  delete from reports where answer_id = p_answer;       -- garanti
  delete from answers where id = p_answer;              -- upvotes/notifications cascade
end;
$$;

grant execute on function delete_own_question(uuid, uuid) to anon, authenticated;
grant execute on function delete_own_answer(uuid, uuid)   to anon, authenticated;
