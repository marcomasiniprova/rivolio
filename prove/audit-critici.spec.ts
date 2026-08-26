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
