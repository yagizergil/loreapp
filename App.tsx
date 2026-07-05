import './src/i18n';
import React, { useEffect, useState } from 'react';
import { configureNotificationHandler } from './src/lib/notifications';
import { initCrashReporting, ErrorBoundary } from './src/lib/crashReporting';

// Configure notification display behaviour + crash reporting before any
// component mounts, so both are active for the very first render.
configureNotificationHandler();
initCrashReporting();
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WaxSeal from './src/components/ui/WaxSeal';
import { useFonts, Fraunces_700Bold, Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { palette, fontSize } from './src/theme/tokens';
import { getLocalProfile, clearLocalProfile, LocalProfile } from './src/lib/storage';
import Navigation from './src/navigation';

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_700Bold,
    Fraunces_500Medium_Italic,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });

  const [profileChecked, setProfileChecked] = useState(false);
  const [initialProfile, setInitialProfile] = useState<LocalProfile | null>(null);

  useEffect(() => {
    getLocalProfile()
      .then((p) => setInitialProfile(p))
      .catch(() => setInitialProfile(null))
      .finally(() => setProfileChecked(true));
  }, []);

  const ready = fontsLoaded && profileChecked;

  if (!ready) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />

        {/* Center: seals + branding */}
        <View style={styles.splashCenter}>
          <View style={styles.sealRow}>
            <View style={{ transform: [{ rotate: '-10deg' }, { translateY: 6 }] }}>
              <WaxSeal type="vote"   size={40} gid="sp0" />
            </View>
            <WaxSeal type="open"   size={52} gid="sp1" />
            <View style={{ transform: [{ rotate: '8deg' }, { translateY: 6 }] }}>
              <WaxSeal type="choice" size={40} gid="sp2" />
            </View>
          </View>
          <Text style={styles.splashTitle}>lore</Text>
          <Text style={styles.splashSub}>lore</Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary
          fallback={({ resetError }) => (
            <View style={styles.splash}>
              <Text style={styles.splashTitle}>lore</Text>
              <Text style={styles.errorText}>Something went wrong.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={resetError} activeOpacity={0.85}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
              {/* If the same bad local state (corrupted profile, bad route
                  param) caused the crash, "Try again" alone re-mounts
                  Navigation with that exact same state and crashes again —
                  trapping the user with no way out. This clears local
                  profile data so a retry falls back to a clean onboarding
                  flow instead of looping. */}
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => { clearLocalProfile().catch(() => {}); setInitialProfile(null); resetError(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Reset app</Text>
              </TouchableOpacity>
            </View>
          )}
        >
          <Navigation initialProfile={initialProfile} />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  splash: {
    flex: 1,
    backgroundColor: palette.ink90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  splashCenter: {
    alignItems: 'center',
    gap: 10,
  },
  sealRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 8,
  },
  splashTitle: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontSize: 52,
    color: palette.accent,
    letterSpacing: -1,
    lineHeight: 56,
  },
  splashSub: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fontSize.base,
    color: palette.ink20,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fontSize.base,
    color: '#fff',
  },
  resetBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  resetBtnText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fontSize.sm,
    color: palette.ink40,
    textDecorationLine: 'underline',
  },
});
