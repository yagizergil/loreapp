import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image, Linking,
} from 'react-native';
import { LINKS } from '../../lib/links';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LocalProfile, Gender, saveLocalProfile } from '../../lib/storage';
import {
  createProfile, signUpWithEmail, signInWithEmail, signInWithAppleToken,
  uploadAvatar, updateProfile, fetchProfileByAuthUserId, getAuthUser,
  linkAuthToProfile,
} from '../../lib/supabase';
import { genderColor } from '../../lib/genderColors';
import { AVATARS } from '../../lib/avatar';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import WaxSeal from '../../components/ui/WaxSeal';
import CityMap from '../../components/ui/CityMap';

const { width: W } = Dimensions.get('window');

// ─── Onboarding slides ────────────────────────────────────────────────────────

const getSlides = () => [
  {
    accent: palette.accent,
    title: i18n.t('onboarding.slides.s1.title'),
    body: i18n.t('onboarding.slides.s1.body'),
    pins: [
      { type: 'vote' as const,     gid: 's0a', size: 46, left: '14%', top: 28, rot: -10 },
      { type: 'open' as const,     gid: 's0b', size: 54, left: '42%', top: 14, rot:   4 },
      { type: 'choice' as const,   gid: 's0c', size: 42, left: '68%', top: 38, rot:  -6 },
      { type: 'answered' as const, gid: 's0d', size: 38, left: '28%', top: 72, rot:   8 },
    ],
  },
  {
    accent: '#D4A916',
    title: i18n.t('onboarding.slides.s2.title'),
    body: i18n.t('onboarding.slides.s2.body'),
    pins: [
      { type: 'answered' as const, gid: 's2a', size: 54, left: '20%', top: 14, rot:  -8 },
      { type: 'vote' as const,     gid: 's2b', size: 44, left: '54%', top: 12, rot:   5 },
      { type: 'answered' as const, gid: 's2c', size: 46, left: '40%', top: 64, rot:   9 },
    ],
  },
  {
    accent: palette.accent,
    title: i18n.t('onboarding.slides.s3.title'),
    body: i18n.t('onboarding.slides.s3.body'),
    pins: [
      { type: 'open' as const,   gid: 's3a', size: 50, left: '18%', top: 18, rot:  -6 },
      { type: 'choice' as const, gid: 's3b', size: 44, left: '56%', top: 12, rot:   7 },
    ],
  },
  {
    accent: '#4A9E6E',
    title: i18n.t('onboarding.slides.s4.title'),
    body: i18n.t('onboarding.slides.s4.body'),
    pins: [
      { type: 'open' as const,     gid: 's4a', size: 52, left: '16%', top: 16, rot:  -8 },
      { type: 'choice' as const,   gid: 's4b', size: 46, left: '50%', top: 10, rot:   5 },
      { type: 'vote' as const,     gid: 's4c', size: 40, left: '74%', top: 38, rot: -10 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Dots({ total, active, accent }: { total: number; active: number; accent: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{
          width: i === active ? 22 : 6, height: 6, borderRadius: 3,
          backgroundColor: i === active ? accent : palette.ink60,
        }} />
      ))}
    </View>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: palette.ink80 + 'EE', borderRadius: 20,
      paddingHorizontal: 8, paddingVertical: 4,
    }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: fontFamily.body, fontSize: 10, color: palette.ink20 }}>{label}</Text>
    </View>
  );
}

function BackRow({ onPress, label }: { onPress: () => void; label?: string }) {
  const backLabel = label ?? i18n.t('common.back');
  return (
    <TouchableOpacity style={s.backRow} onPress={onPress} hitSlop={14}>
      <Text style={s.backChev}>‹</Text>
      <Text style={s.backLabel}>{backLabel}</Text>
    </TouchableOpacity>
  );
}

