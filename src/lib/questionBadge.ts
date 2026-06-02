const HOUR = 60 * 60 * 1000;

export type QuestionBadge = 'hot' | 'popular' | 'new' | null;

/**
 * Derives a single display badge for a question.
 *
 * Priority: hot > popular > new > null
 *   hot      — posted < 6 h ago AND already has ≥ 3 answers (gaining fast)
 *   popular  — ≥ 10 answers total
 *   new      — posted < 24 h ago (and not hot)
 */
export function getQuestionBadge(q: {
  answer_count: number;
  created_at: string;
}): QuestionBadge {
  const age = Date.now() - new Date(q.created_at).getTime();
  if (age < 6 * HOUR && q.answer_count >= 3) return 'hot';
  if (q.answer_count >= 10) return 'popular';
  if (age < 24 * HOUR) return 'new';
  return null;
}

export const BADGE_META: Record<
  NonNullable<QuestionBadge>,
  { label: string; color: string; bg: string }
> = {
  hot:     { label: 'Sıcak',   color: '#E8603A', bg: '#E8603A22' },
  popular: { label: 'Popüler', color: '#C8971A', bg: '#C8971A22' },
  new:     { label: 'Yeni',    color: '#4A9E6E', bg: '#4A9E6E22' },
};

/** Badge priority for sorting (higher = shown first). */
export function badgePriority(badge: QuestionBadge): number {
  if (badge === 'hot') return 3;
  if (badge === 'popular') return 2;
  if (badge === 'new') return 1;
  return 0;
}
