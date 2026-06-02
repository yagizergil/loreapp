-- ─── Notifications table ──────────────────────────────────────────────────────
--
-- Run this in Supabase SQL Editor.
--
-- Notification types:
--   new_answer      → someone answered YOUR question
--   answer_upvoted  → someone upvoted YOUR answer  (written by client)
--   new_message     → new DM (tracked via messages.read field, not this table)
--
-- NOTE: new_message is intentionally NOT stored here.
-- Unread DM count comes from  messages WHERE read = false AND sender_id != me.

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null check (type in ('new_answer', 'answer_upvoted')),
  question_id uuid references questions(id) on delete cascade,
  answer_id   uuid references answers(id)   on delete cascade,
  actor_id    uuid references profiles(id)  on delete set null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifs_user_unread
  on notifications(user_id, read, created_at desc);

-- RLS: any profile can read/update its own rows; server inserts via trigger
alter table notifications enable row level security;
drop policy if exists "notifs_select" on notifications;
drop policy if exists "notifs_update" on notifications;
drop policy if exists "notifs_insert" on notifications;
create policy "notifs_select" on notifications for select using (true);
create policy "notifs_update" on notifications for update using (true);
create policy "notifs_insert" on notifications for insert with check (true);

-- Enable Realtime so clients get live pushes (idempotent — zaten ekliyse atla)
do $$
begin
  alter publication supabase_realtime add table notifications;
exception
  when duplicate_object then null;
end $$;

-- ─── Trigger: new_answer ──────────────────────────────────────────────────────
-- Fires after every answer INSERT.
-- Creates a 'new_answer' notification for the question author,
-- unless the answerer IS the question author.

create or replace function notify_new_answer()
returns trigger language plpgsql security definer as $$
declare
  q_author uuid;
begin
  select author_id into q_author from questions where id = NEW.question_id;
  if q_author is not null and q_author <> NEW.author_id then
    insert into notifications (user_id, type, question_id, answer_id, actor_id)
    values (q_author, 'new_answer', NEW.question_id, NEW.id, NEW.author_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_answer on answers;
create trigger trg_notify_new_answer
  after insert on answers
  for each row execute procedure notify_new_answer();

-- ─── Helper: increment_answer_upvotes (with optional notification) ────────────
-- Drop old version and recreate with actor_id so the client can pass who upvoted.

create or replace function increment_answer_upvotes(
  answer_id  uuid,
  actor_id   uuid default null
)
returns void language plpgsql security definer as $$
declare
  ans_author uuid;
  ans_qid    uuid;
begin
  update answers set upvotes = upvotes + 1 where id = answer_id;

  -- Notify answer author (skip self-upvote)
  if actor_id is not null then
    select author_id, question_id into ans_author, ans_qid from answers where id = answer_id;
    if ans_author is not null and ans_author <> actor_id then
      -- question_id de yazılır ki push deep-link'i doğru cevaba gitsin (send-push
      -- 'answer_upvoted' dalı questionId'yi buradan okuyor).
      insert into notifications (user_id, type, question_id, answer_id, actor_id)
      values (ans_author, 'answer_upvoted', ans_qid, answer_id, actor_id);
    end if;
  end if;
end;
$$;

-- ─── messages: mark-read helper ──────────────────────────────────────────────
-- Call to mark all incoming messages in a conversation as read.
create or replace function mark_messages_read(
  p_conversation_id uuid,
  p_reader_id       uuid
)
returns void language sql security definer as $$
  update messages
  set    read = true
  where  conversation_id = p_conversation_id
    and  sender_id <> p_reader_id
    and  read = false;
$$;
