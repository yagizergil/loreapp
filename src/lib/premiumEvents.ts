export type PaywallTrigger = 'geo' | 'limit' | 'region' | 'welcome' | 'leaderboard';

export interface PaywallOpts {
  /** Number of locked / nearby questions, used for scarcity copy. */
  count?: number;
}

// Trigger to open paywall from anywhere (e.g. QuestionSheet, Answers screen)
export const paywallEvents = {
  show: (_trigger?: PaywallTrigger, _opts?: PaywallOpts) => {},
};
