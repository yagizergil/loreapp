/**
 * RevenueCat wrapper. Thin, typed layer over react-native-purchases so the rest
 * of the app never imports the SDK directly.
 *
 * Configuration is read from app.json → extra.revenueCatIosApiKey (the public
 * "appl_…" SDK key — safe to embed in the client bundle).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

// RevenueCat dashboard → Entitlements. Must match EXACTLY (note the space).
export const ENTITLEMENT_ID = 'com.yagizergilvokario.lore Pro';

const IOS_API_KEY: string | undefined =
  (Constants.expoConfig?.extra as any)?.revenueCatIosApiKey;

let configured = false;

export function isPurchasesConfigured(): boolean {
  return configured;
}

/** Configure the SDK once, tying the RC user to our Supabase profile id. */
export async function configurePurchases(appUserId: string): Promise<void> {
  if (configured) {
    // Already configured (e.g. profile switch) → just realign the user id.
    try { await Purchases.logIn(appUserId); } catch { /* noop */ }
    return;
  }
  if (Platform.OS !== 'ios') return; // Android key not set up yet.
  if (!IOS_API_KEY || IOS_API_KEY.startsWith('REPLACE_')) {
    console.warn('[purchases] RevenueCat iOS API key missing — skipping configure.');
    return;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: IOS_API_KEY, appUserID: appUserId });
  configured = true;
}

export function isPremiumFromInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;
  // 1) Preferred: the named entitlement is active.
  if (info.entitlements.active[ENTITLEMENT_ID] !== undefined) return true;
  // 2) Robust: ANY active entitlement counts. The app sells a single
  //    subscription, so any active entitlement means the user is Pro. This
  //    protects against an entitlement-identifier mismatch in the RC dashboard.
  if (Object.keys(info.entitlements.active ?? {}).length > 0) return true;
  // 3) Last-resort fallback: an active store subscription even when no
  //    entitlement is mapped in RevenueCat (a common dashboard misconfig that
  //    otherwise leaves a paying user "subscribed but not premium").
  if ((info.activeSubscriptions?.length ?? 0) > 0) return true;
  return false;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export type PurchaseResult =
  | { ok: true; isPremium: boolean }
  | { ok: false; cancelled: boolean; message?: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!configured) return { ok: false, cancelled: false, message: 'not_configured' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, isPremium: isPremiumFromInfo(customerInfo) };
  } catch (e: any) {
    return { ok: false, cancelled: !!e?.userCancelled, message: e?.message };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!configured) return { ok: false, cancelled: false, message: 'not_configured' };
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, isPremium: isPremiumFromInfo(info) };
  } catch (e: any) {
    return { ok: false, cancelled: false, message: e?.message };
  }
}

/** Subscribe to live entitlement changes. Returns an unsubscribe fn. */
export function addCustomerInfoListener(cb: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => Purchases.removeCustomerInfoUpdateListener(cb);
}
