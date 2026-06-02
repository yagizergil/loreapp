# Lore — App Overview

> Bu dosya App Store / Play Store metinlerini (açıklama, anahtar kelime, tanıtım metni, gizlilik etiketleri) bir yapay zekaya ürettirmek için hazırlanmıştır. Uygulamanın ne olduğunu, nasıl çalıştığını ve hangi verileri kullandığını eksiksiz anlatır.

---

## 1. Tek cümlede

Lore, etrafındaki insanların anonim olarak sorduğu konuma bağlı soruları harita üzerinde keşfettiğin, cevapladığın ve beğendiğin bir cevabın arkasındaki kişiyle yine anonim şekilde mesajlaşabildiğin sosyal bir keşif uygulamasıdır.

## 2. Konsept / Ana fikir

- Her kullanıcı kimliğini gizleyerek (anonim) çevresine kısa sorular sorar.
- Sorular **harita üzerinde**, soranın konumunun yakınında bir "mühür" (wax seal) pin olarak görünür.
- Yakındaki kullanıcılar bu soruları görür ve cevaplar.
- Cevaplanan soru haritadan kalkar (karmaşa olmaz); kendi geçmişin "Akış" (Feed) sekmesinde durur.
- Beğendiğin bir cevabın sahibine **anonim mesaj** atabilirsin — gerçek ama kimliksiz bağlantılar.
- Global bir uygulamadır (herhangi bir şehir/ülke). Türkiye'ye özel değildir.

## 3. Hedef kitle

- Çevresindeki insanları/yerel nabzı merak edenler.
- Anonim kalarak fikir paylaşmak/soru sormak isteyenler.
- Yer temelli sosyal etkileşim ve hafif, oyunlaştırılmış keşif sevenler.

## 4. Soru tipleri

1. **Poll / Anket (vote):** Evet / Hayır oylaması (turuncu mühür).
2. **Choice / Çoktan seçmeli (choice):** Birden fazla seçenek (mavi mühür).
3. **Open / Açık uçlu (open):** Serbest metin cevabı (yeşil mühür).
- Kendi sorularının mührü sarı renkte gösterilir.

## 5. Ana ekranlar

- **Harita (Map):** Çevredeki soruları mühür pin'lerle gösterir. Filtreler (Tümü / Yeni), "Rastgele" bir soruya gitme butonu, soru sorma butonu (mühür + ikonu).
- **Akış (Feed / Timeline):** Senin sorduğun sorular ve aldıkları cevaplar.
- **Mesajlar (Messages):** Cevaplar üzerinden başlayan anonim birebir sohbetler.
- **Bildirimler (Notifications):** "X sorunu cevapladı", "X cevabını beğendi"; satıra tıklayınca ilgili sorunun cevaplar ekranına götürür.
- **Profil (Profile):** İstatistikler (soru/cevap sayısı), dil, gizlilik, hesap yönetimi (çıkış / hesap silme).
- **Cevaplar (Answers):** Bir sorunun tüm cevapları; popüler/yeni sıralama, beğenme, cevap yazma, mesaj başlatma.
- **Onboarding:** Tanıtım slaytları + anonim devam veya e-posta ile hesap oluşturma.
- **Paywall:** Premium yükseltme ekranı.

## 6. Anonimlik ve kimlik

- Kullanıcılar bir **takma ad (username)**, **avatar** ve isteğe bağlı **cinsiyet** seçer.
- İki giriş yolu: (a) tamamen **anonim devam** (kayıt yok), (b) **e-posta + şifre ile hesap** (Apple Sign In de destekleniyor).
- Soru sorarken/cevaplarken gerçek kimlik her zaman gizli kalır.

## 7. Konum kullanımı

- Soruların haritada konumlandırılması ve "yakındaki soruları" gösterebilmek için cihaz konumu kullanılır.
- Konum **kalıcı saklanmaz** (profilde "Konum verisi: saklanmıyor" denir); yakınlık hesapları için kullanılır.
- Backend'de PostGIS ile mesafe sorguları yapılır (örn. soru çevresindeki kullanıcılar).
- iOS izin metinleri: kullanım sırasında konum (yakındaki soruları göstermek) ve arka plan konumu (yeni sorular için bildirim).

## 8. Bildirim sistemi (önemli backend mantığı)

Uygulamanın canlı hissini veren çekirdek mekanizma:

