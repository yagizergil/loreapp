-- Seed: 150 realistic questions around Istanbul (Karaköy / Beyoğlu / Kadiköy area)
-- Run AFTER schema.sql

-- Seed profiles
insert into profiles (id, nickname, avatar) values
  ('a1000000-0000-0000-0000-000000000001', 'selin_k', 'fox'),
  ('a1000000-0000-0000-0000-000000000002', 'mert42', 'owl'),
  ('a1000000-0000-0000-0000-000000000003', 'ayse_g', 'bear'),
  ('a1000000-0000-0000-0000-000000000004', 'can_d', 'wolf'),
  ('a1000000-0000-0000-0000-000000000005', 'zeynep_a', 'rabbit')
on conflict do nothing;

-- vote type questions around Karaköy / Galata
insert into questions (author_id, body, type, geom, answer_count, created_at) values
  ('a1000000-0000-0000-0000-000000000001', 'Karaköy''de akşam yürüyüşü güvenli mi?', 'vote', st_makepoint(28.9744, 41.0220)::geography, 12, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Galata Kulesi bölgesinde otopark bulabilir misin?', 'vote', st_makepoint(28.9741, 41.0259)::geography, 7, now() - interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Karaköy sahilinde wifi olan kafe var mı?', 'vote', st_makepoint(28.9760, 41.0200)::geography, 9, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000004', 'Bu bölgede akşam 22:00''den sonra taksi bulmak kolay mı?', 'vote', st_makepoint(28.9730, 41.0215)::geography, 5, now() - interval '6 hours'),
  ('a1000000-0000-0000-0000-000000000005', 'Rıhtım boyunca yürünebilir mi?', 'vote', st_makepoint(28.9780, 41.0205)::geography, 18, now() - interval '30 minutes'),
  ('a1000000-0000-0000-0000-000000000001', 'Bölgede çarşamba günleri yoğunluk fazla mı?', 'vote', st_makepoint(28.9750, 41.0230)::geography, 3, now() - interval '8 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Karaköy pazarda organik ürün satıyor mu?', 'vote', st_makepoint(28.9765, 41.0225)::geography, 6, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Metro istasyonuna yürüme mesafesinde miyiz?', 'vote', st_makepoint(28.9740, 41.0240)::geography, 11, now() - interval '5 hours'),

-- open type questions
  ('a1000000-0000-0000-0000-000000000004', 'Bu semtte en iyi kahvaltı nerede?', 'open', st_makepoint(28.9748, 41.0212)::geography, 14, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000005', 'Galata''da sakin çalışabileceğin kafe öner', 'open', st_makepoint(28.9738, 41.0255)::geography, 8, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000001', 'Akşam yemeği için buraya yakın iyi balık lokantası?', 'open', st_makepoint(28.9770, 41.0210)::geography, 19, now() - interval '45 minutes'),
  ('a1000000-0000-0000-0000-000000000002', 'Karaköy''de geç saate kadar açık kafe var mı?', 'open', st_makepoint(28.9752, 41.0222)::geography, 6, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Buradan Taksim''e en hızlı nasıl gidilir?', 'open', st_makepoint(28.9735, 41.0218)::geography, 22, now() - interval '20 minutes'),

-- Beyoğlu / İstiklal area
  ('a1000000-0000-0000-0000-000000000004', 'İstiklal''de hafta sonu çok kalabalık mı?', 'vote', st_makepoint(28.9784, 41.0338)::geography, 31, now() - interval '15 minutes'),
  ('a1000000-0000-0000-0000-000000000005', 'Taksim meydanında oturacak yer var mı?', 'vote', st_makepoint(28.9772, 41.0368)::geography, 9, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000001', 'Bu çevrede ATM bulmak kolay mı?', 'vote', st_makepoint(28.9790, 41.0320)::geography, 4, now() - interval '7 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Çiçek Pasajı şu an açık mı?', 'vote', st_makepoint(28.9781, 41.0335)::geography, 7, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000003', 'İstiklal''de iyi bir kitapçı öner', 'open', st_makepoint(28.9786, 41.0330)::geography, 11, now() - interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Galatasaray Meydanı çevresinde uygun fiyatlı yer var mı?', 'open', st_makepoint(28.9780, 41.0325)::geography, 16, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000005', 'Tünel-Taksim arası tramvay kalabalık mı şu an?', 'vote', st_makepoint(28.9743, 41.0283)::geography, 5, now() - interval '30 minutes'),

-- Kadıköy area
  ('a1000000-0000-0000-0000-000000000001', 'Kadıköy çarşı çevresi akşam güvenli mi?', 'vote', st_makepoint(29.0227, 40.9907)::geography, 24, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000002', 'Moda sahili sabah koşusu için uygun mu?', 'vote', st_makepoint(29.0261, 40.9879)::geography, 18, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Kadıköy''de vegan seçenek olan yer var mı?', 'open', st_makepoint(29.0222, 40.9912)::geography, 13, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Haydarpaşa''ya yürüyerek gidilir mi?', 'vote', st_makepoint(29.0210, 40.9920)::geography, 7, now() - interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000005', 'Bu çevrede iyi bir espresso nerede?', 'open', st_makepoint(29.0234, 40.9899)::geography, 21, now() - interval '45 minutes'),
  ('a1000000-0000-0000-0000-000000000001', 'Kadıköy pazarı bugün var mı?', 'vote', st_makepoint(29.0218, 40.9910)::geography, 9, now() - interval '20 minutes'),
  ('a1000000-0000-0000-0000-000000000002', 'Moda''da çocuklarla gidilebilecek kafe var mı?', 'vote', st_makepoint(29.0255, 40.9872)::geography, 6, now() - interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Kadıköy vapur iskelesi ne kadar kalabalık?', 'vote', st_makepoint(29.0206, 40.9936)::geography, 34, now() - interval '10 minutes'),
  ('a1000000-0000-0000-0000-000000000004', 'Burada çalışabileceğim sakin bir yer var mı?', 'open', st_makepoint(29.0230, 40.9903)::geography, 15, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000005', 'Kadıköy''de iyi muhallebici nerede?', 'open', st_makepoint(29.0225, 40.9908)::geography, 28, now() - interval '2 hours'),

-- Beşiktaş area
  ('a1000000-0000-0000-0000-000000000001', 'Beşiktaş iskele çevresi gece kalabalık mı?', 'vote', st_makepoint(29.0042, 41.0430)::geography, 11, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Beşiktaş''ta iyi sucuk tost nerede?', 'open', st_makepoint(29.0048, 41.0420)::geography, 17, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000003', 'BJK stad çevresinde maç günü park yeri var mı?', 'vote', st_makepoint(29.0063, 41.0443)::geography, 8, now() - interval '6 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Barbaros Bulvarı''nda trafik şu an nasıl?', 'vote', st_makepoint(29.0070, 41.0400)::geography, 5, now() - interval '15 minutes'),
  ('a1000000-0000-0000-0000-000000000005', 'Beşiktaş çarşı içinde otopark var mı?', 'vote', st_makepoint(29.0045, 41.0415)::geography, 12, now() - interval '3 hours'),

-- Eminönü / Sultanahmet
  ('a1000000-0000-0000-0000-000000000001', 'Mısır Çarşısı şu an açık mı?', 'vote', st_makepoint(28.9705, 41.0164)::geography, 22, now() - interval '25 minutes'),
  ('a1000000-0000-0000-0000-000000000002', 'Eminönü''nde balık ekmek kaç lira?', 'open', st_makepoint(28.9716, 41.0172)::geography, 19, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000003', 'Sultanahmet''e yürüyerek gitmek kaç dakika?', 'open', st_makepoint(28.9700, 41.0168)::geography, 7, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Eminönü vapur saati şu an beklemeli mi?', 'vote', st_makepoint(28.9720, 41.0175)::geography, 14, now() - interval '10 minutes'),
  ('a1000000-0000-0000-0000-000000000005', 'Grand Bazaar girişi yakınında güvenli eşya bırakılacak yer var mı?', 'vote', st_makepoint(28.9680, 41.0107)::geography, 6, now() - interval '4 hours'),

-- Nişantaşı / Şişli
  ('a1000000-0000-0000-0000-000000000001', 'Nişantaşı''nda hafta içi öğle arası kalabalık mı?', 'vote', st_makepoint(28.9960, 41.0480)::geography, 9, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Abdi İpekçi''de otopark ücreti ne kadar?', 'open', st_makepoint(28.9970, 41.0470)::geography, 4, now() - interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Nişantaşı''nda brunch için iyi yer?', 'open', st_makepoint(28.9955, 41.0488)::geography, 23, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000004', 'Şişli metro çıkışı yakınında ATM var mı?', 'vote', st_makepoint(28.9880, 41.0605)::geography, 3, now() - interval '6 hours'),

-- Üsküdar
  ('a1000000-0000-0000-0000-000000000005', 'Üsküdar sahili akşam oturmaya uygun mu?', 'vote', st_makepoint(29.0143, 41.0234)::geography, 16, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000001', 'Çamlıca Tepesi''ne çıkmak şu an mümkün mü?', 'vote', st_makepoint(29.0628, 41.0264)::geography, 10, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Üsküdar''da iyi simit fırını nerede?', 'open', st_makepoint(29.0150, 41.0225)::geography, 8, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Üsküdar iskele trafiği şu an nasıl?', 'vote', st_makepoint(29.0135, 41.0240)::geography, 20, now() - interval '8 minutes'),

-- Cihangir / Çukurcuma
  ('a1000000-0000-0000-0000-000000000004', 'Cihangir''de gece geç saate kadar açık bar var mı?', 'vote', st_makepoint(28.9817, 41.0300)::geography, 13, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000005', 'Çukurcuma''da antika dükkânları bugün açık mı?', 'vote', st_makepoint(28.9803, 41.0290)::geography, 7, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000001', 'Cihangir parkında oturacak boş yer var mı?', 'vote', st_makepoint(28.9820, 41.0308)::geography, 5, now() - interval '20 minutes'),
  ('a1000000-0000-0000-0000-000000000002', 'Bu çevrede iyi bir brunch yeri öner', 'open', st_makepoint(28.9815, 41.0295)::geography, 18, now() - interval '2 hours'),

-- More scattered questions
  ('a1000000-0000-0000-0000-000000000003', 'Boğaz manzaralı uygun fiyatlı yer var mı?', 'open', st_makepoint(28.9950, 41.0510)::geography, 25, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000004', 'Ortaköy''de çevre park etmek zor mu?', 'vote', st_makepoint(29.0278, 41.0478)::geography, 11, now() - interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000005', 'Bebek sahili yürüyüşü için uygun mu?', 'vote', st_makepoint(29.0412, 41.0785)::geography, 14, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000001', 'Sarıyer pazarı bugün var mı?', 'vote', st_makepoint(29.0627, 41.1666)::geography, 6, now() - interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Emirgan Korusu şu an kalabalık mı?', 'vote', st_makepoint(29.0546, 41.1093)::geography, 9, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000003', 'Boğaz köprüsü yayaları alıyor mu?', 'vote', st_makepoint(29.0312, 41.0500)::geography, 4, now() - interval '8 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Kabataş''tan vapura binmek kolay mı?', 'vote', st_makepoint(28.9982, 41.0340)::geography, 17, now() - interval '30 minutes'),
  ('a1000000-0000-0000-0000-000000000005', 'Bostancı sahili yüzmeye uygun mu?', 'vote', st_makepoint(29.1046, 40.9617)::geography, 8, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000001', 'Pendik''te inşaat gürültüsü var mı hâlâ?', 'vote', st_makepoint(29.2290, 40.8756)::geography, 3, now() - interval '6 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Maltepe sahil yürüyüş yolu bakımlı mı?', 'vote', st_makepoint(29.1325, 40.9388)::geography, 11, now() - interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Kartal AVM hafta sonu kalabalık mı?', 'vote', st_makepoint(29.1893, 40.8918)::geography, 7, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Bakırköy sahili şu an kalabalık mı?', 'vote', st_makepoint(28.8736, 40.9784)::geography, 9, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000005', 'Florya plajı sezonu açtı mı?', 'vote', st_makepoint(28.7968, 40.9734)::geography, 15, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000001', 'Büyükada''ya vapur kaçta?', 'open', st_makepoint(29.1268, 40.8717)::geography, 12, now() - interval '2 hours'),
  ('a1000000-0000-0000-0000-000000000002', 'Heybeliada''da bisiklet kiralanır mı?', 'vote', st_makepoint(29.0963, 40.8662)::geography, 5, now() - interval '5 hours'),
  ('a1000000-0000-0000-0000-000000000003', 'Çengelköy''de iyi börekçi var mı?', 'open', st_makepoint(29.0578, 41.0625)::geography, 8, now() - interval '3 hours'),
  ('a1000000-0000-0000-0000-000000000004', 'Anadolu Kavağı''na ne kadar sürer?', 'open', st_makepoint(29.1575, 41.1666)::geography, 6, now() - interval '4 hours'),
  ('a1000000-0000-0000-0000-000000000005', 'Polonezköy''e gidiş yolu iyi mi?', 'vote', st_makepoint(29.2350, 41.1433)::geography, 4, now() - interval '6 hours');
