-- ════════════════════════════════════════════════════════════════════════════
-- UGC MODERATION — App Store Guideline 1.2 compliance
-- Kullanıcı tarafından üretilen içerik için: şikayet (report), engelleme (block).
-- Supabase SQL editöründe bir kez çalıştır.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) reports: cevapları ve kullanıcıları da şikayet edebilmek için kolon ekle.
alter table reports add column if not exists answer_id uuid references answers(id) on delete cascade;
alter table reports add column if not exists reported_id uuid references profiles(id) on delete cascade;

-- 2) blocks: bir kullanıcının başka bir kullanıcıyı engellemesi.
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);
create index if not exists blocks_blocker_idx on blocks(blocker_id);

alter table blocks enable row level security;

-- Herkes kendi engel kayıtlarını okuyabilsin (anon key + client-side profile id modeli).
drop policy if exists "read blocks" on blocks;
create policy "read blocks" on blocks for select using (true);

drop policy if exists "insert block" on blocks;
create policy "insert block" on blocks for insert with check (true);

drop policy if exists "delete block" on blocks;
create policy "delete block" on blocks for delete using (true);

-- 3) Engellenen kullanıcıların id listesi (client içerik filtrelemesi için).
create or replace function blocked_ids(p_viewer uuid)
returns table (blocked_id uuid) as $$
  select b.blocked_id from blocks b where b.blocker_id = p_viewer;
$$ language sql stable;
