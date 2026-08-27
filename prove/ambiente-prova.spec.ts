import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * LA SEPARAZIONE FRA IL SITO VERO E IL GEMELLO NON DEVE RIAPRIRSI (27/08).
 *
 * Il gemello (ramo `staging`) condivide il database col sito vero. Queste
 * prove leggono il codice e bocciano la suite se una delle quattro barriere
 * sparisce, o se qualcuno rende `AMBIENTE_PROVA` vero per default (il
 * disastro: la produzione servita in modalità prova).
 */
const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");
const senzaCommenti = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

test.describe("Il gemello non infetta il sito vero", () => {
  test("AMBIENTE_PROVA esiste e di default è la PRODUZIONE", () => {
    const c = senzaCommenti(leggi("lib/ambiente.ts"));
    expect(c).toContain("AMBIENTE_PROVA");
    // il default deve essere false (produzione): il ramo finale torna false
    expect(c).toMatch(/return false;\s*}\s*\/\*\*|return false;\s*}/);
    // il segnale esplicito "0" forza comunque la produzione
    expect(c).toContain('=== "0"');
  });

  test("il fornitore vero non viene MAI chiamato sul gemello", () => {
    const c = senzaCommenti(leggi("lib/voli/verifica.ts"));
    expect(c).toContain("AMBIENTE_PROVA");
    // lo short-circuit alla demo viene PRIMA della scelta di AeroDataBox
    const prova = c.indexOf("if (AMBIENTE_PROVA) return demo");
    const chiave = c.indexOf("AERODATABOX_API_KEY ? aerodatabox");
    expect(prova).toBeGreaterThan(0);
    expect(prova).toBeLessThan(chiave);
  });

  test("il gemello non incassa mai con chiavi vere", () => {
    expect(senzaCommenti(leggi("lib/stripe.ts"))).toContain("cassaVeraVietata");
    expect(leggi("app/api/check/checkout/route.ts")).toContain("cassaVeraVietata");
    expect(leggi("app/api/pratiche/checkout/route.ts")).toContain("cassaVeraVietata");
  });

  test("il gemello non sporca i numeri del pannello vero", () => {
    const c = senzaCommenti(leggi("lib/eventi/registra.ts"));
    // il ritorno anticipato su AMBIENTE_PROVA viene prima della insert
    const guardia = c.indexOf("if (AMBIENTE_PROVA) return");
    const insert = c.indexOf('.from("eventi")');
    expect(guardia).toBeGreaterThan(0);
    expect(guardia).toBeLessThan(insert);
  });

  test("il gemello punta a sé stesso, non al sito vero", () => {
    const c = senzaCommenti(leggi("lib/sito.ts"));
    expect(c).toContain("AMBIENTE_PROVA");
    expect(c).toContain("DEPLOY_PRIME_URL");
  });

  test("il cartello del gemello è nel layout", () => {
    expect(leggi("app/layout.tsx")).toContain("AMBIENTE DI PROVA");
  });
});
