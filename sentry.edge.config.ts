import * as Sentry from "@sentry/nextjs";
import { DSN_SENTRY } from "@/lib/sentry-dsn";

/**
 * SENTRY SUL RUNTIME "EDGE" (audit 26/08). Alcune parti di Next girano su un
 * motore più leggero (il middleware/proxy, certe rotte): questo file le
 * copre. Stessa regola del server: solo errori, niente dati personali, solo
 * in produzione.
 */
Sentry.init({
  dsn: DSN_SENTRY,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  sendDefaultPii: false,
  debug: false,
});
