-- ════════════════════════════════════════════════════════════════════════════
-- UGC AUTO-ENFORCEMENT — App Store Guideline 1.2
--
-- Closes the gap from the previous two rejections: reporting a question/
-- answer/user previously only inserted a row into `reports` and showed a
-- "thanks" alert — nothing was actually removed or actioned, so a reviewer
-- who tapped Report saw no visible effect. This migration makes reporting
-- SELF-ENFORCING instead of depending on a human checking a queue:
--
--   1. Any report on a question/answer hides it immediately for ALL users
--      (RLS-level, not just the reporter's device) — "immediately remove
--      posts from the feed".
--   2. A user whose content has been hidden 3+ times (or who has been
--      reported directly 3+ times) is auto-banned: new posts blocked,
--      existing content hidden — "eject the user who provided the
--      offending content", enforced within seconds, well inside 24h.
--   3. `open_reports` (from reports_ops.sql) remains for a human to do a
--      final review/appeal pass, but nothing is publicly visible while
--      that happens.
--
-- Run once in the Supabase SQL editor, AFTER schema.sql, ugc_moderation.sql
-- and reports_ops.sql have already been applied.
-- ════════════════════════════════════════════════════════════════════════════

alter table questions add column if not exists hidden boolean not null default false;
alter table answers   add column if not exists hidden boolean not null default false;
alter table profiles  add column if not exists banned boolean not null default false;

-- ─── Public reads exclude hidden content / banned authors ────────────────────
-- These run under SECURITY INVOKER RPCs too (questions_around, region_question_count,
-- question_by_id), so hiding here is enough — no need to patch every function.

drop policy if exists "public read questions" on questions;
create policy "public read questions" on questions for select using (
  coalesce(hidden, false) = false
  and not exists (select 1 from profiles p where p.id = questions.author_id and p.banned)
);

drop policy if exists "public read answers" on answers;
create policy "public read answers" on answers for select using (
  coalesce(hidden, false) = false
  and not exists (select 1 from profiles p where p.id = answers.author_id and p.banned)
);

-- ─── Banned users cannot post new content ─────────────────────────────────────

drop policy if exists "insert question" on questions;
create policy "insert question" on questions for insert with check (
  not exists (select 1 from profiles p where p.id = author_id and p.banned)
);

drop policy if exists "insert answer" on answers;
create policy "insert answer" on answers for insert with check (
  not exists (select 1 from profiles p where p.id = author_id and p.banned)
);

-- ─── Auto-hide on report + auto-ban repeat offenders ──────────────────────────

create or replace function handle_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_strikes int;
begin
  if new.question_id is not null then
    update questions set hidden = true where id = new.question_id
    returning author_id into v_author;
  elsif new.answer_id is not null then
    update answers set hidden = true where id = new.answer_id
    returning author_id into v_author;
  elsif new.reported_id is not null then
    v_author := new.reported_id;
  end if;

  if v_author is not null then
    select
      (select count(*) from questions where author_id = v_author and hidden)
      + (select count(*) from answers   where author_id = v_author and hidden)
      + (select count(*) from reports   where reported_id = v_author)
    into v_strikes;

    if v_strikes >= 3 then
      update profiles set banned = true where id = v_author;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_report_auto_enforce on reports;
create trigger trg_report_auto_enforce
  after insert on reports
  for each row execute function handle_new_report();