1. **Saatlik cron** (`seed_dropper_hourly`) → `run_seed_drop(4, 700)` SQL fonksiyonunu çağırır.
2. `run_seed_drop`, uygun her kullanıcının yakınına (150–700 m) bir "seed" soru ekler. Uygunluk: gerçek kullanıcı + geçerli konum + geçerli Expo push token + son 7 günde aktif + son seed üstünden 4 saat geçmiş (yeni kullanıcı ilk seed'i ≤1 saatte alır).
3. Yeni soru eklenince `questions_insert_push` veritabanı trigger'ı `send-push` edge function'ını tetikler.
4. `send-push`, sorunun **2 km** çevresindeki uygun kullanıcıları bulur (`users_near_question`) ve onlara **Expo Push** ile "Yakınında yeni bir soru 📍" bildirimi gönderir. Spam önlemek için kullanıcı başına saatte en fazla 1 nearby bildirim.
5. Ayrıca etkileşim bildirimleri: soruya cevap geldiğinde ve cevap beğenildiğinde ilgili kullanıcıya push gider.

## 9. Premium / Para kazanma

- **RevenueCat** ile abonelik (iOS). Aylık ve yıllık paketler (yıllık daha avantajlı, deneme süresi sunulabilir).
- Premium avantajları:
  - Şehrin tamamını görme (ücretsizde ~1 km mesafe limiti var).
  - Diğer şehirlerdeki soruları görme.
  - Sınırsız günlük soru/cevap (ücretsizde günlük cevap limiti var).
  - Yeni soruları ilk görenlerden olma + premium bildirimler.
- Paywall üç bağlamda açılır: mesafe limiti (`geo`), günlük limit (`limit`), başka şehir (`region`). Metinler tamamen yerelleştirilmiştir.
- Premium durumu RevenueCat'ten otoritatif okunur, Supabase'e yansıtılır (mirror).

## 10. Diller / Yerelleştirme

- `react-i18next` ile çok dilli. Şu an **Türkçe** ve **İngilizce**.
- Fiyatlar mağazadan (RevenueCat) yerel para biriminde gelir.
- Global kullanım için metinlerde ülkeye özel ifadeler kullanılmaz.

## 11. Teknik altyapı (referans)

- **İstemci:** React Native + Expo (SDK ~54, bare workflow / dev-client), TypeScript.
- **Harita:** react-native-maps; pin görselleri react-native-svg ile çizilmiş "wax seal" mühürler.
- **Backend:** Supabase (Postgres + PostGIS), RPC fonksiyonları, Database Webhooks, Edge Functions (Deno), pg_cron.
- **Bildirim:** Expo Push API.
- **Abonelik:** RevenueCat (`react-native-purchases`).
- **Kimlik doğrulama:** Supabase Auth + Apple Sign In + anonim profil.

## 12. Gizlilik / İzinler (mağaza veri etiketleri için)

- **Konum:** yakındaki soruları göstermek ve bildirim için (kalıcı saklanmaz).
- **Bildirimler:** yeni yakın sorular, cevaplar ve beğeniler için push.
- **Hesap verisi:** takma ad, avatar, isteğe bağlı cinsiyet, e-posta (hesapla devam edenlerde).
- **Kullanıcı içeriği:** sorular, cevaplar, mesajlar.
- Kullanıcı uygulama içinden **hesabını ve tüm verisini kalıcı olarak silebilir**.
- Anonim kullanım mümkündür (kayıt zorunlu değil).

## 13. Mağaza metni için öne çıkan satış noktaları

- "Etrafındaki dünyayı keşfet" — konuma bağlı anonim sorular.
- Tamamen anonim ama gerçek, yerel etkileşim.
- Harita üzerinde oyunlaştırılmış, sade keşif (cevapla → harita temizlenir).
- Beğendiğin cevabın arkasındaki kişiyle anonim mesajlaşma.
- Yakınında bir şey olduğunda anlık bildirim.
- Premium ile sınırsız keşif ve tüm şehir/şehirler.

---

### Anahtar kelime fikirleri (örnek)
anonymous, local, nearby, map, questions, social, discovery, community, polls, chat, anonim, yakındaki, harita, sorular, keşfet, sosyal

### Kategori önerisi
Social Networking (birincil), Lifestyle (ikincil).
