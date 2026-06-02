-- ════════════════════════════════════════════════════════════════════════════
-- seed_v2_system.sql — Engagement seed sistemi (İstanbul'dan başlar)
-- ════════════════════════════════════════════════════════════════════════════
-- İçindekiler:
--   1) Şema: is_bot, last_seed_drop_at, seed_templates, seed_drops
--   2) Bot profilleri (gerçekçi Türkçe personalar)
--   3) Generic soru havuzu (auto-drop için — konuma bağımsız, 3 tip)
--   4) run_seed_drop() RPC — asıl engagement motoru
--   5) İstanbul statik yerleşimi (haritayı dolu göstermek için, 3 tip, semt semt)
--
-- ÖNCE seed_v2_cleanup.sql çalıştırılmış olmalı.
-- Supabase → SQL Editor'de çalıştır. İdempotent (tekrar çalıştırılabilir).
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1) Şema ────────────────────────────────────────────────────────────────
alter table profiles add column if not exists is_bot boolean not null default false;
alter table profiles add column if not exists last_seed_drop_at timestamptz;
-- (last_geom / last_location_at / last_notified_nearby_at nearby_question_push.sql'de eklendi)

create table if not exists seed_templates (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  type text not null check (type in ('vote','choice','open')),
  options jsonb,                       -- 'choice' için [{label,count}]
  scope text not null default 'generic' check (scope in ('generic','istanbul')),
  active boolean not null default true,
  unique (body)
);

create table if not exists seed_drops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  template_id uuid not null references seed_templates(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists seed_drops_user_idx on seed_drops(user_id);

-- İç tablolar: client erişimi yok (RLS açık, policy yok → anon engellenir;
-- edge function service-role ile RLS'i bypass eder).
alter table seed_templates enable row level security;
alter table seed_drops    enable row level security;


-- ─── 2) Bot profilleri ──────────────────────────────────────────────────────
insert into profiles (id, nickname, avatar, gender, is_bot) values
  ('c0d00000-0000-0000-0000-000000000001', 'deniz',  'fox',     'male',   true),
  ('c0d00000-0000-0000-0000-000000000002', 'elif',   'rabbit',  'female', true),
  ('c0d00000-0000-0000-0000-000000000003', 'barış',  'wolf',    'male',   true),
  ('c0d00000-0000-0000-0000-000000000004', 'sevgi',  'bear',    'female', true),
  ('c0d00000-0000-0000-0000-000000000005', 'tolga',  'owl',     'male',   true),
  ('c0d00000-0000-0000-0000-000000000006', 'pelin',  'cat',     'female', true),
  ('c0d00000-0000-0000-0000-000000000007', 'kerem',  'lion',    'male',   true),
  ('c0d00000-0000-0000-0000-000000000008', 'derya',  'dolphin', 'female', true)
on conflict (id) do update set is_bot = true;


-- ─── 3) Generic soru havuzu (auto-drop) ─────────────────────────────────────
-- Konuma bağımsız, "bu çevre / buralarda / bu mahalle" diliyle yazılmış.
-- Kullanıcının tam konumuna yakın düşürülür.

insert into seed_templates (body, type, options, scope) values
  -- vote
  ('Bu çevrede akşamları yürüyüş yapmak güvenli mi?',           'vote', null, 'generic'),
  ('Buralarda geç saatte açık market bulunur mu?',              'vote', null, 'generic'),
  ('Bu mahallede otopark bulmak zor mu?',                       'vote', null, 'generic'),
  ('Çevrede sessiz, çalışılabilecek bir kafe var mı?',          'vote', null, 'generic'),
  ('Bu civarda toplu taşıma sık geçiyor mu?',                   'vote', null, 'generic'),
  ('Burası hafta sonları çok kalabalık oluyor mu?',             'vote', null, 'generic'),
  ('Bu mahallede iyi bir fırın var mı?',                        'vote', null, 'generic'),
  ('Köpekle gezmek için buralarda uygun bir park var mı?',      'vote', null, 'generic'),
  ('Bu çevrede akşam taksi bulmak kolay mı?',                   'vote', null, 'generic'),
  ('Buralarda gece nöbetçi eczane yakın mı?',                   'vote', null, 'generic'),
  -- open
  ('Bu çevrede en iyi kahvaltıyı nerede yaptınız?',             'open', null, 'generic'),
  ('Buralarda gerçekten iyi bir kahve nerede içilir?',          'open', null, 'generic'),
  ('Yakınlarda akşam yemeği için ne önerirsiniz?',              'open', null, 'generic'),
  ('Bu mahalleye yeni taşındım, bilmem gereken bir şey var mı?','open', null, 'generic'),
  ('Çevrede uygun fiyatlı, temiz bir lokanta var mı?',          'open', null, 'generic'),
  ('Buralarda tatlı için en iyi adres neresi?',                 'open', null, 'generic'),
  ('Bu civarda spor yapmak için nereyi önerirsiniz?',           'open', null, 'generic'),
  ('Akşam takılmak için buralarda güzel bir mekân var mı?',     'open', null, 'generic'),
  ('Bu çevrede çocukla gidilebilecek bir yer var mı?',          'open', null, 'generic'),
  ('Buralarda en sevdiğiniz esnaf hangisi, neden?',             'open', null, 'generic'),
  -- choice
  ('Bu çevrede en çok ne eksik?',          'choice',
     '[{"label":"Yeşil alan","count":0},{"label":"Otopark","count":0},{"label":"Kafe & restoran","count":0},{"label":"Market","count":0}]'::jsonb, 'generic'),
  ('Burası en çok ne zaman kalabalık olur?','choice',
     '[{"label":"Sabah","count":0},{"label":"Öğlen","count":0},{"label":"Akşam","count":0},{"label":"Gece","count":0}]'::jsonb, 'generic'),
  ('Bu mahallede en çok neyi seviyorsun?',  'choice',
     '[{"label":"Sakinliği","count":0},{"label":"Ulaşımı","count":0},{"label":"Esnafı","count":0},{"label":"Manzarası","count":0}]'::jsonb, 'generic'),
  ('Hafta sonu buralarda ne yapmayı seversin?','choice',
     '[{"label":"Yürüyüş","count":0},{"label":"Kafede oturmak","count":0},{"label":"Alışveriş","count":0},{"label":"Evde dinlenmek","count":0}]'::jsonb, 'generic'),
  ('Bu çevrede ulaşımı nasıl buluyorsun?',  'choice',
     '[{"label":"Çok iyi","count":0},{"label":"İdare eder","count":0},{"label":"Kötü","count":0},{"label":"Kullanmıyorum","count":0}]'::jsonb, 'generic'),
  ('Buranın en büyük sorunu sence ne?',     'choice',
     '[{"label":"Trafik","count":0},{"label":"Gürültü","count":0},{"label":"Temizlik","count":0},{"label":"Park sorunu","count":0}]'::jsonb, 'generic')
on conflict (body) do nothing;

-- vote şablonlarına Evet/Hayır seçeneklerini ekle (uygulama da böyle oluşturuyor:
-- AskQuestionModal → [{Evet,0},{Hayır,0}]). Answers ekranı options'a bağlı olduğu için şart.
update seed_templates
set options = '[{"label":"Evet","count":0},{"label":"Hayır","count":0}]'::jsonb
where type = 'vote' and options is null;


-- ─── 4) run_seed_drop() — engagement motoru ─────────────────────────────────
-- Cron edge function (seed-dropper) SAATTE BİR çağırır (0 * * * *).
--
-- Kadans (kullanıcı bazlı, basit ve net):
--   • Yeni kullanıcı (last_seed_drop_at IS NULL): bir sonraki saatlik çalışmada
--     ilk seed'ini alır → yani kayıttan sonra ≤1 saat içinde. Artık "yeni" değil.
--   • Yerleşik kullanıcı: son seed'inden bu yana est_throttle_hours (4 saat)
--     geçtiyse 1 seed daha alır. Yani 4 saatte 1.
--
-- Uygun kullanıcı = bot değil + canlı konumu var + push token'lı + son 7 gün aktif.
-- Her çalışmada uygun kullanıcı başına TAM 1 seed: havuzdan ona daha önce
-- atılmamış generic şablon, konumuna ~150–jitter_m metre rastgele bir bot adına
-- düşürülür. questions INSERT → nearby-push webhook → "Yakınında yeni soru 📍"
-- bildirimi. 1 seed/4saat olduğu için users_near_question'daki 1 saatlik bildirim
-- throttle'ına asla takılmaz → HER seed bildirim atar.
drop function if exists run_seed_drop(int, int, float, float);
drop function if exists run_seed_drop(int, int, float, float, boolean, int);
drop function if exists run_seed_drop(int, float);

