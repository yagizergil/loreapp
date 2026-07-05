import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { PurchasesPackage } from 'react-native-purchases';
import { usePremium } from '../../lib/PremiumContext';
import { palette, fontFamily, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation';
import { LINKS } from '../../lib/links';
import { track } from '../../lib/analytics';
import { getPaywallCtaVariant } from '../../lib/experiments';
import WaxSeal from '../../components/ui/WaxSeal';

type Plan = 'monthly' | 'yearly';
type PaywallRoute = RouteProp<RootStackParamList, 'Paywall'>;

const MONTHLY_PRICE   = '₺99,99';
const YEARLY_PRICE    = '₺599,99';
const YEARLY_PER_MO   = '₺50';

/** Free-trial length (in days) from a package's introductory offer, or 0 if
 *  there is no free trial. A free trial is an intro price of 0. */
function introTrialDays(pkg: PurchasesPackage | null): number {
  const ip = (pkg?.product as any)?.introPrice;
  if (!ip || ip.price !== 0) return 0;
  const n = ip.periodNumberOfUnits ?? 0;
  switch (ip.periodUnit) {
    case 'DAY':   return n;
    case 'WEEK':  return n * 7;
    case 'MONTH': return n * 30;
    case 'YEAR':  return n * 365;
    default:      return n;
  }
}

// ─── Check row ────────────────────────────────────────────────────────────────
function CheckRow({ text }: { text: string }) {
  return (
    <View style={s.checkRow}>
      <View style={s.checkDot}>
        <View style={s.checkL} />
        <View style={s.checkR} />
      </View>
      <Text style={s.checkText}>{text}</Text>
    </View>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({
  active, label, price, sub, badge, onPress,
}: {
  active: boolean;
  label: string;
  price: string;
  sub: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.planCard, active && s.planCardActive]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {badge ? (
        <View style={s.planBadge}>
          <Text style={s.planBadgeText}>{badge}</Text>
        </View>
      ) : null}

      {/* Radio dot */}
      <View style={[s.radio, active && s.radioActive]}>
        {active && <View style={s.radioDot} />}
      </View>

      <View style={s.planCardBody}>
        <Text style={[s.planLabel, active && s.planLabelActive]}>{label}</Text>
        <Text style={[s.planSub, active && s.planSubActive]}>{sub}</Text>
      </View>

      <Text style={[s.planPrice, active && s.planPriceActive]}>{price}</Text>
    </TouchableOpacity>
  );
}

export default function PaywallScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<PaywallRoute>();
  const insets     = useSafeAreaInsets();
  const { t }      = useTranslation();
  const trigger    = (route.params as any)?.trigger ?? 'geo';
  const count      = (route.params as any)?.count ?? 0;
  const variant: 'geo' | 'region' | 'limit' | 'welcome' | 'leaderboard' =
    trigger === 'region' ? 'region'
    : trigger === 'limit' ? 'limit'
    : trigger === 'welcome' ? 'welcome'
    : trigger === 'leaderboard' ? 'leaderboard'
    : 'geo';

  const { isPremium, offering, purchase, restore } = usePremium();

  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // A/B experiment variant — resolved once per mount from the already-loaded
  // PostHog flag cache (no loading state needed) and orthogonal to `trigger`
  // (trigger = why the paywall opened; ctaVariant = which copy they saw).
  const ctaVariant = useRef(getPaywallCtaVariant()).current;

  // Analytics: one paywall_shown per mount, tagged with the trigger that opened it.
  useEffect(() => {
    track('paywall_shown', { trigger, count, experiment_variant: ctaVariant });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kullanıcı bu ekrana geldiğinde zaten premium miydi? (mount anındaki değer)
  const wasPremiumAtMount = useRef(isPremium);

  // Zaten premium'ken (yanlışlıkla / başka cihazdan) açıldıysa sessizce kapat.
  useEffect(() => {
    if (wasPremiumAtMount.current && isPremium) navigation.goBack();
    // sadece mount'ta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Premium bu oturumda aktifleşirse (satın alma / geri yükleme / yenileme),
  // doğrudan kapatmak yerine "Premium'a Hoş Geldin" ekranını göster.
  useEffect(() => {
    if (isPremium && !wasPremiumAtMount.current && !showSuccess) {
      setShowSuccess(true);
    }
  }, [isPremium, showSuccess]);

  // One-shot spring entrance on the CTA (matches QuestionSheet's entrance vocabulary)
  // instead of a looping pulse, which read as a generic growth-hack tell.
  const ctaScale = useSharedValue(0.94);
  useEffect(() => {
    ctaScale.value = withSpring(1, { damping: 18, stiffness: 200 });
  }, [ctaScale]);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  // ── Gerçek RevenueCat paketleri + fiyatları ──────────────────────────────────
  const monthlyPkg: PurchasesPackage | null = offering?.monthly ?? null;
  const annualPkg:  PurchasesPackage | null = offering?.annual ?? null;

  const fmtCurrency = (amount: number, code: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  };

  // Mağazadan gelen localize fiyatlar; offering yüklenmediyse sabitlere düş.
  const monthlyPriceStr = monthlyPkg?.product.priceString ?? MONTHLY_PRICE;
  const yearlyPriceStr  = annualPkg?.product.priceString ?? YEARLY_PRICE;
  // Sadece tutar; "/ay" eki PlanCard'da bir kez ekleniyor (çift "/ay" olmasın).
  const yearlyPerMoStr  = annualPkg
    ? fmtCurrency(annualPkg.product.price / 12, annualPkg.product.currencyCode)
    : YEARLY_PER_MO;

  async function handleUpgrade() {
    if (busy) return;
    const pkg = plan === 'yearly' ? annualPkg : monthlyPkg;
    if (!pkg) {
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorUnavailable'));
      return;
    }
    track('purchase_started', { trigger, plan, experiment_variant: ctaVariant });
    setBusy(true);
    const res = await purchase(pkg);
    setBusy(false);
    if (res.ok) {
      track('purchase_succeeded', { trigger, plan, experiment_variant: ctaVariant });
      // Satın alma başarılı: premium tespit edilse de edilmese de (RC senkron
      // gecikmesine karşı) başarı ekranını göster. mirror zaten premium'u açar.
      setShowSuccess(true);
    } else if (!res.cancelled) {
      track('purchase_failed', { trigger, plan, experiment_variant: ctaVariant });
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorBody'));
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    const res = await restore();
    setBusy(false);
    if (res.ok && res.isPremium) {
      track('purchase_restored', { trigger, experiment_variant: ctaVariant });
      setShowSuccess(true);
    } else if (res.ok) {
      Alert.alert(t('paywall.restoreNoneTitle'), t('paywall.restoreNoneBody'));
    } else {
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorBody'));
    }
  }

  const title    = t(`paywall.trig.${variant}.title`);
  // Kıtlık: çevrede gerçek kilitli soru sayısı varsa alt başlığı onunla değiştir.
  const subtitle = ((variant === 'geo' || variant === 'region') && count > 0)
    ? t('paywall.scarcity', { count })
    : t(`paywall.trig.${variant}.subtitle`);

  const benefitsKey = variant === 'region'
    ? 'paywall.benefitsRegion'
    : variant === 'limit' ? 'paywall.benefitsLimit'
    : variant === 'leaderboard' ? 'paywall.benefitsLeaderboard'
    : 'paywall.benefitsGeo';
  const benefits = t(benefitsKey, { returnObjects: true }) as string[];

  // Gerçek ürünün ücretsiz deneme süresini RevenueCat introPrice'ından türet
  // (sabit metin yerine). Aylık 3 gün / yıllık 7 gün otomatik doğru gösterilir
  // ve App Store yanıltıcı deneme reddi riski ortadan kalkar.
  const selectedPkg = plan === 'yearly' ? annualPkg : monthlyPkg;
  const selectedPriceStr = plan === 'yearly' ? yearlyPriceStr : monthlyPriceStr;
  const selectedPer = plan === 'yearly' ? t('paywall.yearlyPer') : t('paywall.monthlyPer');
  const trialDays = introTrialDays(selectedPkg);
  const hasTrial = trialDays > 0;

  // Her plan kartı kendi deneme süresini göstersin (yıllık 7g / aylık 3g).
  const yearlyTrialDays  = introTrialDays(annualPkg);
  const monthlyTrialDays = introTrialDays(monthlyPkg);
  // Apple 3.1.2(c): the billed amount must be the most prominent price on the
  // card. The calculated per-month equivalent is informational only, so it
  // stays in this subordinate subtitle line — never in the large price slot.
  const yearlySub = yearlyTrialDays > 0
    ? t('paywall.trialBadge', { days: yearlyTrialDays })
    : t('paywall.perMonthEquivalent', { price: yearlyPerMoStr });
  const monthlySub = monthlyTrialDays > 0
    ? t('paywall.trialBadge', { days: monthlyTrialDays })
    : t('paywall.cancelNote');

  // Experiment (paywall-cta-copy): 'trial_forward' leads with the no-risk
  // framing in the CTA itself instead of relegating it to the trial note
  // below. Only applies when there IS a trial to frame — falls back to the
  // control copy otherwise so it never claims a trial that doesn't exist.
  const ctaLabel = hasTrial
    ? (ctaVariant === 'trial_forward'
        ? t('paywall.ctaTrialForward', { days: trialDays })
        : t('paywall.ctaTrialDays', { days: trialDays }))
    : t('paywall.cta');
  const trialNote = hasTrial
    ? t('paywall.trialNoteDays', { days: trialDays, price: selectedPriceStr, per: selectedPer })
    : t('paywall.noTrialNote', { price: selectedPriceStr, per: selectedPer });

  // Tasarruf çıpası: yıllık planın aylık×12'ye göre ne kadar ucuz olduğunu
  // gerçek mağaza fiyatlarından hesapla. İkisi de yüklüyse ve anlamlıysa göster.
  const savingsStr = (() => {
    if (!monthlyPkg || !annualPkg) return null;
    const yearAtMonthly = monthlyPkg.product.price * 12;
    const diff = yearAtMonthly - annualPkg.product.price;
    if (diff <= 0) return null;
    const pct = Math.round((diff / yearAtMonthly) * 100);
    return t('paywall.savings', {
      amount: fmtCurrency(diff, annualPkg.product.currencyCode),
      pct,
    });
  })();

  // ── Başarı ekranı (Premium'a Hoş Geldin) ────────────────────────────────────
  if (showSuccess) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.successWrap}>
          <View style={s.successSeal}>
            <View style={s.successCheckL} />
            <View style={s.successCheckR} />
          </View>

          <View style={s.eyebrowRow}>
            <View style={[s.eyebrowDot, { backgroundColor: palette.success }]} />
            <Text style={[s.eyebrow, { color: palette.success }]}>{t('paywall.successEyebrow')}</Text>
            <View style={[s.eyebrowDot, { backgroundColor: palette.success }]} />
          </View>

          <Text style={s.title}>{t('paywall.successTitle')}</Text>
          <Text style={[s.subtitle, s.successSub]}>{t('paywall.successSubtitle')}</Text>
        </View>

        <View style={[s.bottom, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={s.cta}
            activeOpacity={0.85}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.ctaText}>{t('paywall.successCta')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Close ────────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.closeBtn}
        onPress={() => { track('paywall_dismissed', { trigger, experiment_variant: ctaVariant }); navigation.goBack(); }}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={s.closeH} />
        <View style={s.closeV} />
      </TouchableOpacity>

      {/* ── Scrollable content (never overlaps the CTA on any screen size) ───── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────────────────── */}
        <View style={s.hero}>
          <View style={s.iconRing}>
            <WaxSeal type="answered" size={48} gid="paywallHeroSeal" shadow={false} />
          </View>

          <View style={s.eyebrowRow}>
            <View style={s.eyebrowDot} />
            <Text style={s.eyebrow}>{t('paywall.eyebrow')}</Text>
            <View style={s.eyebrowDot} />
          </View>

          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>

        {/* ── Benefits ─────────────────────────────────────────────────────────── */}
        <View style={s.benefits}>
          {benefits.map((b) => <CheckRow key={b} text={b} />)}
        </View>

        {/* ── Divider ──────────────────────────────────────────────────────────── */}
        <View style={s.divider} />

        {/* ── Savings anchor ───────────────────────────────────────────────────── */}
        {savingsStr ? <Text style={s.savings}>{savingsStr}</Text> : null}

        {/* ── Plan cards ───────────────────────────────────────────────────────── */}
        <View style={s.plans}>
          <PlanCard
            active={plan === 'yearly'}
            label={t('paywall.yearly')}
            price={yearlyPriceStr + t('paywall.yearlyPer')}
            sub={yearlySub}
            badge={t('paywall.yearlyBadge')}
            onPress={() => setPlan('yearly')}
          />
          <PlanCard
            active={plan === 'monthly'}
            label={t('paywall.monthly')}
            price={monthlyPriceStr + t('paywall.monthlyPer')}
            sub={monthlySub}
            onPress={() => setPlan('monthly')}
          />
        </View>
      </ScrollView>

      {/* ── Sticky CTA ───────────────────────────────────────────────────────── */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 8 }]}>
        <Animated.View style={[{ width: '100%' }, ctaStyle]}>
          <TouchableOpacity
            style={[s.cta, busy && s.ctaDisabled]}
            activeOpacity={0.85}
            onPress={handleUpgrade}
            disabled={busy}
          >
            {busy
              ? <ActivityIndicator color={palette.ink90} />
              : <Text style={s.ctaText}>{ctaLabel}</Text>}
          </TouchableOpacity>
        </Animated.View>

        <Text style={s.trialNote}>{trialNote}</Text>
        <Text style={s.legalNote}>{t('paywall.autoRenewNote')}</Text>

        <View style={s.footerRow}>
          <TouchableOpacity onPress={() => { track('paywall_dismissed', { trigger, experiment_variant: ctaVariant }); navigation.goBack(); }} activeOpacity={0.6} hitSlop={12} disabled={busy}>
            <Text style={s.dismiss}>{t('paywall.dismiss')}</Text>
          </TouchableOpacity>
          <Text style={s.footerSep}>·</Text>
          <TouchableOpacity onPress={handleRestore} activeOpacity={0.6} hitSlop={12} disabled={busy}>
            <Text style={s.dismiss}>{t('paywall.restore')}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.footerRow}>
          <TouchableOpacity onPress={() => Linking.openURL(LINKS.terms)} activeOpacity={0.6} hitSlop={12}>
            <Text style={s.dismiss}>{t('paywall.terms')}</Text>
          </TouchableOpacity>
          <Text style={s.footerSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(LINKS.privacy)} activeOpacity={0.6} hitSlop={12}>
            <Text style={s.dismiss}>{t('paywall.privacy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.ink90,
    paddingHorizontal: spacing.lg,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.xs, paddingBottom: spacing.sm },

  // ── Close ──────────────────────────────────────────────────────────────────
  closeBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.ink70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeH: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: palette.ink20,
    transform: [{ rotate: '45deg' }],
  },
  closeV: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: palette.ink20,
    transform: [{ rotate: '-45deg' }],
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.accent + '18',
    borderWidth: 1,
    borderColor: palette.accent + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eyebrowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.accent,
    opacity: 0.7,
  },
  eyebrow: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 2.5,
    color: palette.accent,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: palette.ink00,
    textAlign: 'center',
    lineHeight: 35,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    textAlign: 'center',
  },

  // ── Benefits ───────────────────────────────────────────────────────────────
  benefits: {
    gap: 10,
    paddingBottom: spacing.md,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.accent + '20',
    borderWidth: 1,
    borderColor: palette.accent + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkL: {
    position: 'absolute',
    width: 4,
    height: 1.5,
    backgroundColor: palette.accent,
    transform: [{ rotate: '45deg' }],
    left: 3,
    top: 9,
  },
  checkR: {
    position: 'absolute',
    width: 7,
    height: 1.5,
    backgroundColor: palette.accent,
    transform: [{ rotate: '-45deg' }],
    right: 2,
    top: 7,
  },
  checkText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink10,
    flex: 1,
  },

  divider: {
    height: 1,
    backgroundColor: palette.ink70,
    marginBottom: spacing.md,
  },

  // ── Plan cards ─────────────────────────────────────────────────────────────
  plans: {
    gap: spacing.sm,
    marginTop: spacing.sm, // room for the "BEST · 50% OFF" badge above the card
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.ink80,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.ink60,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  planCardActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accent + '0E',
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    left: 48,
    backgroundColor: palette.accent,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  planBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 8.5,
    color: palette.white,
    letterSpacing: 0.4,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: palette.ink40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: palette.accent,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  planCardBody: {
    flex: 1,
  },
  planLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.ink20,
  },
  planLabelActive: {
    color: palette.ink00,
  },
  planSub: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: palette.ink40,
    marginTop: 1,
  },
  planSubActive: {
    color: palette.ink40,
  },
  planPrice: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    color: palette.ink40,
  },
  planPriceActive: {
    color: palette.accent,
  },

  // ── Bottom CTA ─────────────────────────────────────────────────────────────
  bottom: {
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...shadow.md,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: palette.white,
    letterSpacing: 0.3,
  },
  trialNote: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: palette.ink40,
    textAlign: 'center',
    marginBottom: 6,
  },
  savings: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: palette.success,
    textAlign: 'center',
    marginBottom: 8,
  },
  legalNote: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    lineHeight: 14,
    color: palette.ink40,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footerSep: {
    color: palette.ink40,
    fontSize: fontSize.sm,
  },
  dismiss: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.ink40,
    paddingVertical: 8,
  },

  // ── Success screen ───────────────────────────────────────────────────────────
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  successSeal: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.success + '1A',
    borderWidth: 2,
    borderColor: palette.success + '66',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successCheckL: {
    position: 'absolute',
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.success,
    transform: [{ rotate: '45deg' }],
    left: 32,
    top: 52,
  },
  successCheckR: {
    position: 'absolute',
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.success,
    transform: [{ rotate: '-45deg' }],
    right: 26,
    top: 46,
  },
  successSub: {
    marginTop: 4,
    paddingHorizontal: spacing.md,
  },
});
