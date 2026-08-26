import * as Sentry from "@sentry/nextjs";
import { DSN_SENTRY } from "@/lib/sentry-dsn";

/**
 * SENTRY LATO SERVER (audit 26/08). Cattura gli errori che esplodono sul
 * server: rotte API, server component, server action, il webhook di Stripe.
 *
 * Tenuto al MINIMO per restare nel piano gratis (5.000 errori al mese):
 * - solo ERRORI, niente tracciamento delle prestazioni (`tracesSampleRate: 0`);
 * - niente dati personali (`sendDefaultPii: false`);
 * - acceso SOLO in produzione: in sviluppo non spediamo niente, così non si
 *   brucia la quota con gli errori di quando si lavora.
 */
Sentry.init({
  dsn: DSN_SENTRY,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  sendDefaultPii: false,
  debug: false,
});
