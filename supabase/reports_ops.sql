-- ════════════════════════════════════════════════════════════════════════════
-- REPORTS OPS — App Store Guideline 1.2: act on reports within 24 hours.
-- Adds triage state to `reports` so incoming reports can be worked off a
-- queue instead of relying on tribal knowledge of the raw table.
-- Run once in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table reports add column if not exists status text not null default 'pending'
  check (status in ('pending', 'reviewing', 'actioned', 'dismissed'));
alter table reports add column if not exists reviewed_at timestamptz;
alter table reports add column if not exists action_taken text;

-- Fast "how old is the oldest open report" query for the 24h SLA.
create index if not exists reports_pending_age_idx
  on reports (created_at)
  where status = 'pending';

-- Operational note: query this view (or the SQL editor) at least daily —
-- e.g. `select * from open_reports order by created_at asc` — and action
-- (remove content + eject user, or dismiss) within 24 hours of created_at.
create or replace view open_reports as
  select * from reports where status = 'pending' order by created_at asc;
