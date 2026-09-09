/**
 * Real, live App Store rating for paywall social proof — never a fabricated
 * number. Lore has very few reviews right now, so this is intentionally
 * gated behind a minimum rating count (RATING_COUNT_FLOOR): showing "★ 5.0
 * (1 rating)" would read as thin/fake and could misrepresent an app this
 * early, which is the same trust risk flagged in the density-badge design
 * (never invent a number to look more popular than the app actually is).
 * Once real ratings accumulate past the floor, this activates on its own —
 * no code change needed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_STORE_ID = '6775550586';
const CACHE_KEY = '@lore/appstore_rating_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RATING_COUNT_FLOOR = 20;

export interface AppStoreRating {
  average: number;
  count: number;
}

interface Cache {
  data: AppStoreRating | null;
  fetchedAt: number;
}

/** Returns null below RATING_COUNT_FLOOR or on any fetch failure — callers
 *  should simply omit the social-proof line in that case, not show a
 *  fallback number. */
export async function fetchAppStoreRatingForSocialProof(): Promise<AppStoreRating | null> {
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as Cache;
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.data && cached.data.count >= RATING_COUNT_FLOOR ? cached.data : null;
      }
    }

    const res = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}`);
    const json = await res.json();
    const entry = json?.results?.[0];
    const data: AppStoreRating | null = entry
      ? { average: entry.averageUserRating ?? 0, count: entry.userRatingCount ?? 0 }
      : null;

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() } as Cache));
    return data && data.count >= RATING_COUNT_FLOOR ? data : null;
  } catch {
    return null;
  }
}
