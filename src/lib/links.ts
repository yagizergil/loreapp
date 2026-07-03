/**
 * Centralised external URLs used across the app (App Store, legal pages,
 * subscription management, contact). Keep these in one place so a change to
 * the hosting / App Store id only needs editing here.
 */

const PAGES_BASE = 'https://yagizergil.github.io/loreapp/legal';

// App Store id (Apple ID from App Store Connect).
const APP_STORE_ID = '6775550586';

export const LINKS = {
  privacy:        `${PAGES_BASE}/privacy.html`,
  terms:          `${PAGES_BASE}/terms.html`,
  privacyChoices: `${PAGES_BASE}/privacy-choices.html`,
  support:        `${PAGES_BASE}/`,

  contactEmail:   'etkinlikyweb@gmail.com',

  /** Native subscriptions management screen. */
  manageSubscriptions: 'itms-apps://apps.apple.com/account/subscriptions',

  /** App Store "write a review" deep-link. Falls back to a search when the id
   *  is not yet known (pre-launch). */
  rate: APP_STORE_ID
    ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
    : 'itms-apps://apps.apple.com/app/lore',

  /** Plain App Store listing — used in share sheets. https:// (not itms-apps://)
   *  so it renders as a normal tappable link in Messages/WhatsApp/etc. There is
   *  no in-app deep-link scheme configured yet, so shares link to the store
   *  listing rather than back into a specific question. */
  appStoreListing: APP_STORE_ID
    ? `https://apps.apple.com/app/id${APP_STORE_ID}`
    : 'https://apps.apple.com/app/lore',
} as const;
