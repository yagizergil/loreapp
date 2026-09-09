import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Share, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { ensureReferralCode, fetchReferralProgress, ReferralProgress } from '../../lib/supabase';
import { usePremium } from '../../lib/PremiumContext';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import { CONTENT_MAX_WIDTH } from '../../theme/responsive';
import { LINKS } from '../../lib/links';
import { track } from '../../lib/analytics';
import { useTranslation } from 'react-i18next';

interface Props {
  profileId: string;
  onClose: () => void;
}

const REWARD_DAYS = 30;
const INVITES_PER_REWARD = 5;

export default function InviteSheet({ profileId, onClose }: Props) {
  const { t } = useTranslation();
  const { refreshReferralPremium } = usePremium();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ReferralProgress | null>(null);

  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value   = withSpring(1, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 220 });

    track('invite_sheet_viewed');

    (async () => {
      try {
        await ensureReferralCode(profileId);
        const p = await fetchReferralProgress(profileId);
        setProgress(p);
        // The rest of the app's isPremium gate reads a value fetched once
        // at app start / polled every few minutes — opening this screen is
        // a good moment to force it fresh instead of waiting on the poll.
        refreshReferralPremium();
      } catch {
        // keep the sheet usable even if this fails — share still works
        // once the code loads on a later open.
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    if (!progress?.referralCode) return;
    track('invite_share_tapped', { invited_count: progress.invitedCount });
    try {
      await Share.share({
        message: t('invite.shareMessage', { code: progress.referralCode, url: LINKS.appStoreListing }),
      });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  const invitedInCycle = progress ? progress.invitedCount % INVITES_PER_REWARD : 0;
  const remaining = progress ? INVITES_PER_REWARD - invitedInCycle : INVITES_PER_REWARD;
  const hasActiveReward = !!progress?.premiumUntil && new Date(progress.premiumUntil).getTime() > Date.now();

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View style={[styles.cardWrapper, cardStyle]} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('invite.title')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <View style={styles.closeX1} />
              <View style={styles.closeX2} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{t('invite.subtitle', { days: REWARD_DAYS, count: INVITES_PER_REWARD })}</Text>

          <View style={styles.headerDivider} />

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : (
            <View style={styles.body}>
              {hasActiveReward && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{t('invite.activeReward')}</Text>
                </View>
              )}

              <View style={styles.progressRow}>
                {Array.from({ length: INVITES_PER_REWARD }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.progressDot, i < invitedInCycle && styles.progressDotFilled]}
                  />
                ))}
              </View>
              <Text style={styles.progressText}>
                {remaining > 0
                  ? t('invite.progressRemaining', { remaining })
                  : t('invite.progressComplete')}
              </Text>

              {progress?.referralCode && (
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>{t('invite.yourCode')}</Text>
                  <Text style={styles.codeValue}>{progress.referralCode}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare}>
                <Text style={styles.shareBtnText}>{t('invite.shareCta')}</Text>
              </TouchableOpacity>

              <Text style={styles.totalInvited}>
                {t('invite.totalInvited', { n: progress?.invitedCount ?? 0 })}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  cardWrapper: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-none' as any },
  card: {
    width: '90%',
    maxWidth: CONTENT_MAX_WIDTH,
    backgroundColor: palette.ink80,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
    overflow: 'hidden',
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.base },
  title: { fontFamily: fontFamily.display, fontSize: fontSize.lg, color: palette.ink00 },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40, paddingHorizontal: spacing.lg, marginTop: 2 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink70, borderRadius: 14 },
  closeX1: { position: 'absolute', width: 12, height: 1.5, backgroundColor: palette.ink20, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  closeX2: { position: 'absolute', width: 12, height: 1.5, backgroundColor: palette.ink20, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.ink60, marginTop: spacing.md },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.success + '22',
    borderColor: palette.success + '55',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  activeBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: palette.success },
  progressRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.sm },
  progressDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: palette.ink70, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.ink60 },
  progressDotFilled: { backgroundColor: palette.accent, borderColor: palette.accent },
  progressText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink20, textAlign: 'center', marginBottom: spacing.lg },
  codeBox: {
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  codeLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.ink40, marginBottom: 4 },
  codeValue: { fontFamily: fontFamily.display, fontSize: fontSize.xl, color: palette.ink00, letterSpacing: 4 },
  shareBtn: { backgroundColor: palette.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  shareBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.white },
  totalInvited: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.ink40, textAlign: 'center', marginTop: spacing.md },
});
