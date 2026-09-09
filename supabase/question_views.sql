-- "Who viewed my question" tracking. View count is free to see (teaser);
-- the actual viewer list is gated behind isPremium in the app layer, same
-- pattern as city_leaderboard's free/premium row clamp.

create table if not exists public.question_views (
  question_id uuid not null references public.questions(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (question_id, viewer_id)
);

alter table public.question_views enable row level security;
create policy "public read question_views" on public.question_views for select using (true);
create policy "authenticated can log views" on public.question_views for insert with check (true);
create policy "authenticated can update own view timestamp" on public.question_views for update using (true);

create or replace function public.log_question_view(p_question_id uuid, p_viewer_id uuid)
returns void
language sql
set search_path = public
as $$
  insert into question_views (question_id, viewer_id)
  values (p_question_id, p_viewer_id)
  on conflict (question_id, viewer_id) do update set viewed_at = now();
$$;
grant execute on function public.log_question_view(uuid, uuid) to authenticated, anon;

-- Excludes the author's own views from both the count and the list — you
-- viewing your own question shouldn't inflate "N people viewed this".
create or replace function public.question_view_count(p_question_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from question_views v
  where v.question_id = p_question_id
    and v.viewer_id <> coalesce((select q.author_id from questions q where q.id = p_question_id), '00000000-0000-0000-0000-000000000000'::uuid);
$$;
grant execute on function public.question_view_count(uuid) to authenticated, anon;

create or replace function public.question_viewers(p_question_id uuid, p_limit int default 30)
returns table(viewer_id uuid, nickname text, avatar text, avatar_url text, viewed_at timestamptz)
language sql
stable
set search_path = public
as $$
  select v.viewer_id, p.nickname, p.avatar, p.avatar_url, v.viewed_at
  from question_views v
  join profiles p on p.id = v.viewer_id
  where v.question_id = p_question_id
    and v.viewer_id <> coalesce((select q.author_id from questions q where q.id = p_question_id), '00000000-0000-0000-0000-000000000000'::uuid)
  order by v.viewed_at desc
  limit p_limit;
$$;
grant execute on function public.question_viewers(uuid, int) to authenticated, anon;