function StepBadge({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.stepBadge}>
      <Text style={s.stepText}>{i18n.t('onboarding.stepLabel', { step, total })}</Text>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

function GenderRow({ gender, onChange }: { gender: Gender; onChange: (g: Gender) => void }) {
  return (
    <View style={s.genderRow}>
      {([
        ['male', i18n.t('onboarding.genders.male')],
        ['female', i18n.t('onboarding.genders.female')],
        ['other', i18n.t('onboarding.genders.other')],
      ] as [Gender, string][]).map(([key, lbl]) => {
        const active = gender === key;
        const col = genderColor(key);
        return (
          <TouchableOpacity
            key={key}
            style={[s.genderChip, active && { borderColor: col, backgroundColor: col + '22' }]}
            activeOpacity={0.8}
            onPress={() => onChange(key)}
          >
            <View style={[s.genderDot, { backgroundColor: active ? col : palette.ink60 }]} />
            <Text style={[s.genderLabel, active && { color: palette.ink00 }]}>{lbl}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const CELL = Math.floor((W - spacing.lg * 2 - spacing.sm * 3) / 4);

function AvatarGrid({ selected, onChange }: { selected: string; onChange: (key: string) => void }) {
  return (
    <View style={s.avatarGrid}>
      {AVATARS.map((av) => {
        const active = selected === av.key;
        return (
          <TouchableOpacity
            key={av.key}
            style={[s.avatarCell, { width: CELL, height: CELL, backgroundColor: av.bg },
              active && s.avatarCellActive]}
            activeOpacity={0.75}
            onPress={() => onChange(av.key)}
          >
            <Text style={[s.avatarEmoji, { fontSize: CELL * 0.44 }]}>{av.emoji}</Text>
            {active && (
              <View style={s.avatarCheck}>
                <Text style={s.avatarCheckMark}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Screen = 'landing' | 'slides' | 'eula' | 'profile-type' | 'account-creds' | 'signin' | 'profile-setup';

interface Props {
  onComplete: (p: LocalProfile) => void;
  /** When set, onboarding runs in "upgrade" mode: the user already has an
   *  anonymous profile and is attaching a real account to it (keeping id,
   *  content and premium). */
  upgradeProfile?: LocalProfile | null;
  onCancel?: () => void;
}

export default function OnboardingScreen({ onComplete, upgradeProfile, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const isUpgrade = !!upgradeProfile;
  const [screen, setScreen]       = useState<Screen>(isUpgrade ? 'profile-type' : 'landing');
  const [mode, setMode]           = useState<'anon' | 'account' | 'apple'>('anon');
  const [eulaAgreed, setEulaAgreed] = useState(false);
  const [appleUserId, setAppleUserId] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [slideIdx, setSlideIdx]   = useState(0);

  // Account credentials
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);

  // Profile fields (shared between anon and account)
  const [nickname, setNickname]   = useState('');
  const [gender, setGender]       = useState<Gender>('other');
  const [avatarKey, setAvatarKey] = useState('fox');
  const [photoUri, setPhotoUri]   = useState<string | null>(null);

  const [loading, setLoading]     = useState(false);

  // Transition animation
  const fadeY = useSharedValue(40);
  const fadeO = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fadeY.value }],
    opacity: fadeO.value,
  }));

  function go(s: Screen) {
    fadeO.value = withTiming(0, { duration: 140 });
    fadeY.value = withTiming(12, { duration: 140 });
    setTimeout(() => {
      setScreen(s);
      if (s === 'slides') setSlideIdx(0);
      fadeY.value = 40;
      fadeO.value = 0;
      fadeY.value = withSpring(0, { damping: 22, stiffness: 110 });
      fadeO.value = withTiming(1, { duration: 260 });
    }, 150);
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(i18n.t('onboarding.photoPermTitle'), i18n.t('onboarding.photoPermBody'));
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  }

  function validateCredsStep(): boolean {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) { Alert.alert(t('common.error'), t('onboarding.errors.invalidEmail')); return false; }
    if (password.length < 6) { Alert.alert(t('common.error'), t('onboarding.errors.shortPassword')); return false; }
    return true;
  }

  function validateProfileStep(): boolean {
    if (!nickname.trim()) { Alert.alert(t('common.error'), t('onboarding.errors.emptyNickname')); return false; }
    if (nickname.trim().length < 2) { Alert.alert(t('common.error'), t('onboarding.errors.emptyNickname')); return false; }
    return true;
  }

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  // Sign in with Apple: authenticate, then either restore an existing profile
  // (recovery after reinstall) or continue to profile setup for a new account.
  async function handleApple() {
    setLoading(true);
    try {
      await Location.requestForegroundPermissionsAsync();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token');

      await signInWithAppleToken(credential.identityToken);
      const authUser = await getAuthUser();
      if (!authUser) throw new Error('No auth user');

      const existing = await fetchProfileByAuthUserId(authUser.id);
      if (existing) {
        const local: LocalProfile = {
          id: existing.id,
          nickname: existing.nickname,
          avatar: existing.avatar,
          gender: (existing.gender as Gender) ?? 'other',
          avatarUrl: existing.avatar_url ?? null,
          isAnonymous: false,
        };
        await saveLocalProfile(local);
        onComplete(local);
        return;
      }

      // Upgrade mode: attach this Apple account to the EXISTING anonymous
      // profile in place — keeps id, content and RevenueCat premium.
      if (upgradeProfile) {
        await linkAuthToProfile(upgradeProfile.id, authUser.id);
        const local: LocalProfile = { ...upgradeProfile, isAnonymous: false };
        await saveLocalProfile(local);
        onComplete(local);
        return;
      }

      // First Apple sign-in on this account → collect nickname/avatar.
      setAppleUserId(authUser.id);
      setMode('apple');
      go('profile-setup');
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // user cancelled — no error UI
      Alert.alert(t('common.error'), t('onboarding.errors.signInFailed', { msg: e?.message ?? '' }));
    } finally {
      setLoading(false);
    }
  }

  async function finishApple() {
    if (!validateProfileStep()) return;
    if (!appleUserId) { Alert.alert(t('common.error'), t('onboarding.errors.signInFailed', { msg: '' })); return; }
    setLoading(true);
    try {
      const p = await createProfile(nickname.trim(), avatarKey, gender, appleUserId);

      let avatarUrl: string | null = null;
      if (photoUri) {
        try { avatarUrl = await uploadAvatar(p.id, photoUri); } catch {}
        if (avatarUrl) {
          try { await updateProfile(p.id, { avatar_url: avatarUrl }); } catch {}
        }
      }

      const local: LocalProfile = {
        id: p.id, nickname: p.nickname, avatar: p.avatar,
        gender, avatarUrl, isAnonymous: false,
      };
      await saveLocalProfile(local);
      onComplete(local);
    } catch (e: any) {
      Alert.alert(t('common.error'), t('onboarding.errors.profileFailed', { msg: e?.message ?? '' }));
    } finally {
      setLoading(false);
    }
  }

  async function finishAnon() {
    if (!validateProfileStep()) return;
    setLoading(true);
    try {
      await Location.requestForegroundPermissionsAsync();
      const p = await createProfile(nickname.trim(), avatarKey, gender);
      const local: LocalProfile = {
        id: p.id, nickname: p.nickname, avatar: p.avatar,
        gender, avatarUrl: null, isAnonymous: true,
      };
      await saveLocalProfile(local);
      onComplete(local);
    } catch (e: any) {
      Alert.alert(t('common.error'), t('onboarding.errors.profileFailed', { msg: e?.message ?? '' }));
    } finally {
      setLoading(false);
    }
  }

  async function finishAccount() {
    // Upgrade mode reuses the existing profile's nickname/avatar, so the
    // onboarding nickname field is intentionally empty — skip that check.
    if (!isUpgrade && !validateProfileStep()) return;
    setLoading(true);
    try {
      await Location.requestForegroundPermissionsAsync();
      const authData = await signUpWithEmail(email.trim().toLowerCase(), password);
      const authUserId = authData.user?.id ?? null;

      // Upgrade mode: link the new credentials to the existing anonymous
      // profile (keeps id / content / premium) instead of creating a new one.
      if (upgradeProfile && authUserId) {
        await linkAuthToProfile(upgradeProfile.id, authUserId);
        const local: LocalProfile = { ...upgradeProfile, isAnonymous: false };
        await saveLocalProfile(local);
        onComplete(local);
        return;
      }

      const p = await createProfile(nickname.trim(), avatarKey, gender, authUserId);

      let avatarUrl: string | null = null;
      if (photoUri) {
        try { avatarUrl = await uploadAvatar(p.id, photoUri); } catch {}
        if (avatarUrl) {
          try { await updateProfile(p.id, { avatar_url: avatarUrl }); } catch {}
        }
      }

      const local: LocalProfile = {
        id: p.id, nickname: p.nickname, avatar: p.avatar,
        gender, avatarUrl, isAnonymous: false,
      };
      await saveLocalProfile(local);
      onComplete(local);
    } catch (e: any) {
      Alert.alert(t('common.error'), t('onboarding.errors.signUpFailed', { msg: e?.message ?? '' }));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) { Alert.alert(t('common.error'), t('onboarding.errors.invalidEmail')); return; }
    if (!password) { Alert.alert(t('common.error'), t('onboarding.errors.shortPassword')); return; }
    setLoading(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
      const authUser = await getAuthUser();
      if (!authUser) throw new Error(i18n.t('onboarding.userNotFound'));
      const profile = await fetchProfileByAuthUserId(authUser.id);
      if (!profile) {
        // Upgrade mode: this account has no profile yet → attach it to the
        // existing anonymous profile (keeps id / content / premium).
        if (upgradeProfile) {
          await linkAuthToProfile(upgradeProfile.id, authUser.id);
          const local: LocalProfile = { ...upgradeProfile, isAnonymous: false };
          await saveLocalProfile(local);
          onComplete(local);
          return;
        }
        // Profile exists in auth but no profile row found → go to profile setup
        setMode('account');
        setLoading(false);
        go('profile-setup');
        return;
      }
      const local: LocalProfile = {
        id: profile.id,
        nickname: profile.nickname,
        avatar: profile.avatar,
        gender: (profile.gender as Gender) ?? 'other',
        avatarUrl: profile.avatar_url ?? null,
        isAnonymous: false,
      };
      await saveLocalProfile(local);
      onComplete(local);
    } catch (e: any) {
      Alert.alert(t('common.error'), t('onboarding.errors.signInFailed', { msg: e?.message ?? '' }));
    } finally {
      setLoading(false);
    }
  }

  // ── LANDING ──────────────────────────────────────────────────────────────────

  if (screen === 'landing') {
    const mapW = W - spacing.lg * 2;
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View style={[s.heroCard, aStyle]}>
          <CityMap width={mapW} height={300} />
          <View style={[s.pinOnMap, { left: '14%', top: 38, transform: [{ rotate: '-12deg' }] }]}>
            <WaxSeal type="vote"     size={42} gid="h0" />
          </View>
          <View style={[s.pinOnMap, { left: '44%', top: 20, transform: [{ rotate: '5deg' }] }]}>
            <WaxSeal type="open"     size={54} gid="h1" />
          </View>
          <View style={[s.pinOnMap, { left: '70%', top: 44, transform: [{ rotate: '-7deg' }] }]}>
            <WaxSeal type="choice"   size={44} gid="h2" />
          </View>
          <View style={[s.pinOnMap, { left: '24%', top: 130, transform: [{ rotate: '9deg' }] }]}>
            <WaxSeal type="answered" size={38} gid="h3" />
          </View>
          <View style={[s.pinOnMap, { left: '58%', top: 150, transform: [{ rotate: '-5deg' }] }]}>
            <WaxSeal type="vote"     size={34} gid="h4" />
          </View>
          <View style={[s.pinOnMap, { left: '82%', top: 120, transform: [{ rotate: '11deg' }] }]}>
            <WaxSeal type="open"     size={36} gid="h5" />
          </View>
          <View style={s.heroFade} />
        </Animated.View>

        <Animated.View style={[s.landingCenter, aStyle]}>
          <Text style={s.brandTitle}>lore</Text>
          <Text style={s.brandTagline}>{t('onboarding.brandTagline')}</Text>
        </Animated.View>

        <Animated.View style={[s.landingBottom, { paddingBottom: Math.max(insets.bottom, 24) + 8 }, aStyle]}>
          <TouchableOpacity style={s.btnPrimary} activeOpacity={0.85} onPress={() => go('slides')}>
            <Text style={s.btnPrimaryText}>{t('onboarding.start')}</Text>
          </TouchableOpacity>
          <Text style={s.legal}>{t('onboarding.legal')}</Text>
        </Animated.View>
      </View>
    );
  }

  // ── SLIDES ───────────────────────────────────────────────────────────────────

  if (screen === 'slides') {
    const SLIDES = getSlides();
    const slide  = SLIDES[slideIdx];
    const isLast = slideIdx === SLIDES.length - 1;

    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.slideNav}>
          <TouchableOpacity onPress={slideIdx === 0 ? () => go('landing') : () => setSlideIdx(i => i - 1)} hitSlop={14}>
            <Text style={s.backChev}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => go('eula')} hitSlop={14}>
            <Text style={s.navSkip}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[s.mapCard, aStyle]}>
          <CityMap width={W - spacing.lg * 2} height={220} />
          {slide.pins.map((p) => (
            <View key={p.gid} style={[s.pinAbs, { left: p.left as any, top: p.top, transform: [{ rotate: `${p.rot}deg` }] }]}>
              <WaxSeal type={p.type} size={p.size} gid={p.gid} />
            </View>
          ))}
          <View style={s.legend}>
            <LegendChip color={palette.accent} label={t('questionType.vote')} />
            <LegendChip color="#4A7FC0"         label={t('questionType.choice')} />
            <LegendChip color="#4A9E6E"         label={t('questionType.open')} />
            <LegendChip color="#D4A916"         label={t('onboarding.legendMine')} />
          </View>
        </Animated.View>

        <Animated.View style={[s.slideText, aStyle]}>
          <Text style={[s.slideTitle, { color: slide.accent }]}>{slide.title}</Text>
          <Text style={s.slideBody}>{slide.body}</Text>
        </Animated.View>

        <View style={[s.slideFooter, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Dots total={SLIDES.length} active={slideIdx} accent={slide.accent} />
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: slide.accent }]}
            activeOpacity={0.85}
            onPress={() => {
              if (isLast) { go('eula'); return; }
              fadeO.value = withTiming(0, { duration: 120 });
              setTimeout(() => {
                setSlideIdx(i => i + 1);
                fadeO.value = withTiming(1, { duration: 230 });
              }, 130);
            }}
          >
            <Text style={s.btnPrimaryText}>{isLast ? t('onboarding.start') : t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── EULA / COMMUNITY RULES (Guideline 1.2) ───────────────────────────────────

  if (screen === 'eula') {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.base }}>
          <BackRow onPress={() => go('slides')} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.eulaTitle}>{t('eula.title')}</Text>
          <Text style={s.eulaIntro}>{t('eula.intro')}</Text>

          <View style={s.eulaRuleRow}><Text style={s.eulaBullet}>•</Text><Text style={s.eulaRule}>{t('eula.rule1')}</Text></View>
          <View style={s.eulaRuleRow}><Text style={s.eulaBullet}>•</Text><Text style={s.eulaRule}>{t('eula.rule2')}</Text></View>
          <View style={s.eulaRuleRow}><Text style={s.eulaBullet}>•</Text><Text style={s.eulaRule}>{t('eula.rule3')}</Text></View>

          <View style={s.eulaLinksRow}>
            <TouchableOpacity onPress={() => Linking.openURL(LINKS.terms)} hitSlop={10}>
              <Text style={s.eulaLink}>{t('eula.terms')}</Text>
            </TouchableOpacity>
            <Text style={s.eulaLinkSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL(LINKS.privacy)} hitSlop={10}>
              <Text style={s.eulaLink}>{t('eula.privacy')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={s.eulaCheckRow}
            activeOpacity={0.8}
            onPress={() => setEulaAgreed((v) => !v)}
          >
            <View style={[s.eulaCheckbox, eulaAgreed && s.eulaCheckboxOn]}>
              {eulaAgreed && <Text style={s.eulaCheckmark}>✓</Text>}
            </View>
            <Text style={s.eulaCheckLabel}>{t('eula.agreeCheckbox')}</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <TouchableOpacity
            style={[s.btnPrimary, !eulaAgreed && { opacity: 0.4 }]}
            activeOpacity={0.85}
            disabled={!eulaAgreed}
            onPress={() => go('profile-type')}
          >
            <Text style={s.btnPrimaryText}>{t('eula.agreeButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PROFILE TYPE ─────────────────────────────────────────────────────────────

  if (screen === 'profile-type') {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View style={[{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.base }, aStyle]}>
          <BackRow onPress={isUpgrade ? (onCancel ?? (() => {})) : () => go('slides')} />

          <View style={s.sealRow}>
            <View style={{ transform: [{ rotate: '-8deg' }, { translateY: 6 }] }}>
              <WaxSeal type="vote"   size={40} gid="pt0" />
            </View>
            <WaxSeal type="open" size={52} gid="pt1" />
            <View style={{ transform: [{ rotate: '7deg' }, { translateY: 6 }] }}>
              <WaxSeal type="choice" size={40} gid="pt2" />
            </View>
          </View>

          <Text style={s.ptTitle}>
            {isUpgrade ? t('onboarding.upgradeTitle') : t('onboarding.profileTypeTitle')}
          </Text>
          <Text style={s.ptSub}>
            {isUpgrade ? t('onboarding.upgradeSub') : t('onboarding.profileTypeSub')}
          </Text>

          {!isUpgrade && (
            <TouchableOpacity
              style={s.typeCard}
              activeOpacity={0.8}
              onPress={() => { setMode('anon'); go('profile-setup'); }}
            >
              <Text style={s.typeEmoji}>🎭</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.typeTitle}>{t('onboarding.anonTitle')}</Text>
                <Text style={s.typeSub}>{t('onboarding.anonSub')}</Text>
              </View>
              <Text style={s.typeChev}>›</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.typeCard, { borderColor: palette.accent + '55' }]}
            activeOpacity={0.8}
            onPress={() => { setMode('account'); go('account-creds'); }}
          >
            <Text style={s.typeEmoji}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.typeTitle}>{t('onboarding.accountTitle')}</Text>
              <Text style={s.typeSub}>{t('onboarding.accountSub')}</Text>
            </View>
            <Text style={[s.typeChev, { color: palette.accent }]}>›</Text>
          </TouchableOpacity>

          {appleAvailable && (
            <>
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>{t('common.or')}</Text>
                <View style={s.dividerLine} />
              </View>

              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.lg}
                style={s.appleBtn}
                onPress={handleApple}
              />
            </>
          )}
        </Animated.View>
      </View>
    );
  }

  // ── ACCOUNT CREDS (Step 1/2) ──────────────────────────────────────────────

  if (screen === 'account-creds') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.ink90 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[s.formScroll, { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.formTopRow}>
            <BackRow onPress={() => go('profile-type')} />
            <StepBadge step={1} total={2} />
          </View>

          <Text style={s.formTitle}>{t('onboarding.registerTitle')}</Text>
          <Text style={s.formSub}>{t('onboarding.registerSub')}</Text>

          <View style={{ height: spacing.xl }} />

          <FieldLabel>{t('onboarding.emailLabel')}</FieldLabel>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@mail.com"
            placeholderTextColor={palette.ink40}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <View style={{ height: spacing.base }} />

          <FieldLabel>{t('onboarding.passwordLabel')}</FieldLabel>
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('onboarding.passwordHint')}
              placeholderTextColor={palette.ink40}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)} activeOpacity={0.7}>
              <Text style={s.eyeText}>{showPass ? i18n.t('onboarding.hidePass') : i18n.t('onboarding.showPass')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.xl + spacing.base }} />

          <TouchableOpacity
            style={[s.btnPrimary, loading && { opacity: 0.6 }]}
            activeOpacity={0.85}
            disabled={loading}
            onPress={() => {
              if (!validateCredsStep()) return;
              // Upgrade mode reuses the existing nickname/avatar → no setup step.
              if (isUpgrade) finishAccount();
              else go('profile-setup');
            }}
          >
            <Text style={s.btnPrimaryText}>{t('common.next')}</Text>
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t('common.or')}</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={s.btnSecondary}
            activeOpacity={0.8}
            onPress={() => go('signin')}
          >
            <Text style={s.btnSecondaryText}>{t('onboarding.haveAccount')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── SIGN IN ───────────────────────────────────────────────────────────────────

  if (screen === 'signin') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.ink90 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[s.formScroll, { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BackRow onPress={() => go('account-creds')} />

          <Text style={s.formTitle}>{t('onboarding.signInTitle')}</Text>
          <Text style={s.formSub}>{t('onboarding.signInSub')}</Text>

          <View style={{ height: spacing.xl }} />

          <FieldLabel>{t('onboarding.emailLabel')}</FieldLabel>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@mail.com"
            placeholderTextColor={palette.ink40}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <View style={{ height: spacing.base }} />

          <FieldLabel>{t('onboarding.passwordLabel')}</FieldLabel>
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder={i18n.t('onboarding.passwordPlaceholder')}
              placeholderTextColor={palette.ink40}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)} activeOpacity={0.7}>
              <Text style={s.eyeText}>{showPass ? i18n.t('onboarding.hidePass') : i18n.t('onboarding.showPass')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.xl + spacing.base }} />

          <TouchableOpacity
            style={[s.btnPrimary, loading && { opacity: 0.6 }]}
            activeOpacity={0.85}
            disabled={loading}
            onPress={handleSignIn}
          >
            {loading
              ? <ActivityIndicator color={palette.white} />
              : <Text style={s.btnPrimaryText}>{t('onboarding.signInBtn')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── PROFILE SETUP (anon or account step 2) ───────────────────────────────────

  const isAccount = mode === 'account';
  const needsPhoto = mode !== 'anon';
  const selectedAv = AVATARS.find(a => a.key === avatarKey);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.ink90 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.formScroll, { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.formTopRow}>
          <BackRow onPress={() => go(isAccount ? 'account-creds' : 'profile-type')} />
          {isAccount && <StepBadge step={2} total={2} />}
        </View>

        <Text style={s.formTitle}>{needsPhoto ? t('onboarding.registerTitle') : t('onboarding.anonTitle')}</Text>
        <Text style={s.formSub}>{needsPhoto ? t('onboarding.registerSub') : t('onboarding.anonSub')}</Text>

        {/* Photo picker — for account / Apple modes */}
        {needsPhoto && (
          <TouchableOpacity style={s.photoPicker} onPress={pickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.photoImg} />
            ) : (
              <View style={[s.photoPlaceholder, selectedAv && { backgroundColor: selectedAv.bg }]}>
                <Text style={s.photoEmoji}>{selectedAv?.emoji ?? '🦊'}</Text>
                <Text style={s.photoHint}>{t('onboarding.addPhoto')}</Text>
              </View>
            )}
            <View style={s.photoBadge}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: needsPhoto ? spacing.lg : spacing.xl }} />

        <FieldLabel>{t('onboarding.usernameLabel')}</FieldLabel>
        <TextInput
          style={s.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder={i18n.t('onboarding.usernamePlaceholder')}
          placeholderTextColor={palette.ink40}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
        <Text style={s.inputHint}>{i18n.t('onboarding.usernameHint')}</Text>

        <View style={{ height: spacing.base }} />

        <FieldLabel>{t('onboarding.genderLabel')}</FieldLabel>
        <GenderRow gender={gender} onChange={setGender} />

        <View style={{ height: spacing.base }} />

        <FieldLabel>{t('onboarding.avatarLabel')}</FieldLabel>
        <AvatarGrid selected={avatarKey} onChange={setAvatarKey} />

        <View style={{ height: spacing.xl }} />

        <TouchableOpacity
          style={[s.btnPrimary, loading && { opacity: 0.6 }]}
          activeOpacity={0.85}
          disabled={loading}
          onPress={mode === 'account' ? finishAccount : mode === 'apple' ? finishApple : finishAnon}
        >
          {loading
            ? <ActivityIndicator color={palette.white} />
            : <Text style={s.btnPrimaryText}>{needsPhoto ? t('onboarding.registerTitle') : t('onboarding.start')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink90 },

  // Landing
  heroCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.base,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.ink60,
    position: 'relative',
    ...shadow.lg,
  },
  pinOnMap: { position: 'absolute' },
  heroFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: palette.ink90, opacity: 0.5,
  },
  landingCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: 8,
  },
  brandTitle: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontSize: 66, color: palette.accent, letterSpacing: -2, lineHeight: 70,
  },
  brandTagline: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base, color: palette.ink20,
    textAlign: 'center', lineHeight: fontSize.base * 1.6,
  },
  landingBottom: { paddingHorizontal: spacing.lg, gap: spacing.sm },

  // Slides
  slideNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.base, paddingBottom: spacing.sm,
  },
  navSkip: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40 },
  mapCard: {
    marginHorizontal: spacing.lg,
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1, borderColor: palette.ink60,
    position: 'relative',
    ...shadow.md,
  },
  pinAbs: { position: 'absolute' },
  legend: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', flexWrap: 'wrap', gap: 5,
  },
  slideText: {
    flex: 1, paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg, gap: 10,
  },
  slideTitle: {
    fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32,
  },
  slideBody: {
    fontFamily: fontFamily.body, fontSize: fontSize.base,
    color: palette.ink20, lineHeight: fontSize.base * 1.65,
  },
  slideFooter: { paddingHorizontal: spacing.lg, gap: spacing.base },

  // Profile type
  sealRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 10, marginBottom: spacing.lg, marginTop: spacing.lg,
  },
  ptTitle: {
    fontFamily: fontFamily.display, fontSize: 30,
    color: palette.ink00, lineHeight: 36, marginBottom: spacing.xs,
  },
  ptSub: {
    fontFamily: fontFamily.body, fontSize: fontSize.sm,
    color: palette.ink40, marginBottom: spacing.xl, lineHeight: fontSize.sm * 1.6,
  },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    backgroundColor: palette.ink80, borderRadius: radius.lg,
    borderWidth: 1, borderColor: palette.ink60,
    padding: spacing.lg, marginBottom: spacing.base,
    ...shadow.sm,
  },
  typeEmoji: { fontSize: 30, width: 40, textAlign: 'center' },
  typeTitle: {
    fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base,
    color: palette.ink00, marginBottom: 3,
  },
  typeSub: {
    fontFamily: fontFamily.body, fontSize: fontSize.sm,
    color: palette.ink40, lineHeight: fontSize.sm * 1.5,
  },
  typeChev: { fontFamily: fontFamily.body, fontSize: 26, color: palette.ink40, lineHeight: 28 },

  // Forms shared
  formScroll: { paddingHorizontal: spacing.lg },
  formTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontFamily: fontFamily.display, fontSize: 28,
    color: palette.ink00, marginBottom: 4,
  },
  formSub: {
    fontFamily: fontFamily.body, fontSize: fontSize.sm,
    color: palette.ink40,
  },

  // Back row
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backChev: { fontFamily: fontFamily.body, fontSize: 34, color: palette.ink20, lineHeight: 36 },
  backLabel: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: palette.ink20 },

  // Step badge
  stepBadge: {
    backgroundColor: palette.ink70,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: palette.ink20,
    letterSpacing: 0.3,
  },

  // Field label
  fieldLabel: {
    fontFamily: fontFamily.bodySemiBold, fontSize: 10,
    color: palette.ink40, letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  // Inputs
  input: {
    backgroundColor: palette.ink80,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink00,
    borderWidth: 1,
    borderColor: palette.ink60,
  },
  inputHint: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: palette.ink40,
    marginTop: 5,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: {
    backgroundColor: palette.ink80,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.ink60,
  },
  eyeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: palette.ink20,
  },

  // Gender
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1, borderColor: palette.ink60, backgroundColor: palette.ink80,
  },
  genderDot: { width: 7, height: 7, borderRadius: 4 },
  genderLabel: {
    fontFamily: fontFamily.body, fontSize: 12, color: palette.ink20,
  },

  // Avatar grid
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  avatarCell: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.sm,
  },
  avatarCellActive: {
    borderColor: palette.ink00,
    transform: [{ scale: 1.05 }],
  },
  avatarEmoji: { lineHeight: undefined },
  avatarCheck: {
    position: 'absolute', bottom: 3, right: 3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  avatarCheckMark: {
    fontSize: 9, color: palette.white, fontFamily: fontFamily.bodySemiBold,
  },

  // Photo picker
  photoPicker: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    width: 88, height: 88,
    borderRadius: 44,
    overflow: 'visible',
    position: 'relative',
  },
  photoImg: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: palette.ink60,
  },
  photoPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    gap: 2,
    borderWidth: 2, borderColor: palette.ink60,
  },
  photoEmoji: { fontSize: 32 },
  photoHint: {
    fontFamily: fontFamily.body, fontSize: 9,
    color: 'rgba(255,255,255,0.6)', textAlign: 'center',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: palette.ink70,
    borderWidth: 1.5, borderColor: palette.ink60,
    alignItems: 'center', justifyContent: 'center',
  },

  // Buttons
  btnPrimary: {
    height: 56, backgroundColor: palette.accent,
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  btnPrimaryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base, color: palette.white, letterSpacing: 0.4,
  },
  btnSecondary: {
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.ink60,
  },
  btnSecondaryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.ink20,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.ink60 },
  dividerText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
  },
  appleBtn: { height: 54, width: '100%' },

  // Legal
  legal: {
    fontFamily: fontFamily.body, fontSize: 11,
    color: palette.ink40, textAlign: 'center', lineHeight: 16,
  },

  // EULA / community rules
  eulaTitle: {
    fontFamily: fontFamily.display, fontSize: 26, color: palette.ink00,
    marginBottom: spacing.sm,
  },
  eulaIntro: {
    fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink20,
    lineHeight: fontSize.sm * 1.5, marginBottom: spacing.md,
  },
  eulaRuleRow: { flexDirection: 'row', marginBottom: spacing.sm, paddingRight: spacing.sm },
  eulaBullet: { color: palette.accent, fontSize: fontSize.base, marginRight: 8, lineHeight: fontSize.sm * 1.5 },
  eulaRule: {
    flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.sm,
    color: palette.ink10, lineHeight: fontSize.sm * 1.5,
  },
  eulaLinksRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm, marginBottom: spacing.lg },
  eulaLink: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.accent },
  eulaLinkSep: { color: palette.ink40 },
  eulaCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: spacing.sm },
  eulaCheckbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
    borderColor: palette.ink60, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  eulaCheckboxOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  eulaCheckmark: { color: palette.white, fontSize: 15, fontFamily: fontFamily.bodySemiBold },
  eulaCheckLabel: {
    flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.sm,
    color: palette.ink10, lineHeight: fontSize.sm * 1.5,
  },
});
