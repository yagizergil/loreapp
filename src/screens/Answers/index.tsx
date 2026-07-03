import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Question, QuestionType, Answer, Profile,
  fetchAnswers, submitAnswer, fetchProfiles, countTodayAnswers, FREE_DAILY_ANSWER_LIMIT,
  fetchBlockedIds, toggleAnswerUpvote, fetchUpvotedAnswerIds, deleteOwnAnswer,
} from '../../lib/supabase';
import { paywallEvents } from '../../lib/premiumEvents';
import { track } from '../../lib/analytics';
import { usePremium } from '../../lib/PremiumContext';
import { supabase } from '../../lib/supabase';
import { moderationMenu, reportAnswerFlow } from '../../lib/moderation';
import { containsObjectionableContent } from '../../lib/contentFilter';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import AvatarView from '../../components/ui/Avatar';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnswersRouteParams = {
  Answers: { question: Question; profileId: string };
};

type SortMode = 'popular' | 'newest';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<QuestionType, string> = {
  vote:   palette.accent,
  choice: '#4A7FC0',
  open:   '#4A9E6E',
};
const TYPE_LABEL = (): Record<QuestionType, string> => ({
  vote:   i18n.t('questionType.vote'),
  choice: i18n.t('questionType.choice'),
  open:   i18n.t('questionType.open'),
});

// Yes/No vote questions store canonical 'Evet'/'Hayır' labels in the DB; show
// them localized. Other (choice) labels are user content and shown as-is.
function displayChoiceLabel(label: string): string {
  if (label === 'Evet')  return i18n.t('sheet.voteYes');
  if (label === 'Hayır') return i18n.t('sheet.voteNo');
  return label;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return i18n.t('common.now');
  if (m < 60) return i18n.t('common.ago.minutes', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t('common.ago.hours', { n: h });
  return i18n.t('common.ago.days', { n: Math.floor(h / 24) });
}

// ─── Poll bar (vote / choice) ─────────────────────────────────────────────────

interface PollOption { label: string; count: number }

function PollBar({
  option, total, isSelected, isWinner, color, revealed,
}: {
  option: PollOption; total: number; isSelected: boolean;
  isWinner: boolean; color: string; revealed: boolean;
}) {
  const pct      = total > 0 ? Math.round((option.count / total) * 100) : 0;
  const barW     = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: `${barW.value}%` as any }));
  useEffect(() => { if (revealed) barW.value = withTiming(pct, { duration: 600 }); }, [revealed, pct]);

  return (
    <View style={[pb.row, isSelected && { borderColor: color + '88', borderWidth: 1.5 }]}>
      <Animated.View style={[pb.fill, barStyle, { backgroundColor: isSelected ? color + '28' : palette.ink70 }]} />
      <View style={pb.content}>
        <View style={pb.left}>
          <View style={[pb.dot, { borderColor: isSelected ? color : palette.ink40 }]}>
            {isSelected && <View style={[pb.dotInner, { backgroundColor: color }]} />}
          </View>
          <Text style={[pb.label, isSelected && { color: palette.ink00, fontFamily: fontFamily.bodySemiBold }]}>
            {displayChoiceLabel(option.label)}
          </Text>
          {isWinner && revealed && (
            <View style={[pb.winnerBadge, { backgroundColor: color + '22' }]}>
              <Text style={[pb.winnerText, { color }]}>{i18n.t('answers.leading')}</Text>
            </View>
          )}
        </View>
        <Text style={[pb.pct, revealed && { color: isSelected ? color : palette.ink20 }]}>
          {revealed ? `${pct}%` : ''}
        </Text>
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  row: {
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: palette.ink60,
    backgroundColor: palette.ink80, marginBottom: spacing.sm, height: 52,
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.md },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: '100%' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: palette.ink10, flex: 1 },
  winnerBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
  winnerText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, letterSpacing: 0.3 },
  pct: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.ink40, minWidth: 38, textAlign: 'right' },
});

