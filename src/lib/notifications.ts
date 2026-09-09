/**
 * Lore Notification Service
 *
 * Handles:
 *  - Expo push token registration & persistence
 *  - Android notification channel setup
 *  - Local scheduled notifications (daily nudge, nearby hotspot)
 *  - Notification content helpers (city-aware, global-ready)
 */

import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { savePushToken } from './supabase';
import i18n from '../i18n';

const EAS_PROJECT_ID = 'a2bfe8c9-6074-4bf9-9c0e-1b9ddc65c13a';

// ─── Channel IDs (Android) ────────────────────────────────────────────────────

export const CHANNEL = {
  SOCIAL:     'lore_social',      // answers, upvotes, messages
  NEARBY:     'lore_nearby',      // nearby question alerts
  ENGAGEMENT: 'lore_engagement',  // re-engagement nudges
} as const;

// ─── Scheduled notification identifiers ──────────────────────────────────────

const ID_DAILY_NUDGE   = 'lore_daily_nudge';
const ID_NEARBY_CHECK  = 'lore_nearby_check';
const ID_STREAK_RISK   = 'lore_streak_risk';
const ID_WINBACK_7     = 'lore_winback_7';
const ID_WINBACK_14    = 'lore_winback_14';
const ID_WINBACK_30    = 'lore_winback_30';

// ─── Android channel setup ────────────────────────────────────────────────────

export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNEL.SOCIAL, {
      name: i18n.t('notif.channelSocial'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 100, 250],
      lightColor: '#D4603A',
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync(CHANNEL.NEARBY, {
      name: i18n.t('notif.channelNearby'),
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150],
      lightColor: '#D4603A',
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync(CHANNEL.ENGAGEMENT, {
      name: i18n.t('notif.channelEngagement'),
      importance: Notifications.AndroidImportance.LOW,
      sound: undefined,
    }),
  ]);
}

// ─── Permission + token registration ─────────────────────────────────────────

export async function registerForPushNotifications(
  profileId: string
): Promise<string | null> {
  await setupNotificationChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    const token = tokenData.data;
    // Persist token to Supabase so server can send remote pushes
    await savePushToken(profileId, token);
    return token;
  } catch {
    return null;
  }
}

// ─── Foreground notification handler ─────────────────────────────────────────

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:   true,
      shouldPlaySound:   true,
      shouldSetBadge:    true,
      shouldShowBanner:  true,
      shouldShowList:    true,
    }),
  });
}

// ─── City/district detection (global-ready) ──────────────────────────────────

/**
 * Returns the most specific available place name for the user's location.
 * Falls back gracefully: district → city → country.
 * Used to build city-aware notification copy without hardcoding any city.
 */
export async function getUserLocationLabel(): Promise<string | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,      // accept up to 5 min old
      requiredAccuracy: 500,       // 500m is enough for city-level
    });
    if (!pos) return null;

    const [geo] = await Location.reverseGeocodeAsync({
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    if (!geo) return null;

    // Prefer district > subregion > city
    return geo.district ?? geo.subregion ?? geo.city ?? null;
  } catch {
    return null;
  }
}

// ─── Notification content builders ───────────────────────────────────────────

type NotifContent = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export function buildDailyNudgeContent(
  locationLabel: string | null,
  streak = 0,
): NotifContent {
  // A live streak is a stronger reason to come back than the generic rotating
  // copy — prefer it whenever the user actually has one worth protecting.
  if (streak >= 2) {
    return {
      title: i18n.t('notif.streakTitle', { streak }),
      body:  i18n.t('notif.streakBody', { streak }),
      data:  { screen: 'Map' },
    };
  }

  // Turkish uses a locative suffix on the place name; English keys are phrased
  // so the bare label reads naturally. When no place is known, fall back to a
  // localized "around you" phrase.
  const isTr  = (i18n.language ?? '').startsWith('tr');
  const place = locationLabel
    ? (isTr ? `${locationLabel}'de` : locationLabel)
    : i18n.t('notif.placeFallback');

  const variants = [
    { title: i18n.t('notif.daily1Title', { place }), body: i18n.t('notif.daily1Body', { place }) },
    { title: i18n.t('notif.daily2Title', { place }), body: i18n.t('notif.daily2Body', { place }) },
    { title: i18n.t('notif.daily3Title', { place }), body: i18n.t('notif.daily3Body', { place }) },
  ];

  const idx = new Date().getDay() % variants.length;
  return { ...variants[idx], data: { screen: 'Map' } };
}

// ─── Local notification scheduling ───────────────────────────────────────────

/**
 * Schedule a daily re-engagement notification at 18:00 local time.
 * Cancels any existing daily nudge first (idempotent).
 */