create or replace function run_seed_drop(
  est_throttle_hours int   default 4,    -- yerleşik kullanıcı: 1 seed / 4 saat
  jitter_m           float default 700
) returns int
language plpgsql
security definer
as $$
declare
  u        record;
  v_tpl    seed_templates%rowtype;
  v_author uuid;
  v_geom   geography;
  v_qid    uuid;
  v_count  int := 0;
begin
  for u in
    select p.id, p.last_geom
    from profiles p
    where p.is_bot = false
      and p.last_geom is not null
      and p.push_token like 'ExponentPushToken%'
      and p.last_location_at > now() - interval '7 days'
      and (p.last_seed_drop_at is null                                          -- yeni kullanıcı
           or p.last_seed_drop_at < now() - make_interval(hours => est_throttle_hours))  -- 4 saat geçti
  loop
    -- Kullanıcıya daha önce atılmamış generic şablon
    select t.* into v_tpl
    from seed_templates t
    where t.active and t.scope = 'generic'
      and not exists (
        select 1 from seed_drops d where d.user_id = u.id and d.template_id = t.id
      )
    order by random()
    limit 1;

    -- Hepsi kullanıldıysa: havuzu sıfırdan kullanmaya izin ver
    if v_tpl.id is null then
      select t.* into v_tpl
      from seed_templates t
      where t.active and t.scope = 'generic'
      order by random()
      limit 1;
    end if;

    continue when v_tpl.id is null;  -- havuz boş

    -- Rastgele bot yazar
    select id into v_author from profiles where is_bot order by random() limit 1;
    continue when v_author is null;

    -- Konumu 150–jitter_m metre, rastgele yönde kaydır (çakışmasın, doğal görünsün)
    v_geom := ST_Project(u.last_geom, 150 + random() * (jitter_m - 150), random() * 2 * pi());

    insert into questions (author_id, body, type, options, geom, answer_count, created_at)
    values (v_author, v_tpl.body, v_tpl.type, v_tpl.options, v_geom, 0, now())
    returning id into v_qid;

    insert into seed_drops (user_id, template_id, question_id)
    values (u.id, v_tpl.id, v_qid);

    update profiles set last_seed_drop_at = now() where id = u.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Güvenlik: sadece cron edge function (service_role) çağırabilsin; anon/clients çağıramaz.
