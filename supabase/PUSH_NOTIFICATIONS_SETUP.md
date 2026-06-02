# Push Notifications — Kurulum Rehberi

## 1. SQL Migration (Supabase SQL Editor)

```sql
-- supabase/push_token_migration.sql dosyasını çalıştır
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles (push_token) WHERE push_token IS NOT NULL;
```

## 2. Edge Function Deploy

```bash
# Supabase CLI ile deploy et
supabase functions deploy send-push --project-ref pmzoeyrkhqavokuzoinz
```

## 3. Edge Function Secrets (Supabase Dashboard → Edge Functions → send-push → Secrets)

```
SUPABASE_URL=https://pmzoeyrkhqavokuzoinz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # Dashboard → Settings → API
```

## 4. Database Webhooks (Supabase Dashboard → Database → Webhooks)

### Webhook 1 — Yeni cevap / beğeni bildirimleri
- Name: `notify_on_notification_insert`
- Table: `notifications`
- Events: INSERT
- HTTP URL: `https://pmzoeyrkhqavokuzoinz.supabase.co/functions/v1/send-push`
- HTTP Method: POST
- HTTP Headers: `Authorization: Bearer <service_role_key>`

### Webhook 2 — Yeni mesaj bildirimleri
- Name: `notify_on_message_insert`
- Table: `messages`
- Events: INSERT
- HTTP URL: `https://pmzoeyrkhqavokuzoinz.supabase.co/functions/v1/send-push`
- HTTP Method: POST
- HTTP Headers: `Authorization: Bearer <service_role_key>`

## 5. Android — google-services.json

FCM için Firebase Console'dan `google-services.json` indir ve proje kök dizinine koy.
(EAS Build ile gönderirken gerekli.)

## 6. iOS — APNs

EAS Build otomatik configure eder (`eas.json` içinde credentials ayarı).
İlk build'de `eas credentials` ile APNs push key yükle.

## Bildirim Tipleri

| Tip | Kaynak | İçerik |
|-----|--------|--------|
| `new_answer` | DB Webhook → Edge Function | "X sorunuza cevap yazdı" |
| `answer_upvoted` | DB Webhook → Edge Function | "X cevabını beğendi" |
| Yeni mesaj | DB Webhook → Edge Function | "X ✉️: mesaj içeriği" |
| Yakın soru | Local (scheduleNearbyNotification) | "Kadıköy'de 12 soru var 📍" |
| Günlük hatırlatma | Local (scheduleDailyNudge, 18:00) | "Bugün haritana baktın mı?" |
