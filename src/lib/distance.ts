const R = 6371; // Earth radius km

export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Free users see/open questions within this radius (km). */
export const FREE_RADIUS_KM = 1;

/** Premium users see/open questions within this radius (km). Also the radius
 *  fetched for everyone — free users see 1–4 km questions as locked teasers. */
export const PREMIUM_RADIUS_KM = 4;

/** Hard cap on questions fetched/loaded around the user (performance). */
export const MAX_NEARBY_QUESTIONS = 60;

/** If fewer than this many questions are within PREMIUM_RADIUS_KM, the server
 *  expands the search radius to backfill (sparse areas). */
export const MIN_NEARBY_QUESTIONS = 10;
