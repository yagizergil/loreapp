import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MapView, { MapStyleElement, Region, Circle, Marker } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Question, fetchNearbyQuestions, fetchUserAnsweredQuestionIds, fetchRegionQuestionCount } from '../../lib/supabase';
import { useProfile } from '../../lib/ProfileContext';
import { usePremium } from '../../lib/PremiumContext';
import { useUnreadCounts } from '../../lib/UnreadCountsContext';
import { mapAskEvent } from '../../lib/mapEvents';
import { paywallEvents } from '../../lib/premiumEvents';
import { distanceKm, FREE_RADIUS_KM } from '../../lib/distance';
import { getQuestionBadge } from '../../lib/questionBadge';
import { useNotifications } from '../../hooks/useNotifications';
import {
  palette,
  fontFamily,
  fontSize,
  spacing,
  radius,
  shadow,
  mapStyle,
} from '../../theme/tokens';
import QuestionPin from '../../components/map/QuestionPin';
import { SealMark, MINE_SHADE, TYPE_SHADE } from '../../components/map/SealMark';
import { IconBell } from '../../components/ui/Icons';
import QuestionSheet from '../../components/sheet/QuestionSheet';
import AskQuestionModal from '../../components/sheet/AskQuestionModal';
import { useTranslation } from 'react-i18next';


// Ücretsiz kullanıcı bu mesafeden uzaktaki bir alana bakıyorsa "başka şehir"
// sayılır → gerçek pin yerine teaser gösterilir (yüklenen set ~80km yarıçaplı).
const FAR_REGION_KM = 70;

