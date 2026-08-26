import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/* ── Header di sicurezza, su ogni risposta ───────────────────────────────
   Mancavano del tutto (nessun _headers, nessun middleware): la repo era
   nuda. Qui si mette il vestito antiproiettile di base, quello che vale
   per QUALSIASI sito e non costa nulla:

   - Content-Security-Policy: da dove può arrivare il codice. Blocca lo
     script iniettato da un dominio esterno, il tag <base> ostile, gli
     <object>/<embed>. Gli inline restano ammessi (Next inietta i suoi
     senza nonce): la rete vera contro l'iniezione è che nessun dato
     dell'utente finisce dentro uno <script> (controllato: l'unico punto,
     auth/conferma, ora filtra il valore alla radice).
   - frame-ancestors 'self' + X-Frame-Options SAMEORIGIN: nessun sito
     estraneo può incorniciare le nostre pagine per il clickjacking
     (login compreso). Same-origin sì, così l'anteprima dell'app che si
     incornicia da sola continua a funzionare.
   - Referrer-Policy: non regaliamo l'indirizzo pieno ai siti esterni.
   - Permissions-Policy: spegniamo fotocamera, microfono e posizione, che
     il sito web non usa (la foto della carta è un semplice campo file).
   - nosniff: il browser non "indovina" il tipo di un file.
   - HSTS: dopo la prima visita, solo https.

   'unsafe-eval' serve SOLO al server di sviluppo (React Fast Refresh usa
   eval); in produzione sparisce, così la regola è più stretta dove conta.
   Niente 'upgrade-insecure-requests': in locale gira su http e lo
   romperebbe; in produzione è tutto già https. */
const inSviluppo = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${inSviluppo ? " 'unsafe-eval'" : ""}`,
  /* ⚠️ sentry.io serve a Sentry per mandare gli errori dal browser (audit
     26/08): senza, la CSP lo bloccherebbe in silenzio e non arriverebbe
     niente. Copre tutte le regioni (us/de), incluso l'ingest de.sentry.io. */
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io",
  "frame-src 'self'",
]
  .join("; ")
  .concat(";");

const HEADER_SICUREZZA = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: HEADER_SICUREZZA },
      /* Il programma dell'app e i suoi caratteri hanno l'impronta del
         contenuto nel nome del file: se cambia il contenuto cambia il
         nome. Quindi si possono tenere in memoria per sempre, e la
         lavagna smette di riscaricare 2,3 MB per ognuno dei trentatré
         riquadri (in prova erano 75 MB per aprire una pagina). */
      {
        source: "/app-anteprima/_expo/:percorso*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/app-anteprima/assets/:percorso*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  /* L'anteprima dell'app (build web di Expo in /public/app-anteprima) va
     servita su un indirizzo PULITO, senza /index.html in coda: il router
     dell'app legge l'indirizzo del browser e con /index.html appeso non
     riconosce la rotta ("Unmatched Route").

     La lavagna NON usa indirizzi tipo /app-anteprima/verdetto: l'export
     di Expo è una pagina sola, quel file non esiste e su Netlify
     rispondeva 404 (tutti i riquadri neri, 10/08). La rotta viaggia come
     parametro su questo stesso indirizzo: /app-anteprima?r=/verdetto. */
  async rewrites() {
    return [{ source: "/app-anteprima", destination: "/app-anteprima/index.html" }];
  },
};

/* SENTRY (audit 26/08). `withSentryConfig` aggancia Sentry al build.
   - org/project: il progetto rivolio-error-handling nella regione Germania
     (sentryUrl de.sentry.io), da cui viene il DSN.
   - authToken: le mappe del codice (stack trace leggibili nel browser) si
     caricano SOLO se questo segreto è presente su Netlify. Se manca, il build
     NON fallisce: si salta il caricamento, gli errori arrivano lo stesso, solo
     con le righe del browser compresse. È un di più, non un requisito.
   Senza token, `withSentryConfig` fa solo l'aggancio a runtime, che è tutto
   ciò che serve perché gli errori arrivino. */
export default withSentryConfig(nextConfig, {
  org: "rivolio",
  project: "rivolio-error-handling",
  sentryUrl: "https://de.sentry.io",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: false,
});
