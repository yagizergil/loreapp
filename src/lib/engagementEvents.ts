// Module-level event bridge: fires once a user takes their first meaningful
// in-app action (answers or posts a question) this session. Used to time the
// post-onboarding "welcome" paywall off a real engagement moment instead of a
// flat delay — evidence-based placement (paywall after value, not cold).
export const firstActionEvent = { notify: () => {} };
