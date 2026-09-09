import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Share, ActivityIndicator } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { File } from 'expo-file-system';
import { palette, fontFamily, fontSize, spacing, radius } from '../theme/tokens';
import { track } from '../lib/analytics';
import { LINKS } from '../lib/links';
import { useTranslation } from 'react-i18next';

interface Props {
  questionBody: string;
  answerBody?: string;
  onClose: () => void;
}

const CARD_WIDTH = 320;
const CARD_HEIGHT = 400;

/**
 * Renders a shareable, on-brand image card (question + optionally its top
 * answer) that the user can post to Instagram Stories/WhatsApp/etc — the
 * cheapest acquisition channel there is, since every share is the existing
 * user advertising the app for free (the mechanic behind BeReal/Poparazzi's
 * organic growth: a genuinely nice-looking artifact people WANT to post,
 * not a bare screenshot of the app UI).
 */
export default function ShareCard({ questionBody, answerBody, onClose }: Props) {
  const { t } = useTranslation();
  const shotRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      track('share_card_shared', { hasAnswer: !!answerBody });
      await Share.share({
        url: uri,
        message: t('shareCard.shareMessage', { url: LINKS.appStoreListing }),
      });
      // Best-effort cleanup — sharing has already handed off the file to
      // the OS share sheet by the time this runs.
      try { new File(uri).delete(); } catch {}
    } catch {
      // User cancelled the native share sheet, or capture failed — either
      // way there's nothing actionable to show; just let them retry.
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.wrapper} pointerEvents="box-none">
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.card}>
            <Text style={styles.wordmark}>lore</Text>
            <View style={styles.divider} />
            <Text style={styles.question} numberOfLines={6}>{questionBody}</Text>
            {answerBody && (
              <View style={styles.answerBox}>
                <Text style={styles.answerQuote}>"</Text>
                <Text style={styles.answer} numberOfLines={5}>{answerBody}</Text>
              </View>
            )}
            <Text style={styles.footer}>{t('shareCard.footer')}</Text>
          </View>
        </ViewShot>

        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare} disabled={sharing}>
          {sharing ? <ActivityIndicator color={palette.white} /> : <Text style={styles.shareBtnText}>{t('shareCard.shareCta')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>{t('common.close')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.ink90,
    borderRadius: radius.xl,
    padding: spacing.xl,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.accent + '33',
  },
  wordmark: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xl,
    fontFamily: 'Fraunces_500Medium_Italic',
    fontSize: fontSize.lg,
    color: palette.accent,
  },
  divider: {
    position: 'absolute',
    top: spacing.lg + 32,
    left: spacing.xl,
    right: spacing.xl,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.ink60,
  },
  question: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: palette.ink00,
    lineHeight: 30,
    marginBottom: spacing.lg,
  },
  answerBox: {
    backgroundColor: palette.ink80,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    padding: spacing.base,
  },
  answerQuote: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: palette.accent,
    lineHeight: 20,
  },
  answer: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink10,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.xl,
    right: spacing.xl,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    textAlign: 'center',
  },
  shareBtn: {
    backgroundColor: palette.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: CARD_WIDTH * 0.6,
    alignItems: 'center',
  },
  shareBtnText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: palette.white },
  closeBtn: { paddingVertical: spacing.sm },
  closeBtnText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: palette.ink40 },
});
