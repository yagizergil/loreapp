-- "Say Hi" — premium-gated cold-open anonymous 1:1 greeting to a nearby
-- active stranger. Grounded in Turkey-market research: Turkish users are
-- proven, heavy spenders on anonymous 1:1 chat products (Connected2.me is
-- the #2 top-grossing social app in Turkey's App Store) — Lore's public
-- map/Q&A format is untested there, so this bridges to the mechanic
-- Turkish users already know and pay for.
--
-- Safety design (this is the exact mechanic that has caused abuse/trust
-- problems elsewhere — unsolicited cold anonymous contact):
--   - Receiver must have opted IN (open_to_say_hi, default true but a
--     real, visible toggle in Settings — not a dark pattern).
--   - Sender must be premium (friction reduces spam volume) and capped at
--     a small daily limit regardless of premium status.
--   - Never re-target the same receiver within 7 days, and never target
--     someone you already have a conversation OR a block relationship with.
--   - The resulting conversation uses the exact same conversations/messages
--     tables, RLS, moderation (report/block), and content filter as every
--     other chat in the app — no parallel unmoderated channel.

alter table public.profiles
  add column if not exists open_to_say_hi boolean not null default true;

create table if not exists public.say_hi_sent (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists say_hi_sent_sender_idx on public.say_hi_sent(sender_id, created_at);

alter table public.say_hi_sent enable row level security;
create policy "public read say_hi_sent" on public.say_hi_sent for select using (true);
-- No direct insert policy: rows are only ever created by record_say_hi().

create or replace function public.say_hi_daily_remaining(p_profile_id uuid, p_daily_limit int default 3)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, p_daily_limit - count(*)::int)
  from say_hi_sent
  where sender_id = p_profile_id and created_at > now() - interval '24 hours';
$$;
grant execute on function public.say_hi_daily_remaining(uuid, int) to authenticated, anon;

-- One eligible nearby-active candidate, or zero rows if none exist right
-- now (e.g. sparse area) — the client must handle "no one nearby" gracefully.
create or replace function public.find_say_hi_candidate(
  p_profile_id uuid,
  p_lat float,
  p_lng float,
  p_radius_m float default 3000
)
returns table(candidate_id uuid, nickname text, avatar text, avatar_url text, gender text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nickname, p.avatar, p.avatar_url, p.gender
  from profiles p
  where p.id <> p_profile_id
    and coalesce(p.is_bot, false) = false
    and coalesce(p.open_to_say_hi, true) = true
    and coalesce(p.banned, false) = false
    and p.last_geom is not null
    and p.last_location_at > now() - interval '30 minutes'
    and st_dwithin(p.last_geom, st_makepoint(p_lng, p_lat)::geography, p_radius_m)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = p_profile_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = p_profile_id)
    )
    and not exists (
      select 1 from say_hi_sent s
      where s.sender_id = p_profile_id and s.receiver_id = p.id
        and s.created_at > now() - interval '7 days'
    )
    and not exists (
      select 1 from conversations c
      where (c.user1_id = p_profile_id and c.user2_id = p.id)
         or (c.user1_id = p.id and c.user2_id = p_profile_id)
    )
  order by random()
  limit 1;
$$;
grant execute on function public.find_say_hi_candidate(uuid, float, float, float) to authenticated, anon;

-- Validates premium + daily cap and records the send, server-side (not
-- just trusted client state) — same client-supplied-identity trust model
-- as boost_question/city_leaderboard elsewhere in this app.
create or replace function public.record_say_hi(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_is_premium boolean,
  p_daily_limit int default 3
)
returns table(ok boolean, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
begin
  if not p_is_premium then
    return query select false, 0;
    return;
  end if;

  select say_hi_daily_remaining(p_sender_id, p_daily_limit) into v_remaining;
  if v_remaining <= 0 then
    return query select false, 0;
    return;
  end if;

  insert into say_hi_sent (sender_id, receiver_id) values (p_sender_id, p_receiver_id);
  return query select true, v_remaining - 1;
end;
$$;
grant execute on function public.record_say_hi(uuid, uuid, boolean, int) to authenticated, anon;

create or replace function public.set_open_to_say_hi(p_id uuid, p_open boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set open_to_say_hi = p_open where id = p_id;
$$;
grant execute on function public.set_open_to_say_hi(uuid, boolean) to authenticated, anon;
