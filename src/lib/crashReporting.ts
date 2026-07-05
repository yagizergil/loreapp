/**
 * Sentry wrapper. Thin layer so the rest of the app never imports the SDK
 * directly (mirrors analytics.ts/purchases.ts).
 *
 * Configuration is read from app.json → extra.sentryDsn (a public DSN —
 * safe to embed in the client bundle, it can only submit events, not read
 * project data). No-ops safely when the DSN is missing/placeholder.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN: string | undefined = (Constants.expoConfig?.extra as any)?.sentryDsn;

function isConfigured(): boolean {
  return !!DSN && !DSN.startsWith('REPLACE_');
}

/** Initialize the SDK once, as early as possible (before the app renders). */
export function initCrashReporting(): void {
  if (!isConfigured()) return;
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enabled: !__DEV__, // avoid noisy dev-only errors polluting the project
  });
}

/** Report a caught error with optional extra context. */
export function captureError(error: unknown, extra?: Record<string, unknown>): void {
  if (!isConfigured()) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}

export { ErrorBoundary } from '@sentry/react-native';
