/**
 * PostHog wrapper. Thin, typed layer over posthog-react-native so the rest of
 * the app never imports the SDK directly (mirrors purchases.ts).
 *
 * Configuration is read from app.json → extra.posthogApiKey (a public
 * write-only "phc_…" project key — safe to embed in the client bundle).
 * No-ops safely when the key is missing so analytics is optional at any time.
 */

import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

const API_KEY: string | undefined =
  (Constants.expoConfig?.extra as any)?.posthogApiKey;
const HOST: string =
  (Constants.expoConfig?.extra as any)?.posthogHost ?? 'https://us.i.posthog.com';

export type AnalyticsEvent =
  | 'app_opened'
  | 'paywall_shown'
  | 'paywall_dismissed'
  | 'purchase_started'
  | 'purchase_succeeded'
  | 'purchase_failed'
  | 'purchase_restored'
  | 'question_posted'
  | 'answer_submitted'
  | 'answer_blocked_limit'
  | 'locked_pin_tapped'
  | 'empty_map_shown'
  | 'empty_map_ask_tapped'
  | 'review_prompt_shown'
  | 'share_result';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

let client: PostHog | null = null;

function isConfigured(): boolean {
  return !!API_KEY && !API_KEY.startsWith('REPLACE_');
}

/** Initialize the SDK once. Safe no-op if no key is configured. */
export function initAnalytics(): void {
  if (client || !isConfigured()) return;
  client = new PostHog(API_KEY!, { host: HOST });
}

/** Tie subsequent events to a stable profile id. */
export function identifyAnalytics(profileId: string): void {
  client?.identify(profileId);
  // Re-evaluate feature flags against the resolved identity (not the prior
  // anonymous one) so any A/B assignment read afterward (e.g. the paywall
  // experiment variant) reflects the real user, not a throwaway anon id.
  client?.reloadFeatureFlags();
}

/** Read a feature flag value from the SDK's already-loaded local cache
 *  (synchronous, no network wait). Returns `undefined` if analytics isn't
 *  configured or the flag hasn't resolved yet — callers must supply a
 *  sensible default/control fallback. */
export function getFeatureFlag(key: string): boolean | string | undefined {
  return client?.getFeatureFlag(key);
}

/** Clear identity on sign-out so events after this point aren't misattributed. */
export function resetAnalytics(): void {
  client?.reset();
}

/** Record a typed product event. No-op if analytics isn't configured. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  client?.capture(event, props);
}

/** Record a screen view. */
export function trackScreen(name: string, props?: AnalyticsProps): void {
  client?.screen(name, props);
}
