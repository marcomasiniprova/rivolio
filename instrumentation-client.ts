import * as Sentry from "@sentry/nextjs";
import { DSN_SENTRY } from "@/lib/sentry-dsn";

/**
 * SENTRY LATO BROWSER (audit 26/08). Cattura gli errori che esplodono nella
 * pagina, dal telefono o dal computer di chi usa il sito.
 *
 * ⚠️ Perché nel browser serve la modifica alla CSP (next.config.ts): il muro
 * di sicurezza lascia parlare il browser solo con Supabase; senza aggiungere
 * sentry.io, questo pezzo sarebbe muto.
 *
 * Tenuto al minimo come il server, per restare nel gratis:
 * - solo errori, niente tracciamento prestazioni (`tracesSampleRate: 0`);
 * - niente registrazione delle sessioni (`replays...: 0`): mangia la quota;
 * - niente dati personali;
 * - acceso solo in produzione.
 *
 * Nota: `onRouterTransitionStart` (che segnala i cambi di pagina) NON si
 * esporta qui: serve solo col tracciamento, che è spento. In più in questa
 * versione dell'SDK non è nemmeno disponibile, quindi aggiungerlo sarebbe un
 * errore. Per gli errori non serve.
 */
Sentry.init({
  dsn: DSN_SENTRY,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  debug: false,
});
