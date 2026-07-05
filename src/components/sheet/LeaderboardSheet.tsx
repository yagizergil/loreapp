import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Modal, Pressable, Dimensions, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCityLeaderboard, fetchMyLeaderboardRank, LeaderboardEntry } from '../../lib/supabase';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import { CONTENT_MAX_WIDTH } from '../../theme/responsive';
import Avatar from '../ui/Avatar';
import { track } from '../../lib/analytics';
import { paywallEvents } from '../../lib/premiumEvents';
import { useTranslation } from 'react-i18next';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const LAST_REGION_KEY = '@lore/last_region';

// Free users see this many rows in full; the rest render locked/blurred.
const FREE_VISIBLE_ROWS = 3;

interface Props {
  profileId: string;
  isPremium: boolean;
  onClose: () => void;
}

// Free callers only ever receive up to FREE_VISIBLE_ROWS rows — clamped
// server-side in city_leaderboard, not just hidden here — so there's no
// "locked" row data to render past this point.
const LeaderboardRow = React.memo(function LeaderboardRow({ item, isMe }: { item: LeaderboardEntry; isMe: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.row, isMe && styles.rowMine]}>
      <Text style={styles.rank}>{item.rank}</Text>
      <Avatar avatarKey={item.avatar} avatarUrl={item.avatar_url} size={32} ring={false} />
      <Text style={styles.name} numberOfLines={1}>{item.nickname}</Text>
      <Text style={styles.count}>{t('leaderboard.answersCount', { n: item.answer_count })}</Text>
    </View>
  );
});

export default function LeaderboardSheet({ profileId, isPremium, onClose }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading]   = useState(true);
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank]     = useState<{ rank: number; answerCount: number } | null>(null);
  const [noLocation, setNoLocation] = useState(false);

  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value   = withSpring(1, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 220 });

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LAST_REGION_KEY);
        if (!saved) { setNoLocation(true); setLoading(false); return; }
        const { latitude, longitude } = JSON.parse(saved);
        const [top, mine] = await Promise.all([
          fetchCityLeaderboard(latitude, longitude, isPremium),
          fetchMyLeaderboardRank(profileId, latitude, longitude),
        ]);
        setEntries(top);
        setMyRank(mine);
        track('leaderboard_viewed', { entries: top.length, rank: mine?.rank ?? null });
      } catch {
        setNoLocation(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myOwnRow = entries.find((e) => e.profile_id === profileId);
  const showMyRankFooter = !isPremium && myRank && (!myOwnRow || myRank.rank > FREE_VISIBLE_ROWS);

  const renderItem = useCallback(({ item }: { item: LeaderboardEntry }) => (
    <LeaderboardRow item={item} isMe={item.profile_id === profileId} />
  ), [profileId]);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View style={[styles.cardWrapper, cardStyle]} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('leaderboard.title')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <View style={styles.closeX1} />
              <View style={styles.closeX2} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{t('leaderboard.subtitle')}</Text>

          <View style={styles.headerDivider} />

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : noLocation || entries.length === 0 ? (
            <Text style={styles.emptyText}>{t('leaderboard.empty')}</Text>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(e) => e.profile_id}
              contentContainerStyle={styles.list}
              style={{ maxHeight: SCREEN_HEIGHT * 0.45 }}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={renderItem}
              ListFooterComponent={
                !isPremium ? (
                  <TouchableOpacity
                    style={styles.unlockBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      track('leaderboard_unlock_tapped');
                      onClose();
                      setTimeout(() => paywallEvents.show('leaderboard'), 300);
                    }}
                  >
                    <Text style={styles.unlockBtnText}>{t('leaderboard.unlockCta')}</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}

          {showMyRankFooter && (
            <View style={styles.myRankFooter}>
              <Text style={styles.myRankText}>
                {t('leaderboard.yourRank', { rank: myRank!.rank })}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none' as any,
  },
  card: {
    width: '90%',
    maxWidth: CONTENT_MAX_WIDTH,
    backgroundColor: palette.ink80,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
    overflow: 'hidden',
    paddingBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.ink00,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    paddingHorizontal: spacing.lg,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink70,
    borderRadius: 14,
  },
  closeX1: {
    position: 'absolute',
    width: 12, height: 1.5,
    backgroundColor: palette.ink20,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  closeX2: {
    position: 'absolute',
    width: 12, height: 1.5,
    backgroundColor: palette.ink20,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.ink60,
    marginTop: spacing.md,
  },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  list: { paddingBottom: spacing.sm },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: palette.ink70, marginLeft: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  rowMine: { backgroundColor: palette.accent + '14' },
  rank: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.ink40,
    width: 22,
    textAlign: 'center',
  },
  name: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: palette.ink00,
  },
  count: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
  },
  unlockBtn: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.white,
  },
  myRankFooter: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.ink60,
    alignItems: 'center',
  },
  myRankText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.accent,
  },
});