const ISTANBUL = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const profile = useProfile();
  const navigation = useNavigation<any>();
  const { notifCount } = useUnreadCounts();
  const { t } = useTranslation();
  const mapRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [region, setRegion] = useState<Region>(ISTANBUL);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [showAsk, setShowAsk] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const { isPremium } = usePremium();

  // Render merkezi: görünen pin seti bu noktaya en yakın olanlardan seçilir.
  // Sadece hareket bitince (debounce) güncellenir; ham region'a bağlı DEĞİL —
  // böylece pan/zoom sırasında marker seti değişip native crash olmaz.
  const [renderCenter, setRenderCenter] = useState({ lat: ISTANBUL.latitude, lng: ISTANBUL.longitude });
  const lastFetchCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ücretsiz kullanıcı uzaktaki bir şehre kaydırınca, orada soru varsa tek bir
  // büyük "teaser" pin gösterilir; tıklayınca paywall (başka şehirler premium).
  const [teaserPin, setTeaserPin] = useState<{ lat: number; lng: number } | null>(null);
  const teaserPinRef = useRef<{ lat: number; lng: number } | null>(null);

  // Notification setup — registers push token, schedules local notifications
  useNotifications({
    profileId:    profile.id,
    userLat:      userLocation?.lat,
    userLng:      userLocation?.lng,
  });
  const [filter, setFilter] = useState<'all' | 'new'>('all');

  // Debounced zoom: only update when the integer zoom level actually changes.
  // This prevents mass tracksViewChanges re-enables across all pins during smooth pinch gestures.
  const [zoom, setZoom] = useState(() => Math.round(Math.log2(360 / ISTANBUL.latitudeDelta)));
  const zoomRef = useRef(zoom);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegionChangeComplete = useCallback((r: Region) => {
    setRegion(r);
    const next = Math.round(Math.log2(360 / r.latitudeDelta));
    if (next !== zoomRef.current) {
      zoomRef.current = next;
      // Debounce: wait until the user has stopped zooming before updating
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
      regionDebounceRef.current = setTimeout(() => setZoom(next), 200);
    }
    // Hareket bittikten SONRA, debounce ile: render merkezini güncelle ve
    // (premium ise) görünen bölgeyi fetch et. Gesture sırasında ASLA tetiklenmez.
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      setRenderCenter({ lat: r.latitude, lng: r.longitude });
      if (isPremium) { maybeFetchRegion(r); return; }
      // Ücretsiz: uzaktaki (kendi bölgesinin dışındaki) bir şehre YAKLAŞINCA ve
      // orada soru varsa tek bir teaser pin göster. Aşağıdaki koşullar glitch'i
      // ve şehre varmadan erken görünmeyi engeller:
      //  • Yeterince zoom yapılmış olmalı (tüm ülke görünürken gösterme).
      //  • Kullanıcının kendi bölgesinin dışında olmalı.
      //  • Sayım yarıçapı viewport ile sınırlı (yoldaki uzak şehri yakalamaz).
      if (!userLocation) return;
      const viewKm = r.latitudeDelta * 111;
      const d = distanceKm(userLocation.lat, userLocation.lng, r.latitude, r.longitude);

      // Zaten gösterilen teaser'a hâlâ yakınsak yerinde bırak (pan'da zıplamasın).
      const cur = teaserPinRef.current;
      if (cur && distanceKm(cur.lat, cur.lng, r.latitude, r.longitude) < 25) return;

      // Çok uzaktan (ülke geneli) bakarken veya kendi bölgesindeyken teaser yok.
      if (viewKm > 90 || d <= FAR_REGION_KM) {
        teaserPinRef.current = null;
        setTeaserPin(null);
        return;
      }

      const radiusM = Math.min(40000, Math.max(15000, viewKm * 1000 * 0.5));
      const center = { lat: r.latitude, lng: r.longitude };
      fetchRegionQuestionCount(center.lat, center.lng, radiusM)
        .then((count) => {
          const next = count > 0 ? center : null;
          teaserPinRef.current = next;
          setTeaserPin(next);
        })
        .catch(() => {});
    }, 350);
  }, [isPremium, userLocation]);

  const isLocked = useCallback((q: Question) => {
    if (isPremium || !userLocation) return false;
    return distanceKm(userLocation.lat, userLocation.lng, q.lat, q.lng) > FREE_RADIUS_KM;
  }, [isPremium, userLocation]);

  // Cevaplanan sorular haritadan KALKAR (akışta/Timeline'da takip edilir).
  // Kendi sorduğun sorular haritada kalır ve sarı mühürle gösterilir.
  const filteredQuestions = (filter === 'all'
    ? questions
    : questions.filter((q) => getQuestionBadge(q) === filter)
  ).filter((q) => !answeredIds.has(q.id));

  // Compute stable spread offsets for same-coordinate pins (computed once per questions array,
  // not per zoom/region change — so pins never jump or move).
  const spreadOffsets = useMemo(() => {
    const KEY_PRECISION = 4; // ~11 m grid
    const SPREAD_DEG = 0.00007; // ~7 m radius spread circle
    const buckets = new Map<string, string[]>();
    for (const q of filteredQuestions) {
      const key = `${q.lat.toFixed(KEY_PRECISION)},${q.lng.toFixed(KEY_PRECISION)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(q.id);
      buckets.set(key, bucket);
    }
    const offsets = new Map<string, { dLat: number; dLng: number }>();
    for (const ids of buckets.values()) {
      if (ids.length <= 1) continue;
      ids.forEach((id, i) => {
        const angle = (2 * Math.PI * i) / ids.length;
        offsets.set(id, {
          dLat: SPREAD_DEG * Math.cos(angle),
          dLng: SPREAD_DEG * Math.sin(angle),
        });
      });
    }
    return offsets;
  }, [filteredQuestions]);

  // Görünen pin seti: render merkezine en yakın MAX_VISIBLE_PINS pin. renderCenter
  // sadece hareket bitince (debounce) değiştiği için bu set gesture sırasında
  // değişmez — yani marker'lar mid-gesture mount/unmount olmaz, harita crash etmez.
  // questions store'u büyüyebilir (sadece veri); gerçek <Marker> sayısı bu cap ile sınırlı.
  const visibleQuestions = useMemo(() => {
    const MAX_VISIBLE_PINS = 150;
    if (filteredQuestions.length <= MAX_VISIBLE_PINS) return filteredQuestions;
    const c = renderCenter;
    return [...filteredQuestions]
      .sort((a, b) =>
        distanceKm(c.lat, c.lng, a.lat, a.lng) - distanceKm(c.lat, c.lng, b.lat, b.lng))
      .slice(0, MAX_VISIBLE_PINS);
  }, [filteredQuestions, renderCenter]);

  useEffect(() => {
    mapAskEvent.trigger = () => setShowAsk(true);
    return () => { mapAskEvent.trigger = () => {}; };
  }, []);

  // Premium açıldığında teaser pin'i temizle (isPremium context'ten canlı gelir).
  useEffect(() => {
    if (isPremium) { teaserPinRef.current = null; setTeaserPin(null); }
  }, [isPremium]);

  // Load all previously answered question IDs from DB so they persist across sessions
  useEffect(() => {
    fetchUserAnsweredQuestionIds(profile.id)
      .then((ids) => setAnsweredIds(new Set(ids)))
      .catch(() => {});
  }, [profile.id]);

  const loadingRef = useRef(false);
  async function loadQuestions(lat: number, lng: number) {
    if (loadingRef.current) return; // prevent concurrent fetches
    loadingRef.current = true;
    try {
      // Tek seferde geniş alanı çek (~tüm İstanbul). Böylece uzaktaki pinler de
      // (1 km ötesi kilitli/premium) yüklenir; pan/zoom'da YENİDEN çekmiyoruz, o
      // yüzden marker'lar remount olmaz ve harita crash etmez. Görünür pin sayısı
      // questions_nearby (limit 200) + viewport culling (max 120) ile sınırlı.
      setQuestions(await fetchNearbyQuestions(lat, lng, 80000));
      lastFetchCenterRef.current = { lat, lng };
      setRenderCenter({ lat, lng });
    } catch {
      // network errors are silent — pins stay as they are
    } finally {
      loadingRef.current = false;
    }
  }

  // Premium: harita başka bölgeye kaydırılınca o bölgenin sorularını çek ve
  // mevcut sete MERGE et (silme yok → ekrandaki marker'lar remount olmaz).
  // Yalnızca yeterince uzağa hareket edildiyse fetch eder (gereksiz istek olmasın).
  function maybeFetchRegion(r: Region) {
    const last = lastFetchCenterRef.current;
    const movedKm = last ? distanceKm(last.lat, last.lng, r.latitude, r.longitude) : Infinity;
    const viewKm = r.latitudeDelta * 111; // viewport yüksekliği (~km)
    if (movedKm < Math.max(20, viewKm * 0.5)) return; // yeterince uzaklaşmadı
    lastFetchCenterRef.current = { lat: r.latitude, lng: r.longitude };
    const radiusM = Math.min(200000, Math.max(80000, viewKm * 1000));
    fetchNearbyQuestions(r.latitude, r.longitude, radiusM)
      .then((fetched) => {
        setQuestions((prev) => {
          const byId = new Map(prev.map((q) => [q.id, q]));
          for (const q of fetched) byId.set(q.id, q);
          return Array.from(byId.values());
        });
      })
      .catch(() => {});
  }

  // Refetch when the Map regains focus (e.g. arriving via a "nearby new question"
  // notification while the app was already running) so freshly dropped pins show
  // up without needing an app restart. Runs once per focus, not during gestures.
  useFocusEffect(
    useCallback(() => {
      if (userLocation) loadQuestions(userLocation.lat, userLocation.lng);
    }, [userLocation]),
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await loadQuestions(ISTANBUL.latitude, ISTANBUL.longitude);
        return;
      }

      // 1 km circle fits comfortably at this delta (≈ 3.1 km visible)
      const CIRCLE_DELTA = 0.028;

      // Fast path: last known position loads questions instantly
      const last = await Location.getLastKnownPositionAsync({});
      if (last) {
        const lat = last.coords.latitude;
        const lng = last.coords.longitude;
        setUserLocation({ lat, lng });
        mapRef.current?.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: CIRCLE_DELTA, longitudeDelta: CIRCLE_DELTA },
          600
        );
        loadQuestions(lat, lng);
      }

      // Precise fix
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setUserLocation({ lat, lng });
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: CIRCLE_DELTA, longitudeDelta: CIRCLE_DELTA },
        last ? 400 : 800
      );
      await loadQuestions(lat, lng);
    })();
  }, []);

  const handlePinPress = useCallback((q: Question) => {
    if (isLocked(q)) {
      const parent = navigation.getParent() as any;
      parent?.navigate('Paywall', { trigger: 'geo' });
      return;
    }
    setViewedIds((prev) => new Set(prev).add(q.id));
    setSelectedQuestion(q);
  }, [isLocked, navigation]);

  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  const handleSheetClose = useCallback(() => {
    setSelectedQuestion(null);
    // iOS invalidates the marker layer cache on modal dismiss.
    // Incrementing this key tells all pins to re-snapshot for 400ms.
    setMapRefreshKey((k) => k + 1);
  }, []);

  const handleAnswered = useCallback((questionId: string) => {
    setAnsweredIds((prev) => new Set(prev).add(questionId));
  }, []);

  const handlePosted = useCallback(() => {
    if (userLocation) {
      loadQuestions(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

  const availableQuestions = filteredQuestions.filter(
    (q) => !isLocked(q) && q.author_id !== profile.id && !answeredIds.has(q.id)
  );

  const handleRandomQuestion = useCallback(() => {
    const pool = questions.filter(
      (q) => !isLocked(q) && q.author_id !== profile.id && !answeredIds.has(q.id)
    );
    if (!pool.length) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    setSelectedQuestion(q);
    mapRef.current?.animateToRegion(
      { latitude: q.lat, longitude: q.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  }, [questions, isLocked, answeredIds, profile.id]);

  const handleGoToMyLocation = useCallback(async () => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        500
      );
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setUserLocation({ lat, lng });
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        500
      );
      await loadQuestions(lat, lng);
    }
  }, [userLocation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={ISTANBUL}
        customMapStyle={mapStyle as unknown as MapStyleElement[]}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {/* Free zone circle */}
        {userLocation && !isPremium && (
          <Circle
            center={{ latitude: userLocation.lat, longitude: userLocation.lng }}
            radius={FREE_RADIUS_KM * 1000}
            strokeColor={palette.accent + 'AA'}
            fillColor={palette.accent + '12'}
            strokeWidth={1.5}
          />
        )}

        {visibleQuestions.map((q) => {
          const locked   = isLocked(q);
          const mine     = q.author_id === profile.id;
          const viewed   = viewedIds.has(q.id);
          const coordOffset = spreadOffsets.get(q.id);
          return (
            <QuestionPin
              key={q.id}
              question={q}
              zoom={zoom}
              locked={locked}
              mine={mine}
              viewed={viewed}
              coordOffset={coordOffset}
              refreshKey={mapRefreshKey}
              onPress={() => handlePinPress(q)}
            />
          );
        })}

        {/* Teaser pin: ücretsiz kullanıcı başka şehre bakınca (orada soru varsa) */}
        {!isPremium && teaserPin && (
          <Marker
            coordinate={{ latitude: teaserPin.lat, longitude: teaserPin.lng }}
            onPress={() => paywallEvents.show('region')}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.teaserWrap}>
              <SealMark size={64} shade={MINE_SHADE} gid="teaserSeal" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top bar with BlurView */}
      <View style={styles.topBarWrapper}>
        <BlurView intensity={60} tint="dark" style={styles.topBar}>
          <Text style={styles.appName}>lore</Text>
          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Notifications')}
          >
            <IconBell color={palette.ink10} size={20} strokeWidth={2} />
            {notifCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {notifCount > 9 ? '9+' : String(notifCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Filter pills */}
      <View style={[styles.filterBar, { top: (Platform.OS === 'ios' ? 50 : 28) + 68 }]}>
        {([
          { key: 'all', label: t('map.filterAll') },
          { key: 'new', label: t('map.filterNew') },
        ] as { key: typeof filter; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterPill, filter === key && styles.filterPillActive]}
            activeOpacity={0.75}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterLabel, filter === key && styles.filterLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom gradient fade */}
      <LinearGradient
        colors={['transparent', palette.ink90 + '66']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Location + Random buttons */}
      {!selectedQuestion && !showAsk && (
        <View style={[styles.locationCluster, { bottom: insets.bottom + 90 }]}>
          {availableQuestions.length > 0 && (
            <TouchableOpacity
              style={styles.randomBtn}
              activeOpacity={0.8}
              onPress={handleRandomQuestion}
            >
              <View style={styles.diceWrap}>
                <SealMark size={20} shade={TYPE_SHADE.open} gid="randomSeal" />
              </View>
              <Text style={styles.randomLabel}>{t('map.random')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={handleGoToMyLocation}
          >
            <View style={styles.targetOuter}>
              <View style={styles.targetInner} />
              <View style={styles.targetLineH} />
              <View style={styles.targetLineV} />
            </View>
          </TouchableOpacity>
        </View>
      )}



      {/* Question Sheet */}
      {selectedQuestion && (
        <QuestionSheet
          question={selectedQuestion}
          profileId={profile.id}
          hasAnswered={answeredIds.has(selectedQuestion.id)}
          onClose={handleSheetClose}
          onAnswered={handleAnswered}
          onOpenAnswers={(q) => {
            const parent = navigation.getParent() as any;
            parent?.navigate('Answers', { question: q, profileId: profile.id });
          }}
        />
      )}

      {/* Ask Modal */}
      {showAsk && (
        <AskQuestionModal
          profileId={profile.id}
          userLocation={userLocation}
          onClose={() => setShowAsk(false)}
          onPosted={handlePosted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.ink90,
  },
  teaserWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 28,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  appName: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontSize: fontSize.xl,
    color: palette.accent,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: palette.ink80 + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
  },
  bellBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.ink80,
  },
  bellBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontFamily: fontFamily.bodySemiBold,
    lineHeight: 11,
  },
  filterBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: palette.ink80 + 'DD',
    borderWidth: 1,
    borderColor: palette.ink60,
    ...shadow.sm,
  },
  filterPillActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  filterLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: palette.ink40,
    letterSpacing: 0.3,
  },
  filterLabelActive: {
    color: palette.white,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  locationCluster: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.sm,
  },
  randomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: palette.accent,
    ...shadow.md,
  },
  diceWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  randomLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.white,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: palette.ink80 + 'EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.ink60,
    ...shadow.sm,
  },
  targetOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: palette.ink10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.accent,
  },
  targetLineH: {
    position: 'absolute',
    width: 24,
    height: 1.5,
    backgroundColor: palette.ink40,
  },
  targetLineV: {
    position: 'absolute',
    width: 1.5,
    height: 24,
    backgroundColor: palette.ink40,
  },
});