function PollResults({
  question, answers, myChoice, color,
}: { question: Question; answers: Answer[]; myChoice: string | null; color: string }) {
  const options: PollOption[] = question.options ?? [];
  const revealed = myChoice !== null;
  const liveCounts: Record<string, number> = {};
  answers.forEach((a) => { if (a.choice) liveCounts[a.choice] = (liveCounts[a.choice] ?? 0) + 1; });
  const totalVotes = Object.values(liveCounts).reduce((s, c) => s + c, 0);
  const merged = options.map((o) => ({ label: o.label, count: liveCounts[o.label] ?? o.count }));
  const maxCount = Math.max(...merged.map((o) => o.count), 0);
  return (
    <View style={poll.wrap}>
      {merged.map((opt) => (
        <PollBar
          key={opt.label} option={opt} total={totalVotes}
          isSelected={myChoice === opt.label}
          isWinner={opt.count === maxCount && maxCount > 0}
          color={color} revealed={revealed}
        />
      ))}
      {revealed && <Text style={poll.total}>{i18n.t('sheet.votesCollected', { n: totalVotes })}</Text>}
    </View>
  );
}

const poll = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.base },
  total: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.ink40, textAlign: 'center', marginTop: spacing.xs },
});

// ─── Option picker (vote/choice) ──────────────────────────────────────────────

function OptionPicker({ question, color, submitting, onSubmit }: {
  question: Question; color: string; submitting: boolean; onSubmit: (c: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const options: PollOption[] = question.options ?? [];
  return (
    <View style={op.wrap}>
      <Text style={op.prompt}>{i18n.t('answers.castVote')}</Text>
      <View style={op.options}>
        {options.map((opt) => {
          const active = selected === opt.label;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[op.option, active && { borderColor: color, backgroundColor: color + '18' }]}
              activeOpacity={0.8}
              onPress={() => setSelected(opt.label)}
            >
              <View style={[op.radio, { borderColor: active ? color : palette.ink40 }]}>
                {active && <View style={[op.radioFill, { backgroundColor: color }]} />}
              </View>
              <Text style={[op.optLabel, active && { color: palette.ink00 }]}>{displayChoiceLabel(opt.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[op.btn, { backgroundColor: color }, (!selected || submitting) && op.btnDisabled]}
        disabled={!selected || submitting}
        activeOpacity={0.85}
        onPress={() => selected && onSubmit(selected)}
      >
        {submitting
          ? <ActivityIndicator color={palette.white} size="small" />
          : <Text style={op.btnText}>{i18n.t('answers.vote')}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const op = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: 14, gap: spacing.sm },
  prompt: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: palette.ink40, letterSpacing: 0.6, textTransform: 'uppercase' },
  options: { gap: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: palette.ink60, backgroundColor: palette.ink80 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 8, height: 8, borderRadius: 4 },
  optLabel: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: palette.ink20, flex: 1 },
  btn: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, ...shadow.sm },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.white, letterSpacing: 0.2 },
});

// ─── Answer card (open type) ──────────────────────────────────────────────────

function AnswerCard({
  answer, author, isOwn, upvoted, onUpvote, onMessage, onModerate, onDelete,
}: {
  answer:    Answer;
  author?:   Profile;
  isOwn:     boolean;
  upvoted:   boolean;
  onUpvote:  () => void;
  onMessage?: () => void;
  onModerate?: () => void;
  onDelete?: () => void;
}) {
  const scale     = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handleUpvote() {
    scale.value = withSequence(
      withSpring(0.82, { damping: 8 }),
      withSpring(1.12, { damping: 8 }),
      withSpring(1,    { damping: 10 }),
    );
    onUpvote();
  }

  return (
    <View style={[ac.root, isOwn && ac.rootOwn]}>
      {/* Own-answer accent line */}
      {isOwn && <View style={ac.ownLine} />}

      <View style={ac.top}>
        <AvatarView
          avatarKey={author?.avatar ?? 'fox'}
          avatarUrl={author?.avatar_url}
          gender={author?.gender}
          size={34}
          ring={false}
        />
        <View style={ac.meta}>
          <View style={ac.nameRow}>
            <Text style={ac.name} numberOfLines={1}>{author?.nickname ?? i18n.t('answers.anonymous')}</Text>
            {isOwn && (
              <View style={ac.ownBadge}>
                <Text style={ac.ownBadgeText}>{i18n.t('answers.mine')}</Text>
              </View>
            )}
          </View>
          <Text style={ac.time}>{timeAgo(answer.created_at)}</Text>
        </View>
        {!isOwn && onModerate && (
          <TouchableOpacity onPress={onModerate} hitSlop={12} style={ac.moreBtn}>
            <Text style={ac.moreIcon}>⋯</Text>
          </TouchableOpacity>
        )}
        {isOwn && onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={12} style={ac.moreBtn}>
            <Text style={ac.moreIcon}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={ac.body}>{answer.body}</Text>

      <View style={ac.footer}>
        {/* Upvote */}
        <TouchableOpacity
          onPress={handleUpvote}
          activeOpacity={0.75}
          style={[ac.upBtn, upvoted && ac.upBtnActive]}
        >
          <Animated.View style={[ac.upInner, animStyle]}>
            {/* Heart icon via SVG-like box */}
            <Text style={[ac.upIcon, upvoted && { color: palette.accent }]}>
              {upvoted ? '♥' : '♡'}
            </Text>
            <Text style={[ac.upCount, upvoted && { color: palette.accent }]}>
              {answer.upvotes > 0 ? answer.upvotes : i18n.t('answers.like')}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Message */}
        {!isOwn && onMessage && (
          <TouchableOpacity style={ac.msgBtn} activeOpacity={0.7} onPress={onMessage}>
            <Text style={ac.msgIcon}>✦</Text>
            <Text style={ac.msgText}>{i18n.t('answers.message')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const ac = StyleSheet.create({
  root: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: palette.ink80,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.ink70,
    padding: spacing.base,
    overflow: 'hidden',
    ...shadow.sm,
  },
  rootOwn: {
    borderColor: palette.accent + '44',
    backgroundColor: palette.ink80,
  },
  ownLine: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: palette.accent,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  moreBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  moreIcon: { color: palette.ink40, fontSize: 20, lineHeight: 20, fontFamily: fontFamily.body },
  meta: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.ink00, flexShrink: 1 },
  time: { fontFamily: fontFamily.body, fontSize: 11, color: palette.ink40 },
  ownBadge: {
    backgroundColor: palette.accent + '20',
    borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  ownBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: palette.accent },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink10,
    lineHeight: fontSize.base * 1.6,
    marginBottom: 12,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  upBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: palette.ink70,
    borderWidth: 1, borderColor: palette.ink60,
  },
  upBtnActive: {
    backgroundColor: palette.accent + '15',
    borderColor: palette.accent + '44',
  },
  upInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  upIcon: { fontSize: 13, color: palette.ink40, lineHeight: 16 },
  upCount: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: palette.ink20 },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: palette.ink70,
    borderWidth: 1, borderColor: palette.ink60,
  },
  msgIcon: { fontSize: 10, color: palette.ink40 },
  msgText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, color: palette.ink20 },
});

