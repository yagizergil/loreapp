-- ─── Büyükşehir seed'leri ─────────────────────────────────────────────────────
--
-- 5 büyükşehre 10'ar gerçek soru: İstanbul, Ankara, İzmir, Bursa, Antalya.
-- Gerçek semt adları + gerçek koordinatlar, insan ağzından yazılmış gibi.
-- Bot profilleri (c0d00000-…001..008) yazar olarak kullanılır — bunların
-- seed_v2_system.sql ile oluşturulmuş olması gerekir.
--
-- Supabase SQL Editor'da çalıştır. İdempotent değildir; iki kez çalıştırırsan
-- aynı sorular iki kez eklenir.
--
-- Koordinat formatı: st_makepoint(LNG, LAT) — önce boylam, sonra enlem.

insert into questions (author_id, body, type, options, geom, answer_count, created_at) values

-- ─── İstanbul ──────────────────────────────────────────────────────────────
('c0d00000-0000-0000-0000-000000000001', 'Üsküdar sahilinde akşamüstü çay içip oturmak için en iyi yer neresi?', 'open', null, st_makepoint(29.0156, 41.0255)::geography, 21, now() - interval '40 minutes'),
('c0d00000-0000-0000-0000-000000000002', 'Bakırköy Özgürlük Meydanı çevresi hafta sonu çok mu kalabalık oluyor?', 'vote', null, st_makepoint(28.8717, 40.9785)::geography, 16, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000003', 'Sarıyer''de balık ekmek için hâlâ gidilecek klasik bir yer var mı?', 'open', null, st_makepoint(29.0556, 41.1668)::geography, 27, now() - interval '1 hour'),
('c0d00000-0000-0000-0000-000000000004', 'Maltepe sahil yürüyüş yolu sabah koşusu için uygun mu?', 'vote', null, st_makepoint(29.1311, 40.9255)::geography, 12, now() - interval '3 hours'),
('c0d00000-0000-0000-0000-000000000005', 'Bebek sahilinde sabah kahvaltısı yapılacak makul bir yer var mı?', 'open', null, st_makepoint(29.0435, 41.0776)::geography, 19, now() - interval '25 minutes'),
('c0d00000-0000-0000-0000-000000000006', 'Eyüp''ten Pierre Loti''ye çıkarken teleferik mi yürüyüş mü daha iyi?', 'choice',
   '[{"label":"Teleferik","count":29},{"label":"Yürüyüş","count":14}]'::jsonb, st_makepoint(28.9337, 41.0480)::geography, 43, now() - interval '4 hours'),
('c0d00000-0000-0000-0000-000000000007', 'Ataşehir''de akşam sakin oturup çalışabileceğin bir kafe önerir misin?', 'open', null, st_makepoint(29.1247, 40.9923)::geography, 9, now() - interval '90 minutes'),
('c0d00000-0000-0000-0000-000000000008', 'Şile''ye hafta sonu araba ile gitmek mantıklı mı, yol çok mu tutuyor?', 'vote', null, st_makepoint(29.6126, 41.1759)::geography, 22, now() - interval '5 hours'),
('c0d00000-0000-0000-0000-000000000001', 'Moda''dan Kadıköy''e sahil boyu yürümek ne kadar sürüyor?', 'vote', null, st_makepoint(29.0261, 40.9810)::geography, 14, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000002', 'İstanbul''da en sevdiğin yaka hangisi?', 'choice',
   '[{"label":"Avrupa","count":38},{"label":"Anadolu","count":47}]'::jsonb, st_makepoint(28.9784, 41.0082)::geography, 85, now() - interval '6 hours'),

-- ─── Ankara ────────────────────────────────────────────────────────────────
('c0d00000-0000-0000-0000-000000000003', 'Tunalı Hilmi''de akşamüstü oturup bir şeyler içmek için sakin bir yer var mı?', 'open', null, st_makepoint(32.8625, 39.9012)::geography, 18, now() - interval '35 minutes'),
('c0d00000-0000-0000-0000-000000000004', 'Kızılay Sakarya Caddesi akşamları hâlâ eskisi gibi kalabalık mı?', 'vote', null, st_makepoint(32.8541, 39.9208)::geography, 24, now() - interval '1 hour'),
('c0d00000-0000-0000-0000-000000000005', 'Bahçelievler 7. Cadde''de öğlen masraf etmeden yemek yenir mi?', 'open', null, st_makepoint(32.8205, 39.9210)::geography, 13, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000006', 'Anıtkabir''e metroyla gidip yürümek kolay mı, hangi durakta inmeli?', 'open', null, st_makepoint(32.8369, 39.9255)::geography, 20, now() - interval '3 hours'),
('c0d00000-0000-0000-0000-000000000007', 'Hamamönü''nü gezmek için en güzel zaman ne?', 'choice',
   '[{"label":"Sabah","count":7},{"label":"Öğleden sonra","count":15},{"label":"Akşam","count":22}]'::jsonb, st_makepoint(32.8662, 39.9355)::geography, 44, now() - interval '4 hours'),
('c0d00000-0000-0000-0000-000000000008', 'ODTÜ ormanında yürüyüş için dışarıdan girişe izin veriyorlar mı?', 'vote', null, st_makepoint(32.7783, 39.8918)::geography, 17, now() - interval '50 minutes'),
('c0d00000-0000-0000-0000-000000000001', 'Kuğulu Park''tan Tunalı boyunca yürümek keyifli mi şu sıralar?', 'vote', null, st_makepoint(32.8645, 39.9035)::geography, 11, now() - interval '90 minutes'),
('c0d00000-0000-0000-0000-000000000002', 'Gençlik Parkı çevresi akşam saatlerinde güvenli mi?', 'vote', null, st_makepoint(32.8527, 39.9402)::geography, 15, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000003', 'Çankaya tarafında güzel bir serpme kahvaltı yeri önerir misin?', 'open', null, st_makepoint(32.8625, 39.9075)::geography, 26, now() - interval '5 hours'),
('c0d00000-0000-0000-0000-000000000004', 'Ankara''da en sevdiğin semt hangisi?', 'choice',
   '[{"label":"Çankaya","count":31},{"label":"Kızılay","count":19},{"label":"Tunalı","count":24},{"label":"Keçiören","count":12}]'::jsonb, st_makepoint(32.8597, 39.9334)::geography, 86, now() - interval '6 hours'),

-- ─── İzmir ─────────────────────────────────────────────────────────────────
('c0d00000-0000-0000-0000-000000000005', 'Kordon''da akşam yürüyüşü için en güzel bölüm Alsancak tarafı mı?', 'open', null, st_makepoint(27.1385, 38.4352)::geography, 23, now() - interval '30 minutes'),
('c0d00000-0000-0000-0000-000000000006', 'Kemeraltı''nda öğle yemeği için iyi bir esnaf lokantası var mı?', 'open', null, st_makepoint(27.1378, 38.4185)::geography, 31, now() - interval '1 hour'),
('c0d00000-0000-0000-0000-000000000007', 'Bostanlı iskelesi gün batımı izlemek için doğru yer mi?', 'vote', null, st_makepoint(27.0971, 38.4612)::geography, 19, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000008', 'Karşıyaka çarşı hafta sonu çok mu kalabalık oluyor?', 'vote', null, st_makepoint(27.1108, 38.4565)::geography, 16, now() - interval '3 hours'),
('c0d00000-0000-0000-0000-000000000001', 'Asansör''den (Karataş) gün batımı manzarası gerçekten güzel mi?', 'vote', null, st_makepoint(27.1295, 38.4135)::geography, 27, now() - interval '45 minutes'),
('c0d00000-0000-0000-0000-000000000002', 'Bornova''da öğrenci bütçesine uygun yemek nerede yenir?', 'open', null, st_makepoint(27.2128, 38.4685)::geography, 14, now() - interval '90 minutes'),
('c0d00000-0000-0000-0000-000000000003', 'Güzelyalı sahilinde sabah koşusu için yol uygun mu?', 'vote', null, st_makepoint(27.0905, 38.3955)::geography, 10, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000004', 'Konak Pier çevresinde otopark bulmak sorun oluyor mu?', 'vote', null, st_makepoint(27.1305, 38.4225)::geography, 13, now() - interval '4 hours'),
('c0d00000-0000-0000-0000-000000000005', 'Alsancak''ta gece geç saate kadar açık sakin bir kafe var mı?', 'open', null, st_makepoint(27.1420, 38.4380)::geography, 18, now() - interval '20 minutes'),
('c0d00000-0000-0000-0000-000000000006', 'İzmir''in en sevdiğin yanı ne?', 'choice',
   '[{"label":"Deniz","count":34},{"label":"Hava","count":21},{"label":"Yemek","count":18},{"label":"İnsanlar","count":25}]'::jsonb, st_makepoint(27.1428, 38.4237)::geography, 98, now() - interval '6 hours'),

-- ─── Bursa ─────────────────────────────────────────────────────────────────
('c0d00000-0000-0000-0000-000000000007', 'Uludağ''a teleferikle çıkmak için en uygun saat hangisi, kuyruk oluyor mu?', 'open', null, st_makepoint(29.0915, 40.1805)::geography, 22, now() - interval '40 minutes'),
('c0d00000-0000-0000-0000-000000000008', 'Cumalıkızık''a toplu taşımayla gitmek kolay mı?', 'vote', null, st_makepoint(29.1788, 40.1830)::geography, 15, now() - interval '1 hour'),
('c0d00000-0000-0000-0000-000000000001', 'Heykel civarında klasik bir İskender yeri önerir misin?', 'open', null, st_makepoint(29.0668, 40.1842)::geography, 33, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000002', 'Kültürpark içinde yürüyüş için sabah mı akşam mı daha iyi?', 'choice',
   '[{"label":"Sabah","count":18},{"label":"Akşam","count":24}]'::jsonb, st_makepoint(29.0560, 40.1955)::geography, 42, now() - interval '3 hours'),
('c0d00000-0000-0000-0000-000000000003', 'Setbaşı tarafında akşam sakin oturulacak bir yer var mı?', 'open', null, st_makepoint(29.0712, 40.1845)::geography, 12, now() - interval '90 minutes'),
('c0d00000-0000-0000-0000-000000000004', 'Nilüfer FSM Bulvarı akşam saatlerinde trafik çok mu sıkışıyor?', 'vote', null, st_makepoint(28.9870, 40.2155)::geography, 17, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000005', 'Tophane''den şehri seyretmek için en iyi nokta neresi?', 'open', null, st_makepoint(29.0608, 40.1830)::geography, 14, now() - interval '4 hours'),
('c0d00000-0000-0000-0000-000000000006', 'Görükle''de öğrenciye uygun fiyatlı yemek yeri var mı?', 'vote', null, st_makepoint(28.8665, 40.2280)::geography, 11, now() - interval '50 minutes'),
('c0d00000-0000-0000-0000-000000000007', 'Zafer Plaza çevresi hafta sonu çok mu kalabalık oluyor?', 'vote', null, st_makepoint(29.0612, 40.1928)::geography, 13, now() - interval '5 hours'),
('c0d00000-0000-0000-0000-000000000008', 'Bursa''da en sevdiğin lezzet hangisi?', 'choice',
   '[{"label":"İskender","count":41},{"label":"Kestane şekeri","count":17},{"label":"Pideli köfte","count":15},{"label":"Cantık","count":9}]'::jsonb, st_makepoint(29.0610, 40.1885)::geography, 82, now() - interval '6 hours'),

-- ─── Antalya ───────────────────────────────────────────────────────────────
('c0d00000-0000-0000-0000-000000000001', 'Konyaaltı sahilinde akşam yürüyüşü için en güzel bölüm neresi?', 'open', null, st_makepoint(30.6555, 36.8685)::geography, 20, now() - interval '35 minutes'),
('c0d00000-0000-0000-0000-000000000002', 'Kaleiçi''nde araçla gidip otopark bulmak zor mu?', 'vote', null, st_makepoint(30.7058, 36.8842)::geography, 18, now() - interval '1 hour'),
('c0d00000-0000-0000-0000-000000000003', 'Düden Şelalesi''ne toplu taşımayla nasıl gidilir?', 'open', null, st_makepoint(30.7855, 36.8662)::geography, 16, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000004', 'Lara sahilinde gün batımı manzarası güzel oluyor mu?', 'vote', null, st_makepoint(30.7895, 36.8555)::geography, 21, now() - interval '3 hours'),
('c0d00000-0000-0000-0000-000000000005', 'Falez üstündeki yürüyüş yolu akşam saatlerinde güvenli mi?', 'vote', null, st_makepoint(30.6920, 36.8780)::geography, 14, now() - interval '45 minutes'),
('c0d00000-0000-0000-0000-000000000006', 'Kaleiçi marina çevresinde makul fiyatlı bir yer var mı?', 'open', null, st_makepoint(30.7045, 36.8825)::geography, 12, now() - interval '90 minutes'),
('c0d00000-0000-0000-0000-000000000007', 'Muratpaşa tarafında güzel bir kahvaltı yeri önerir misin?', 'open', null, st_makepoint(30.7185, 36.8845)::geography, 19, now() - interval '2 hours'),
('c0d00000-0000-0000-0000-000000000008', 'Konyaaltı''nda yazın deniz çok mu kalabalık oluyor?', 'vote', null, st_makepoint(30.6320, 36.8625)::geography, 23, now() - interval '4 hours'),
('c0d00000-0000-0000-0000-000000000001', 'Antalya''da yaz sıcağında gündüz vakit geçirmek için en iyisi ne?', 'choice',
   '[{"label":"Plaj","count":28},{"label":"AVM","count":11},{"label":"Şelale","count":16},{"label":"Kaleiçi","count":19}]'::jsonb, st_makepoint(30.7133, 36.8869)::geography, 74, now() - interval '5 hours'),
('c0d00000-0000-0000-0000-000000000002', 'Antalya''da en sevdiğin bölge hangisi?', 'choice',
   '[{"label":"Kaleiçi","count":26},{"label":"Konyaaltı","count":22},{"label":"Lara","count":18},{"label":"Side","count":14}]'::jsonb, st_makepoint(30.7000, 36.8900)::geography, 80, now() - interval '6 hours');

-- vote tipi sorulara Evet/Hayır seçeneklerini ekle (Answers ekranı options'a bağlı).
update questions
set options = '[{"label":"Evet","count":0},{"label":"Hayır","count":0}]'::jsonb
where type = 'vote' and options is null;
