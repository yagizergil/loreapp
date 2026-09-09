import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { boostQuestion, fetchBoostWeeklyRemaining } from '../lib/supabase';
import { palette, fontFamily, fontSize, spacing, radius } from '../theme/tokens';
import { track } from '../lib/analytics';
import { paywallEvents } from '../lib/premiumEvents';
import { useTranslation } from 'react-i18next';

interface Props {
  questionId: string;
  profileId: string;
  isPremium: boolean;
  isBoosted: boolean;
}

const BOOST_DURATION_HOURS = 3;
const BOOST_WEEKLY_LIMIT = 3;

/**
 * Author-only. Free users see a locked teaser that opens the paywall;
 * premium users get a limited weekly action (Jodel JodelPLUS's "3x weekly
 * boost" model) that's included in the subscription — never a separate
 * purchase (explicitly out of scope for now per product direction).
 */
export default function BoostRow({ questionId, profileId, isPremium, isBoosted }: Props) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [boosted, setBoosted] = useState(isBoosted);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPremium) return;
    fetchBoostWeeklyRemaining(profileId, BOOST_WEEKLY_LIMIT).then(setRemaining).catch(() => {});
  }, [profileId, isPremium]);

  if (boosted) {
    return (
      <View style={styles.boostedPill}>
        <View style={styles.boostedDot} />
        <Text style={styles.boostedText}>{t('boost.activeBadge', { hours: BOOST_DURATION_HOURS })}</Text>
      </View>
    );
  }

  if (!isPremium) {
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => { track('boost_unlock_tapped'); paywallEvents.show('boost'); }}
      >
        <Text style={styles.lockedText}>{t('boost.unlockCta')}</Text>
      </TouchableOpacity>
    );
  }

  async function handleBoost() {
    if (busy || remaining === 0) return;
    setBusy(true);
    try {
      const res = await boostQuestion(questionId, profileId, isPremium, BOOST_DURATION_HOURS, BOOST_WEEKLY_LIMIT);
      if (res.ok) {
        track('question_boosted');
        setBoosted(true);
        setRemaining(res.remaining);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleBoost} disabled={busy || remaining === 0}>
      {busy ? (
        <ActivityIndicator color={palette.accent} size="small" />
      ) : (
        <Text style={[styles.boostText, remaining === 0 && styles.boostTextDisabled]}>
          {remaining === 0
            ? t('boost.noneLeft')
            : t('boost.cta', { remaining: remaining ?? BOOST_WEEKLY_LIMIT, limit: BOOST_WEEKLY_LIMIT })}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.xs },
  lockedText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.accent },
  boostText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.accent },
  boostTextDisabled: { color: palette.ink40 },
  boostedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: palette.success + '22',
    borderColor: palette.success + '55',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginVertical: spacing.xs,
  },
  boostedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success },
  boostedText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: palette.success },
});
