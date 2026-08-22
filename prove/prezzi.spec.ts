import { test, expect } from "@playwright/test";
import { COOKIE_PREZZO, LISTINI, confronto, euro, listinoDi, varianteValida } from "../lib/prezzi";

/**
 * IL TEST DEI DUE PREZZI (9/08).
 *
 * La cosa che deve reggere sopra ogni altra: chi vede 24,90 sulla landing
 * deve trovare 24,90 anche alla cassa. Se il prezzo balla fra una pagina e
 * l'altra il test misura la nostra incoerenza invece del prezzo, e nel
 * frattempo perdiamo la vendita.
 */

test.describe("I due listini", () => {
  test("le cifre sono quelle decise, scritte in italiano", () => {
    expect(LISTINI.a.singolaTesto).toBe("16,90€");
    expect(LISTINI.a.famigliaTesto).toBe("29,90€");
    expect(LISTINI.b.singolaTesto).toBe("24,90€");
    expect(LISTINI.b.famigliaTesto).toBe("39,90€");
    // mai il punto decimale all'inglese
    expect(euro(16.9)).not.toContain(".");
  });

  test("un cookie sporco non rompe niente: si torna al listino di sempre", () => {
    expect(varianteValida("c")).toBeNull();
    expect(varianteValida(undefined)).toBeNull();
    expect(listinoDi(null).singolaTesto).toBe("16,90€");
    expect(listinoDi("b").singolaTesto).toBe("24,90€");
  });

  test("il confronto coi portali torna col prezzo giusto, in tutte e due le varianti", () => {
    const a = confronto(LISTINI.a);
    expect(a.trattenutoPortale).toBe(210);
    expect(a.restanoPortale).toBe(390);
    expect(a.restanoNostro).toBe(583.1);

    const b = confronto(LISTINI.b);
    expect(b.restanoNostro).toBe(575.1);
    // in tutte e due resta a te molto piu' che col portale: e' l'argomento
    expect(b.restanoNostro).toBeGreaterThan(b.restanoPortale);
  });
});

/**
 * ⚠️ IL TEST È SPENTO DALL'11/08 (`TEST_DUE_PREZZI = false`), e queste
 * prove descrivono lo stato di adesso, non quello di prima.
 *
 * Il motivo dello spegnimento è la velocità: per scegliere fra i due
 * prezzi bisogna leggere un cookie, e una pagina che legge un cookie va
 * ricostruita a ogni visita invece di essere consegnata già pronta. La
 * landing è la pagina che vede più gente, quindi quel costo lo paga
 * ognuno che arriva. In cambio oggi non si misurava niente: senza
 * venditore non c'è una vendita da contare.
 *
 * Il giorno che si riaccende, queste due prove vanno riscritte al
 * contrario. È voluto che si accorgano del cambio.
 */
test.describe("Col test spento c'è un prezzo solo", () => {
  test("nessuno riceve più la moneta: il cookie del prezzo non si scrive", async ({ page }) => {
    await page.goto("/");
    const cookie = (await page.context().cookies()).find((c) => c.name === COOKIE_PREZZO);
    expect(
      cookie,
      "col test spento il proxy non deve assegnare nessuna variante",
    ).toBeFalsy();
  });

  test("un cookie vecchio NON cambia il prezzo che si legge", async ({ page }) => {
    /* ⚠️ Questa è la crepa trovata spegnendo il test, ed è sui soldi: il
       cookie della variante dura SEI MESI. Chi l'aveva preso da acceso
       avrebbe letto 16,90 sulla landing e trovato 24,90 alla cassa. Un
       prezzo che cambia fra il bottone e il pagamento è il motivo per cui
       uno chiude la pagina. */
    await page.context().addCookies([
      { name: COOKIE_PREZZO, value: "b", url: "http://localhost:3100" },
    ]);
    await page.goto("/#prezzi");
    const sezione = page.locator("#prezzi");
    await expect(sezione).toContainText("16,90€");
    await expect(sezione).not.toContainText("39,90€");
  });
});
