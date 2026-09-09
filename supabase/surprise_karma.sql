-- Variable/surprise reward layer (Hook Model's weakest link previously —
-- karma and streaks are fully predictable, which is a documented gap vs.
-- apps with unpredictable payoffs). A small, capped, server-rolled chance
-- of a bonus karma popup after answering — for every user, not just
-- premium, since this is a general retention lever, not a paywall.
alter table public.profiles
  add column if not exists bonus_karma integer not null default 0,
  add column if not exists last_surprise_karma_at timestamptz;

create or replace function public.maybe_grant_surprise_karma(
  p_profile_id uuid,
  p_chance numeric default 0.12,
  p_amount int default 3
)
returns table(granted boolean, amount int, bonus_karma int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_bonus int;
begin
  select last_surprise_karma_at, bonus_karma into v_last, v_bonus
  from profiles where id = p_profile_id;

  -- At most one roll per rolling 24h, regardless of how many times this is
  -- called that day — prevents farming by spamming answers.
  if v_last is not null and v_last > now() - interval '24 hours' then
    return query select false, 0, coalesce(v_bonus, 0);
    return;
  end if;

  update profiles set last_surprise_karma_at = now() where id = p_profile_id;

  if random() >= p_chance then
    return query select false, 0, coalesce(v_bonus, 0);
    return;
  end if;

  update profiles set bonus_karma = coalesce(bonus_karma, 0) + p_amount where id = p_profile_id
    returning bonus_karma into v_bonus;

  return query select true, p_amount, v_bonus;
end;
$$;
grant execute on function public.maybe_grant_surprise_karma(uuid, numeric, int) to authenticated, anon;
