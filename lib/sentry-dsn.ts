/**
 * IL DSN DI SENTRY: l'indirizzo dove il sito manda gli errori.
 *
 * ⚠️ NON è un segreto, e per questo può stare nel repo. Un DSN finisce nel
 * browser di OGNI visitatore per costruzione: lo fa qualunque sito che usa
 * Sentry. Non dà accesso a niente, serve solo a spedire un errore al progetto
 * giusto. (Il segreto vero, quello sì da tenere fuori dal repo, è l'auth token
 * del build per le mappe del codice: quello vive solo su Netlify.)
 *
 * Da variabile d'ambiente se un domani serve cambiarlo senza toccare il
 * codice; altrimenti vale questo, che è il DSN del progetto
 * rivolio/rivolio-error-handling (regione Germania).
 */
export const DSN_SENTRY =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://c9f0706171b0e5c6b852d0120d33bc1b@o4511978601906176.ingest.de.sentry.io/4511978677796944";
