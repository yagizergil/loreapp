/**
 * authEvents — lightweight singleton for cross-component auth signals.
 * Navigation listens; Profile/other screens trigger.
 */
import type { LocalProfile } from './storage';

export const authEvents = {
  onSignOut: () => {},
  /** Anonymous → real account: opens onboarding in "upgrade" mode, keeping the
   *  current profile (and its premium) until sign-in succeeds. */
  onUpgradeAccount: (_current: LocalProfile) => {},
};
