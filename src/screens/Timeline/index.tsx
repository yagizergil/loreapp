import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../../lib/ProfileContext';
import {
  Question,
  QuestionType,
  fetchMyQuestions,
  fetchMyAnsweredQuestions,
} from '../../lib/supabase';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { SkeletonList } from '../../components/ui/SkeletonRow';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = 'mine' | 'answered';

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

// ─── Card ─────────────────────────────────────────────────────────────────────

function TimelineCard({
  question,
  onPress,
}: {
  question: Question;
  onPress: () => void;
}) {
  const color = TYPE_COLOR[question.type] ?? palette.accent;
  // Memoized: TYPE_LABEL() ran 3 i18n.t() lookups on every render of every
  // visible row — cheap individually but pure waste at list scale since the
  // labels only change if the user switches language mid-session.
  const typeLabels = useMemo(() => TYPE_LABEL(), [i18n.language]);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      style={card.root}
    >
      {/* Top accent line — full card width, type color */}
      <View style={[card.accentLine, { backgroundColor: color }]} />

      <View style={card.inner}>
        {/* Row 1: badge + time */}
        <View style={card.metaRow}>
          <View style={[card.badge, { backgroundColor: color + '1A' }]}>
            <View style={[card.badgeDot, { backgroundColor: color }]} />
            <Text style={[card.badgeText, { color }]}>{typeLabels[question.type]}</Text>
          </View>
          <Text style={card.time}>{timeAgo(question.created_at)}</Text>
        </View>

        {/* Row 2: question body — editorial, prominent */}
        <Text style={card.body} numberOfLines={4}>{question.body}</Text>

        {/* Row 3: stats + CTA */}
        <View style={card.footer}>
          <View style={card.statRow}>
            {/* Mini chat icon */}
            <View style={card.chatIcon}>
              <View style={card.chatBubble} />
              <View style={card.chatTail} />
            </View>
            <Text style={card.statText}>
              {question.answer_count === 0
                ? i18n.t('answers.emptyTitle')
                : i18n.t('timeline.answers', { n: question.answer_count })}
            </Text>
          </View>
          <View style={[card.ctaBtn, { borderColor: color + '55' }]}>
            <Text style={[card.ctaText, { color }]}>{i18n.t('timeline.openBtn')}</Text>
            <View style={card.ctaArrow}>
              <View style={[card.arrowLine, { backgroundColor: color }]} />
              <View style={[card.arrowHead, { borderLeftColor: color }]} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <View style={empty.root}>
      <View style={empty.sealWrap}>
        <View style={empty.sealOuter}>
          <View style={empty.sealInner}>
            <Text style={empty.sealL}>L</Text>
          </View>
        </View>
      </View>
      <Text style={empty.title}>{i18n.t('timeline.emptyTitle')}</Text>
      <Text style={empty.body}>{i18n.t('timeline.emptyBody')}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const insets    = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const profile   = useProfile();
  const { t } = useTranslation();

  const [tab, setTab]           = useState<Tab>('mine');
  const [mine, setMine]         = useState<Question[] | null>(null);
  const [answered, setAnswered] = useState<Question[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Underline indicator animation
  const indicatorX   = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  function switchTab(t: Tab) {
    setTab(t);
    Animated.spring(indicatorX, {
      toValue: t === 'mine' ? 0 : tabWidth,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
    }).start();
  }

  function onTabLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    setTabWidth(w);
  }

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([
        fetchMyQuestions(profile.id),
        fetchMyAnsweredQuestions(profile.id),
      ]);
      setMine(m);
      setAnswered(a);
    } catch {
      setMine((p) => p ?? []);
      setAnswered((p) => p ?? []);
    }
  }, [profile.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const data    = tab === 'mine' ? mine : answered;
  const loading = data === null;

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.title}>{t('timeline.title')}</Text>
          <Text style={styles.subtitle}>{t('timeline.subtitle')}</Text>
        </View>
        {/* Accent dot — brand mark */}
        <View style={styles.brandDot} />
      </View>

      {/* ── Underline tabs ── */}
      <View style={styles.tabRow} onLayout={onTabLayout}>
        {/* Active indicator — animates */}
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabWidth / 2, transform: [{ translateX: indicatorX }] },
          ]}
        />
        <TouchableOpacity
          style={styles.tabBtn}
          activeOpacity={0.7}
          onPress={() => switchTab('mine')}
        >
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            {t('profile.rows.myQuestions')}
          </Text>
          {mine != null && mine.length > 0 && (
            <View style={[styles.countChip, tab === 'mine' && styles.countChipActive]}>
              <Text style={[styles.countText, tab === 'mine' && styles.countTextActive]}>
                {mine.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabBtn}
          activeOpacity={0.7}
          onPress={() => switchTab('answered')}
        >
          <Text style={[styles.tabText, tab === 'answered' && styles.tabTextActive]}>
            {t('timeline.answered')}
          </Text>
          {answered != null && answered.length > 0 && (
            <View style={[styles.countChip, tab === 'answered' && styles.countChipActive]}>
              <Text style={[styles.countText, tab === 'answered' && styles.countTextActive]}>
                {answered.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <SkeletonList count={5} withAvatar={false} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(q) => q.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.ink40}
            />
          }
          renderItem={({ item }) => (
            <TimelineCard
              question={item}
              onPress={() =>
                navigation.navigate('Answers', {
                  question: item,
                  profileId: profile.id,
                })
              }
            />
          )}
          ListEmptyComponent={<EmptyState tab={tab} />}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.ink90,
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom:  spacing.base,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize:   34,
    color:      palette.ink00,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize:   fontSize.sm,
    color:      palette.ink40,
    marginTop:  2,
  },
  brandDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    backgroundColor: palette.accent,
    marginBottom: 6,
  },

  // Tabs
  tabRow: {
    flexDirection:   'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.ink60,
    marginBottom: spacing.base,
    position: 'relative',
  },
  tabBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            7,
    paddingVertical: 13,
  },
  tabText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize:   fontSize.sm,
    color:      palette.ink40,
    letterSpacing: 0.1,
  },
  tabTextActive: {
    color: palette.ink00,
  },
  tabIndicator: {
    position: 'absolute',
    bottom:   -1,
    height:   2,
    backgroundColor: palette.accent,
    borderRadius: 1,
    left: 0,
  },
  countChip: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      radius.full,
    backgroundColor:   palette.ink70,
  },
  countChipActive: {
    backgroundColor: palette.accentDim,
  },
  countText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize:   11,
    color:      palette.ink40,
  },
  countTextActive: {
    color: palette.accent,
  },

  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
  },
});

