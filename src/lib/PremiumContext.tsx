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
import { fetchIsPremium, setProfilePremium } from './supabase';

interface PremiumContextValue {
  isPremium: boolean;
  ready: boolean;                       // RevenueCat finished its first check
  offering: PurchasesOffering | null;
  refreshOffering: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<{ ok: boolean; cancelled: boolean; isPremium: boolean; message?: string }>;
  restore: () => Promise<{ ok: boolean; cancelled: boolean; isPremium: boolean; message?: string }>;
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

    // 2) RevenueCat is authoritative.
    (async () => {
      await configurePurchases(profileId);

      // If the SDK couldn't configure (missing key / non-iOS), fall back to DB.
      if (!isPurchasesConfigured()) {
        if (alive) setReady(true);
        return;
      }

      const info = await getCustomerInfo();
      if (alive) {
        mirror(isPremiumFromInfo(info));
        setReady(true);
      }

      getCurrentOffering().then((o) => { if (alive) setOffering(o); });
    })();

    // 3) Live updates (renewals, restores from other contexts, expiry).
    const unsub = addCustomerInfoListener((info: CustomerInfo) => {
      if (alive) mirror(isPremiumFromInfo(info));
    });

    return () => { alive = false; unsub(); };
  }, [profileId, mirror]);

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

  const value = useMemo<PremiumContextValue>(() => ({
    isPremium, ready, offering, refreshOffering, purchase, restore,
  }), [isPremium, ready, offering, refreshOffering, purchase, restore]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}