// ─── Sort tabs ────────────────────────────────────────────────────────────────

function SortTabs({ mode, onChange }: { mode: SortMode; onChange: (m: SortMode) => void }) {
  return (
    <View style={st.row}>
      {([
        { key: 'popular', label: i18n.t('answers.sortPopular') },
        { key: 'newest',  label: i18n.t('answers.sortNew') },
      ] as { key: SortMode; label: string }[]).map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[st.tab, mode === key && st.tabActive]}
          activeOpacity={0.75}
          onPress={() => onChange(key)}
        >
          <Text style={[st.label, mode === key && st.labelActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: palette.ink80,
    borderWidth: 1,
    borderColor: palette.ink70,
  },
  tabActive: {
    backgroundColor: palette.ink60,
    borderColor: palette.ink40,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: palette.ink40,
    letterSpacing: 0.2,
  },
  labelActive: { color: palette.ink00 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AnswersScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<AnswersRouteParams, 'Answers'>>();
  const { question, profileId } = route.params;
  const insets     = useSafeAreaInsets();
  const { t } = useTranslation();

  const isVotable  = question.type === 'vote' || question.type === 'choice';
  const typeColor  = TYPE_COLOR[question.type] ?? palette.accent;

  const [answers, setAnswers]       = useState<Answer[]>([]);
  const [authorsMap, setAuthorsMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading]       = useState(true);
  const [text, setText]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered]     = useState(false);
  const [myChoice, setMyChoice]     = useState<string | null>(null);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode]     = useState<SortMode>('popular');
  const { isPremium } = usePremium();

  const upvotedRef  = useRef<Set<string>>(new Set());

  const inputBorder = useSharedValue(0);
  const inputStyle  = useAnimatedStyle(() => ({
    borderColor: inputBorder.value === 1 ? typeColor : palette.ink60,
  }));

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ansRaw, upvotedIdList, blocked] = await Promise.all([
          fetchAnswers(question.id),
          fetchUpvotedAnswerIds(profileId, question.id),
          fetchBlockedIds(profileId),
        ]);
        if (cancelled) return;
        const blockedSet = new Set(blocked);
        const ans = ansRaw.filter((a) => !blockedSet.has(a.author_id));
        setAnswers(ans);

        const restoredSet = new Set<string>(upvotedIdList);
        upvotedRef.current = restoredSet;
        setUpvotedIds(restoredSet);

        const mine = ans.find((a) => a.author_id === profileId);
        if (mine) {
          setAnswered(true);
          if (mine.choice) setMyChoice(mine.choice);
        }

        const authorIds = [...new Set(ans.map((a) => a.author_id))];
        if (authorIds.length) {
          const profiles = await fetchProfiles(authorIds);
          if (!cancelled) setAuthorsMap(Object.fromEntries(profiles.map((p) => [p.id, p])));
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [question.id]);

  // ── Realtime: new answers arrive live ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`answers:${question.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `question_id=eq.${question.id}` },
        async (payload) => {
          const newAns = payload.new as Answer;
          setAnswers((prev) => {
            if (prev.some((a) => a.id === newAns.id)) return prev;
            return [...prev, newAns];
          });
          // Fetch author profile if unknown
          setAuthorsMap((prev) => {
            if (prev[newAns.author_id]) return prev;
            fetchProfiles([newAns.author_id])
              .then((profiles) => {
                if (profiles.length) {
                  setAuthorsMap((p2) => ({ ...p2, [profiles[0].id]: profiles[0] }));
                }
              })
              .catch(() => {});
            return prev;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [question.id]);

  // ── Sorted list ───────────────────────────────────────────────────────────
  //
  // Rules:
  //   1. User's own answer is always pinned at the top with a visual badge.
  //   2. Remaining answers sorted by: Popüler → upvotes DESC, then newest;
  //                                   Yeni    → created_at DESC.
  //
  const sortedAnswers = useMemo(() => {
    const own   = answers.filter((a) => a.author_id === profileId);
    const other = answers.filter((a) => a.author_id !== profileId);

    const sorted = [...other].sort((a, b) => {
      if (sortMode === 'popular') {
        if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return [...own, ...sorted];
  }, [answers, profileId, sortMode]);

  // ── Submit vote ───────────────────────────────────────────────────────────
  async function handleVote(choice: string) {
    if (submitting || answered) return;
    if (!isPremium) {
      const todayCount = await countTodayAnswers(profileId);
      if (todayCount >= FREE_DAILY_ANSWER_LIMIT) { track('answer_blocked_limit', { type: question.type }); paywallEvents.show('limit'); return; }
    }
    setSubmitting(true);
    try {
      const newAnswer = await submitAnswer(question.id, profileId, { choice });
      setAnswers((prev) => prev.some((a) => a.id === newAnswer.id) ? prev : [...prev, newAnswer]);
      setMyChoice(choice);
      setAnswered(true);
      track('answer_submitted', { type: question.type });
    } catch {}
    finally { setSubmitting(false); }
  }

  // ── Submit open answer ────────────────────────────────────────────────────
  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || submitting || answered) return;
    // Objectionable-content filter (Guideline 1.2): block before posting.
    if (containsObjectionableContent(trimmed)) {
      Alert.alert(t('filter.blockedTitle'), t('filter.blockedBody'));
      return;
    }
    if (!isPremium) {
      const todayCount = await countTodayAnswers(profileId);
      if (todayCount >= FREE_DAILY_ANSWER_LIMIT) { track('answer_blocked_limit', { type: question.type }); paywallEvents.show('limit'); return; }
    }
    setSubmitting(true);
    try {
      const newAnswer = await submitAnswer(question.id, profileId, { body: trimmed });
      setAnswers((prev) => prev.some((a) => a.id === newAnswer.id) ? prev : [...prev, newAnswer]);
      setText('');
      setAnswered(true);
      track('answer_submitted', { type: question.type });
    } catch (e: any) {
      if (e?.code === '23505') setAnswered(true); // already answered (duplicate)
    }
    finally { setSubmitting(false); }
  }

  // ── Delete own answer (Guideline 1.2: immediate removal) ─────────────────────
  function handleDeleteAnswer(answerId: string) {
    Alert.alert(
      t('ownPost.deleteAnswerTitle'),
      t('ownPost.deleteAnswerMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('ownPost.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOwnAnswer(answerId, profileId);
              setAnswers((prev) => prev.filter((a) => a.id !== answerId));
            } catch {
              Alert.alert(t('common.error'), t('ownPost.deleteError'));
            }
          },
        },
      ],
    );
  }

  // ── Upvote (server-authoritative toggle) ─────────────────────────────────────
  // Optimistik güncelle, sonra sunucunun döndürdüğü gerçek sayı/duruma sabitle.
  // Aynı cevap için eşzamanlı çift-dokunuşu engellemek için in-flight kilit.
  const inFlightUpvotes = useRef<Set<string>>(new Set());

  async function handleUpvote(answerId: string) {
    if (inFlightUpvotes.current.has(answerId)) return;
    inFlightUpvotes.current.add(answerId);

    const wasUpvoted = upvotedRef.current.has(answerId);
    const nextSet = new Set(upvotedRef.current);
    if (wasUpvoted) nextSet.delete(answerId); else nextSet.add(answerId);
    upvotedRef.current = nextSet;
    setUpvotedIds(new Set(nextSet));
    setAnswers((prev) => prev.map((a) =>
      a.id === answerId ? { ...a, upvotes: Math.max(0, a.upvotes + (wasUpvoted ? -1 : 1)) } : a));

    try {
      const { upvoted, upvotes } = await toggleAnswerUpvote(answerId, profileId);
      // Sunucu otoritedir: gerçek duruma sabitle.
      const synced = new Set(upvotedRef.current);
      if (upvoted) synced.add(answerId); else synced.delete(answerId);
      upvotedRef.current = synced;
      setUpvotedIds(new Set(synced));
      setAnswers((prev) => prev.map((a) =>
        a.id === answerId ? { ...a, upvotes } : a));
    } catch {
      // Ağ hatası: optimistik değişikliği geri al.
      const rollback = new Set(upvotedRef.current);
      if (wasUpvoted) rollback.add(answerId); else rollback.delete(answerId);
      upvotedRef.current = rollback;
      setUpvotedIds(new Set(rollback));
      setAnswers((prev) => prev.map((a) =>
        a.id === answerId ? { ...a, upvotes: Math.max(0, a.upvotes + (wasUpvoted ? 1 : -1)) } : a));
    } finally {
      inFlightUpvotes.current.delete(answerId);
    }
  }

  function handleMessage(author: Profile) {
    navigation.navigate('Chat', {
      otherUserId: author.id, otherNickname: author.nickname,
      otherAvatar: author.avatar, otherGender: author.gender,
    });
  }

  // ── List header ───────────────────────────────────────────────────────────
  const ListHeader = (
    <>
      {/* Question hero */}
      <View style={s.hero}>
        <View style={[s.heroAccent, { backgroundColor: typeColor }]} />
        <View style={s.heroInner}>
          <View style={s.heroBadgeRow}>
            <View style={[s.heroBadge, { backgroundColor: typeColor + '22' }]}>
              <View style={[s.heroBadgeDot, { backgroundColor: typeColor }]} />
              <Text style={[s.heroBadgeText, { color: typeColor }]}>{TYPE_LABEL()[question.type]}</Text>
            </View>
            <Text style={s.heroMeta}>
              {isVotable
                ? t('sheet.voteTotal', { n: answers.length })
                : `${answers.length} ${t('sheet.answersLabel')}`}
            </Text>
          </View>
          <Text style={s.heroBody}>{question.body}</Text>
        </View>
      </View>

      {/* Poll results for vote/choice */}
      {isVotable && (
        <PollResults question={question} answers={answers} myChoice={myChoice} color={typeColor} />
      )}

      {/* Sort tabs + section label for open type */}
      {!isVotable && answers.length > 0 && (
        <View style={s.sectionHeader}>
          <View style={s.sectionLabelRow}>
            <Text style={s.sectionLabel}>{t('answers.sectionLabel')}</Text>
            <View style={s.sectionLine} />
            <Text style={s.sectionCount}>{answers.length}</Text>
          </View>
          <SortTabs mode={sortMode} onChange={setSortMode} />
        </View>
      )}
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <View style={s.chevron} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isVotable ? t('answers.votingTitle') : t('answers.title')}</Text>
        <View style={s.backBtn} />
      </View>

      {/* Content */}
      {loading ? (
        <>
          {ListHeader}
          <ActivityIndicator color={palette.ink40} style={{ marginTop: spacing.xl }} />
        </>
      ) : (
        <FlatList
          data={isVotable ? [] : sortedAnswers}
          keyExtractor={(a) => a.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[
            s.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + (answered ? 56 : isVotable ? 180 : 80) },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !isVotable ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>✦</Text>
                <Text style={s.emptyTitle}>{t('answers.emptyTitle')}</Text>
                <Text style={s.emptyBody}>{t('answers.emptyBody')}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const author = authorsMap[item.author_id];
            const isOwn  = item.author_id === profileId;
            return (
              <AnswerCard
                answer={item}
                author={author}
                isOwn={isOwn}
                upvoted={upvotedIds.has(item.id)}
                onUpvote={() => handleUpvote(item.id)}
                onMessage={author && !isOwn ? () => handleMessage(author) : undefined}
                onModerate={!isOwn ? () => moderationMenu({
                  reporterId: profileId,
                  authorId: item.author_id,
                  onReport: () => reportAnswerFlow(item.id, profileId),
                  onBlocked: () => setAnswers((prev) => prev.filter((a) => a.author_id !== item.author_id)),
                }) : undefined}
                onDelete={isOwn ? () => handleDeleteAnswer(item.id) : undefined}
              />
            );
          }}
        />
      )}

      {/* Bottom area */}
      {answered ? (
        <View style={[s.confirmedBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[s.confirmedDot, { backgroundColor: isVotable ? typeColor : palette.success }]} />
          <Text style={[s.confirmedText, isVotable && { color: typeColor }]}>
            {isVotable ? t('answers.voteUsed') : t('answers.answerSaved')}
          </Text>
        </View>
      ) : isVotable ? (
        <View style={[s.pickerWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <OptionPicker question={question} color={typeColor} submitting={submitting} onSubmit={handleVote} />
        </View>
      ) : (
        <Animated.View style={[s.inputWrap, { paddingBottom: Math.max(insets.bottom, 16) }, inputStyle]}>
          <TextInput
            style={s.input}
            placeholder={t('answers.placeholder')}
            placeholderTextColor={palette.ink40}
            value={text}
            onChangeText={setText}
            maxLength={280}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => { inputBorder.value = withTiming(1, { duration: 180 }); }}
            onBlur={() => { inputBorder.value = withTiming(0, { duration: 180 }); }}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: typeColor }, (!text.trim() || submitting) && s.sendDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim() || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={palette.white} size="small" />
              : <View style={s.sendArrow} />
            }
          </TouchableOpacity>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink90 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: palette.ink80,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.ink60,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 9, height: 9,
    borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: palette.ink10,
    transform: [{ rotate: '45deg' }], marginLeft: 4,
  },
  headerTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.ink00 },

  hero: {
    marginHorizontal: spacing.lg, marginTop: spacing.base, marginBottom: spacing.base,
    backgroundColor: palette.ink80, borderRadius: radius.lg,
    borderWidth: 1, borderColor: palette.ink60, overflow: 'hidden', ...shadow.sm,
  },
  heroAccent: { height: 4, width: '100%' },
  heroInner: { padding: 20, gap: 12 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, letterSpacing: 0.3 },
  heroMeta: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.ink40 },
  heroBody: { fontFamily: fontFamily.display, fontSize: 22, color: palette.ink00, lineHeight: 30 },

  sectionHeader: { paddingTop: spacing.xs, marginBottom: spacing.sm },
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm,
  },
  sectionLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: palette.ink40, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.ink60 },
  sectionCount: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: palette.ink40 },

  listContent: { paddingTop: spacing.xs },

  emptyWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl * 2, alignItems: 'center', gap: spacing.sm },
  emptyIcon: { fontSize: 28, color: palette.ink40 },
  emptyTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.ink20 },
  emptyBody: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40, textAlign: 'center', lineHeight: fontSize.sm * 1.7 },

  pickerWrap: { backgroundColor: palette.ink80, borderTopWidth: 1, borderTopColor: palette.ink60 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: 12,
    backgroundColor: palette.ink80,
    borderTopWidth: 1, borderColor: palette.ink60,
  },
  input: {
    flex: 1, backgroundColor: palette.ink70, borderRadius: radius.md,
    paddingHorizontal: spacing.base, paddingVertical: 11,
    fontFamily: fontFamily.body, fontSize: fontSize.base, color: palette.ink00,
    maxHeight: 120, lineHeight: fontSize.base * 1.4,
  },
  sendBtn: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  sendDisabled: { opacity: 0.35 },
  sendArrow: {
    width: 0, height: 0,
    borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: palette.white,
    marginLeft: 2,
  },

  confirmedBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: 14,
    backgroundColor: palette.ink80,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.ink60,
  },
  confirmedDot: { width: 8, height: 8, borderRadius: 4 },
  confirmedText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.success },
});
