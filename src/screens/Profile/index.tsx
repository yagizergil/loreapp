import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch, Linking, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../../lib/ProfileContext';
import { clearLocalProfile } from '../../lib/storage';
import { fetchUserStats, signOut, deleteAccount } from '../../lib/supabase';
import { authEvents } from '../../lib/authEvents';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import Avatar from '../../components/ui/Avatar';
import {
  IconMessages, IconSignOut, IconTrash,
} from '../../components/ui/Icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// ─── Icon-based row item ──────────────────────────────────────────────────────

function SettingRow({
  icon, label, value, onPress, danger, rightNode,
}: {
  icon:       React.ReactNode;
  label:      string;
  value?:     string;
  onPress?:   () => void;
  danger?:    boolean;
  rightNode?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={sr.row}
      activeOpacity={onPress ? 0.65 : 1}
      onPress={onPress}
      disabled={!onPress && !rightNode}
    >
      <View style={[sr.iconBox, danger && sr.iconBoxDanger]}>
        {icon}
      </View>
      <Text style={[sr.label, danger && { color: palette.error }]}>{label}</Text>
      <View style={sr.right}>
        {rightNode ?? (
          <>
            {value ? <Text style={sr.value}>{value}</Text> : null}
            {onPress && !danger && <Text style={sr.chevron}>›</Text>}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const ICON_COLOR       = palette.ink20;
const ICON_DANGER      = palette.error;
const ICON_SIZE        = 16;
const ICON_STROKE      = 1.7;

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    gap: spacing.base,
  },
  iconBox: {
    width: 32, height: 32,
    borderRadius: 8,
    backgroundColor: palette.ink70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxDanger: {
    backgroundColor: palette.error + '18',
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
  },
  chevron: {
    fontFamily: fontFamily.body,
    fontSize: 20,
    color: palette.ink40,
    lineHeight: 22,
  },
});

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}

const sec = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: palette.ink40,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: palette.ink80,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.ink70,
    overflow: 'hidden',
    ...shadow.sm,
  },
});