revoke all on function run_seed_drop(int, float) from public;
grant execute on function run_seed_drop(int, float) to service_role;


-- ─── 5) İstanbul statik yerleşimi ───────────────────────────────────────────
-- Harita ilk açıldığında dolu görünsün diye İstanbul semtlerine yayılmış,
-- gerçekçi (AI gibi olmayan), 3 tipte sorular. Bot adına, çeşitli zaman/sayılarla.
-- Tekrar çalıştırmada çoğalmasın diye önce mevcut İstanbul bot sorularını temizler.
delete from reports where question_id in (
  select id from questions
  where author_id in (select id from profiles where is_bot)
    and st_dwithin(geom, st_makepoint(28.9784, 41.0082)::geography, 60000)
    and id not in (select question_id from seed_drops where question_id is not null)
);
delete from answers where question_id in (
  select id from questions
  where author_id in (select id from profiles where is_bot)
    and st_dwithin(geom, st_makepoint(28.9784, 41.0082)::geography, 60000)
    and id not in (select question_id from seed_drops where question_id is not null)
);
delete from questions
where author_id in (select id from profiles where is_bot)
  and st_dwithin(geom, st_makepoint(28.9784, 41.0082)::geography, 60000)   -- ~60km İstanbul
  and id not in (select question_id from seed_drops where question_id is not null);  -- auto-drop'lara dokunma

