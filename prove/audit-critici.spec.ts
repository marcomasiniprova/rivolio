import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * I SEI CRITICI DELL'AUDIT NON DEVONO RIAPRIRSI (26/08).
 *
 * Ognuno di questi buchi si riapre togliendo una riga. Queste prove leggono
 * il codice e bocciano la suite se il fix sparisce: è il modo del progetto
 * di dire «vietato per sempre».
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");
/* I commenti citano apposta il vecchio codice sbagliato per spiegarlo: si
   guarda il codice VERO, senza commenti. */
const senzaCommenti = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

test.describe("I critici dell'audit restano chiusi", () => {
  test("open redirect: /auth/sessione usa il percorso RIPULITO, non il grezzo", () => {
    const c = senzaCommenti(leggi("app/auth/sessione/route.ts"));
    expect(c, "deve usare il valore ripulito").toContain("const poi = percorsoInterno(grezzo)");
    // il vecchio ternario buttava la ripulitura: non deve tornare
    expect(c).not.toContain("percorsoInterno(grezzo) ? grezzo");
  });

  test("mail bombing: iscriviti e verifica/email hanno il freno per IP", () => {
    for (const f of ["app/api/iscriviti/route.ts", "app/api/verifica/email/route.ts"]) {
      expect(leggi(f), `${f} deve avere il freno`).toContain("oltreIlLimite(");
    }
  });

  test("webhook concorrenti: l'evasione si ferma se la corsa è persa", () => {
    const c = leggi("lib/pratiche/evasione.ts");
    expect(c).toContain("creata.giaEsisteva");
  });

  test("cron follow-up: fallisce CHIUSO, non aperto", () => {
    // La memoria degli eventi torna null su errore (non un insieme vuoto)...
    const lib = leggi("lib/pratiche/pratiche.ts");
    expect(lib).toContain("Promise<Set<string> | null>");
    // ...e il giro si annulla quando è null, invece di rimandare tutto.
    const rotta = leggi("app/api/motore/segui/route.ts");
    expect(rotta).toContain("fatti === null");
  });

  test("commissioni creator: la lettura pagina, non tronca a 1000", () => {
    const c = leggi("lib/affiliati/lettura.ts");
    expect(c).toContain("tutteLeCommissioni");
    expect(c).toContain(".range(");
  });

  test("escalation admin: la migrazione della colonna ruolo esiste nel repo", () => {
    const c = leggi("supabase/2026-08-26-profili-colonne-sicure.sql");
    expect(c).toContain("revoke update on public.profili from authenticated");
    // il permesso si ridà SOLO sulle colonne sicure, ruolo NON è fra queste
    const grant = c.slice(c.indexOf("grant update ("));
    expect(grant).toContain("nickname");
    expect(grant.slice(0, grant.indexOf(")"))).not.toContain("ruolo");
  });
});

test.describe("Gli importanti dell'audit restano chiusi", () => {
  test("muro del check: il cancello è atomico (riserva prima dell'analisi)", () => {
    const c = leggi("app/api/verifica/route.ts");
    expect(c).toContain("riservaCheckAtomica");
    expect(c).toContain("rilasciaCheck");
  });

  test("la seconda fonte non congela un primario già certo", () => {
    const c = senzaCommenti(leggi("lib/voli/incrocio.ts"));
    // lo short-circuit del primario verificato viene PRIMA del ramo discordanti
    const primario = c.indexOf("orarioVerificato === true");
    const discordanti = c.indexOf("discordanti: true");
    expect(primario).toBeGreaterThan(0);
    expect(primario).toBeLessThan(discordanti);
  });

  test("il riepilogo serale copre anche l'inverno (19 e 20 UTC)", () => {
    const c = leggi("netlify/functions/riepilogo.mjs");
    expect(c).toContain('schedule: "0 19,20 * * *"');
  });

  test("i numeri del pannello si contano dal database", () => {
    const c = leggi("lib/eventi/lettura.ts");
    expect(c).toContain("cruscotto_numeri");
    expect(c).toContain("serie_giorni");
  });

  test("il check pagato ha la rete di sicurezza via email", () => {
    const c = leggi("app/api/stripe/webhook/route.ts");
    expect(c).toContain("analisiPagataPronta");
  });

  test("webhook Stripe: dedup sull'id evento (prendi/rilascia)", () => {
    const c = senzaCommenti(leggi("app/api/stripe/webhook/route.ts"));
    expect(c).toContain("webhook_eventi_stripe");
    expect(c).toContain("prendiEvento");
    // si prende l'evento PRIMA di evadere, e si rilascia se fallisce (5xx)
    expect(c).toContain("rilasciaEvento");
    // la migrazione della tabella dedup è nel repo
    const sql = leggi("supabase/2026-08-26-webhook-dedup.sql");
    expect(sql).toContain("webhook_eventi_stripe");
    expect(sql).toContain("pratiche_ordine_pagamento_unico");
  });

  test("checkout Stripe: chiave di idempotenza in uscita", () => {
    const c = senzaCommenti(leggi("lib/stripe.ts"));
    expect(c).toContain("idempotencyKey");
  });

  test("la pulizia sfoltisce il registro dedup dei webhook", () => {
    const c = leggi("app/api/motore/pulizia/route.ts");
    expect(c).toContain("webhook_eventi_stripe");
  });

  test("modo sicuro: ferma email e replica AI, non la cassa", () => {
    // il freno esiste
    const lib = leggi("lib/motore/modo-sicuro.ts");
    expect(lib).toContain("modoSicuroAttivo");
    // ...ed è cablato nei tre automatismi giusti
    expect(senzaCommenti(leggi("app/api/motore/segui/route.ts"))).toContain("modoSicuroAttivo");
    expect(senzaCommenti(leggi("lib/recupero/esegui.ts"))).toContain("modoSicuroAttivo");
    expect(senzaCommenti(leggi("lib/ai/replica.ts"))).toContain("modoSicuroAttivo");
    // NON deve toccare la cassa: il webhook di Stripe non lo conosce
    expect(leggi("app/api/stripe/webhook/route.ts")).not.toContain("modoSicuroAttivo");
    // la migrazione della tabella è nel repo
    expect(leggi("supabase/2026-08-26-modo-sicuro.sql")).toContain("impostazioni");
  });

  test("Sentry: agganciato al server e non murato nel browser dalla CSP", () => {
    // l'aggancio server c'è
    expect(leggi("instrumentation.ts")).toContain("onRequestError");
    // ...e la CSP lascia parlare il browser con Sentry, se no è muto in silenzio
    expect(leggi("next.config.ts")).toContain("https://*.sentry.io");
    // il global-error manda l'errore a Sentry
    expect(leggi("app/global-error.tsx")).toContain("Sentry.captureException");
  });
});
