/**
 * Typed accessors for PostHog feature-flag-backed A/B experiments. Keep one
 * function per experiment so call sites never touch raw flag keys/strings.
 *
 * Flag configuration (which variants exist, rollout %) is done in the
 * PostHog dashboard, not in code — this file only defines the fallback
 * ("control") behavior when analytics isn't configured or the flag hasn't
 * loaded yet.
 */

import { getFeatureFlag } from './analytics';

export type PaywallCtaVariant = 'control' | 'trial_forward';

const PAYWALL_CTA_FLAG = 'paywall-cta-copy';

/**
 * Experiment: does leading with trial-and-cancel-anytime framing in the CTA
 * button itself (vs. the current copy, which puts that reassurance in the
 * smaller trial note below the button) lift trial-start rate?
 */
export function getPaywallCtaVariant(): PaywallCtaVariant {
  const value = getFeatureFlag(PAYWALL_CTA_FLAG);
  return value === 'trial_forward' ? 'trial_forward' : 'control';
}