insert into questions (author_id, body, type, options, geom, answer_count, created_at) values
  -- Karaköy / Galata
  ('c0d00000-0000-0000-0000-000000000001', 'Karaköy''de akşam yürüyüşü güvenli mi?', 'vote', null, st_makepoint(28.9744, 41.0220)::geography, 12, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000002', 'Galata''da sakin çalışabileceğin bir kafe öner', 'open', null, st_makepoint(28.9738, 41.0255)::geography, 9, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000003', 'Akşam yemeği için Karaköy''de iyi balık lokantası?', 'open', null, st_makepoint(28.9770, 41.0210)::geography, 19, now() - interval '45 minutes'),
  ('c0d00000-0000-0000-0000-000000000004', 'Karaköy''de hafta içi en çok ne zaman kalabalık olur?', 'choice',
     '[{"label":"Sabah","count":4},{"label":"Öğlen","count":11},{"label":"Akşam","count":17},{"label":"Gece","count":6}]'::jsonb, st_makepoint(28.9752, 41.0222)::geography, 38, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000005', 'Galata Kulesi çevresinde otopark bulunur mu?', 'vote', null, st_makepoint(28.9741, 41.0259)::geography, 7, now() - interval '4 hours'),

  -- Beyoğlu / İstiklal / Cihangir
  ('c0d00000-0000-0000-0000-000000000006', 'İstiklal''de hafta sonu çok mu kalabalık?', 'vote', null, st_makepoint(28.9784, 41.0338)::geography, 31, now() - interval '15 minutes'),
  ('c0d00000-0000-0000-0000-000000000007', 'İstiklal civarında iyi bir kitapçı öner', 'open', null, st_makepoint(28.9786, 41.0330)::geography, 11, now() - interval '4 hours'),
  ('c0d00000-0000-0000-0000-000000000008', 'Cihangir''de gece geç saate kadar açık mekân var mı?', 'vote', null, st_makepoint(28.9817, 41.0300)::geography, 13, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000001', 'Beyoğlu''nda hafta sonu ne yapmayı seversin?', 'choice',
     '[{"label":"Sinema","count":9},{"label":"Kafede oturmak","count":21},{"label":"Sergi gezmek","count":7},{"label":"Yürüyüş","count":14}]'::jsonb, st_makepoint(28.9780, 41.0325)::geography, 51, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000002', 'Çukurcuma''da antikacılar bugün açık mı?', 'vote', null, st_makepoint(28.9803, 41.0290)::geography, 7, now() - interval '3 hours'),

  -- Kadıköy / Moda
  ('c0d00000-0000-0000-0000-000000000003', 'Kadıköy çarşı çevresi akşam güvenli mi?', 'vote', null, st_makepoint(29.0227, 40.9907)::geography, 24, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000004', 'Kadıköy''de iyi muhallebici nerede?', 'open', null, st_makepoint(29.0225, 40.9908)::geography, 28, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000005', 'Moda sahili sabah koşusu için uygun mu?', 'vote', null, st_makepoint(29.0261, 40.9879)::geography, 18, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000006', 'Kadıköy''de en sevdiğin yan nedir?', 'choice',
     '[{"label":"Yeme-içme","count":33},{"label":"Deniz manzarası","count":19},{"label":"Sokak kültürü","count":15},{"label":"Ulaşım","count":8}]'::jsonb, st_makepoint(29.0230, 40.9903)::geography, 75, now() - interval '50 minutes'),
  ('c0d00000-0000-0000-0000-000000000007', 'Kadıköy''de vegan seçenek olan yer var mı?', 'open', null, st_makepoint(29.0222, 40.9912)::geography, 13, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000008', 'Kadıköy vapur iskelesi şu an kalabalık mı?', 'vote', null, st_makepoint(29.0206, 40.9936)::geography, 34, now() - interval '10 minutes'),

  -- Beşiktaş / Ortaköy
  ('c0d00000-0000-0000-0000-000000000001', 'Beşiktaş''ta iyi sucuk-tost nerede?', 'open', null, st_makepoint(29.0048, 41.0420)::geography, 17, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000002', 'Beşiktaş çarşı içinde otopark var mı?', 'vote', null, st_makepoint(29.0045, 41.0415)::geography, 12, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000003', 'Ortaköy''de çevreye park etmek zor mu?', 'vote', null, st_makepoint(29.0278, 41.0478)::geography, 11, now() - interval '4 hours'),
  ('c0d00000-0000-0000-0000-000000000004', 'Barbaros Bulvarı''nda trafik şu an nasıl?', 'choice',
     '[{"label":"Akıcı","count":5},{"label":"Orta","count":13},{"label":"Yoğun","count":22},{"label":"Kilitli","count":9}]'::jsonb, st_makepoint(29.0070, 41.0400)::geography, 49, now() - interval '20 minutes'),

  -- Eminönü / Sultanahmet / Fatih
  ('c0d00000-0000-0000-0000-000000000005', 'Mısır Çarşısı şu an açık mı?', 'vote', null, st_makepoint(28.9705, 41.0164)::geography, 22, now() - interval '25 minutes'),
  ('c0d00000-0000-0000-0000-000000000006', 'Eminönü''nde balık-ekmek nereden alınır?', 'open', null, st_makepoint(28.9716, 41.0172)::geography, 19, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000007', 'Sultanahmet''e buradan yürüyerek kaç dakika?', 'open', null, st_makepoint(28.9700, 41.0168)::geography, 7, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000008', 'Eminönü vapur sırası şu an uzun mu?', 'vote', null, st_makepoint(28.9720, 41.0175)::geography, 14, now() - interval '10 minutes'),

  -- Üsküdar / Çengelköy
  ('c0d00000-0000-0000-0000-000000000001', 'Üsküdar sahili akşam oturmaya uygun mu?', 'vote', null, st_makepoint(29.0143, 41.0234)::geography, 16, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000002', 'Üsküdar''da iyi bir simit fırını nerede?', 'open', null, st_makepoint(29.0150, 41.0225)::geography, 8, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000003', 'Çengelköy''de iyi börekçi var mı?', 'open', null, st_makepoint(29.0578, 41.0625)::geography, 8, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000004', 'Üsküdar iskele trafiği şu an nasıl?', 'vote', null, st_makepoint(29.0135, 41.0240)::geography, 20, now() - interval '8 minutes'),

  -- Nişantaşı / Şişli
  ('c0d00000-0000-0000-0000-000000000005', 'Nişantaşı''nda brunch için iyi yer?', 'open', null, st_makepoint(28.9955, 41.0488)::geography, 23, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000006', 'Şişli metro çıkışı yakınında ATM var mı?', 'vote', null, st_makepoint(28.9880, 41.0605)::geography, 4, now() - interval '6 hours'),
  ('c0d00000-0000-0000-0000-000000000007', 'Nişantaşı''nda en çok ne için gelirsin?', 'choice',
     '[{"label":"Alışveriş","count":18},{"label":"Kafe-restoran","count":24},{"label":"İş","count":7},{"label":"Sadece geçiş","count":5}]'::jsonb, st_makepoint(28.9960, 41.0480)::geography, 54, now() - interval '2 hours'),

  -- Sahil / kuzey hat
  ('c0d00000-0000-0000-0000-000000000008', 'Bebek sahili yürüyüş için uygun mu?', 'vote', null, st_makepoint(29.0412, 41.0785)::geography, 14, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000001', 'Emirgan Korusu şu an kalabalık mı?', 'vote', null, st_makepoint(29.0546, 41.1093)::geography, 9, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000002', 'Sarıyer''de balık almak için en iyi yer neresi?', 'open', null, st_makepoint(29.0627, 41.1666)::geography, 12, now() - interval '5 hours'),
  ('c0d00000-0000-0000-0000-000000000003', 'Kabataş''tan vapura binmek kolay mı şu an?', 'vote', null, st_makepoint(28.9982, 41.0340)::geography, 17, now() - interval '30 minutes'),

  -- Anadolu yakası güney
  ('c0d00000-0000-0000-0000-000000000004', 'Bostancı sahilinde bisiklet yolu bakımlı mı?', 'vote', null, st_makepoint(29.1046, 40.9617)::geography, 8, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000005', 'Maltepe sahil parkı hafta sonu çok mu dolu?', 'vote', null, st_makepoint(29.1325, 40.9388)::geography, 11, now() - interval '4 hours'),
  ('c0d00000-0000-0000-0000-000000000006', 'Kartal''da akşam yemeği için ne önerirsiniz?', 'open', null, st_makepoint(29.1893, 40.8918)::geography, 9, now() - interval '2 hours'),

  -- Avrupa yakası batı
  ('c0d00000-0000-0000-0000-000000000007', 'Bakırköy sahili şu an kalabalık mı?', 'vote', null, st_makepoint(28.8736, 40.9784)::geography, 9, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000008', 'Florya''da deniz kenarında oturulacak yer var mı?', 'open', null, st_makepoint(28.7968, 40.9734)::geography, 15, now() - interval '3 hours'),

  -- Adalar
  ('c0d00000-0000-0000-0000-000000000001', 'Büyükada''ya vapur en son kaçta?', 'open', null, st_makepoint(29.1268, 40.8717)::geography, 12, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000002', 'Heybeliada''da bisiklet kiralanır mı?', 'vote', null, st_makepoint(29.0963, 40.8662)::geography, 5, now() - interval '5 hours'),

  -- ─── Maslak / Levent / Etiler / Ayazağa (kullanıcı konumu çevresi) ──────────
  -- Maslak merkez ~41.108, 29.018 — bu küme harita o bölgede açıldığında dolu görünsün.
  ('c0d00000-0000-0000-0000-000000000003', 'Maslak''ta öğlen uygun fiyatlı yemek için nereyi önerirsiniz?', 'open', null, st_makepoint(29.0177, 41.1079)::geography, 21, now() - interval '35 minutes'),
  ('c0d00000-0000-0000-0000-000000000004', 'Maslak ofis bölgesinde en çok ne eksik?', 'choice',
     '[{"label":"Yeşil alan","count":19},{"label":"Uygun yemek","count":27},{"label":"Otopark","count":12},{"label":"Toplu taşıma","count":8}]'::jsonb, st_makepoint(29.0185, 41.1065)::geography, 66, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000005', 'Maslak''ta hafta içi en yoğun saat hangisi?', 'choice',
     '[{"label":"Sabah","count":24},{"label":"Öğlen","count":15},{"label":"Akşam","count":29},{"label":"Gece","count":4}]'::jsonb, st_makepoint(29.0170, 41.1090)::geography, 72, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000006', 'Maslak''ta gece geç saatte taksi bulmak kolay mı?', 'vote', null, st_makepoint(29.0175, 41.1082)::geography, 18, now() - interval '40 minutes'),
  ('c0d00000-0000-0000-0000-000000000007', 'Maslak''ta yaşamak ister miydin?', 'vote', null, st_makepoint(29.0182, 41.1075)::geography, 33, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000008', 'İTÜ Ayazağa çevresinde öğrenci dostu kafe var mı?', 'open', null, st_makepoint(29.0240, 41.1050)::geography, 14, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000001', 'Ayazağa''da akşam yürüyüşü güvenli mi?', 'vote', null, st_makepoint(29.0095, 41.1128)::geography, 16, now() - interval '2 hours'),
  ('c0d00000-0000-0000-0000-000000000002', 'Sarıyer yönüne bu saatte çıkış trafiği yoğun mu?', 'vote', null, st_makepoint(29.0205, 41.1185)::geography, 27, now() - interval '12 minutes'),
  ('c0d00000-0000-0000-0000-000000000003', 'Levent''te bu saatte otopark bulmak zor mu?', 'vote', null, st_makepoint(29.0110, 41.0820)::geography, 23, now() - interval '25 minutes'),
  ('c0d00000-0000-0000-0000-000000000004', 'Levent''te gerçekten iyi bir kahve nerede içilir?', 'open', null, st_makepoint(29.0118, 41.0812)::geography, 29, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000005', '4. Levent çevresinde akşam açık spor salonu var mı?', 'vote', null, st_makepoint(29.0090, 41.0870)::geography, 9, now() - interval '4 hours'),
  ('c0d00000-0000-0000-0000-000000000006', 'Etiler''de sakin oturulacak bir kafe önerir misiniz?', 'open', null, st_makepoint(29.0330, 41.0810)::geography, 22, now() - interval '50 minutes'),
  ('c0d00000-0000-0000-0000-000000000007', 'Etiler''de köpekle gezmek için uygun bir park var mı?', 'vote', null, st_makepoint(29.0345, 41.0805)::geography, 11, now() - interval '3 hours'),
  ('c0d00000-0000-0000-0000-000000000008', 'Maslak''tan Levent''e bu saatte metroyla kaç dakika sürüyor?', 'open', null, st_makepoint(29.0160, 41.1010)::geography, 13, now() - interval '30 minutes'),
  ('c0d00000-0000-0000-0000-000000000001', 'Maslak çevresinde sessiz, çalışılabilecek bir kafe var mı?', 'open', null, st_makepoint(29.0190, 41.1058)::geography, 17, now() - interval '1 hour'),
  ('c0d00000-0000-0000-0000-000000000002', 'Maslak''ta hafta sonu en çok ne yapılır?', 'choice',
     '[{"label":"AVM''de vakit","count":18},{"label":"Kafede oturmak","count":14},{"label":"Belgrad Ormanı","count":31},{"label":"Evde dinlenmek","count":9}]'::jsonb, st_makepoint(29.0168, 41.1095)::geography, 72, now() - interval '2 hours');

-- Statik vote sorularına Evet/Hayır seçenekleri (answer_count ~%60 Evet / %40 Hayır dağıtılır).
update questions q
set options = jsonb_build_array(
  jsonb_build_object('label', 'Evet',  'count', round(q.answer_count * 0.6)),
  jsonb_build_object('label', 'Hayır', 'count', q.answer_count - round(q.answer_count * 0.6))
)
where q.type = 'vote'
  and q.options is null
  and q.author_id in (select id from profiles where is_bot);
