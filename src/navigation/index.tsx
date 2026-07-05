import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalProfile } from '../lib/storage';
import { ProfileProvider } from '../lib/ProfileContext';
import { PremiumProvider } from '../lib/PremiumContext';
import { mapAskEvent } from '../lib/mapEvents';
import { authEvents } from '../lib/authEvents';
import { paywallEvents, PaywallTrigger } from '../lib/premiumEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationEvents } from '../lib/notificationEvents';
import { UnreadCountsProvider, useUnreadCounts } from '../lib/UnreadCountsContext';
import { Question, fetchQuestionById } from '../lib/supabase';
import { initAnalytics, identifyAnalytics, resetAnalytics, track } from '../lib/analytics';
import { firstActionEvent } from '../lib/engagementEvents';
import OnboardingScreen from '../screens/Onboarding';
import MapScreen from '../screens/Map';
import TimelineScreen from '../screens/Timeline';
import ProfileScreen from '../screens/Profile';
import AnswersScreen from '../screens/Answers';
import NotificationsScreen from '../screens/Notifications';
import PaywallScreen from '../screens/Paywall';
import ConversationsScreen from '../screens/Conversations';
import ChatScreen from '../screens/Chat';
import { palette, fontFamily, spacing, radius, shadow } from '../theme/tokens';
import {
  IconMapPin,
  IconTimeline,
  IconChat,
  IconPerson,
} from '../components/ui/Icons';
import { SealMark, MINE_SHADE } from '../components/map/SealMark';

// ─── Badge pill ───────────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View style={badge.wrap}>
      <Text style={badge.text}>{label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: palette.ink80,
    zIndex: 10,
  },
  text: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    color: '#fff',
    lineHeight: 11,
    letterSpacing: 0.2,
  },
});

// ─── Param lists ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  MainTabs: undefined;
  Answers: { question: Question; profileId: string };
  Paywall: { trigger?: PaywallTrigger; count?: number } | undefined;
  Chat: {
    conversationId?: string;
    otherUserId: string;
    otherNickname: string;
    otherAvatar: string;
    otherGender: 'male' | 'female' | 'other' | null;
  };
};

export type MainTabParamList = {
  Map: undefined;
  Timeline: undefined;
  Conversations: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<MainTabParamList>();

// ─── Custom tab bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { notifCount, messageCount } = useUnreadCounts();
  const { t } = useTranslation();

  const currentRoute = state.routes[state.index]?.name;
  const activeTab = currentRoute === 'Map'           ? 0
    : currentRoute === 'Timeline'      ? 1
    : currentRoute === 'Conversations' ? 2
    : currentRoute === 'Profile'       ? 3
    : -1;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outerContainer, { bottom: Math.max(insets.bottom, 16) + 4 }]}
    >
      {/* Floating FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => {
          if (activeTab === 0) {
            mapAskEvent.trigger();
          } else {
            navigation.navigate('Map');
            setTimeout(() => mapAskEvent.trigger(), 320);
          }
        }}
      >
        <SealMark size={46} shade={MINE_SHADE} gid="fabSeal" glyph="plus" />
      </TouchableOpacity>

      {/* Pill navbar */}
      <View style={styles.pill}>

        {/* Map */}
        <TouchableOpacity style={styles.tab} activeOpacity={0.7} onPress={() => navigation.navigate('Map')}>
          <View style={styles.iconWrap}>
            <IconMapPin color={activeTab === 0 ? palette.accent : palette.ink40} size={22} strokeWidth={activeTab === 0 ? 2.2 : 1.8} />
            {/* Bell badge shown on Map tab (bell is in Map screen header) */}
            {notifCount > 0 && activeTab !== 0 && <Badge count={notifCount} />}
          </View>
          <Text style={[styles.label, activeTab === 0 && styles.labelActive]}>{t('nav.map')}</Text>
        </TouchableOpacity>

        {/* Timeline */}
        <TouchableOpacity style={styles.tab} activeOpacity={0.7} onPress={() => navigation.navigate('Timeline')}>
          <View style={styles.iconWrap}>
            <IconTimeline color={activeTab === 1 ? palette.accent : palette.ink40} size={22} strokeWidth={activeTab === 1 ? 2.2 : 1.8} />
          </View>
          <Text style={[styles.label, activeTab === 1 && styles.labelActive]}>{t('nav.timeline')}</Text>
        </TouchableOpacity>

        {/* Conversations — message badge */}
        <TouchableOpacity style={styles.tab} activeOpacity={0.7} onPress={() => navigation.navigate('Conversations')}>
          <View style={styles.iconWrap}>
            <IconChat color={activeTab === 2 ? palette.accent : palette.ink40} size={22} strokeWidth={activeTab === 2 ? 2.2 : 1.8} />
            <Badge count={messageCount} />
          </View>
          <Text style={[styles.label, activeTab === 2 && styles.labelActive]}>{t('nav.messages')}</Text>
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity style={styles.tab} activeOpacity={0.7} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.iconWrap}>
            <IconPerson color={activeTab === 3 ? palette.accent : palette.ink40} size={22} strokeWidth={activeTab === 3 ? 2.2 : 1.8} />
          </View>
          <Text style={[styles.label, activeTab === 3 && styles.labelActive]}>{t('nav.profile')}</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

