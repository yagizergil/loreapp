-- ─── Database Webhook: notifications INSERT → send-push ───────────────────────
--
-- new_answer / answer_upvoted bildirimleri bu trigger ile gönderilir.
-- DM (messages) ve yakındaki soru (questions) webhook'ları zaten Dashboard'dan
-- kurulu; eksik olan SADECE bu (notifications) idi.
--
-- Supabase SQL Editor'da çalıştır. <SERVICE_ROLE_KEY> yerine
-- Dashboard → Settings → API → service_role key değerini koy.
--
-- NOT: Dashboard'daki "Webhooks" UI'ı da bu trigger'ı oluşturur; buradaki SQL
-- aynı işi reproducible şekilde yapar.

drop trigger if exists notify_on_notification_insert on notifications;

create trigger notify_on_notification_insert
  after insert on notifications
  for each row
  execute function supabase_functions.http_request(
    'https://pmzoeyrkhqavokuzoinz.supabase.co/functions/v1/send-push',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}',
    '{}',
    '5000'
  );
