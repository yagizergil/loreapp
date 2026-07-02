import React, { useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Modal, Pressable, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Question } from '../../lib/supabase';
import { getQuestionBadge, badgePriority, BADGE_META } from '../../lib/questionBadge';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import { CONTENT_MAX_WIDTH } from '../../theme/responsive';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const TYPE_COLOR: Record<string, string> = {
  vote: palette.accent, choice: '#4A7FC0', open: '#4A9E6E',
};
const TYPE_LABEL = (): Record<string, string> => ({
  vote: i18n.t('questionType.vote'),
  choice: i18n.t('questionType.choice'),
  open: i18n.t('questionType.open'),
});

interface Props {
  questions: Question[];
  lockedIds?: Set<string>;
  onSelect: (q: Question) => void;
  onClose: () => void;
}

export default function ClusterSheet({ questions, lockedIds = new Set(), onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value   = withSpring(1, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 220 });
  }, []);

  // Unlocked first, then by badge priority, then answer count, then newest
  const sorted = useMemo(() => [...questions].sort((a, b) => {
    const aLocked = lockedIds.has(a.id) ? 1 : 0;
    const bLocked = lockedIds.has(b.id) ? 1 : 0;
    if (aLocked !== bLocked) return aLocked - bLocked;
    const bp = badgePriority(getQuestionBadge(b)) - badgePriority(getQuestionBadge(a));
    if (bp !== 0) return bp;
    const ac = b.answer_count - a.answer_count;
    if (ac !== 0) return ac;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }), [questions, lockedIds]);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View style={[styles.cardWrapper, cardStyle]} pointerEvents="box-none">
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('cluster.nearby', { n: questions.length })}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={12}>
              <View style={styles.closeX1} />
              <View style={styles.closeX2} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerDivider} />

          <FlatList
            data={sorted}
            keyExtractor={(q) => q.id}
            contentContainerStyle={styles.list}
            style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item: q }) => {
              const color  = TYPE_COLOR[q.type] ?? palette.accent;
              const locked = lockedIds.has(q.id);
              const badge  = locked ? null : getQuestionBadge(q);
              const badgeMeta = badge ? BADGE_META[badge] : null;

              return (
                <TouchableOpacity
                  style={[styles.row, locked && styles.rowLocked]}
                  activeOpacity={0.75}
                  onPress={() => onSelect(q)}
                >
                  <View style={[styles.strip, { backgroundColor: locked ? palette.ink60 : color }]} />
                  <View style={styles.rowBody}>
                    {locked ? (
                      <>
                        <View style={styles.lockedBar} />
                        <View style={[styles.lockedBar, { width: 80, opacity: 0.5 }]} />
                      </>
                    ) : (
                      <Text style={styles.rowText} numberOfLines={2}>{q.body}</Text>
                    )}
                    <View style={styles.meta}>
                      {locked ? (
                        <Text style={styles.lockedLabel}>{t('cluster.locked')}</Text>
                      ) : (
                        <>
                          <Text style={[styles.metaType, { color }]}>{TYPE_LABEL()[q.type]}</Text>
                          {q.answer_count > 0 && (
                            <Text style={styles.metaCount}>{t('timeline.answers', { n: q.answer_count })}</Text>
                          )}
                          {badgeMeta && (
                            <View style={[styles.badgeChip, { backgroundColor: badgeMeta.bg }]}>
                              <Text style={[styles.badgeText, { color: badgeMeta.color }]}>
                                {t(`badge.${badge}`)}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                  {locked ? (
                    <View style={styles.lockMini}>
                      <View style={styles.lockMiniBody} />
                      <View style={styles.lockMiniArc} />
                    </View>
                  ) : (
                    <Text style={styles.arrow}>›</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
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
    paddingVertical: spacing.base,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.ink00,
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
  },

  list: { paddingBottom: spacing.sm },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: palette.ink70, marginLeft: spacing.lg },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.ink80,
    overflow: 'hidden',
  },
  rowLocked: { opacity: 0.6 },
  strip: { width: 3, alignSelf: 'stretch' },
  rowBody: {
    flex: 1,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: 4,
  },
  rowText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
    lineHeight: fontSize.base * 1.4,
  },
  meta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  metaType: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaCount: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
  },
  badgeChip: {
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  arrow: {
    fontFamily: fontFamily.body,
    fontSize: 22,
    color: palette.ink40,
    paddingRight: spacing.base,
    lineHeight: 28,
  },

  lockedBar: { height: 7, width: 120, borderRadius: 4, backgroundColor: palette.ink60, marginBottom: 3 },
  lockedLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockMini: { alignItems: 'center', paddingRight: spacing.base, paddingLeft: spacing.sm },
  lockMiniBody: { width: 12, height: 9, borderRadius: 2, backgroundColor: palette.ink40, marginTop: 6 },
  lockMiniArc: {
    position: 'absolute', top: 0,
    width: 8, height: 7,
    borderTopLeftRadius: 4, borderTopRightRadius: 4,
    borderWidth: 1.5, borderBottomWidth: 0,
    borderColor: palette.ink40,
  },
});
