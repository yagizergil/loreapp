/**
 * Single source of truth for premium status across the app.
 *
 * Flow:
 *  • On mount, configure RevenueCat with the Supabase profile id.
 *  • Read the entitlement from RevenueCat (authoritative on-device).
 *  • Subscribe to live entitlement changes (purchase / renewal / expiry).
 *  • Mirror the result onto profiles.is_premium so the server and other
 *    devices stay in sync. (A RevenueCat → Supabase webhook is the robust
 *    server-side path; this mirror is a best-effort client fallback.)
 *
 * While RevenueCat is initialising, we optimistically seed from the persisted
 * profiles.is_premium so a returning premium user never sees a locked UI flash.
 */

import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  configurePurchases, getCustomerInfo, getCurrentOffering, isPremiumFromInfo,
  addCustomerInfoListener, purchasePackage, restorePurchases,
  isPurchasesConfigured,
} from './purchases';
import { fetchIsPremium, setProfilePremium, fetchReferralPremiumUntil } from './supabase';

interface PremiumContextValue {
  isPremium: boolean;
  ready: boolean;                       // RevenueCat finished its first check
  offering: PurchasesOffering | null;
  refreshOffering: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<{ ok: boolean; cancelled: boolean; isPremium: boolean; message?: string }>;
  restore: () => Promise<{ ok: boolean; cancelled: boolean; isPremium: boolean; message?: string }>;
  /** Re-reads the referral reward window from Supabase. The reward is
   *  granted on a DIFFERENT device (whoever redeems the referrer's code),
   *  so nothing pushes this update to the referrer's open app — call this
   *  after any moment the user might plausibly have just crossed a reward
   *  threshold (e.g. opening the Invite screen). Also polled periodically
   *  below so it's never wrong for more than a few minutes either way. */
  refreshReferralPremium: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({
  profileId,
  children,
}: {
  profileId: string;
  children: React.ReactNode;
}) {
  const [isPremium, setIsPremium] = useState(false);
  const [ready, setReady] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  // Reward window from referrals (see referrals.sql) — additive to the
  // RevenueCat/mirror state above, never overwritten by it.
  const [referralPremiumUntil, setReferralPremiumUntil] = useState<number | null>(null);

  // Avoid redundant Supabase writes — only mirror when the value flips.
  const lastMirrored = useRef<boolean | null>(null);

  const mirror = useCallback((premium: boolean) => {
    setIsPremium(premium);
    if (lastMirrored.current === premium) return;
    lastMirrored.current = premium;
    setProfilePremium(profileId, premium).catch(() => {});
  }, [profileId]);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    // 1) Optimistic seed from persisted DB flag (no UI flash for returning users).
    fetchIsPremium(profileId)
      .then((db) => { if (alive && db) setIsPremium(true); })
      .catch(() => {});

    // 1b) Referral reward window, independent of RevenueCat/mirror state.
    // Polled (not just fetched once) because the reward is granted by a
    // REDEMPTION ON SOMEONE ELSE'S DEVICE — this app has no push/realtime
    // signal for "you just crossed 5 invites", so we re-check periodically
    // rather than leaving the referrer stuck on stale state until their
    // next cold start.
    const loadReferralPremium = () => {
      fetchReferralPremiumUntil(profileId)
        .then((iso) => { if (alive) setReferralPremiumUntil(iso ? new Date(iso).getTime() : null); })
        .catch(() => {});
    };
    loadReferralPremium();
    const referralPollInterval = setInterval(loadReferralPremium, 3 * 60 * 1000);

    // 2) RevenueCat is authoritative.
    (async () => {
      await configurePurchases(profileId);

      // If the SDK couldn't configure (missing key / non-iOS), fall back to DB.
      if (!isPurchasesConfigured()) {
        if (alive) setReady(true);
        return;
      }

      try {
        const info = await getCustomerInfo();
        if (alive) mirror(isPremiumFromInfo(info));
      } catch {
        // RevenueCat fetch failed (network blip, RC outage) — this is NOT the
        // same as "confirmed not premium". Leave the DB-optimistic seed (step 1)
        // standing rather than mirroring `false` and persisting a wrong
        // downgrade for a paying subscriber.
      }
      if (alive) setReady(true);

      getCurrentOffering().then((o) => { if (alive) setOffering(o); });
    })();

    // 3) Live updates (renewals, restores from other contexts, expiry).
    const unsub = addCustomerInfoListener((info: CustomerInfo) => {
      if (alive) mirror(isPremiumFromInfo(info));
    });

    return () => { alive = false; unsub(); clearInterval(referralPollInterval); };
  }, [profileId, mirror]);

  const refreshReferralPremium = useCallback(async () => {
    const iso = await fetchReferralPremiumUntil(profileId).catch(() => null);
    setReferralPremiumUntil(iso ? new Date(iso).getTime() : null);
  }, [profileId]);

  const refreshOffering = useCallback(async () => {
    const o = await getCurrentOffering();
    setOffering(o);
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const res = await purchasePackage(pkg);
    if (res.ok) mirror(res.isPremium);
    return {
      ok: res.ok,
      cancelled: res.ok ? false : res.cancelled,
      isPremium: res.ok ? res.isPremium : false,
      message: res.ok ? undefined : res.message,
    };
  }, [mirror]);

  const restore = useCallback(async () => {
    const res = await restorePurchases();
    if (res.ok) mirror(res.isPremium);
    return {
      ok: res.ok,
      cancelled: false,
      isPremium: res.ok ? res.isPremium : false,
      message: res.ok ? undefined : res.message,
    };
  }, [mirror]);

  // Referral-granted premium is a time window, not a static flag, so it's
  // re-evaluated against Date.now() on every render rather than cached in
  // state as a boolean (which would go stale once the window expires while
  // the app stays open).
  const hasReferralPremium = !!referralPremiumUntil && referralPremiumUntil > Date.now();
  const effectiveIsPremium = isPremium || hasReferralPremium;

  const value = useMemo<PremiumContextValue>(() => ({
    isPremium: effectiveIsPremium, ready, offering, refreshOffering, purchase, restore, refreshReferralPremium,
  }), [effectiveIsPremium, ready, offering, refreshOffering, purchase, restore, refreshReferralPremium]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}
