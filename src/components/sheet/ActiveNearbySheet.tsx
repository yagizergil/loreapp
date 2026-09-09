import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { fetchNearbyActiveUsers, NearbyActiveUser } from '../../lib/supabase';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import { CONTENT_MAX_WIDTH } from '../../theme/responsive';
import AvatarView from '../ui/Avatar';
import { track } from '../../lib/analytics';
import { useTranslation } from 'react-i18next';

interface Props {
  profileId: string;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onSayHi: () => void;
}

/**
 * Free presence/liveliness mini-list — "who's active nearby right now"
 * (see nearby_active_users.sql). Deliberately not a match/dating list: no
 * messaging lives here. It exists to make the map feel alive at a glance,
 * and funnels into the premium Say Hi sheet for anyone who wants to
 * actually start a conversation with one of these people.
 */
export default function ActiveNearbySheet({ profileId, userLocation, onClose, onSayHi }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<NearbyActiveUser[]>([]);

  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value   = withSpring(1, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 220 });

    if (!userLocation) {
      setLoading(false);
      return;
    }
    track('active_nearby_list_viewed');
    fetchNearbyActiveUsers(profileId, userLocation.lat, userLocation.lng)
      .then(setUsers)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.cardWrapper, cardStyle]} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('activeNearby.title')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <View style={styles.closeX1} />
              <View style={styles.closeX2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : users.length === 0 ? (
            <View style={styles.body}>
              <Text style={styles.emptyText}>{t('activeNearby.empty')}</Text>
            </View>
          ) : (
            <View style={styles.body}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
                {users.map((u) => (
                  <View key={u.candidateId} style={styles.userRow}>
                    <AvatarView avatarKey={u.avatar} avatarUrl={u.avatarUrl} gender={u.gender} size={40} />
                    <Text style={styles.userName}>{u.nickname}</Text>
                    <View style={styles.liveDot} />
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onSayHi}>
                <Text style={styles.primaryBtnText}>{t('activeNearby.sayHiCta')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  cardWrapper: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-none' as any },
  card: {
    width: '90%',
    maxWidth: CONTENT_MAX_WIDTH,
    backgroundColor: palette.ink80,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ink60,
    overflow: 'hidden',
    paddingBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.base, paddingBottom: spacing.sm },
  title: { fontFamily: fontFamily.display, fontSize: fontSize.lg, color: palette.ink00 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink70, borderRadius: 14 },
  closeX1: { position: 'absolute', width: 12, height: 1.5, backgroundColor: palette.ink20, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  closeX2: { position: 'absolute', width: 12, height: 1.5, backgroundColor: palette.ink20, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40, textAlign: 'center', paddingVertical: spacing.lg },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  userName: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.ink00 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.success },
  primaryBtn: { backgroundColor: palette.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  primaryBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.white },
});
