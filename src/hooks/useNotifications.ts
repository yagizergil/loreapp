/**
 * useNotifications
 *
 * Single hook that wires up the full notification lifecycle:
 *  1. Registers push token on first mount (after profile is available)
 *  2. Listens for foreground notification receipts
 *  3. Listens for notification tap responses → deep link navigation
 *  4. Schedules daily nudge + nearby check based on current location
 *  5. Cancels nearby notification when user enters the app (app is open = no need to nudge)
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  scheduleDailyNudge,
  cancelNearbyNotification,
  getUserLocationLabel,
} from '../lib/notifications';
import { notificationEvents, NotificationScreen } from '../lib/notificationEvents';
import { saveUserLocation, fetchUserStats } from '../lib/supabase';

interface Options {
  profileId:    string | null;
  userLat?:     number;
  userLng?:     number;
}

export function useNotifications({ profileId, userLat, userLng }: Options) {
  const registeredFor = useRef<string | null>(null);

  // ── 1. Register push token whenever the active profile changes ──────────────
  // Re-claiming on every profile switch ensures the *current* profile owns the
  // device token. Otherwise, after a sign-out/profile switch the token stays on
  // the previous profile and this profile's notifications (DM, like, answer)
  // silently never arrive. claim_push_token is idempotent so this is safe.
  useEffect(() => {
    if (!profileId || registeredFor.current === profileId) return;
    registeredFor.current = profileId;
    registerForPushNotifications(profileId).catch(() => {});
  }, [profileId]);

  // ── 2. Schedule daily nudge once (or refresh when location changes) ─────────
  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [label, stats] = await Promise.all([
        getUserLocationLabel(),
        fetchUserStats(profileId).catch(() => null),
      ]);
      await scheduleDailyNudge(label, stats?.streak ?? 0);
    })();
  // Only re-run when profile first available; location label is fetched inside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // ── 3. Persist last known location → enables server-side nearby push ────────
  // When a new question is created near this location, the send-push Edge
  // Function pushes it in real time (replaces the old local nearby nudge).
  useEffect(() => {
    if (!profileId || userLat === undefined || userLng === undefined) return;
    saveUserLocation(profileId, userLat, userLng).catch(() => {});
  }, [profileId, userLat, userLng]);

  // ── 4. Clean up any stale local nearby nudge from older app versions ────────
  useEffect(() => {
    if (!profileId) return;
    cancelNearbyNotification().catch(() => {});
  }, [profileId]);

  // ── 5. Foreground notification received ─────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      // Notification arrived while app is in foreground.
      // expo-notifications will show it per the handler set in configureNotificationHandler().
      // No extra action needed here; in-app notification badge refresh
      // is handled by UnreadCountsContext via Supabase realtime.
      void notification;
    });
    return () => sub.remove();
  }, []);

  // ── 6. Notification tap → deep link ─────────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      if (!data) return;

      const dest = resolveDestination(data);
      if (dest) notificationEvents.onNavigate(dest);
    });
    return () => sub.remove();
  }, []);

  // ── 7. Cold-start: app opened via notification tap ───────────────────────────
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, any>;
      if (!data) return;
      const dest = resolveDestination(data);
      if (dest) notificationEvents.onNavigate(dest);
    });
  }, []);
}

// ─── Resolve notification data → navigation destination ──────────────────────

function resolveDestination(data: Record<string, any>): NotificationScreen | null {
  const screen = data?.screen as string | undefined;

  if (!screen || screen === 'Map')          return { screen: 'Map' };
  if (screen === 'Notifications')           return { screen: 'Notifications' };

  if (screen === 'Answers' && data.questionId && data.profileId) {
    return {
      screen:     'Answers',
      questionId: data.questionId as string,
      profileId:  data.profileId  as string,
    };
  }

  if (screen === 'Chat' && data.otherUserId) {
    return {
      screen:          'Chat',
      conversationId:  data.conversationId as string | undefined,
      otherUserId:     data.otherUserId    as string,
      otherNickname:   (data.otherNickname as string) ?? '',
      otherAvatar:     (data.otherAvatar   as string) ?? '🐾',
      otherGender:     (data.otherGender   as 'male' | 'female' | 'other' | null) ?? null,
    };
  }

  return { screen: 'Map' }; // safe fallback
}
