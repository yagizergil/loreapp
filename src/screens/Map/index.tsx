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
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { MapStyleElement, Region, Circle, Marker } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Question, fetchQuestionsAround, fetchUserAnsweredQuestionIds, fetchBlockedIds, fetchRegionQuestionCount } from '../../lib/supabase';
import { track } from '../../lib/analytics';
import { useProfile } from '../../lib/ProfileContext';
import { usePremium } from '../../lib/PremiumContext';
import { useUnreadCounts } from '../../lib/UnreadCountsContext';
import { mapAskEvent } from '../../lib/mapEvents';
import { distanceKm, FREE_RADIUS_KM, PREMIUM_RADIUS_KM, MIN_NEARBY_QUESTIONS, MAX_NEARBY_QUESTIONS } from '../../lib/distance';
import { getQuestionBadge } from '../../lib/questionBadge';
import { CONTENT_MAX_WIDTH } from '../../theme/responsive';
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
import { SealMark, TYPE_SHADE } from '../../components/map/SealMark';
import { IconBell, IconLocateMe } from '../../components/ui/Icons';
import QuestionSheet from '../../components/sheet/QuestionSheet';
import AskQuestionModal from '../../components/sheet/AskQuestionModal';
import LeaderboardSheet from '../../components/sheet/LeaderboardSheet';
import { useTranslation } from 'react-i18next';