// ─── Tab navigator ────────────────────────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Map"           component={MapScreen} />
      <Tab.Screen name="Timeline"      component={TimelineScreen} />
      <Tab.Screen name="Conversations" component={ConversationsScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile"       component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface Props {
  initialProfile: LocalProfile | null;
}

export default function Navigation({ initialProfile }: Props) {
  const [profile, setProfile] = useState<LocalProfile | null>(initialProfile);
  const [upgrading, setUpgrading] = useState<LocalProfile | null>(null);
  const [justOnboarded, setJustOnboarded] = useState(false);
  const hasProfile = !!profile?.id && !!profile?.nickname;
  const navRef = React.useRef<any>(null);

  // Analytics: init once, then identify/reset as the profile changes.
  useEffect(() => {
    initAnalytics();
    track('app_opened');
  }, []);

  useEffect(() => {
    if (hasProfile && profile?.id) identifyAnalytics(profile.id);
  }, [hasProfile, profile?.id]);

  // Sign-out / account-delete: Profile screen fires authEvents.onSignOut → clears state → shows Onboarding
  useEffect(() => {
    authEvents.onSignOut = () => { resetAnalytics(); setUpgrading(null); setProfile(null); };
    // Anonymous → real account: keep the current profile mounted, but overlay
    // onboarding in "upgrade" mode so premium/content survive a cancel.
    authEvents.onUpgradeAccount = (current) => setUpgrading(current);
    return () => {
      authEvents.onSignOut = () => {};
      authEvents.onUpgradeAccount = () => {};
    };
  }, []);

  // Wire paywallEvents so any component can trigger the Paywall screen
  useEffect(() => {
    paywallEvents.show = (trigger, opts) =>
      navRef.current?.navigate('Paywall', { trigger: trigger ?? 'limit', count: opts?.count });
    return () => { paywallEvents.show = () => {}; };
  }, []);

  // One-time "welcome" soft paywall right after a fresh onboarding (not on
  // returning launches, not after an account upgrade). Persisted so it only
  // ever shows once per install.
  //
  // Timing: paywalls convert best right after a real value moment rather
  // than cold (evidence: RevenueCat/Apphud placement research), so prefer
  // showing it right after the user's first answer/question this session.
  // A fallback timer still shows it eventually for users who browse without
  // acting, preserving the old "always shown once" guarantee.
  const WELCOME_PAYWALL_KEY = '@lore/welcome_paywall_seen';
  useEffect(() => {
    if (!hasProfile || !justOnboarded) return;
    setJustOnboarded(false);
    let cancelled = false;
    let shown = false;
    let fallback: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const seen = await AsyncStorage.getItem(WELCOME_PAYWALL_KEY);
        if (seen) return;
        await AsyncStorage.setItem(WELCOME_PAYWALL_KEY, '1');

        const showOnce = () => {
          if (shown || cancelled) return;
          shown = true;
          navRef.current?.navigate('Paywall', { trigger: 'welcome' });
        };

        // Let the main stack mount before either path can navigate.
        setTimeout(() => {
          if (cancelled) return;
          firstActionEvent.notify = showOnce;
          fallback = setTimeout(showOnce, 20000);
        }, 900);
      } catch { /* noop */ }
    })();

    return () => {
      cancelled = true;
      firstActionEvent.notify = () => {};
      if (fallback) clearTimeout(fallback);
    };
  }, [hasProfile, justOnboarded]);

  // Wire notificationEvents deep-link navigation
  useEffect(() => {
    notificationEvents.onNavigate = (dest) => {
      const nav = navRef.current;
      if (!nav) return;
      if (dest.screen === 'Map') {
        nav.navigate('MainTabs', { screen: 'Map' });
      } else if (dest.screen === 'Notifications') {
        nav.navigate('MainTabs', { screen: 'Notifications' });
      } else if (dest.screen === 'Answers') {
        // Answers needs the full Question object; fetch it by id first.
        fetchQuestionById(dest.questionId)
          .then((question) => {
            if (question) nav.navigate('Answers', { question, profileId: dest.profileId });
            else nav.navigate('MainTabs', { screen: 'Map' });
          })
          .catch(() => nav.navigate('MainTabs', { screen: 'Map' }));
      } else if (dest.screen === 'Chat') {
        nav.navigate('Chat', {
          conversationId: dest.conversationId,
          otherUserId:    dest.otherUserId,
          otherNickname:  dest.otherNickname,
          otherAvatar:    dest.otherAvatar,
          otherGender:    dest.otherGender,
        });
      }
    };
    return () => { notificationEvents.onNavigate = () => {}; };
  }, []);

  return (
    <NavigationContainer ref={navRef}>
      {hasProfile && upgrading ? (
        <OnboardingScreen
          upgradeProfile={upgrading}
          onCancel={() => setUpgrading(null)}
          onComplete={(p) => { setUpgrading(null); setProfile(p); }}
        />
      ) : hasProfile ? (
        <ProfileProvider profile={profile!}>
          <PremiumProvider profileId={profile!.id}>
          <UnreadCountsProvider userId={profile!.id}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen
                name="Answers"
                component={AnswersScreen}
                options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: palette.ink90 } }}
              />
              <Stack.Screen
                name="Paywall"
                component={PaywallScreen}
                options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: palette.ink90 } }}
              />
              <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: palette.ink90 } }}
              />
            </Stack.Navigator>
          </UnreadCountsProvider>
          </PremiumProvider>
        </ProfileProvider>
      ) : (
        <OnboardingScreen onComplete={(p) => { setProfile(p); setJustOnboarded(true); }} />
      )}
    </NavigationContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PILL_HEIGHT  = 58;
const FAB_SIZE     = 50;
const FAB_GAP      = 10; // space between FAB bottom and pill top

const styles = StyleSheet.create({
  // Transparent full-width wrapper so touches pass through to map underneath
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // Floating pill — full width with side margins so tabs distribute evenly
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    backgroundColor: palette.ink80,
    borderRadius: radius.full,
    marginHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
    ...shadow.lg,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },


  label: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    color: palette.ink40,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: palette.accent,
    fontFamily: fontFamily.bodySemiBold,
  },

  // FAB floats above the pill
  fab: {
    position: 'absolute',
    top: -(FAB_SIZE + FAB_GAP),
    alignSelf: 'center',
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
