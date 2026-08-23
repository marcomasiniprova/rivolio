import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OVERBOOKING E COINCIDENZA APRONO LA PRATICA COME IL RITARDO.
 *
 * 🔴 Il difetto (Valerio, 13/08, con gli screenshot): su un volo reale il
 * verdetto di negato imbarco / coincidenza persa usciva giusto, ma poi
 * «pagamento non attivo», niente pratica, niente bottone famiglia. Il flusso
 * completo partiva solo per i voli demo o con un venditore configurato.
 *
 * Oggi la cassa è Stripe: accende i bottoni su OGNI idoneo (demo o vero) e
 * apre la sessione di pagamento per qualunque volo. Queste prove guardano il
 * codice, perché il difetto si riapre togliendo una parola, e una parola
 * tolta non si vede a occhio.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

test.describe("Le altre casistiche hanno lo stesso flusso del ritardo", () => {
  test("i bottoni d'acquisto seguono la cassa vera, non una cassa finta", () => {
    const risultato = leggi("components/verifica/Risultato.tsx");
    // Il bottone si accende su un volo demo o quando la cassa Stripe è attiva
    // (dati.checkout). Niente più `|| dati.cassaProva`.
    expect(risultato).toMatch(/compraSingola\s*=\s*dati\.demo\s*\|\|\s*dati\.checkout\.singola\b/);
    expect(risultato).toMatch(/compraFamiglia\s*=\s*dati\.demo\s*\|\|\s*dati\.checkout\.famiglia\b/);
    expect(risultato, "la cassa di prova non deve tornare").not.toContain("cassaProva");
  });

  test("i bottoni li accende Stripe, non un flag a mano", () => {
    // Dal 14/08 il cuore della pagina vive in contenuto.tsx (indirizzo pulito).
    const pagina = leggi("app/verifica/contenuto.tsx");
    // Il checkout è vero quando la chiave Stripe c'è: da lì si accendono i bottoni.
    expect(pagina).toContain("stripeAttivo()");
    expect(pagina, "niente cassa di prova").not.toContain("cassaDiProvaAperta");
  });

  test("la rotta dichiara riscrive esito e caso: da lì nasce la pratica", () => {
    /* La pratica di overbooking/coincidenza si apre perché la riga della
       verifica diventa idonea col caso dichiarato. Se la rotta smette di
       scriverli, il checkout non trova un idoneo su cui aprire. */
    const rotta = leggi("app/api/verifica/dichiara/route.ts");
    expect(rotta).toContain("caso_dichiarato");
    expect(rotta).toMatch(/esito:\s*verdetto\.esito/);
  });

  test("il checkout apre la sessione Stripe su un idoneo, senza guardare il numero del volo", () => {
    /* Il flusso completo (overbooking/coincidenza su un volo VERO) si apre
       come quello del ritardo: la riga diventa idonea e il checkout apre una
       sessione Stripe. L'unico stop è un verdetto corretto a mano; nessun
       cancello sul numero del volo (ZZ o no), se no si rimura sui voli veri. */
    const rotta = leggi("app/api/pratiche/checkout/route.ts");
    expect(rotta).toContain("creaSessioneCheckout");
    expect(rotta, "il verdetto corretto a mano non si vende, ed è l'unico stop").toContain(
      'conferma === "corretta"',
    );
    expect(rotta, "niente cancello sul numero del volo").not.toMatch(/startsWith\(["']ZZ["']\)/);
  });
});