// Ücretsiz kullanıcı bu mesafeden uzaktaki bir alana bakıyorsa "başka şehir"
// sayılır → gerçek pin yerine teaser gösterilir (yüklenen set ~80km yarıçaplı).
const ISTANBUL = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// Persisted last known region → used as fallback when Location Services are off
// so the app keeps showing a relevant area instead of a hardcoded default.
const LAST_REGION_KEY = '@lore/last_region';

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
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const { isPremium } = usePremium();

  // Render merkezi: görünen pin seti bu noktaya en yakın olanlardan seçilir.
  // Sadece hareket bitince (debounce) güncellenir; ham region'a bağlı DEĞİL —
  // böylece pan/zoom sırasında marker seti değişip native crash olmaz.
  const [renderCenter, setRenderCenter] = useState({ lat: ISTANBUL.latitude, lng: ISTANBUL.longitude });
  const lastFetchCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Hareket bittikten SONRA, debounce ile sadece render merkezini güncelle.
    // Artık pan/zoom'da YENİDEN fetch YOK: soru seti kullanıcının etrafındaki
    // 4 km ile sınırlı (≤60). Bu, harita kasmasını ve marker remount'unu önler.
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      setRenderCenter({ lat: r.latitude, lng: r.longitude });
    }, 250);
  }, []);

  const isLocked = useCallback((q: Question) => {
    if (isPremium || !userLocation) return false;
    return distanceKm(userLocation.lat, userLocation.lng, q.lat, q.lng) > FREE_RADIUS_KM;
  }, [isPremium, userLocation]);

  // Cevaplanan sorular haritadan KALKAR (akışta/Timeline'da takip edilir).
  // Kendi sorduğun sorular haritada kalır ve sarı mühürle gösterilir.
  // Memoized: this was previously recomputed on every render (including
  // unrelated ones like toggling the leaderboard sheet), which also broke
  // the memoization chain feeding spreadOffsets/visibleQuestions below.
  const filteredQuestions = useMemo(() => (filter === 'all'
    ? questions
    : questions.filter((q) => getQuestionBadge(q) === filter)
  )
    .filter((q) => !blockedIds.has(q.author_id))
    .filter((q) => q.author_id === profile.id || !answeredIds.has(q.id)),
  [questions, filter, blockedIds, answeredIds, profile.id]);

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
    const MAX_VISIBLE_PINS = 80;
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

  useEffect(() => {
    if (hasLoadedOnce && filteredQuestions.length === 0) track('empty_map_shown');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedOnce, filteredQuestions.length === 0]);

  // Load all previously answered question IDs from DB so they persist across sessions
  useEffect(() => {
    fetchUserAnsweredQuestionIds(profile.id)
      .then((ids) => setAnsweredIds(new Set(ids)))
      .catch(() => {});
  }, [profile.id]);

  // Load blocked user IDs so their questions never appear on the map.
  useFocusEffect(
    useCallback(() => {
      fetchBlockedIds(profile.id)
        .then((ids) => setBlockedIds(new Set(ids)))
        .catch(() => {});
    }, [profile.id])
  );

  const loadingRef = useRef(false);
  async function loadQuestions(lat: number, lng: number) {
    if (loadingRef.current) return; // prevent concurrent fetches
    loadingRef.current = true;
    try {
      // Performans: yalnızca premium yarıçapı (4 km) içindeki soruları, mesafeye
      // göre sıralı ve sabit üst sınırla (60) çek. Seyrek bölgede sunucu otomatik
      // genişletip en az 10'a tamamlar. Free kullanıcıda 1 km ötesi kilitli pin
      // olarak görünür. Böylece harita asla şişmez / kasmaz.
      setQuestions(
        await fetchQuestionsAround(lat, lng, PREMIUM_RADIUS_KM * 1000, MIN_NEARBY_QUESTIONS, MAX_NEARBY_QUESTIONS),
      );
      lastFetchCenterRef.current = { lat, lng };
      setRenderCenter({ lat, lng });
    } catch {
      // network errors are silent — pins stay as they are
    } finally {
      loadingRef.current = false;
      setHasLoadedOnce(true);
    }
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
        // Location not shared → app stays fully functional (Guideline 5.1.5).
        // Show the user's last known region if we have one, else a default area.
        // Browsing, answering, messaging and profile all work without location;
        // only posting a new question asks the user to enable location.
        let region = ISTANBUL;
        try {
          const saved = await AsyncStorage.getItem(LAST_REGION_KEY);
          if (saved) {
            const r = JSON.parse(saved);
            if (typeof r?.latitude === 'number' && typeof r?.longitude === 'number') {
              region = { ...ISTANBUL, latitude: r.latitude, longitude: r.longitude };
            }
          }
        } catch { /* ignore */ }
        mapRef.current?.animateToRegion(region, 600);
        await loadQuestions(region.latitude, region.longitude);
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
      // Remember this region as the fallback for sessions where the user later
      // turns Location Services off.
      AsyncStorage.setItem(LAST_REGION_KEY, JSON.stringify({ latitude: lat, longitude: lng })).catch(() => {});
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: CIRCLE_DELTA, longitudeDelta: CIRCLE_DELTA },
        last ? 400 : 800
      );
      await loadQuestions(lat, lng);
    })();
  }, []);

  // Beyond this distance a locked pin reads as "a different part of town / a
  // different city" rather than "just past your 1km free radius" — the two
  // paywall triggers already have distinct copy ('geo' vs 'region'), so route
  // to the one that actually matches what the user tapped.
  const REGION_DISTANCE_KM = 15;

  const handlePinPress = useCallback((q: Question) => {
    if (isLocked(q)) {
      const lockedCount = questions.filter(isLocked).length;
      const parent = navigation.getParent() as any;
      const isFarRegion = !!userLocation &&
        distanceKm(userLocation.lat, userLocation.lng, q.lat, q.lng) > REGION_DISTANCE_KM;

      if (isFarRegion) {
        track('locked_pin_tapped', { trigger: 'region' });
        fetchRegionQuestionCount(q.lat, q.lng)
          .then((regionCount) => parent?.navigate('Paywall', { trigger: 'region', count: regionCount || lockedCount }))
          .catch(() => parent?.navigate('Paywall', { trigger: 'region', count: lockedCount }));
      } else {
        track('locked_pin_tapped', { trigger: 'geo' });
        parent?.navigate('Paywall', { trigger: 'geo', count: lockedCount });
      }
      return;
    }
    setViewedIds((prev) => new Set(prev).add(q.id));
    setSelectedQuestion(q);
  }, [isLocked, navigation, questions, userLocation]);

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

  const availableQuestions = useMemo(() => filteredQuestions.filter(
    (q) => !isLocked(q) && q.author_id !== profile.id && !answeredIds.has(q.id)
  ), [filteredQuestions, isLocked, profile.id, answeredIds]);

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
        {/* Premium zone circle (faint) — the locked 1–4 km ring for free users */}
        {userLocation && !isPremium && (
          <Circle
            center={{ latitude: userLocation.lat, longitude: userLocation.lng }}
            radius={PREMIUM_RADIUS_KM * 1000}
            strokeColor={palette.accent + '44'}
            fillColor={palette.accent + '08'}
            strokeWidth={1}
          />
        )}

        {/* Free zone circle — questions inside this are open */}
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

      </MapView>

      {/* Top bar with BlurView */}
      <View style={styles.topBarWrapper}>
        <BlurView intensity={60} tint="dark" style={styles.topBar}>
          <Text style={styles.appName}>lore</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.leaderboardButton}
              activeOpacity={0.8}
              onPress={() => setShowLeaderboard(true)}
              accessibilityRole="button"
              accessibilityLabel={t('leaderboard.title')}
            >
              <Text style={styles.leaderboardEmoji}>🏆</Text>
            </TouchableOpacity>
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
          </View>
        </BlurView>
      </View>

      {showLeaderboard && (
        <LeaderboardSheet
          profileId={profile.id}
          isPremium={isPremium}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

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
            <IconLocateMe color={palette.ink00} size={22} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      )}


      {/* Empty region explainer — first-launch users outside seeded areas see
          this instead of a silent blank map (App Store review, Guideline 2.1). */}
      {hasLoadedOnce && filteredQuestions.length === 0 && !selectedQuestion && !showAsk && (
        <View style={styles.emptyCard} pointerEvents="box-none">
          <View style={styles.emptyCardInner}>
            <SealMark size={40} shade={TYPE_SHADE.open} gid="emptySeal" />
            <Text style={styles.emptyTitle}>{t('map.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('map.emptyBody')}</Text>
            <TouchableOpacity
              style={styles.emptyCta}
              activeOpacity={0.85}
              onPress={() => { track('empty_map_ask_tapped'); setShowAsk(true); }}
            >
              <Text style={styles.emptyCtaText}>{t('map.emptyCta')}</Text>
            </TouchableOpacity>
          </View>
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
          onDeleted={(qid) => setQuestions((prev) => prev.filter((q) => q.id !== qid))}
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
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leaderboardButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: palette.ink80 + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
  },
  leaderboardEmoji: { fontSize: 17 },
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

  emptyCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '38%',
    alignItems: 'center',
  },
  emptyCardInner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    backgroundColor: palette.ink80 + 'F2',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.md,
  },
  emptyTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.ink00,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink20,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.4,
  },
  emptyCta: {
    marginTop: spacing.xs,
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  emptyCtaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.white,
  },
});

