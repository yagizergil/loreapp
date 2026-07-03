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

const ID_DAILY_NUDGE  = 'lore_daily_nudge';
const ID_NEARBY_CHECK = 'lore_nearby_check';

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
