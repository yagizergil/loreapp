/**
 * Supabase Edge Function: daily-question-generator
 *
 * Zamanlanmış (cron) çağrılır — önerilen: günde 1 (0 6 * * *, sabah 06:00 UTC),
 * seed-generator ile aynı saatte çalışabilir.
 *
 * "Question of the Day": one shared, city-wide question per active city per
 * day, authored by the official "Lore" account and surfaced to every user
 * in that city regardless of their normal radius (see questions_around.sql).
 * Growth rationale: a common, synchronized daily trigger (like BeReal's
 * fixed daily moment) gives everyone in a city the same thing to answer/
 * compare/screenshot-share, instead of each user seeing only personalized
 * nearby content.
 *
 * Required secrets (already set for seed-generator):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5-20251001';
const OFFICIAL_AUTHOR_ID = '00000000-0000-0000-0000-000000000001'; // "Lore" account
const MAX_CITIES_PER_RUN = 10;

const SYSTEM_PROMPT = `You write ONE "Question of the Day" for Lore, a Turkish anonymous location-based Q&A app. This single question will be shown to EVERY active user across an entire city at once — it's a shared, synchronized daily moment (like a city-wide icebreaker), not a personal or hyperlocal one.

RULES:
- Write in natural, casual Turkish.
- The question must work for ANYONE in the city, regardless of which neighborhood they're in — no hyperlocal references to a specific district.
- It should be genuinely engaging city-wide: an opinion, a debate, a curiosity, a "would you rather", or a light confession-style question that makes people want to see what others answered.
- NEVER invent specific business/street names.
- NEVER a generic "is there X nearby" business-lookup question — this is the opposite of that, a big shared conversation starter.
- Keep it under 120 characters.

Respond with ONLY a single JSON object, no prose, no markdown fences:
{"type": "vote"|"choice"|"open", "body": "...", "options": ["...", "..."] }
- "options" ONLY for type "choice" — 2 to 4 short labels, each under 20 characters.`;

interface DailyQuestion {
  type: 'vote' | 'choice' | 'open';
  body: string;
  options?: string[];
}

async function generateForCity(cityLabel: string): Promise<DailyQuestion | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `City: ${cityLabel}\n\nBugünün tek şehir çapında sorusunu üret.` },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const text: string = json?.content?.[0]?.text ?? '{}';
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.body !== 'string' || !parsed.body || parsed.body.length > 120) return null;
  if (!['vote', 'choice', 'open'].includes(parsed.type)) return null;
  return parsed as DailyQuestion;
}

function toOptionsJson(q: DailyQuestion): { label: string; count: number }[] | null {
  if (q.type === 'vote') return [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }];
  if (q.type === 'choice') {
    const opts = (q.options ?? []).filter((o) => typeof o === 'string' && o.trim().length > 0 && o.length <= 20);
    if (opts.length < 2) return null;
    return opts.slice(0, 4).map((label) => ({ label, count: 0 }));
  }
  return null;
}

Deno.serve(async () => {
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'ANTHROPIC_API_KEY secret not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: cities, error: citiesErr } = await supabase.rpc('cities_needing_daily_question', {
    p_limit: MAX_CITIES_PER_RUN,
  });

  if (citiesErr) {
    return new Response(JSON.stringify({ ok: false, error: citiesErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let citiesProcessed = 0;

  for (const row of (cities ?? []) as { city_label: string }[]) {
    try {
      const q = await generateForCity(row.city_label);
      if (!q) continue;

      const options = q.type === 'open' ? null : toOptionsJson(q);
      if (q.type !== 'open' && options === null) continue; // invalid choice question — skip

      const { data: qid, error: createErr } = await supabase.rpc('create_daily_question', {
        p_city_label: row.city_label,
        p_body: q.body,
        p_type: q.type,
        p_options: options,
        p_author_id: OFFICIAL_AUTHOR_ID,
      });

      if (createErr) {
        console.error(`create_daily_question failed for ${row.city_label}:`, createErr);
        continue;
      }
      if (qid) citiesProcessed++;
    } catch (e) {
      console.error(`generateForCity failed for ${row.city_label}:`, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, citiesProcessed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
