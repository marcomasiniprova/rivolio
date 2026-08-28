import { test, expect } from "@playwright/test";
import { INTRO_FISSA, dataLeggibile, introPulita } from "../lib/email/newsletter";

/**
 * LA NEWSLETTER NON PUÒ DIRE UN NUMERO INVENTATO.
 *
 * Regola di Valerio (28/08): dati veri, AI attorno. I numeri (indici dei
 * ritardi, date, fasce) li mette il codice; l'AI scrive solo il contorno.
 * `introPulita` è il cancello: se il modello infila una cifra, un euro,
 * una percentuale o il trattino lungo, il suo testo si butta e vale
 * l'intro fissa. Queste prove tengono fermo il cancello: una newsletter
 * pubblica col nostro nome sopra che dice il falso sui ritardi ci brucia.
 */
test.describe("newsletter · il cancello dei numeri", () => {
  test("accetta il testo di contorno, senza numeri", () => {
    expect(
      introPulita("Questa settimana i cieli italiani sono stati movimentati. Dagli un'occhiata."),
    ).toBe(true);
  });

  for (const cattivo of [
    "Ci sono stati 3 scioperi.", // cifra
    "Ti spettano fino a 600 euro col simbolo €.", // euro
    "Il traffico è cresciuto del 20%.", // percentuale
    "", // vuoto
    "   ", // solo spazi
    "Settimana intensa — occhio ai voli.", // trattino lungo (vietato)
  ]) {
    test(`rifiuta: ${JSON.stringify(cattivo)}`, () => {
      expect(introPulita(cattivo)).toBe(false);
    });
  }

  test("l'intro di riserva passa il proprio cancello", () => {
    // Se un domani qualcuno mette un numero o un trattino nell'intro fissa,
    // questa prova lo prende prima del lettore.
    expect(introPulita(INTRO_FISSA)).toBe(true);
  });
});

test.describe("newsletter · le date in parole", () => {
  test("una data ISO diventa una data italiana leggibile", () => {
    const s = dataLeggibile("2026-08-31");
    expect(s).toContain("31");
    expect(s.toLowerCase()).toContain("agosto");
  });

  test("una data non valida torna com'è, senza rompere", () => {
    expect(dataLeggibile("non-una-data")).toBe("non-una-data");
  });
});
