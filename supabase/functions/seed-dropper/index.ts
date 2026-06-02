/**
 * Supabase Edge Function: seed-dropper
 *
 * Zamanlanmış (cron) çağrılır — Supabase Dashboard → Edge Functions → Schedules.
 * Önerilen aralık: saatte bir (0 * * * *).
 *
 * Tüm engagement mantığı DB tarafındaki run_seed_drop() RPC'sinde. Bu fonksiyon
 * sadece tetikleyici: uygun kullanıcıların konumlarına yeni soru düşürür, ki
 * questions INSERT webhook'u → send-push → "Yakınında yeni bir soru 📍" bildirimi
 * otomatik gitsin.
 *
 * Gerekli secret'lar (zaten send-push için ayarlı):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  // SAATTE BİR çalışır (schedule: 0 * * * *). Kadans DB tarafında:
  //   yeni kullanıcı → ≤1 saat içinde ilk seed; yerleşik → 4 saatte 1.
  // Her seed tek bildirim atar.
  const { data, error } = await supabase.rpc('run_seed_drop', {
    est_throttle_hours: 4,   // yerleşik kullanıcı: 1 seed / 4 saat
    jitter_m:           700, // konumdan 150–700 m rastgele uzaklığa yerleştir
  });

  if (error) {
    console.error('run_seed_drop error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, dropped: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
