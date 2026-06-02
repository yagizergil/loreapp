-- Enable PostGIS for geospatial queries
create extension if not exists postgis;

-- Profiles: anonymous, nickname + avatar only
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  avatar text not null,
  gender text check (gender in ('male', 'female', 'other')),
  created_at timestamptz default now()
);

-- Questions: geo-tagged, three types
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id),
  body text not null,
  type text not null check (type in ('vote','choice','open')),
  options jsonb,                  -- for 'choice' type: [{label, count}]
  geom geography(point) not null,
  answer_count int not null default 0,
  created_at timestamptz default now()
);
create index if not exists questions_geom_idx on questions using gist (geom);

-- Answers
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  author_id uuid references profiles(id),
  body text,
  choice text,
  upvotes int not null default 0,
  created_at timestamptz default now(),
  unique (question_id, author_id)
);

-- Reports (App Store requirement)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id),
  reporter_id uuid references profiles(id),
  reason text,
  created_at timestamptz default now()
);

-- Nearby questions with coordinates unpacked from geom
create or replace function questions_nearby(user_lat float, user_lng float, radius_m float)
returns table (
  id uuid,
  author_id uuid,
  body text,
  type text,
  options jsonb,
  geom geography,
  answer_count int,
  created_at timestamptz,
  lat float,
  lng float
) as $$
  select
    q.id, q.author_id, q.body, q.type, q.options, q.geom,
    q.answer_count, q.created_at,
    ST_Y(q.geom::geometry) as lat,
    ST_X(q.geom::geometry) as lng
  from questions q
  where st_dwithin(q.geom, st_makepoint(user_lng, user_lat)::geography, radius_m)
  order by q.created_at desc
  limit 200;
$$ language sql stable;

-- Auto-increment answer_count trigger
create or replace function increment_answer_count()
returns trigger as $$
begin
  update questions
  set answer_count = answer_count + 1
  where id = NEW.question_id;
  return NEW;
end;
$$ language plpgsql;

create trigger on_answer_insert
  after insert on answers
  for each row execute procedure increment_answer_count();

-- RLS
alter table profiles enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table reports enable row level security;

-- Everyone can read
create policy "public read profiles" on profiles for select using (true);
create policy "public read questions" on questions for select using (true);
create policy "public read answers" on answers for select using (true);

-- Insert: anon users (we use anon key, profile_id stored client-side)
create policy "insert own profile" on profiles for insert with check (true);
create policy "insert question" on questions for insert with check (true);
create policy "insert answer" on answers for insert with check (true);
create policy "insert report" on reports for insert with check (true);

-- ─── Migration v2 — run once in Supabase SQL editor ──────────────────────────
-- alter table profiles add column if not exists avatar_url text;
-- alter table profiles add column if not exists auth_user_id uuid references auth.users(id);
-- create index if not exists profiles_auth_user_idx on profiles(auth_user_id);
