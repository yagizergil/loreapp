-- "Question of the Day" — one shared, city-wide question per day from an
-- official account, surfaced regardless of the viewer's normal radius.
-- Growth rationale: a common trigger everyone in a city sees at once
-- creates a shared conversation topic people compare answers on/screenshot
-- to share elsewhere (the mechanic behind BeReal's viral growth — a
-- synchronized daily moment, not personalized content).

alter table public.questions
  add column if not exists is_daily_question boolean not null default false;

create table if not exists public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  city_label text not null,
  question_date date not null default current_date,
  question_id uuid references public.questions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (city_label, question_date)
);

alter table public.daily_questions enable row level security;
create policy "public read daily_questions" on public.daily_questions for select using (true);
-- No client insert policy: only the daily-question-generator edge function
-- (service role) creates rows.

-- Cities with real active users that don't have today's daily question yet.
-- Derives "city" as the segment after the last comma in last_location_label
-- (e.g. "Kadıköy, İstanbul" -> "İstanbul") so the question is shared across
-- an entire city's districts, not fragmented per-neighborhood.
create or replace function public.cities_needing_daily_question(p_limit int default 10)
returns table(city_label text)
language sql
stable
security definer
set search_path = public
as $$
  select d.city
  from (
    select distinct trim(
      substring(p.last_location_label from '[^,]+$')
    ) as city
    from profiles p
    where p.is_bot = false
      and p.last_location_label is not null
      and p.last_location_at > now() - interval '3 days'
  ) d
  where not exists (
    select 1 from daily_questions dq
    where dq.city_label = d.city and dq.question_date = current_date
  )
  limit p_limit;
$$;
revoke all on function public.cities_needing_daily_question(int) from public;
grant execute on function public.cities_needing_daily_question(int) to service_role;

-- Creates today's daily question for a city, anchored at the centroid of
-- that city's currently-active real users (so it lands somewhere
-- reasonable on the map rather than an arbitrary fixed point).
create or replace function public.create_daily_question(
  p_city_label text,
  p_body text,
  p_type text,
  p_options jsonb,
  p_author_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_centroid geography;
  v_qid uuid;
begin
  select st_centroid(st_collect(p.last_geom::geometry))::geography into v_centroid
  from profiles p
  where p.is_bot = false
    and p.last_location_label is not null
    and trim(substring(p.last_location_label from '[^,]+$')) = p_city_label
    and p.last_location_at > now() - interval '3 days';

  if v_centroid is null then
    return null;
  end if;

  insert into questions (author_id, body, type, options, geom, answer_count, created_at, is_daily_question)
  values (p_author_id, p_body, p_type, p_options, v_centroid, 0, now(), true)
  returning id into v_qid;

  insert into daily_questions (city_label, question_date, question_id)
  values (p_city_label, current_date, v_qid)
  on conflict (city_label, question_date) do nothing;

  return v_qid;
end;
$$;
revoke all on function public.create_daily_question(text, text, text, jsonb, uuid) from public;
grant execute on function public.create_daily_question(text, text, text, jsonb, uuid) to service_role;
