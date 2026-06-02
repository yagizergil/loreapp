import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';

interface Props {
  onClose: () => void;
  onUpgrade: () => void;
}

const BENEFITS = [
  { text: 'Tüm şehirdeki soruları gör' },
  { text: '1 km sınırı kalkar, her yeri keşfet' },
  { text: 'Yeni sorulara önce sen ulaş' },
  { text: 'Premium bildirimler ile anlık takip' },
];

function BenefitIcon({ type }: { type: string }) {
  if (type === 'map') return (
    <View style={ic.wrap}>
      <View style={ic.pinCircle} />
      <View style={ic.pinTail} />
    </View>
  );
  if (type === 'unlock') return (
    <View style={ic.wrap}>
      <View style={ic.lockBody} />
      <View style={ic.lockArc} />
    </View>
  );
  if (type === 'bolt') return (
    <View style={ic.wrap}>
      <View style={ic.boltTop} />
      <View style={ic.boltBottom} />
    </View>
  );
  return (
    <View style={ic.wrap}>
      <View style={ic.starDot} />
    </View>
  );
}

export default function PaywallSheet({ onClose, onUpgrade }: Props) {
  const ref = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet
      ref={ref}
      snapPoints={['60%', '88%']}
      index={0}
      enablePanDownToClose
      onChange={(i) => { if (i === -1) onClose(); }}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Lock icon */}
        <View style={styles.lockWrap}>
          <View style={styles.lockIconOuter}>
            <View style={styles.lockIconBody} />
            <View style={styles.lockIconArc} />
            <View style={styles.lockIconHole} />
          </View>
        </View>

        {/* Headline */}
        <Text style={styles.title}>Premium'a Geç</Text>
        <Text style={styles.subtitle}>
          1 km ötesindeki sorulara ulaşmak için{'\n'}Lore Premium'a abone ol.
        </Text>

        {/* Benefits */}
        <View style={styles.benefitList}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefitRow}>
              <View style={styles.benefitDot} />
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* Price card */}
        <View style={styles.priceCard}>
          <View>
            <Text style={styles.priceLabel}>Aylık plan</Text>
            <Text style={styles.priceNote}>İstediğin zaman iptal et</Text>
          </View>
          <Text style={styles.price}>₺49<Text style={styles.pricePerMonth}>/ay</Text></Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={onUpgrade}>
          <Text style={styles.ctaText}>Premium'a Geç</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.dismissText}>Şimdi değil</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bg:     { backgroundColor: palette.ink80 },
  handle: { backgroundColor: palette.ink60, width: 36 },

  content: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },

  lockWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.accent + '44',
  },
  lockIconOuter: {
    alignItems: 'center',
  },
  lockIconBody: {
    width: 22,
    height: 16,
    borderRadius: 4,
    backgroundColor: palette.accent,
    marginTop: 10,
  },
  lockIconArc: {
    position: 'absolute',
    top: 0,
    width: 16,
    height: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: palette.accent,
  },
  lockIconHole: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.ink80,
  },

  title: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: palette.ink00,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink40,
    textAlign: 'center',
    lineHeight: fontSize.base * 1.6,
    marginBottom: spacing.xl,
  },

  benefitList: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  benefitText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.ink10,
    flex: 1,
  },

  priceCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.ink70,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.ink60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    marginBottom: spacing.lg,
  },
  priceLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.ink00,
  },
  priceNote: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.ink40,
    marginTop: 2,
  },
  price: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: palette.accent,
  },
  pricePerMonth: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
  },

  ctaBtn: {
    width: '100%',
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  ctaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.white,
    letterSpacing: 0.3,
  },

  dismissBtn: {
    paddingVertical: spacing.sm,
  },
  dismissText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
  },
});

const ic = StyleSheet.create({
  wrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  pinCircle: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent },
  pinTail: { width: 2, height: 6, backgroundColor: palette.accent, marginTop: -1 },
  lockBody: { width: 14, height: 10, borderRadius: 3, backgroundColor: palette.accent, marginTop: 6 },
  lockArc: { position: 'absolute', top: 0, width: 10, height: 8, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderWidth: 2, borderBottomWidth: 0, borderColor: palette.accent },
  boltTop: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: palette.accent },
  boltBottom: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: palette.accent, marginTop: -2 },
  starDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent },
});
