-- Add gender to profiles if not already present
alter table profiles
  add column if not exists gender text check (gender in ('male', 'female', 'other'));

-- Conversations table
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  user1_id        uuid not null references profiles(id) on delete cascade,
  user2_id        uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint unique_pair unique (user1_id, user2_id)
);

create index if not exists conversations_user1 on conversations(user1_id);
create index if not exists conversations_user2 on conversations(user2_id);
create index if not exists conversations_last  on conversations(last_message_at desc);

-- Messages table
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null check (char_length(body) > 0 and char_length(body) <= 500),
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv on messages(conversation_id, created_at asc);

-- RLS
alter table conversations enable row level security;
alter table messages      enable row level security;

-- Permissive read/write for any anon (app uses anon key + UUID identity)
create policy "conversations_select" on conversations for select using (true);
create policy "conversations_insert" on conversations for insert with check (true);
create policy "conversations_update" on conversations for update using (true);

create policy "messages_select" on messages for select using (true);
create policy "messages_insert" on messages for insert with check (true);

-- Enable Realtime for live chat
alter publication supabase_realtime add table messages;
