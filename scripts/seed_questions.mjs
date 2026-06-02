/**
 * Seed test questions around: 41.11731, 29.011145
 * Run: node scripts/seed_questions.mjs
 */

const SUPABASE_URL = 'https://pmzoeyrkhqavokuzoinz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2DzwoSQP626Y2jddL5G8Cw_Cmr6RCAo';

const CENTER_LAT = 41.11731;
const CENTER_LNG = 29.011145;

// Offset helpers (degrees per meter, approximate)
const LAT_PER_M = 1 / 111320;
const LNG_PER_M = 1 / (111320 * Math.cos(CENTER_LAT * Math.PI / 180));

function offset(dLat_m, dLng_m) {
  return {
    lat: CENTER_LAT + dLat_m * LAT_PER_M,
    lng: CENTER_LNG + dLng_m * LNG_PER_M,
  };
}

async function getAuthorId() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const data = await res.json();
  if (!data.length) throw new Error('No profiles found in DB!');
  console.log('Using author_id:', data[0].id);
  return data[0].id;
}

async function insert(authorId, body, type, lat, lng, options) {
  const payload = {
    author_id: authorId,
    body,
    type,
    geom: `POINT(${lng} ${lat})`,
    ...(options ? { options } : {}),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Failed: ${body.slice(0, 40)} →`, err);
  } else {
    console.log(`✅ ${type.padEnd(6)} | ${body.slice(0, 50)}`);
  }
}

async function main() {
  const authorId = await getAuthorId();

  const questions = [
    // ── yakın (< 200 m) ──────────────────────────────────────────────
    {
      body: 'Buradaki kafe mi yoksa fırın mı daha iyi?',
      type: 'vote',
      ...offset(50, 30),
      options: [{ label: 'Kafe', count: 0 }, { label: 'Hayır', count: 0 }],
    },
    {
      body: 'Bu sokakta en çok ne sesi duyuyorsunuz?',
      type: 'choice',
      ...offset(-80, 60),
      options: [
        { label: 'Trafik', count: 0 },
        { label: 'Müzik', count: 0 },
        { label: 'Çocuk sesleri', count: 0 },
        { label: 'Sessizlik', count: 0 },
      ],
    },
    {
      body: 'Bu köşede ne inşa edilmeli?',
      type: 'open',
      ...offset(120, -50),
    },
    {
      body: 'Buradaki park yeterince büyük mü?',
      type: 'vote',
      ...offset(-30, -90),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },
    {
      body: 'Bu mahallede yaşamak ister miydiniz?',
      type: 'vote',
      ...offset(10, 10),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },

    // ── yakın-orta (200–500 m) ───────────────────────────────────────
    {
      body: 'Buraya en yakın metro durağı hangisi?',
      type: 'choice',
      ...offset(300, 200),
      options: [
        { label: 'Dudullu', count: 0 },
        { label: 'Parseller', count: 0 },
        { label: 'Çarşı', count: 0 },
      ],
    },
    {
      body: 'Bu cadde hakkında ne düşünüyorsunuz?',
      type: 'open',
      ...offset(-250, 350),
    },
    {
      body: 'Akşamları bu bölgede güvende hissediyor musunuz?',
      type: 'vote',
      ...offset(400, -100),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },
    {
      body: 'Bölgedeki ulaşımı nasıl buluyorsunuz?',
      type: 'choice',
      ...offset(-400, -250),
      options: [
        { label: 'Çok iyi', count: 0 },
        { label: 'İdare eder', count: 0 },
        { label: 'Kötü', count: 0 },
      ],
    },

    // ── orta (500 m – 1 km) ─────────────────────────────────────────
    {
      body: 'Bu semtte oturanlar sabah kahvaltısını nerede yapıyor?',
      type: 'open',
      ...offset(700, 300),
    },
    {
      body: 'Yakın çevrede yeni bir market açılmalı mı?',
      type: 'vote',
      ...offset(-600, 500),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },
    {
      body: 'Buradaki trafik saatleri arasında hangisi en yoğun?',
      type: 'choice',
      ...offset(800, -400),
      options: [
        { label: '07:00–09:00', count: 0 },
        { label: '12:00–14:00', count: 0 },
        { label: '17:00–19:00', count: 0 },
        { label: 'Gece', count: 0 },
      ],
    },
    {
      body: '1 km yakınınızda bisiklet yolu olsa kullanır mıydınız?',
      type: 'vote',
      ...offset(-900, -300),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },

    // ── uzak (2–5 km) ───────────────────────────────────────────────
    {
      body: 'Kadıköy semti hakkında ne düşünüyorsunuz?',
      type: 'open',
      ...offset(2500, 1800),
    },
    {
      body: 'İstanbul\'un en iyi yakası hangisi?',
      type: 'choice',
      ...offset(-3000, 2000),
      options: [
        { label: 'Avrupa', count: 0 },
        { label: 'Asya', count: 0 },
        { label: 'Fark etmez', count: 0 },
      ],
    },
    {
      body: 'Bu bölgeye ulaşım için hangi yolu tercih edersiniz?',
      type: 'vote',
      ...offset(4000, -3000),
      options: [{ label: 'Metrobüs', count: 0 }, { label: 'Otobüs', count: 0 }],
    },
    {
      body: 'Çevredeki yeşil alanlar yeterli mi?',
      type: 'vote',
      ...offset(-4500, -2000),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },
    {
      body: 'Bu mesafeden şehir merkezine gitmeye değer mi?',
      type: 'vote',
      ...offset(3500, 4000),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },

    // ── aynı nokta testi (spread sistemi) ───────────────────────────
    {
      body: 'Aynı noktada birinci soru — spread test',
      type: 'open',
      ...offset(150, 150),
    },
    {
      body: 'Aynı noktada ikinci soru — spread test',
      type: 'vote',
      ...offset(150, 150),
      options: [{ label: 'Evet', count: 0 }, { label: 'Hayır', count: 0 }],
    },
    {
      body: 'Aynı noktada üçüncü soru — spread test',
      type: 'choice',
      ...offset(150, 150),
      options: [
        { label: 'A', count: 0 },
        { label: 'B', count: 0 },
        { label: 'C', count: 0 },
      ],
    },
  ];

  console.log(`\nSeeding ${questions.length} questions around (${CENTER_LAT}, ${CENTER_LNG})...\n`);

  for (const q of questions) {
    await insert(authorId, q.body, q.type, q.lat, q.lng, q.options);
  }

  console.log('\nDone!');
}

main().catch(console.error);
