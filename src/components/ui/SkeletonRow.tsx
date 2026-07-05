import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { palette, spacing, radius } from '../../theme/tokens';

/** Generic list-row skeleton (avatar + two text bars) shown while a list's
 *  first page is loading, instead of a bare centered spinner — avoids the
 *  layout "pop" when real content replaces an unrelated loading state. */
export default function SkeletonRow({ withAvatar = true }: { withAvatar?: boolean }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 600 }), withTiming(0.4, { duration: 600 })),
      -1,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[s.row, style]}>
      {withAvatar && <View style={s.avatar} />}
      <View style={s.lines}>
        <View style={[s.bar, { width: '55%' }]} />
        <View style={[s.bar, { width: '85%', marginTop: 6 }]} />
      </View>
    </Animated.View>
  );
}

/** Render `count` skeleton rows — drop-in replacement for a loading spinner. */
export function SkeletonList({ count = 5, withAvatar = true }: { count?: number; withAvatar?: boolean }) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.base }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} withAvatar={withAvatar} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: palette.ink70,
  },
  lines: { flex: 1 },
  bar: {
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: palette.ink70,
  },
});
