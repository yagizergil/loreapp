-- Premium "boost" mechanic (Jodel JodelPLUS model: a limited weekly action
-- that temporarily widens a post's reach, included in the subscription —
-- no separate purchase). A boosted question is surfaced to viewers OUTSIDE
-- their normal premium radius for a few hours, and sorted first.
--
-- Trust model note: like city_leaderboard/questions_around, p_is_premium is
-- client-supplied (this app's existing pattern pending a broader
-- auth.uid()-based RLS overhaul) — a determined caller could lie about it,
-- but so could they about any other client-supplied-identity RPC here.

alter table public.questions
  add column if not exists boosted_until timestamptz;

create table if not exists public.question_boosts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  booster_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.question_boosts enable row level security;
create policy "public read question_boosts" on public.question_boosts for select using (true);
-- No direct insert policy: rows are only ever created by boost_question().

create or replace function public.boost_weekly_remaining(p_profile_id uuid, p_weekly_limit int default 3)
returns int
language sql
stable
set search_path = public
as $$
  select greatest(0, p_weekly_limit - count(*)::int)
  from question_boosts
  where booster_id = p_profile_id
    and created_at > now() - interval '7 days';
$$;
grant execute on function public.boost_weekly_remaining(uuid, int) to authenticated, anon;

create or replace function public.boost_question(
  p_question_id uuid,
  p_profile_id uuid,
  p_is_premium boolean,
  p_duration_hours int default 3,
  p_weekly_limit int default 3
)
returns table(ok boolean, remaining int, boosted_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_remaining int;
begin
  if not p_is_premium then
    return query select false, 0, null::timestamptz;
    return;
  end if;

  select author_id into v_author_id from questions where id = p_question_id;
  if v_author_id is null or v_author_id <> p_profile_id then
    return query select false, 0, null::timestamptz;
    return;
  end if;

  select boost_weekly_remaining(p_profile_id, p_weekly_limit) into v_remaining;
  if v_remaining <= 0 then
    return query select false, 0, null::timestamptz;
    return;
  end if;

  insert into question_boosts (question_id, booster_id) values (p_question_id, p_profile_id);

  update questions
    set boosted_until = now() + make_interval(hours => p_duration_hours)
    where id = p_question_id;

  return query
    select true, v_remaining - 1, (now() + make_interval(hours => p_duration_hours));
end;
$$;
grant execute on function public.boost_question(uuid, uuid, boolean, int, int) to authenticated, anon;