export async function scheduleDailyNudge(locationLabel: string | null, streak = 0) {
  await Notifications.cancelScheduledNotificationAsync(ID_DAILY_NUDGE).catch(() => {});

  const content = buildDailyNudgeContent(locationLabel, streak);

  await Notifications.scheduleNotificationAsync({
    identifier: ID_DAILY_NUDGE,
    content: {
      title:          content.title,
      body:           content.body,
      data:           content.data,
      sound:          'default',
      ...(Platform.OS === 'android' && { channelId: CHANNEL.ENGAGEMENT }),
    },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.DAILY,
      hour:    18,
      minute:  0,
    },
  });
}

/**
 * Streak-loss warning (Duolingo's single most-cited retention mechanic —
 * loss aversion outperforms the gain of the streak itself). Fires ONCE,
 * later THIS evening, only when there's an actual streak worth protecting
 * and the user hasn't already answered today — never scheduled as a
 * recurring DAILY trigger like the nudge above, because "you're about to
 * lose your streak" would be false and spammy on a day the user already
 * answered; re-evaluated fresh on every app open instead.
 */
export async function scheduleStreakRiskWarning(streak: number, hasAnsweredToday: boolean) {
  await Notifications.cancelScheduledNotificationAsync(ID_STREAK_RISK).catch(() => {});
  if (streak < 2 || hasAnsweredToday) return;

  const now = new Date();
  const fireAt = new Date(now);
  fireAt.setHours(21, 30, 0, 0);
  // Already past 21:30 — give a short lead time instead of skipping the
  // warning entirely (still meaningfully "later tonight" pre-midnight).
  if (fireAt <= now) fireAt.setTime(now.getTime() + 60 * 60 * 1000);
  // Never schedule into tomorrow — if that pushes past midnight, the streak
  // is effectively already at its deadline; nothing useful to warn about.
  if (fireAt.getDate() !== now.getDate()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: ID_STREAK_RISK,
    content: {
      title: i18n.t('notif.streakRiskTitle', { streak }),
      body:  i18n.t('notif.streakRiskBody', { streak }),
      data:  { screen: 'Map' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: CHANNEL.ENGAGEMENT }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

/**
 * Call right after a successful answer submission — the streak is safe for
 * today, so the evening warning (scheduled at last app-open, before this
 * answer happened) would otherwise fire a false "you're about to lose it".
 */
export async function cancelStreakRiskWarning() {
  await Notifications.cancelScheduledNotificationAsync(ID_STREAK_RISK).catch(() => {});
}

/**
 * 3-stage win-back sequence for lapsed users (documented pattern: escalating
 * specificity/incentive at 7/14/30 days inactive, ~20-30% average recovery
 * rate for structured win-back campaigns vs. single generic reminders).
 * Scheduled as three far-future local DATE triggers on every app open — the
 * clock resets each time the user actually opens the app, and since these
 * are OS-scheduled local notifications, they still fire even if the app is
 * never reopened before the target date, without needing a server job.
 */
export async function scheduleWinBackSequence(locationLabel: string | null) {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(ID_WINBACK_7),
    Notifications.cancelScheduledNotificationAsync(ID_WINBACK_14),
    Notifications.cancelScheduledNotificationAsync(ID_WINBACK_30),
  ].map((p) => p.catch(() => {})));

  const isTr  = (i18n.language ?? '').startsWith('tr');
  const place = locationLabel
    ? (isTr ? `${locationLabel}'de` : locationLabel)
    : i18n.t('notif.placeFallback');

  const stages: { id: string; days: number; titleKey: string; bodyKey: string }[] = [
    { id: ID_WINBACK_7,  days: 7,  titleKey: 'notif.winback7Title',  bodyKey: 'notif.winback7Body' },
    { id: ID_WINBACK_14, days: 14, titleKey: 'notif.winback14Title', bodyKey: 'notif.winback14Body' },
    { id: ID_WINBACK_30, days: 30, titleKey: 'notif.winback30Title', bodyKey: 'notif.winback30Body' },
  ];

  for (const stage of stages) {
    const fireAt = new Date(Date.now() + stage.days * 24 * 60 * 60 * 1000);
    await Notifications.scheduleNotificationAsync({
      identifier: stage.id,
      content: {
        title: i18n.t(stage.titleKey, { place }),
        body:  i18n.t(stage.bodyKey, { place }),
        data:  { screen: 'Map' },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: CHANNEL.ENGAGEMENT }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
  }
}

/**
 * Cancel any stale local "nearby questions" notification scheduled by older
 * app versions. Nearby alerts are now delivered as real-time server pushes.
 */
export async function cancelNearbyNotification() {
  await Notifications.cancelScheduledNotificationAsync(ID_NEARBY_CHECK).catch(() => {});
}

/**
 * Full teardown (e.g. on sign-out).
 */
export async function cancelAllLocalNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
