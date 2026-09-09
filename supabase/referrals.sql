-- Referral / invite system.
-- 5 successful invites (cumulative, repeats every 5) grants the referrer
-- 30 days of premium via profiles.referral_premium_until, which the app
-- OR-combines with the RevenueCat entitlement (see PremiumContext.tsx).
-- This is intentionally separate from profiles.is_premium, which stays a
-- pure mirror of RevenueCat truth and must never be stomped by this reward.

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles(id),
  add column if not exists referral_premium_until timestamptz;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade unique,
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

create policy "public read referrals" on public.referrals for select using (true);
-- No direct insert policy: rows are only ever created by the
-- security-definer redeem_referral_code() function below.

create or replace function public.ensure_referral_code(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select referral_code into v_code from profiles where id = p_profile_id;
  if v_code is not null then
    return v_code;
  end if;
  loop
    v_code := upper(substr(md5(random()::text || p_profile_id::text || clock_timestamp()::text), 1, 6));
    begin
      update profiles set referral_code = v_code where id = p_profile_id;
      return v_code;
    exception when unique_violation then
      -- collision on the 6-char code — loop and try a fresh one
    end;
  end loop;
end;
$$;
grant execute on function public.ensure_referral_code(uuid) to authenticated, anon;

create or replace function public.redeem_referral_code(p_code text, p_new_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_count int;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return false;
  end if;

  select id into v_referrer_id from profiles where referral_code = upper(trim(p_code));
  if v_referrer_id is null or v_referrer_id = p_new_profile_id then
    return false;
  end if;

  if exists (select 1 from profiles where id = p_new_profile_id and referred_by is not null) then
    return false; -- already redeemed a code once
  end if;

  update profiles set referred_by = v_referrer_id where id = p_new_profile_id;
  insert into referrals (referrer_id, referred_id) values (v_referrer_id, p_new_profile_id)
    on conflict (referred_id) do nothing;

  select count(*) into v_count from referrals where referrer_id = v_referrer_id;

  if v_count > 0 and v_count % 5 = 0 then
    update profiles
      set referral_premium_until = greatest(coalesce(referral_premium_until, now()), now()) + interval '30 days'
      where id = v_referrer_id;
  end if;

  return true;
end;
$$;
grant execute on function public.redeem_referral_code(text, uuid) to authenticated, anon;

create or replace function public.referral_progress(p_profile_id uuid)
returns table(referral_code text, invited_count int, premium_until timestamptz, next_reward_at int)
language sql
stable
set search_path = public
as $$
  select
    p.referral_code,
    (select count(*)::int from referrals r where r.referrer_id = p.id),
    p.referral_premium_until,
    ((((select count(*) from referrals r where r.referrer_id = p.id)) / 5) + 1) * 5
  from profiles p
  where p.id = p_profile_id;
$$;
grant execute on function public.referral_progress(uuid) to authenticated, anon;
