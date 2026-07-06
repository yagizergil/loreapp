import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LINKS } from '../../lib/links';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { contentWidth as W, CONTENT_MAX_WIDTH } from '../../theme/responsive';

interface Props {
  /** Called once the user has checked the box and pressed continue. */
  onAgree: () => void;
  /** Lets a user who won't agree leave their account instead of being stuck. */
  onSignOut: () => void;
}

/**
 * Re-consent gate shown to already-onboarded users when the Community Rules /
 * EULA version they last agreed to (src/lib/eula.ts) is out of date — e.g. an
 * existing install from before this screen existed, where `eulaVersion` was
 * never recorded. Guideline 1.2 requires every user to agree, not just new
 * installs, so this mirrors the onboarding EULA screen but runs in front of
 * the main app for returning users.
 */
export default function EulaGateScreen({ onAgree, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg,
          width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>{t('eula.title')}</Text>
        <Text style={s.updatedNote}>{t('eula.reconsentNote')}</Text>
        <Text style={s.intro}>{t('eula.intro')}</Text>

        <View style={s.ruleRow}><Text style={s.bullet}>•</Text><Text style={s.rule}>{t('eula.rule0')}</Text></View>
        <View style={s.ruleRow}><Text style={s.bullet}>•</Text><Text style={s.rule}>{t('eula.rule1')}</Text></View>
        <View style={s.ruleRow}><Text style={s.bullet}>•</Text><Text style={s.rule}>{t('eula.rule2')}</Text></View>
        <View style={s.ruleRow}><Text style={s.bullet}>•</Text><Text style={s.rule}>{t('eula.rule3')}</Text></View>

        <View style={s.linksRow}>
          <TouchableOpacity onPress={() => Linking.openURL(LINKS.terms)} hitSlop={10}>
            <Text style={s.link}>{t('eula.terms')}</Text>
          </TouchableOpacity>
          <Text style={s.linkSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(LINKS.privacy)} hitSlop={10}>
            <Text style={s.link}>{t('eula.privacy')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.checkRow} activeOpacity={0.8} onPress={() => setAgreed((v) => !v)}>
          <View style={[s.checkbox, agreed && s.checkboxOn]}>
            {agreed && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.checkLabel}>{t('eula.agreeCheckbox')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: spacing.sm }}>
        <TouchableOpacity
          style={[s.btnPrimary, !agreed && { opacity: 0.4 }]}
          activeOpacity={0.85}
          disabled={!agreed}
          onPress={onAgree}
        >
          <Text style={s.btnPrimaryText}>{t('eula.agreeButton')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.signOutBtn} activeOpacity={0.7} onPress={onSignOut}>
          <Text style={s.signOutText}>{t('eula.declineSignOut')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink90 },
  title: {
    fontFamily: fontFamily.display, fontSize: 26, color: palette.ink00,
    marginBottom: spacing.sm,
  },
  updatedNote: {
    fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: palette.accent,
    marginBottom: spacing.sm, letterSpacing: 0.3, textTransform: 'uppercase',
  },
  intro: {
    fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink20,
    lineHeight: fontSize.sm * 1.5, marginBottom: spacing.md,
  },
  ruleRow: { flexDirection: 'row', marginBottom: spacing.sm, paddingRight: spacing.sm },
  bullet: { color: palette.accent, fontSize: fontSize.base, marginRight: 8, lineHeight: fontSize.sm * 1.5 },
  rule: {
    flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.sm,
    color: palette.ink10, lineHeight: fontSize.sm * 1.5,
  },
  linksRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm, marginBottom: spacing.lg },
  link: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.accent },
  linkSep: { color: palette.ink40 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: spacing.sm },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
    borderColor: palette.ink60, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  checkmark: { color: palette.white, fontSize: 15, fontFamily: fontFamily.bodySemiBold },
  checkLabel: {
    flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.sm,
    color: palette.ink10, lineHeight: fontSize.sm * 1.5,
  },
  btnPrimary: {
    height: 56, backgroundColor: palette.accent,
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  btnPrimaryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base, color: palette.white, letterSpacing: 0.4,
  },
  signOutBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  signOutText: {
    fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40,
    textDecorationLine: 'underline',
  },
});
