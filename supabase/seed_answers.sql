-- Seed answers for SF questions
-- Run AFTER seed_sf.sql
-- Uses WITH to get question IDs by body text, then inserts answers + fixes answer_count

-- ─── Helper: get question ids ─────────────────────────────────────────────────
-- We match questions by body. If a question doesn't exist nothing is inserted (safe).

do $$
declare
  q_id uuid;
begin

  -- ── "Dolores Park şu an kalabalık mı?" (vote, 8 cevap)
  select id into q_id from questions where body ilike 'Dolores Park%kalabalık%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet');
  end if;

  -- ── "BART şu an düzgün çalışıyor mu?" (vote, 22 cevap)
  select id into q_id from questions where body ilike 'BART%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır');
  end if;

  -- ── "Fisherman's Wharf kalabalık mı şu an?" (vote, 31 cevap)
  select id into q_id from questions where body ilike 'Fisherman%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet');
  end if;

  -- ── "SoMa'da geç saate kadar açık bar?" (open, 18 cevap)
  select id into q_id from questions where body ilike 'SoMa%bar%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, body, upvotes) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Butter bar gece 2ye kadar açık, iyi cocktaillar var', 14),
      (q_id, 'a1000000-0000-0000-0000-000000000002', '21st Amendment Brewery hem gece geç hem yemek de var', 9),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'The Cask gece 2ye kadar, viski seçeneği güçlü', 7),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Bloodhound Bar ucuz ve geç saate kadar açık', 11),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'DNA Lounge ise cuma cumartesi sabah 6ya kadar', 19),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'AsiaSF eğlenceli ama pahalı', 4),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Third Rail Bar geç saate kadar iyi müzik de var', 8),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Bar Fluxus genelde gece 1,5e kadar açık', 3),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Slim''s konserleri de var, geç saate kadar açık kalıyor', 6),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'The End Up gece clubı sabah 6ya kadar açık kalıyor', 16),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hole in the Wall Bar ucuz ve rahat', 5),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Vessel Nightclub hafta sonu geç saate kadar', 4),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Mr. Smith''s Bar oldukça uygun fiyatlı', 2),
      (q_id, 'a1000000-0000-0000-0000-000000000004', '1015 Folsom hafta sonu en geç kapanan yer', 12),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Oasis Club cuma cumartesi sabah 4e kadar', 7),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Bar Agricole kokteyl için süper ama biraz erken kapanıyor', 3),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Bergerac Bar Wine bar ama gece 12ye kadar', 5),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'The Endup en iyisi hafta sonu gece geç için', 9);
  end if;

  -- ── "Chinatown'da dim sum için en iyi yer?" (open, 24 cevap)
  select id into q_id from questions where body ilike 'Chinatown%dim sum%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, body, upvotes) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Dim Sum Club kesinlikle — har gow mükemmel', 21),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Great Eastern Restaurant klasik seçim, çok eski köklü', 15),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'City View Restaurant sabah 11den itibaren açılıyor', 12),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Good Mong Kok Bakery ucuz ama muazzam BBQ pork bun', 18),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hang Ah Tea Room en eski dim sum yeri, tarihi bir yer', 9),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Yank Sing biraz pahalı ama kalite çok iyi', 14),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Gold Mountain Restaurant siu mai için harika', 7),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Lai Hong Lounge hafta sonu erken gel, kuyruk oluyor', 11),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Oriental Pearl Restaurant biraz sakin ama lezzetli', 5),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Ton Kiang Richmond bölgesinde ama en iyilerinden', 16),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Dol Ho Restaurant ucuz ve küçük ama çok taze', 8),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Pearl City Seafood hafta içi daha az kalabalık', 6),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'House of Nanking teknk dim sum değil ama harika', 4),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Sam Wo Restaurant sabah erken açılıyor, taze malzeme', 3),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'R&G Lounge akşam daha iyi ama öğlen de açık', 7),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Lichee Garden geleneksel vibe, nostalji hissi', 5),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Bund Shanghai Restaurant şangay usulu dumplingler için', 9),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Great China Restaurant cheung fun için gel', 6),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Empress of China kapandı artık, yeni yere git', 2),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Z & Y Bistro Sichuan usulü dim sum istiyorsan burası', 8),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Shanghai Dumpling King uzak ama çok değer', 11),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Fook Yuen Seafood hafta sonu için rezervasyon şart', 4),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Eastern Bakery pastry için ama dim sum daha azdır', 3),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Delicious Dim Sum gerçekten adı gibi, lezzetli', 13);
  end if;

  -- ── "North Beach'te iyi pizza nerede?" (open, 19 cevap)
  select id into q_id from questions where body ilike 'North Beach%pizza%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, body, upvotes) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Tony''s Pizza Napoletana — Dünya şampiyonu pizza yapıyor', 25),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Golden Boy Pizza dilim satıyor, gece geç saate kadar açık', 18),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Caffe Sport eski köklü İtalyan, deniz ürünlü pizza harika', 11),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'L''Osteria del Forno fırın pizzası için kesinlikle', 14),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Mozzeria tamamen Deaf-owned restaurant, super mozzarella', 8),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Trattoria Contadina ev yemesi gibi sıcak ortam', 7),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Vesuvio''nun yanındaki Golden Boy''dan iyi dilim alırım hep', 16),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Sotto Mare deniz mahsullü pasta da yapıyor, pizza da var', 5),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Park Tavern biraz fine dining ama pizza da iyi', 4),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Bocce Cafe açık hava bahçesi var, güzel ortam', 9),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Original Joe''s North Beach''te, klasik SF restoranı', 6),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Giordano Bros''ın focaccia sandviçleri de harika', 3),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Mama''s için sabah erken kuyruğa gir ama pizza yok', 2),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Palermo Deli''de dilim pizza en uygun fiyatlı', 7),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Michelangelo Cafe küçük ama kaliteli', 4),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Tony''s''in kuyrukta 1 saat beklemeye değiyor kesinlikle', 12),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Cafe Zoetrope Coppola''nın kafesi, pizza da var', 5),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Stinking Rose garlic temalı restoran, pizza da garlic ağırlıklı', 8),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Il Pollaio pizza yok ama tavuk ızgara için gel', 3);
  end if;

  -- ── "Lombard Street şu an kalabalık mı?" (vote, 33 cevap)
  select id into q_id from questions where body ilike 'Lombard Street%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet');
  end if;

  -- ── "Caltrain şu an gecikmeli mi?" (vote, 25 cevap)
  select id into q_id from questions where body ilike 'Caltrain%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet');
  end if;

  -- ── "Tenderloin'dan geçmek güvenli mi?" (vote, 29 cevap)
  select id into q_id from questions where body ilike 'Tenderloin%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır');
  end if;

  -- ── "Alcatraz turu için bilet kalmış mı?" (vote, 28 cevap)
  select id into q_id from questions where body ilike 'Alcatraz%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Hayır');
  end if;

  -- ── "Tartine Bakery'de kuyruk uzun mu?" (vote, 21 cevap)
  select id into q_id from questions where body ilike 'Tartine%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, choice) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Hayır'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Evet'),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hayır');
  end if;

  -- ── "Divisadero'da brunch için en iyi yer?" (open, 16 cevap)
  select id into q_id from questions where body ilike 'Divisadero%brunch%' limit 1;
  if q_id is not null then
    insert into answers (question_id, author_id, body, upvotes) values
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Nopa — hafta sonu brunch''ı efsane ama kuyruk uzun', 19),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Nopalito için de aynı, Mexican brunch harika', 12),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Cafe Crudo hafta içi daha sakin ve kaliteli', 8),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'The Mill ekmek ve kahvesi çok iyi, brunch menüsü de var', 14),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Brenda''s French Soul Food uzakça ama çok değer', 11),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Alamo Square Cafe rahat yer, yoğunluk olmaz', 6),
      (q_id, 'a1000000-0000-0000-0000-000000000002', '1601 Bar & Kitchen güzel mimari, hafta sonu kalabalık', 5),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Magnolia Brewing hem bira hem brunch istiyorsan', 9),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Loving Hut vegan seçenekler için iyi', 3),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Roam Artisan Burgers öğlen için güzel ama brunch yok', 2),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Hollow bölge için güzel, sessiz ortam', 7),
      (q_id, 'a1000000-0000-0000-0000-000000000002', 'Parada 22 Puerto Rican brunch, farklı bir deneyim', 10),
      (q_id, 'a1000000-0000-0000-0000-000000000003', 'Nopa açılmadan önce kuyruğa gir, buna değer', 15),
      (q_id, 'a1000000-0000-0000-0000-000000000004', 'Bar Crudo deniz ürünlü brunch istiyorsan burası', 4),
      (q_id, 'a1000000-0000-0000-0000-000000000005', 'Udupi Palace Hint sayfasında brunch farklı ama güzel', 3),
      (q_id, 'a1000000-0000-0000-0000-000000000001', 'Bi-Rite Market açık sandviç alıp Alamo''da yemek', 8);
  end if;

  -- ── Tüm soruların answer_count'unu gerçek cevap sayısından güncelle
  update questions q
  set answer_count = (select count(*) from answers a where a.question_id = q.id);

end $$;
