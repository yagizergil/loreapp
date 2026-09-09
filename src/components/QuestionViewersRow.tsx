import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { fetchQuestionViewCount, fetchQuestionViewers, QuestionViewer } from '../lib/supabase';
import { palette, fontFamily, fontSize, spacing, radius } from '../theme/tokens';
import { CONTENT_MAX_WIDTH } from '../theme/responsive';
import AvatarView from './ui/Avatar';
import { track } from '../lib/analytics';
import { paywallEvents } from '../lib/premiumEvents';
import { useTranslation } from 'react-i18next';

interface Props {
  questionId: string;
  isPremium: boolean;
}

/**
 * Author-only "who viewed this" teaser. Free users see a count with an
 * unlock CTA; premium users can tap through to the actual viewer list.
 * View data itself (question_views table) is written unconditionally for
 * every viewer regardless of the AUTHOR's premium status — this component
 * only gates whether the author gets to SEE it.
 */
export default function QuestionViewersRow({ questionId, isPremium }: Props) {
  const { t } = useTranslation();
  const [count, setCount] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchQuestionViewCount(questionId).then((n) => { if (alive) setCount(n); }).catch(() => {});
    return () => { alive = false; };
  }, [questionId]);

  if (count === null) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => {
          if (!isPremium) {
            track('question_viewers_unlock_tapped');
            paywallEvents.show('viewers');
            return;
          }
          track('question_viewers_viewed', { count });
          setShowList(true);
        }}
      >
        <Text style={styles.text}>
          {count > 0 ? t('answers.viewersCount', { n: count }) : t('answers.viewersCountZero')}
        </Text>
        {!isPremium && count > 0 && (
          <Text style={styles.unlockText}>{t('answers.viewersUnlockCta')}</Text>
        )}
      </TouchableOpacity>

      {showList && (
        <ViewersListModal questionId={questionId} onClose={() => setShowList(false)} />
      )}
    </>
  );
}

function ViewersListModal({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [viewers, setViewers] = useState<QuestionViewer[]>([]);

  useEffect(() => {
    fetchQuestionViewers(questionId).then(setViewers).finally(() => setLoading(false));
  }, [questionId]);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={modalStyles.cardWrapper} pointerEvents="box-none">
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{t('answers.viewersTitle')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Text style={modalStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />
          ) : viewers.length === 0 ? (
            <Text style={modalStyles.empty}>{t('answers.viewersEmpty')}</Text>
          ) : (
            <FlatList
              data={viewers}
              keyExtractor={(v) => v.viewerId}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <View style={modalStyles.viewerRow}>
                  <AvatarView avatarKey={item.avatar} avatarUrl={item.avatarUrl} size={32} ring={false} />
                  <Text style={modalStyles.viewerName} numberOfLines={1}>{item.nickname}</Text>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40 },
  unlockText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.accent },
});

const modalStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  cardWrapper: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '85%',
    maxWidth: CONTENT_MAX_WIDTH,
    backgroundColor: palette.ink80,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontFamily: fontFamily.display, fontSize: fontSize.lg, color: palette.ink00 },
  closeText: { fontSize: fontSize.lg, color: palette.ink40 },
  empty: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40, textAlign: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  viewerName: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: palette.ink10, flex: 1 },
});
