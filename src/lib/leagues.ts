/**
 * Duolingo-style leagues: the leaderboard is split into small, winnable
 * groups of LEAGUE_SIZE instead of one flat citywide ranking. A flat global
 * leaderboard demotivates everyone outside the top handful — Duolingo's
 * tiered leagues are the documented fix (cited ~14-40% engagement lift),
 * and this app already has all the ranked data needed; no new schema or
 * weekly cron/promotion job required — the league is just a stateless
 * grouping of the existing rank-ordered city_leaderboard rows.
 */

export interface LeagueTier {
  key: string;
  label: string; // i18n key
  color: string;
}

const NAMED_TIERS: LeagueTier[] = [
  { key: 'diamond', label: 'league.diamond', color: '#7FD9E8' },
  { key: 'gold',    label: 'league.gold',    color: '#D4A64A' },
  { key: 'silver',  label: 'league.silver',  color: '#B9C0CC' },
  { key: 'bronze',  label: 'league.bronze',  color: '#C08A5A' },
];

export const LEAGUE_SIZE = 10;

/** Zero-based league index for a given 1-based rank. */
export function leagueIndexForRank(rank: number): number {
  return Math.floor((rank - 1) / LEAGUE_SIZE);
}

export function getLeagueTier(leagueIndex: number): LeagueTier {
  if (leagueIndex < NAMED_TIERS.length) return NAMED_TIERS[leagueIndex];
  return { key: `group${leagueIndex}`, label: 'league.group', color: '#5A6278' };
}
