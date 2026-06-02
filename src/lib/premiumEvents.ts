export type PaywallTrigger = 'geo' | 'limit' | 'region';

// Trigger to open paywall from anywhere (e.g. QuestionSheet, Answers screen)
export const paywallEvents = { show: (_trigger?: PaywallTrigger) => {} };
