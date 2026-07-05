/**
 * Karma tiers: a title/badge derived from total upvotes received across a
 * user's answers (see fetchUserStats). The raw karma NUMBER is visible to
 * everyone — the tier BADGE (name + color) is a premium-only status marker,
 * an earned-not-artificial upgrade reason (Yik Yak/Jodel-style local
 * reputation, adapted for a hyperlocal Q&A product).
 */

export interface KarmaTier {
  key: string;
  label: string;
  minKarma: number;
  color: string;
}

// Ordered ascending by threshold; pick the last one the user's karma clears.
export const KARMA_TIERS: KarmaTier[] = [
  { key: 'newcomer', label: 'karma.tierNewcomer', minKarma: 0,   color: '#5A6278' },
  { key: 'regular',  label: 'karma.tierRegular',  minKarma: 10,  color: '#4A9E6E' },
  { key: 'trusted',  label: 'karma.tierTrusted',  minKarma: 50,  color: '#4A7FC0' },
  { key: 'topVoice', label: 'karma.tierTopVoice', minKarma: 150, color: '#D4603A' },
];

export function getKarmaTier(karma: number): KarmaTier {
  let tier = KARMA_TIERS[0];
  for (const t of KARMA_TIERS) {
    if (karma >= t.minKarma) tier = t;
  }
  return tier;
}
