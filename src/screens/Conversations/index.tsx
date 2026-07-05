import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../../lib/ProfileContext';
import {
  Profile,
  fetchConversationsSummary, fetchProfiles,
} from '../../lib/supabase';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import Avatar from '../../components/ui/Avatar';
import { SkeletonList } from '../../components/ui/SkeletonRow';
import { captureError } from '../../lib/crashReporting';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2)  return i18n.t('common.now');
  if (m < 60) return i18n.t('common.ago.minutes', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t('common.ago.hours', { n: h });
  return i18n.t('common.ago.days', { n: Math.floor(h / 24) });
}

interface ConvItem {
  conversationId: string;
  other: Profile;
  lastMessageBody: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function ConversationsScreen() {
  const profile    = useProfile();
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const { t } = useTranslation();

  const [items, setItems]     = useState<ConvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      // Single RPC computes last-message + unread-count per conversation
      // server-side, instead of fetching every conversation's full message
      // history client-side (the old N+1 pattern).
      const summaries = await fetchConversationsSummary(profile.id);
      if (!summaries.length) { setItems([]); setLoading(false); return; }

      const others = await fetchProfiles(summaries.map((s) => s.other_id));
      const othersMap = Object.fromEntries(others.map((p) => [p.id, p]));

      const enriched: ConvItem[] = summaries.map((s) => ({
        conversationId: s.conversation_id,
        other: othersMap[s.other_id] ?? { id: s.other_id, nickname: '?', avatar: 'OW', gender: null },
        lastMessageBody: s.last_message_body ?? '',
        lastMessageTime: s.last_message_time,
        unreadCount: s.unread_count,
      }));
      setItems(enriched);
    } catch (e) {
      // Distinct from "you have no conversations" — an RPC failure (e.g. the
      // conversations_summary.sql migration hasn't been run yet) must not
      // look like an empty inbox.
      captureError(e);
      setLoadError(true);
    }
    finally { setLoading(false); }
  }, [profile.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openChat(item: ConvItem) {
    navigation.getParent()?.navigate('Chat', {
      conversationId: item.conversationId,
      otherUserId:    item.other.id,
      otherNickname:  item.other.nickname,
      otherAvatar:    item.other.avatar,
      otherGender:    item.other.gender,
    });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('conversations.title')}</Text>
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : loadError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('common.error')}</Text>
          <Text style={styles.emptyNote}>{t('conversations.loadError')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('conversations.emptyTitle')}</Text>
          <Text style={styles.emptyNote}>{t('conversations.emptyBody')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.conversationId}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.75}
                onPress={() => openChat(item)}
              >
                <Avatar avatarKey={item.other.avatar} gender={item.other.gender} size={50} ring />

                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, item.unreadCount > 0 && styles.nameUnread]}>{item.other.nickname}</Text>
                    <Text style={[styles.time, item.unreadCount > 0 && styles.timeUnread]}>{timeAgo(item.lastMessageTime)}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text
                      style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {item.lastMessageBody || '—'}
                    </Text>
                    {item.unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink90 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ink70,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: palette.ink00,
  },
  list: { paddingBottom: 32 },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: palette.ink70, marginLeft: 72 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    gap: spacing.md,
  },
  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.ink00,
  },
  time: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
  },
  preview: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    flex: 1,
  },
  nameUnread: { color: palette.ink00 },
  timeUnread: { color: palette.accent },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewUnread: { color: palette.ink00, fontFamily: fontFamily.bodySemiBold },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: palette.ink00,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.ink20,
  },
  emptyNote: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.6,
  },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.white,
  },
});
