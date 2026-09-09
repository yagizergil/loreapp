import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  findSayHiCandidate, recordSayHi, fetchSayHiDailyRemaining,
  getOrCreateConversation, sendMessage, SayHiCandidate,
} from '../../lib/supabase';
import { containsObjectionableContent } from '../../lib/contentFilter';
import { palette, fontFamily, fontSize, spacing, radius } from '../../theme/tokens';
import { CONTENT_MAX_WIDTH } from '../../theme/responsive';
import AvatarView from '../ui/Avatar';
import { track } from '../../lib/analytics';
import { paywallEvents } from '../../lib/premiumEvents';
import { useTranslation } from 'react-i18next';

interface Props {
  profileId: string;
  isPremium: boolean;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onOpenChat: (conversationId: string, candidate: SayHiCandidate) => void;
}

const DAILY_LIMIT = 3;

/**
 * Premium-gated cold-open anonymous 1:1 greeting to a nearby active
 * stranger (see say_hi.sql for the full design rationale — this bridges
 * to the anonymous-1:1-chat mechanic Turkish users are already proven,
 * heavy spenders on, per market research, since Lore's public map/Q&A
 * format is untested there). Never a raw text box on first contact —
 * template openers keep the very first message low-risk, and the
 * resulting conversation still goes through the same report/block/content
 * filter as every other chat.
 */
export default function SayHiSheet({ profileId, isPremium, userLocation, onClose, onOpenChat }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<SayHiCandidate | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);

  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const templates = t('sayHi.templates', { returnObjects: true }) as string[];

  useEffect(() => {
    scale.value   = withSpring(1, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 220 });

    if (!isPremium) {
      track('say_hi_unlock_tapped');
      setLoading(false);
      return;
    }
    if (!userLocation) {
      setLoading(false);
      return;
    }

    track('say_hi_sheet_viewed');
    Promise.all([
      findSayHiCandidate(profileId, userLocation.lat, userLocation.lng),
      fetchSayHiDailyRemaining(profileId, DAILY_LIMIT),
    ]).then(([c, r]) => {
      setCandidate(c);
      setRemaining(r);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(text: string) {
    if (!candidate || sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (containsObjectionableContent(trimmed)) {
      Alert.alert(t('common.error'), t('chat.errorSend'));
      return;
    }

    setSending(true);
    try {
      const res = await recordSayHi(profileId, candidate.candidateId, isPremium, DAILY_LIMIT);
      if (!res.ok) {
        Alert.alert(t('common.error'), t('sayHi.noneLeft'));
        return;
      }
      const conversationId = await getOrCreateConversation(profileId, candidate.candidateId);
      await sendMessage(conversationId, profileId, trimmed);
      track('say_hi_sent');
      onOpenChat(conversationId, candidate);
    } catch {
      Alert.alert(t('common.error'), t('chat.errorSend'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.cardWrapper, cardStyle]} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('sayHi.title')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <View style={styles.closeX1} />
              <View style={styles.closeX2} />
            </TouchableOpacity>
          </View>

          {!isPremium ? (
            <View style={styles.body}>
              <Text style={styles.lockedText}>{t('sayHi.unlockBody')}</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={() => { onClose(); setTimeout(() => paywallEvents.show('sayHi'), 300); }}
              >
                <Text style={styles.primaryBtnText}>{t('sayHi.unlockCta')}</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : !candidate ? (
            <View style={styles.body}>
              <Text style={styles.emptyText}>{t('sayHi.noOneNearby')}</Text>
            </View>
          ) : (
            <View style={styles.body}>
              <View style={styles.candidateRow}>
                <AvatarView avatarKey={candidate.avatar} avatarUrl={candidate.avatarUrl} gender={candidate.gender} size={48} ring />
                <View style={{ flex: 1 }}>
                  <Text style={styles.candidateName}>{candidate.nickname}</Text>
                  <Text style={styles.candidateSub}>{t('sayHi.nearbyNow')}</Text>
                </View>
              </View>

              <Text style={styles.templatesLabel}>{t('sayHi.pickOpener')}</Text>
              {templates.map((tpl, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.templateChip}
                  activeOpacity={0.75}
                  disabled={sending}
                  onPress={() => handleSend(tpl)}
                >
                  <Text style={styles.templateChipText}>{tpl}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder={t('sayHi.customPlaceholder')}
                  placeholderTextColor={palette.ink40}
                  maxLength={200}
                  editable={!sending}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!customText.trim() || sending) && { opacity: 0.4 }]}
                  disabled={!customText.trim() || sending}
                  onPress={() => handleSend(customText)}
                >
                  {sending ? <ActivityIndicator color={palette.white} size="small" /> : <Text style={styles.sendBtnText}>{t('common.send')}</Text>}
                </TouchableOpacity>
              </View>

              {remaining !== null && (
                <Text style={styles.remainingText}>{t('sayHi.remaining', { remaining, limit: DAILY_LIMIT })}</Text>
              )}
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
  lockedText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink20, marginBottom: spacing.lg },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40, textAlign: 'center', paddingVertical: spacing.lg },
  primaryBtn: { backgroundColor: palette.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primaryBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.white },
  candidateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  candidateName: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.ink00 },
  candidateSub: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.success },
  templatesLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: palette.ink40, marginBottom: spacing.xs },
  templateChip: {
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  templateChipText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink10 },
  customRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, alignItems: 'center' },
  customInput: {
    flex: 1,
    backgroundColor: palette.ink70,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: palette.ink00,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  sendBtn: { backgroundColor: palette.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: palette.white },
  remainingText: { fontFamily: fontFamily.body, fontSize: 11, color: palette.ink40, textAlign: 'center', marginTop: spacing.sm },
});