function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.ink70, marginLeft: 62 }} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const profile    = useProfile();
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();

  const { t, i18n: i18nHook } = useTranslation();
  const [stats, setStats]     = useState<{ questions: number; answers: number } | null>(null);
  const [notifOn, setNotifOn] = useState(true);
  const [busySignOut, setBusySignOut]   = useState(false);
  const [busyDelete, setBusyDelete]     = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const LANGS = [
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ];
  const currentLang = LANGS.find((l) => l.code === i18nHook.language) ?? LANGS[0];

  async function handleChangeLang(code: string) {
    await i18n.changeLanguage(code);
    setShowLangPicker(false);
  }

  useFocusEffect(useCallback(() => {
    fetchUserStats(profile.id)
      .then(setStats)
      .catch(() => setStats({ questions: 0, answers: 0 }));
  }, [profile.id]));

  // ── Sign out ─────────────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      t('profile.signOutTitle'),
      t('profile.signOutMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOutConfirm'),
          style: 'destructive',
          onPress: async () => {
            setBusySignOut(true);
            try {
              await signOut();
              await clearLocalProfile();
              authEvents.onSignOut();
            } catch {
              // Even if signOut fails, clear local state
              await clearLocalProfile().catch(() => {});
              authEvents.onSignOut();
            } finally {
              setBusySignOut(false);
            }
          },
        },
      ]
    );
  }

  // ── Delete account ────────────────────────────────────────────────────────
  function handleDeleteAccount() {
    Alert.alert(
      t('profile.deleteTitle'),
      t('profile.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            setBusyDelete(true);
            try {
              await deleteAccount(profile.id);
              await clearLocalProfile();
              authEvents.onSignOut();
            } catch {
              await clearLocalProfile().catch(() => {});
              authEvents.onSignOut();
            } finally {
              setBusyDelete(false);
            }
          },
        },
      ]
    );
  }

  const genderLabel =
    profile.gender === 'male'   ? t('profile.gender.male') :
    profile.gender === 'female' ? t('profile.gender.female') : t('profile.gender.other');

  return (
    <View style={[s.root, { backgroundColor: palette.ink90 }]}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + spacing.base }]}>
        <Text style={s.headerTitle}>{t('profile.title')}</Text>
        <TouchableOpacity
          style={s.msgBtn}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('Conversations')}
        >
          <IconMessages color={palette.ink20} size={20} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Avatar card ── */}
        <View style={s.avatarCard}>
          <Avatar
            avatarKey={profile.avatar}
            avatarUrl={profile.avatarUrl}
            gender={profile.gender}
            size={68}
            ring
          />
          <View style={s.avatarMeta}>
            <Text style={s.nickname}>{profile.nickname}</Text>
            <View style={s.anonBadge}>
              <View style={[s.anonDot, {
                backgroundColor: profile.isAnonymous === false ? palette.accent : palette.success,
              }]} />
              <Text style={s.anonText}>
                {profile.isAnonymous === false ? t('profile.account') : t('profile.anonymous')} · {genderLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={[s.statsCard, { marginHorizontal: spacing.lg }]}>
          <View style={s.statItem}>
            {stats === null
              ? <ActivityIndicator color={palette.ink40} size="small" />
              : <Text style={s.statValue}>{stats.questions}</Text>}
            <Text style={s.statLabel}>{t('profile.statQuestions')}</Text>
          </View>
          <View style={s.statSep} />
          <View style={s.statItem}>
            {stats === null
              ? <ActivityIndicator color={palette.ink40} size="small" />
              : <Text style={s.statValue}>{stats.answers}</Text>}
            <Text style={s.statLabel}>{t('profile.statAnswers')}</Text>
          </View>
          <View style={s.statSep} />
          <View style={s.statItem}>
            <Text style={s.statValue}>
              {stats === null ? '—' : stats.questions + stats.answers}
            </Text>
            <Text style={s.statLabel}>{t('profile.statTotal')}</Text>
          </View>
        </View>

        {/* ── Aktivite ── */}
        <Section title={t('profile.sections.activity')}>
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>📋</Text>}
            label={t('profile.rows.myQuestions')}
            onPress={() => navigation.navigate('Timeline')}
          />
          <Divider />
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>💬</Text>}
            label={t('profile.rows.myMessages')}
            onPress={() => navigation.navigate('Conversations')}
          />
        </Section>

        {/* ── Tercihler ── */}
        <Section title={t('profile.sections.prefs')}>
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>🔔</Text>}
            label={t('profile.rows.notifications')}
            rightNode={
              <Switch
                value={notifOn}
                onValueChange={setNotifOn}
                trackColor={{ false: palette.ink60, true: palette.accent + 'AA' }}
                thumbColor={notifOn ? palette.accent : palette.ink40}
              />
            }
          />
          <Divider />
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>🌍</Text>}
            label={t('profile.rows.language')}
            value={`${currentLang.flag}  ${currentLang.label}`}
            onPress={() => setShowLangPicker(true)}
          />
        </Section>

        {/* ── Gizlilik & Güvenlik ── */}
        <Section title={t('profile.sections.privacy')}>
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>🔒</Text>}
            label={t('profile.rows.privacy')}
            onPress={() => Linking.openURL('https://lore.app/privacy')}
          />
          <Divider />
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>📄</Text>}
            label={t('profile.rows.terms')}
            onPress={() => Linking.openURL('https://lore.app/terms')}
          />
          <Divider />
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>📍</Text>}
            label={t('profile.rows.location')}
            value={t('profile.rows.locationValue')}
          />
        </Section>

        {/* ── Uygulama ── */}
        <Section title={t('profile.sections.app')}>
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>⭐</Text>}
            label={t('profile.rows.rateApp')}
            onPress={() => Linking.openURL('https://apps.apple.com')}
          />
          <Divider />
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>🐛</Text>}
            label={t('profile.rows.bugReport')}
            onPress={() => Linking.openURL('mailto:hello@lore.app')}
          />
          <Divider />
          <SettingRow
            icon={<Text style={{ fontSize: 15 }}>ℹ️</Text>}
            label={t('profile.rows.version')}
            value="1.0.0"
          />
        </Section>

        {/* ── Hesap ── */}
        <Section title={t('profile.sections.account')}>
          <SettingRow
            icon={
              busySignOut
                ? <ActivityIndicator color={palette.ink40} size="small" />
                : <IconSignOut color={ICON_COLOR} size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            }
            label={t('profile.rows.signOut')}
            onPress={busySignOut ? undefined : handleSignOut}
          />
          <Divider />
          <SettingRow
            icon={
              busyDelete
                ? <ActivityIndicator color={palette.error} size="small" />
                : <IconTrash color={ICON_DANGER} size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            }
            label={t('profile.rows.deleteAccount')}
            onPress={busyDelete ? undefined : handleDeleteAccount}
            danger
          />
        </Section>

      </ScrollView>

      {/* ── Language picker modal ── */}
      <Modal
        visible={showLangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <Pressable style={lp.backdrop} onPress={() => setShowLangPicker(false)} />
        <View style={lp.sheet}>
          <View style={lp.handle} />
          <Text style={lp.title}>{t('profile.rows.language')}</Text>
          {LANGS.map((lang, idx) => {
            const active = lang.code === i18nHook.language;
            return (
              <React.Fragment key={lang.code}>
                {idx > 0 && <View style={lp.sep} />}
                <TouchableOpacity
                  style={[lp.row, active && lp.rowActive]}
                  activeOpacity={0.7}
                  onPress={() => handleChangeLang(lang.code)}
                >
                  <Text style={lp.flag}>{lang.flag}</Text>
                  <Text style={[lp.label, active && lp.labelActive]}>{lang.label}</Text>
                  {active && <View style={lp.check}><Text style={lp.checkText}>✓</Text></View>}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ink70,
  },
  headerTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: palette.ink00,
  },
  msgBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: palette.ink80,
    borderWidth: 1,
    borderColor: palette.ink60,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingTop: spacing.lg,
    gap: 0,
  },

  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: palette.ink80,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.ink70,
    padding: spacing.lg,
    ...shadow.sm,
  },
  avatarMeta: { flex: 1, gap: 6 },
  nickname: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.ink00,
  },
  anonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  anonDot: { width: 7, height: 7, borderRadius: 4 },
  anonText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.ink80,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.ink70,
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadow.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: palette.ink00,
  },
  statLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    letterSpacing: 0.3,
  },
  statSep: {
    width: 1,
    height: 36,
    backgroundColor: palette.ink70,
  },
});

const lp = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.ink80,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: palette.ink60,
    paddingTop: spacing.sm,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    ...shadow.lg,
  },
  handle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: palette.ink60,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: palette.ink40,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.base,
    paddingHorizontal: 2,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.ink70,
    marginLeft: 52,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: spacing.base,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  rowActive: {
    backgroundColor: palette.accentDim,
  },
  flag: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink20,
  },
  labelActive: {
    fontFamily: fontFamily.bodySemiBold,
    color: palette.ink00,
  },
  check: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: palette.white,
  },
});
