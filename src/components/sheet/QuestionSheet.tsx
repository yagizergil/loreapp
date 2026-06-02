import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal, Pressable, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, interpolate,
} from 'react-native-reanimated';
import { Question, Answer, fetchAnswers, submitAnswer, reportQuestion, countTodayAnswers, FREE_DAILY_ANSWER_LIMIT } from '../../lib/supabase';
import { paywallEvents } from '../../lib/premiumEvents';
import { usePremium } from '../../lib/PremiumContext';
import { getQuestionBadge, BADGE_META } from '../../lib/questionBadge';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  question: Question | null;
  profileId: string;
  hasAnswered: boolean;
  onClose: () => void;
  onAnswered: (questionId: string) => void;
  onOpenAnswers: (question: Question) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return i18n.t('common.ago.minutes', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t('common.ago.hours', { n: h });
  return i18n.t('common.ago.days', { n: Math.floor(h / 24) });
}

const TYPE_COLOR: Record<string, string> = {
  vote: palette.accent, choice: '#4A7FC0', open: '#4A9E6E',
};
const TYPE_LABEL = (): Record<string, string> => ({
  vote: i18n.t('questionType.vote'),
  choice: i18n.t('questionType.choice'),
  open: i18n.t('questionType.open'),
});

// ── Vote result bar ───────────────────────────────────────────────────────────

function VoteBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const widthVal = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: `${widthVal.value}%` as any }));
  useEffect(() => { widthVal.value = withTiming(pct, { duration: 600 }); }, [pct]);

  return (
    <View style={voteStyles.row}>
      <View style={voteStyles.barBg}>
        <Animated.View style={[voteStyles.barFill, barStyle, { backgroundColor: color + '55' }]} />
      </View>
      <View style={voteStyles.labelRow}>
        <Text style={voteStyles.label}>{label}</Text>
        <Text style={[voteStyles.pct, { color }]}>{pct}%</Text>
      </View>
      <Text style={voteStyles.count}>{count} oy</Text>
    </View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function QuestionSheet({
  question, profileId, hasAnswered, onClose, onAnswered, onOpenAnswers,
}: Props) {
  const { t } = useTranslation();
  const [answers, setAnswers]             = useState<Answer[]>([]);
  const [loading, setLoading]             = useState(false);
  const [openText, setOpenText]           = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [localAnswered, setLocalAnswered] = useState(false);
  // myChoice: tracks which option the user selected (vote or choice type)
  const [myChoice, setMyChoice]           = useState<string | null>(null);
  const { isPremium } = usePremium();

  // Entry animation
  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const confirmOpacity = useSharedValue(0);
  const confirmStyle   = useAnimatedStyle(() => ({
    opacity: confirmOpacity.value,
    transform: [{ translateY: interpolate(confirmOpacity.value, [0, 1], [8, 0]) }],
  }));

  const yesScale = useSharedValue(1);
  const noScale  = useSharedValue(1);
  const yesStyle = useAnimatedStyle(() => ({ transform: [{ scale: yesScale.value }] }));
  const noStyle  = useAnimatedStyle(() => ({ transform: [{ scale: noScale.value }] }));

  const answered = hasAnswered || localAnswered;

  // Animate in + fetch answers whenever question changes
  useEffect(() => {
    if (!question) return;
    scale.value   = 0.88;
    opacity.value = 0;
    scale.value   = withSpring(1, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 220 });

    setAnswers([]);
    setLoading(true);
    setLocalAnswered(false);
    setMyChoice(null);
    setOpenText('');
    confirmOpacity.value = 0;

    fetchAnswers(question.id)
      .then((fetched) => {
        setAnswers(fetched);
        // Restore user's own choice on reopen so their pick is highlighted
        const mine = fetched.find((a) => a.author_id === profileId);
        if (mine?.choice) setMyChoice(mine.choice);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [question?.id]);

  async function handleVote(choice: string) {
    if (!question || answered || submitting) return;
    if (!isPremium) {
      const todayCount = await countTodayAnswers(profileId);
      if (todayCount >= FREE_DAILY_ANSWER_LIMIT) { onClose(); setTimeout(() => paywallEvents.show('limit'), 300); return; }
    }
    if (choice === 'Evet') yesScale.value = withSequence(withSpring(0.9), withSpring(1));
    if (choice === 'Hayır') noScale.value = withSequence(withSpring(0.9), withSpring(1));
    setSubmitting(true);
    try {
      const newAnswer = await submitAnswer(question.id, profileId, { choice });
      setAnswers((prev) => [...prev, newAnswer]);
      setMyChoice(choice);
      confirmOpacity.value = withTiming(1, { duration: 350 });
      setLocalAnswered(true);
      onAnswered(question.id);
    } catch (e: any) {
      if (e?.code === '23505') {
        // Already answered — fetch fresh to recover the choice
        const fresh = await fetchAnswers(question.id).catch(() => []);
        if (fresh.length) {
          setAnswers(fresh);
          const mine = fresh.find((a) => a.author_id === profileId);
          if (mine?.choice) setMyChoice(mine.choice);
        }
        setLocalAnswered(true);
        onAnswered(question.id);
      }
    } finally { setSubmitting(false); }
  }

  async function handleOpenSubmit() {
    if (!question || !openText.trim() || submitting) return;
    if (!isPremium) {
      const todayCount = await countTodayAnswers(profileId);
      if (todayCount >= FREE_DAILY_ANSWER_LIMIT) { onClose(); setTimeout(() => paywallEvents.show('limit'), 300); return; }
    }
    setSubmitting(true);
    try {
      await submitAnswer(question.id, profileId, { body: openText.trim() });
      confirmOpacity.value = withTiming(1, { duration: 350 });
      setLocalAnswered(true);
      onAnswered(question.id);
    } catch (e: any) {
      if (e?.code === '23505') { setLocalAnswered(true); onAnswered(question.id); }
    } finally { setSubmitting(false); }
  }

  if (!question) return null;

  const typeColor   = TYPE_COLOR[question.type] ?? palette.accent;
  const badge       = getQuestionBadge(question);
  const badgeMeta   = badge ? BADGE_META[badge] : null;
  const yesVotes    = answers.filter((a) => a.choice === 'Evet').length;
  const noVotes     = answers.filter((a) => a.choice === 'Hayır').length;
  const totalVotes  = yesVotes + noVotes;

  // choiceTallies: prefer live counts from fetched answers; fall back to
  // question.options[].count (DB-stored aggregate) when answers aren't loaded yet.
  // This ensures percentages are always visible even before the fetch finishes.
  const choiceTallies = (question.options ?? []).map((opt) => {
    const liveCount = answers.filter((a) => a.choice === opt.label).length;
    return {
      label: opt.label,
      count: answers.length > 0 ? liveCount : opt.count,
    };
  });
  const totalChoiceVotes = choiceTallies.reduce((s, o) => s + o.count, 0);

  return (
    <Modal
      visible={!!question}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Card */}
      <Animated.View style={[styles.cardWrapper, cardStyle]} pointerEvents="box-none">
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={12}>
            <View style={styles.closeX1} />
            <View style={styles.closeX2} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.typePill, { backgroundColor: typeColor + '22', borderColor: typeColor + '55' }]}>
                  <Text style={[styles.typeText, { color: typeColor }]}>{TYPE_LABEL()[question.type]}</Text>
                </View>
                {badgeMeta && (
                  <View style={[styles.typePill, { backgroundColor: badgeMeta.bg, borderColor: badgeMeta.color + '55' }]}>
                    <Text style={[styles.typeText, { color: badgeMeta.color }]}>{badgeMeta.label}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.timeText}>{timeAgo(question.created_at)}</Text>
            </View>

            {/* Question */}
            <Text style={styles.questionBody}>{question.body}</Text>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{question.answer_count}</Text>
                <Text style={styles.statLabel}>{t('sheet.answersLabel')}</Text>
              </View>
              {question.type === 'vote' && totalVotes > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: palette.success }]}>
                    {Math.round((yesVotes / totalVotes) * 100)}%
                  </Text>
                  <Text style={styles.statLabel}>{t('sheet.yesLabel')}</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* VOTE */}
            {question.type === 'vote' && (
              <View style={styles.section}>
                {answered && totalVotes > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    <VoteBar label={t('sheet.voteYes')} count={yesVotes} total={totalVotes} color={palette.success} />
                    <VoteBar label={t('sheet.voteNo')}  count={noVotes}  total={totalVotes} color={palette.error} />
                  </View>
                ) : !answered ? (
                  <View style={styles.voteButtons}>
                    <Animated.View style={[{ flex: 1 }, yesStyle]}>
                      <TouchableOpacity
                        style={[styles.voteBtn, styles.voteBtnYes]}
                        activeOpacity={0.8}
                        onPress={() => handleVote('Evet')}
                        disabled={submitting}
                      >
                        <Text style={[styles.voteBtnText, { color: palette.success }]}>{t('sheet.voteYes')}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                    <Animated.View style={[{ flex: 1 }, noStyle]}>
                      <TouchableOpacity
                        style={[styles.voteBtn, styles.voteBtnNo]}
                        activeOpacity={0.8}
                        onPress={() => handleVote('Hayır')}
                        disabled={submitting}
                      >
                        <Text style={[styles.voteBtnText, { color: palette.error }]}>{t('sheet.voteNo')}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                ) : (
                  <Text style={styles.emptyNote}>{t('sheet.loadingVote')}</Text>
                )}
              </View>
            )}

            {/* CHOICE */}
            {question.type === 'choice' && (
              <View style={styles.section}>
                {choiceTallies.map((opt) => {
                  const pct       = totalChoiceVotes > 0
                    ? Math.round((opt.count / totalChoiceVotes) * 100)
                    : 0;
                  const isMyPick  = myChoice === opt.label;
                  const isLeading = answered && opt.count === Math.max(...choiceTallies.map(o => o.count)) && opt.count > 0;

                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.choiceRow,
                        isMyPick && { borderColor: typeColor, borderWidth: 1.5 },
                      ]}
                      activeOpacity={0.75}
                      disabled={answered || submitting}
                      onPress={() => handleVote(opt.label)}
                    >
                      {/* Fill bar — always rendered when answered so it animates from 0 */}
                      {answered && (
                        <View style={[
                          styles.choiceBar,
                          {
                            width: `${pct}%` as any,
                            backgroundColor: isMyPick ? typeColor + '30' : typeColor + '18',
                          },
                        ]} />
                      )}

                      {/* Selection dot */}
                      {answered && (
                        <View style={[
                          styles.choiceDot,
                          { borderColor: isMyPick ? typeColor : palette.ink40 },
                        ]}>
                          {isMyPick && <View style={[styles.choiceDotFill, { backgroundColor: typeColor }]} />}
                        </View>
                      )}

                      <Text style={[
                        styles.choiceLabel,
                        isMyPick && { color: palette.ink00, fontFamily: fontFamily.bodySemiBold },
                      ]}>
                        {opt.label}
                      </Text>

                      {isLeading && answered && (
                        <View style={[styles.leadBadge, { backgroundColor: typeColor + '22' }]}>
                          <Text style={[styles.leadText, { color: typeColor }]}>{t('sheet.leading')}</Text>
                        </View>
                      )}

                      {answered && (
                        <Text style={[styles.choicePct, isMyPick && { color: typeColor }]}>
                          {pct}%
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Total votes footer */}
                {answered && totalChoiceVotes > 0 && (
                  <Text style={styles.choiceTotalText}>
                    {t('sheet.totalVotesLine', { total: totalChoiceVotes, choice: myChoice ?? '' })}
                  </Text>
                )}
              </View>
            )}

            {/* OPEN — input */}
            {question.type === 'open' && !answered && (
              <View style={styles.section}>
                <TextInput
                  style={styles.openInput}
                  placeholder={t('sheet.openPlaceholder')}
                  placeholderTextColor={palette.ink40}
                  value={openText}
                  onChangeText={setOpenText}
                  maxLength={120}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, (!openText.trim() || submitting) && styles.submitBtnDisabled]}
                  activeOpacity={0.85}
                  onPress={handleOpenSubmit}
                  disabled={!openText.trim() || submitting}
                >
                  {submitting
                    ? <ActivityIndicator color={palette.white} size="small" />
                    : <Text style={styles.submitBtnText}>{t('sheet.submitAnswer')}</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Confirmation */}
            {localAnswered && (
              <Animated.View style={[styles.confirmation, confirmStyle]}>
                <View style={styles.confirmDot} />
                <Text style={styles.confirmText}>{t('sheet.answerSaved')}</Text>
              </Animated.View>
            )}

            {/* Open CTA */}
            {question.type === 'open' && (
              <TouchableOpacity
                style={styles.answersCtaBtn}
                activeOpacity={0.8}
                onPress={() => { onClose(); onOpenAnswers(question); }}
              >
                {loading ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : (
                  <>
                    <Text style={styles.answersCtaText}>
                      {answers.length > 0
                        ? t('sheet.answersCtaSingle', { n: answers.length })
                        : t('sheet.answersCtaEmpty')}
                    </Text>
                    <View style={styles.answersCtaChevron} />
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Vote summary — shown after voting, replaces the old chip list */}
            {question.type === 'vote' && answered && totalVotes > 0 && (
              <View style={styles.voteSummary}>
                {/* Segmented split bar */}
                <View style={styles.splitBarWrap}>
                  <View style={[
                    styles.splitBarYes,
                    { flex: yesVotes || 1, backgroundColor: palette.success },
                  ]} />
                  <View style={[
                    styles.splitBarNo,
                    { flex: noVotes  || 1, backgroundColor: palette.error },
                  ]} />
                </View>

                {/* Stat row */}
                <View style={styles.splitStats}>
                  <View style={styles.splitStatItem}>
                    <Text style={[styles.splitStatNum, { color: palette.success }]}>
                      {yesVotes}
                    </Text>
                    <Text style={styles.splitStatLabel}>{t('sheet.voteYes')}</Text>
                  </View>

                  <View style={styles.splitTotalWrap}>
                    <Text style={styles.splitTotal}>{totalVotes}</Text>
                    <Text style={styles.splitTotalLabel}>{t('sheet.voteTotal', { n: '' }).trim()}</Text>
                  </View>

                  <View style={[styles.splitStatItem, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.splitStatNum, { color: palette.error }]}>
                      {noVotes}
                    </Text>
                    <Text style={styles.splitStatLabel}>{t('sheet.voteNo')}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Report */}
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => reportQuestion(question.id, profileId, 'user_report').catch(() => {})}
            >
              <Text style={styles.reportText}>{t('sheet.report')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cardWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none' as any,
  },
  card: {
    width: '90%',
    maxHeight: SCREEN_HEIGHT * 0.75,
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

  closeBtn: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: palette.ink70,
    borderRadius: 14,
  },
  closeX1: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: palette.ink20,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  closeX2: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: palette.ink20,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingRight: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  typeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
  },
  timeText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
  },

  questionBody: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    color: palette.ink00,
    lineHeight: 32,
    marginBottom: spacing.base,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.base,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  statNum: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.ink00,
  },
  statLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.ink60,
    marginBottom: spacing.lg,
  },

  section: { marginBottom: spacing.lg },

  voteButtons: { flexDirection: 'row', gap: spacing.sm },
  voteBtn: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  voteBtnYes: { backgroundColor: palette.success + '15', borderColor: palette.success + '60' },
  voteBtnNo:  { backgroundColor: palette.error   + '15', borderColor: palette.error   + '60' },
  voteBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },

  choiceRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ink60,
    backgroundColor: palette.ink70,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  choiceBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    borderRadius: radius.md,
  },
  choiceDot: {
    width: 16, height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceDotFill: {
    width: 7, height: 7,
    borderRadius: 3.5,
  },
  choiceLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
    flex: 1,
  },
  choicePct: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.ink40,
  },
  leadBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  leadText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  choiceTotalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  openInput: {
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ink60,
    padding: spacing.base,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
    minHeight: 80,
    marginBottom: spacing.sm,
  },
  submitBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.white,
  },

  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.success + '18',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  confirmDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.success },
  confirmText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.success,
  },

  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.ink20,
    letterSpacing: 0.3,
  },
  emptyNote: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // ── Vote summary (replaces chips) ──────────────────────────────────────────
  voteSummary: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  splitBarWrap: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
  },
  splitBarYes: {
    borderRadius: radius.full,
    opacity: 0.85,
  },
  splitBarNo: {
    borderRadius: radius.full,
    opacity: 0.85,
  },
  splitStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 2,
  },
  splitStatItem: {
    alignItems: 'flex-start',
    gap: 1,
    minWidth: 48,
  },
  splitStatNum: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.1,
  },
  splitStatLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    letterSpacing: 0.3,
  },
  splitTotalWrap: {
    alignItems: 'center',
    gap: 1,
  },
  splitTotal: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: palette.ink00,
    lineHeight: fontSize.xl * 1.1,
  },
  splitTotalLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    letterSpacing: 0.4,
  },

  answersCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.accent + '55',
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    marginBottom: spacing.base,
  },
  answersCtaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.accent,
  },
  answersCtaChevron: {
    width: 8, height: 8,
    borderTopWidth: 2, borderRightWidth: 2,
    borderColor: palette.accent,
    transform: [{ rotate: '45deg' }],
    marginRight: 2,
  },

  reportBtn: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
  reportText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.ink60, textDecorationLine: 'underline' },
});

const voteStyles = StyleSheet.create({
  row:      { marginBottom: spacing.sm, gap: 6 },
  barBg:    { height: 10, backgroundColor: palette.ink70, borderRadius: radius.full, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: radius.full },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:    { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: palette.ink00 },
  pct:      { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm },
  count:    { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.ink40 },
});
