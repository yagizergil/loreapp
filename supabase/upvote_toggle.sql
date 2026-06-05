-- ════════════════════════════════════════════════════════════════════════════
-- Beğeniyi geri çekme (toggle) — Supabase SQL editöründe bir kez çalıştır.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function decrement_answer_upvotes(
  answer_id  uuid,
  actor_id   uuid default null
)
returns void language plpgsql security definer as $$
begin
  update answers set upvotes = greatest(0, upvotes - 1) where id = answer_id;

  -- Beğeni geri çekilince, daha önce oluşmuş "answer_upvoted" bildirimini temizle.
  if actor_id is not null then
    delete from notifications
    where type = 'answer_upvoted'
      and answer_id = decrement_answer_upvotes.answer_id
      and actor_id  = decrement_answer_upvotes.actor_id;
  end if;
end;
$$;
