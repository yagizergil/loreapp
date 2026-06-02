import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../../lib/ProfileContext';
import { useUnreadCounts } from '../../lib/UnreadCountsContext';
import { fetchNotifications, AppNotification } from '../../lib/supabase';
import { notificationEvents } from '../../lib/notificationEvents';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import Avatar from '../../components/ui/Avatar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return i18n.t('common.now');
  if (m < 60) return i18n.t('common.ago.minutes', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t('common.ago.hours', { n: h });
  const d = Math.floor(h / 24);
  if (d < 7)  return i18n.t('common.ago.days', { n: d });
  return i18n.t('common.ago.weeks', { n: Math.floor(d / 7) });
}

function notifIcon(type: AppNotification['type']): string {
  switch (type) {
    case 'new_answer':     return '💬';
    case 'answer_upvoted': return '♥';
    default:               return '✦';
  }
}

function notifText(n: AppNotification): string {
  const actor = n.actor?.nickname ?? i18n.t('notifications.someone');
  const question = n.question?.body
    ? `"${n.question.body.slice(0, 40)}${n.question.body.length > 40 ? '…' : ''}"`
    : i18n.t('notifications.title').toLowerCase();
  switch (n.type) {
    case 'new_answer':
      return i18n.t('notifications.newAnswer', { actor, question });
    case 'answer_upvoted':
      return i18n.t('notifications.upvoted', { actor });
    default:
      return i18n.t('notifications.title');
  }
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[n.row, !item.read && n.rowUnread]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Unread dot */}
      {!item.read && <View style={n.dot} />}

      {/* Actor avatar or icon */}
      <View style={n.avatarWrap}>
        {item.actor ? (
          <Avatar
            avatarKey={item.actor.avatar}
            avatarUrl={item.actor.avatar_url}
            gender={item.actor.gender}
            size={42}
            ring={false}
          />
        ) : (
          <View style={n.iconCircle}>
            <Text style={n.iconText}>{notifIcon(item.type)}</Text>
          </View>
        )}
        {/* Type badge */}
        <View style={n.typeBadge}>
          <Text style={n.typeBadgeText}>{notifIcon(item.type)}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={n.content}>
        <Text style={[n.text, !item.read && n.textUnread]} numberOfLines={2}>
          {notifText(item)}
        </Text>
        <Text style={n.time}>{timeAgo(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const n = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    gap: spacing.base,
    backgroundColor: 'transparent',
  },
  rowUnread: {
    backgroundColor: palette.ink80,
  },
  dot: {
    position: 'absolute',
    left: 8,
    top: '50%',
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
    marginTop: -3,
  },
  avatarWrap: { position: 'relative', width: 42 },
  iconCircle: {
    width: 42, height: 42,
    borderRadius: 21,
    backgroundColor: palette.ink70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: palette.ink80,
    borderWidth: 1.5,
    borderColor: palette.ink70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeText: { fontSize: 9, lineHeight: 11 },
  content: { flex: 1, gap: 3 },
  text: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink20,
    lineHeight: fontSize.sm * 1.5,
  },
  textUnread: {
    fontFamily: fontFamily.bodySemiBold,
    color: palette.ink00,
  },
  time: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: palette.ink40,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const profile    = useProfile();
  const insets     = useSafeAreaInsets();
  const { markNotifsRead } = useUnreadCounts();
  const { t } = useTranslation();

  const [items, setItems]     = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch + mark read every time screen is focused
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fetchNotifications(profile.id)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    // Mark all as read after brief delay (let user see the unread state first)
    const t = setTimeout(() => {
      markNotifsRead();
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [profile.id, markNotifsRead]));

  function handlePress(item: AppNotification) {
    if (item.question_id) {
      // Deep-link to the question's Answers screen. The navigation bridge
      // fetches the full Question object by id, then navigates.
      notificationEvents.onNavigate({
        screen: 'Answers',
        questionId: item.question_id,
        profileId: profile.id,
      });
    }
  }

  return (
    <View style={[s.root, { backgroundColor: palette.ink90 }]}>

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.base }]}>
        <Text style={s.title}>{t('notifications.title')}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={palette.ink40} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>{t('notifications.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('notifications.emptyBody')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotifRow item={item} onPress={() => handlePress(item)} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={s.separator} />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ink70,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: palette.ink00,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  emptyTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.ink20,
  },
  emptyBody: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.6,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.ink70,
    marginLeft: spacing.lg + 42 + spacing.base,
  },
});
