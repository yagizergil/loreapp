-- Location-aware LLM-generated seed pool, replacing the flat 26-template
-- generic pool that felt repetitive/obviously-AI (same body text dropped
-- everywhere regardless of actual neighborhood). See seed_generator edge
-- function: Haiku generates a batch of diverse, archetype-varied questions
-- per district, cached here and served many times ("generate once, serve
-- many" — avoids one LLM call per user per drop).

alter table public.profiles
  add column if not exists last_location_label text;

create table if not exists public.seed_pool (
  id uuid primary key default gen_random_uuid(),
  district_label text not null,
  lat double precision,
  lng double precision,
  body text not null,
  type text not null check (type in ('vote','choice','open')),
  options jsonb,
  archetype text,
  created_at timestamptz not null default now(),
  used_count int not null default 0,
  last_used_at timestamptz
);
create index if not exists seed_pool_district_idx on public.seed_pool(district_label);

alter table public.seed_pool enable row level security;
-- Internal table like seed_templates/seed_drops: no client access, only
-- service-role (edge functions) reads/writes it.

create or replace function public.update_user_location_label(p_id uuid, p_label text)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set last_location_label = p_label where id = p_id;
$$;
grant execute on function public.update_user_location_label(uuid, text) to authenticated, anon;

-- Districts with real active users whose unused seed_pool has run low —
-- what seed-generator tops up each run. Service-role only (same trust
-- level as run_seed_drop).
create or replace function public.districts_needing_seed_pool(
  p_floor int default 4,
  p_limit int default 15
)
returns table(district_label text)
language sql
security definer
set search_path = public
as $$
  select d.label
  from (
    select distinct p.last_location_label as label
    from profiles p
    where p.is_bot = false
      and p.last_location_label is not null
      and p.last_location_at > now() - interval '7 days'
  ) d
  where (
    select count(*) from seed_pool sp
    where sp.district_label = d.label and sp.used_count = 0
  ) < p_floor
  limit p_limit;
$$;

revoke all on function public.districts_needing_seed_pool(int, int) from public;
grant execute on function public.districts_needing_seed_pool(int, int) to service_role;
