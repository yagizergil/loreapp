// Fires a brief "🎉 lucky answer" toast from anywhere (QuestionSheet,
// Answers screen) after maybe_grant_surprise_karma grants a bonus — same
// wiring pattern as premiumEvents.ts, real implementation attached by a
// host component mounted near the navigation root.
export const surpriseKarmaEvents = {
  show: (_amount: number) => {},
};
