import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay } from 'react-native-reanimated';
import { surpriseKarmaEvents } from '../lib/surpriseKarmaEvents';
import { palette, fontFamily, fontSize, spacing, radius } from '../theme/tokens';
import { useTranslation } from 'react-i18next';

const VISIBLE_MS = 2600;

/** Mount once near the navigation root — subscribes to surpriseKarmaEvents
 *  and renders a self-dismissing top banner. */
export default function SurpriseKarmaToast() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState<number | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    surpriseKarmaEvents.show = (n: number) => {
      if (timer.current) clearTimeout(timer.current);
      setAmount(n);
      opacity.value = withSequence(withTiming(1, { duration: 220 }), withDelay(VISIBLE_MS, withTiming(0, { duration: 300 })));
      translateY.value = withTiming(0, { duration: 220 });
      timer.current = setTimeout(() => setAmount(null), VISIBLE_MS + 320);
    };
    return () => { surpriseKarmaEvents.show = () => {}; if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (amount === null) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }, animStyle]}>
      <View style={styles.pill}>
        <Text style={styles.text}>{t('surpriseKarma.toast', { amount })}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  pill: {
    backgroundColor: palette.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  text: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: palette.white,
  },
});
