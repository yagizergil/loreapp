-- ════════════════════════════════════════════════════════════════════════════
-- ANSWER UPVOTES — profesyonel beğeni sistemi (join tablo + atomik toggle)
-- Supabase SQL editöründe bir kez çalıştır.
--
-- Eski sistem: answers.upvotes bir tam sayıydı, "kim beğendi" sadece cihazda
-- (AsyncStorage) tutuluyordu → geri çekme desync oluyordu, cihaz değişince
-- kayboluyordu, sayı şişirilebiliyordu.
--
-- Yeni sistem: (answer_id, profile_id) ikilisi UNIQUE. Beğeni = satır ekle,
-- geri çekme = satır sil. answers.upvotes hep gerçek satır sayısıyla senkron
-- tutulur (sıralama bu cached sayıyı kullanmaya devam eder).
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Join tablo: bir kullanıcı bir cevabı en fazla 1 kez beğenebilir.
create table if not exists answer_upvotes (
  answer_id  uuid not null references answers(id)  on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (answer_id, profile_id)
);
create index if not exists answer_upvotes_profile_idx on answer_upvotes(profile_id);

alter table answer_upvotes enable row level security;

-- Anon key + client-side profile id modeli: herkese izin (uygulama mantığı kontrol eder).
drop policy if exists "read answer_upvotes"   on answer_upvotes;
create policy "read answer_upvotes"   on answer_upvotes for select using (true);
drop policy if exists "insert answer_upvote"   on answer_upvotes;
create policy "insert answer_upvote"   on answer_upvotes for insert with check (true);
drop policy if exists "delete answer_upvote"   on answer_upvotes;
create policy "delete answer_upvote"   on answer_upvotes for delete using (true);

-- 2) Mevcut answers.upvotes değerlerini join tabloya taşımak için backfill YOK;
--    eski sayılar cached olarak korunur. Bundan sonra toggle her zaman gerçek
--    satır sayısıyla yeniden hesaplar, böylece zamanla tutarlı hale gelir.

-- 3) Atomik toggle: beğen / geri çek. Yeni durumu ve güncel sayıyı döner.
create or replace function toggle_answer_upvote(
  p_answer  uuid,
  p_profile uuid
)
returns table (upvoted boolean, upvotes int)
language plpgsql security definer as $$
declare
  v_exists   boolean;
  v_count    int;
  ans_author uuid;
  ans_qid    uuid;
begin
  select exists(
    select 1 from answer_upvotes
    where answer_id = p_answer and profile_id = p_profile
  ) into v_exists;

  if v_exists then
    -- Geri çek
    delete from answer_upvotes
    where answer_id = p_answer and profile_id = p_profile;

    -- "answer_upvoted" bildirimini temizle
    delete from notifications
    where type = 'answer_upvoted'
      and answer_id = p_answer
      and actor_id  = p_profile;
  else
    -- Beğen
    insert into answer_upvotes (answer_id, profile_id)
    values (p_answer, p_profile)
    on conflict do nothing;

    -- Cevap sahibine bildirim (kendi cevabını beğenmeyi atla)
    select author_id, question_id into ans_author, ans_qid
    from answers where id = p_answer;
    if ans_author is not null and ans_author <> p_profile then
      insert into notifications (user_id, type, question_id, answer_id, actor_id)
      values (ans_author, 'answer_upvoted', ans_qid, p_answer, p_profile);
    end if;
  end if;

  -- Cached sayıyı gerçek satır sayısıyla senkronla
  select count(*) into v_count from answer_upvotes where answer_id = p_answer;
  update answers set upvotes = v_count where id = p_answer;

  return query select (not v_exists), v_count;
end;
$$;

-- 4) Bir kullanıcının bir sorudaki hangi cevapları beğendiğini döner
--    (uygulama açılışında kalp durumlarını sunucudan geri yüklemek için).
create or replace function user_upvoted_answers(
  p_profile  uuid,
  p_question uuid
)
returns table (answer_id uuid)
language sql stable as $$
  select au.answer_id
  from answer_upvotes au
  join answers a on a.id = au.answer_id
  where au.profile_id = p_profile
    and a.question_id = p_question;
$$;