// Card styles
const card = StyleSheet.create({
  root: {
    backgroundColor: palette.ink80,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     palette.ink60,
    marginBottom:    spacing.md,
    overflow:        'hidden',
    ...shadow.sm,
  },
  accentLine: {
    height: 3,
    width:  '100%',
    opacity: 0.9,
  },
  inner: {
    padding: 18,
    gap:     14,
  },

  // Badge + time row
  metaRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:   radius.full,
  },
  badgeDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize:   11,
    letterSpacing: 0.3,
  },
  time: {
    fontFamily: fontFamily.body,
    fontSize:   fontSize.xs,
    color:      palette.ink40,
  },

  // Question body — editorial
  body: {
    fontFamily: fontFamily.display,
    fontSize:   20,
    color:      palette.ink00,
    lineHeight: 28,
  },

  // Footer
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.ink60,
    paddingTop:     12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  chatIcon: {
    width: 16, height: 14,
  },
  chatBubble: {
    width: 14, height: 11,
    borderRadius: 4,
    borderWidth:  1.5,
    borderColor:  palette.ink40,
    position:     'absolute',
    top: 0, left: 0,
  },
  chatTail: {
    width:  5, height: 5,
    borderBottomRightRadius: 4,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderColor: palette.ink40,
    position:    'absolute',
    bottom: 0, left: 3,
  },
  statText: {
    fontFamily: fontFamily.body,
    fontSize:   fontSize.xs,
    color:      palette.ink20,
  },

  ctaBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    paddingHorizontal: 14,
    paddingVertical:    7,
    borderRadius:   radius.full,
    borderWidth:    1,
  },
  ctaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize:   fontSize.xs,
    letterSpacing: 0.2,
  },
  ctaArrow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  arrowLine: {
    width: 10, height: 1.5,
    borderRadius: 1,
  },
  arrowHead: {
    width: 0, height: 0,
    borderTopWidth:    4,
    borderBottomWidth: 4,
    borderLeftWidth:   5,
    borderTopColor:    'transparent',
    borderBottomColor: 'transparent',
    marginLeft: -1,
  },
});

// Empty state styles
const empty = StyleSheet.create({
  root: {
    alignItems: 'center',
    marginTop:  spacing.xxl + 12,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  sealWrap: {
    marginBottom: spacing.sm,
  },
  sealOuter: {
    width:           64,
    height:          64,
    borderRadius:    32,
    borderWidth:     2,
    borderColor:     palette.ink60,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sealInner: {
    width:           44,
    height:          44,
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     palette.ink60,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sealL: {
    fontFamily: fontFamily.display,
    fontSize:   22,
    color:      palette.ink60,
  },
  title: {
    fontFamily: fontFamily.displayMedium,
    fontSize:   fontSize.md,
    color:      palette.ink10,
    textAlign:  'center',
  },
  body: {
    fontFamily:  fontFamily.body,
    fontSize:    fontSize.sm,
    color:       palette.ink40,
    textAlign:   'center',
    lineHeight:  fontSize.sm * 1.6,
  },
});
