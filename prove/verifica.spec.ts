import { test, expect } from "@playwright/test";
import { COPY } from "../lib/copy";
import { LISTINO_BASE } from "../lib/prezzi";
import { apriModoNumero } from "./aiuti";
import { VOLI_DEMO } from "../lib/voli/fornitori/demo";

/* La CTA d'acquisto porta dentro il prezzo, e dal 9/08 il prezzo ha due
   varianti: qui si usa il listino base, che è quello che il sito serve
   quando il cookie del test non c'è. */
const CTA_ACQUISTO = COPY.risultato.idoneo.cta.replace("{prezzo}", LISTINO_BASE.singolaTesto);

/**
 * Il flusso del check in modalità DEMO, senza chiavi: è il percorso che
 * chiunque può provare in locale, ed è lo stesso che vale metà del
 * progetto (SPEC §8: il reveal).
 *
 * I numeri di volo NON sono inventati qui: vengono da lib/voli/fornitori/
 * demo.ts, l'unico posto che decide cosa copre ogni volo dimostrativo.
 *
 * Due gruppi:
 * 1. dalla home: modulo volo+data → si atterra su /verifica/[id];
 * 2. la pagina del risultato dritta per URL (id "demo-..."): funziona
 *    con e senza database, quindi le prove non dipendono dalle chiavi.
 */

const idoneo250 = VOLI_DEMO.find((v) => v.copre.startsWith("idoneo, fascia 250"));
const nonIdoneoPerUnMinuto = VOLI_DEMO.find((v) => v.copre.startsWith("non idoneo per un minuto"));
const cancellato = VOLI_DEMO.find((v) => v.stato === "cancellato");
if (!idoneo250 || !nonIdoneoPerUnMinuto || !cancellato) {
  throw new Error("Il fornitore demo non copre più i casi delle prove: guarda VOLI_DEMO.");
}

/** Ieri in forma ISO: una data sempre valida per un volo già atterrato. */
function ieri(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const urlDemo = (volo: string) => `/verifica/demo-${volo}-${ieri()}`;

/* ================================================= 1. dalla home */

test.describe("Il check dalla home", () => {
  async function compilaECont(page: import("@playwright/test").Page, volo: string) {
    await page.goto("/");
    // dall'8/08 il modo predefinito è la tratta: il numero ha il suo selettore
    await apriModoNumero(page);
    await page.getByLabel(COPY.hero.form.volo.etichetta).first().fill(volo);
    // ISO va bene sia per un campo data sia per l'API (normalizzaData).
    await page.getByLabel(COPY.hero.form.data.etichetta).first().fill(ieri());
    await page.getByRole("button", { name: COPY.hero.form.bottone }).first().click();
  }

  test("volo demo idoneo: si arriva su /verifica/[id] col reveal e il badge demo", async ({
    page,
  }) => {
    await compilaECont(page, idoneo250.voloIata);
    /* L'analisi profonda dura ~16 secondi prima di navigare (scelta di
       Valerio dell'8/08: sei passi da 2,4s piu la pausa del timbro). */
    await page.waitForURL(/\/verifica\//, { timeout: 45_000 });
    // il contatore si posa sull'importo pieno della fascia
    await expect(page.getByText("250€", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    // il dato è dimostrativo e lo si dice, sempre (regola 3)
    await expect(page.getByText(COPY.comune.demo).first()).toBeVisible();
  });

  test("volo demo non idoneo: risposta chiara, senza vendita", async ({ page }) => {
    await compilaECont(page, nonIdoneoPerUnMinuto.voloIata);
    await page.waitForURL(/\/verifica\//, { timeout: 45_000 });
    await expect(page.getByText(COPY.risultato.nonIdoneo.titolo).first()).toBeVisible();
    // il dato mostrato: 179 minuti, nel formato leggibile (9/08)
    await expect(page.getByText(/2 h e 59 min/).first()).toBeVisible();
    await expect(page.getByText(/16,90/)).toHaveCount(0);
  });

  test("input invalido: messaggio di validazione, si resta sulla home", async ({ page }) => {
    await compilaECont(page, "!!!");
    // i due soli messaggi del normalizzatore per un volo illeggibile
    await expect(
      page.getByText(/Non riconosco questo volo|Scrivi il numero del volo/).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/verifica\//);
  });
});

/* ==================================== 2. la pagina del risultato */

test.describe("La pagina del risultato (id demo, senza chiavi)", () => {
  test("IDONEO: reveal, fatto oggettivo, scadenza stimata, badge demo", async ({ page }) => {
    await page.goto(urlDemo(idoneo250.voloIata));

    // il reveal: il contatore finisce sull'importo esatto della fascia
    await expect(page.getByText("250€", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    // il fatto oggettivo: atterrato alle X invece delle Y
    await expect(page.getByText(/atterrato alle .+ invece delle/).first()).toBeVisible();
    // il ritardo, bene in vista nel titolo (200 minuti, formato leggibile)
    await expect(page.getByText(/3 h e 20 min/).first()).toBeVisible();
    // la scadenza è una stima DICHIARATA: l'avvertenza del motore c'è
    // (dal 13/08 il termine è 2 anni, il più corto: mai sovrastimare)
    await expect(page.getByText(/termine.*2 anni|non è un parere legale/i).first()).toBeVisible();
    // il badge demo, onesto e visibile
    await expect(page.getByText(COPY.comune.demo).first()).toBeVisible();
    // la card condivisibile col suo bottone
    await expect(page.getByText(COPY.condivisione.card.piede).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: COPY.condivisione.bottone }).first(),
    ).toBeVisible();
  });

  /* 🔴 QUESTA PROVA CONTROLLAVA UN DIFETTO, non una funzione: sotto il
     verdetto c'era un riquadro che chiedeva l'email, e SOTTO ancora il
     pagamento che la richiedeva un'altra volta. Valerio l'ha scoperto
     percorrendo il giro il 12/08: l'ha data in cima, e la cassa gliel'ha
     richiesta. Adesso si chiede in un punto solo, dentro il modulo
     d'acquisto, e su un esempio puro non si chiede affatto: non c'è
     nessuna riga a cui agganciarla. */
  test("IDONEO demo: l'email non si chiede due volte, e sull'esempio nemmeno una", async ({
    page,
  }) => {
    await page.goto(urlDemo(idoneo250.voloIata));
    await expect(page.getByText(COPY.risultato.idoneo.recesso.etichetta).first()).toBeVisible();
    expect(await page.locator('input[type="email"]').count()).toBe(0);
  });

  test("IDONEO demo: il bottone d'acquisto torna alla pagina con l'avviso, non a Polar", async ({
    page,
  }) => {
    await page.goto(urlDemo(idoneo250.voloIata));
    // #21: prima si firma la rinuncia al recesso, poi si può proseguire.
    await page.getByRole("checkbox").first().check();
    await page.getByRole("link", { name: CTA_ACQUISTO }).first().click();
    await expect(page).toHaveURL(/checkout=demo/);
    await expect(page.getByText(COPY.risultato.idoneo.checkoutDemo).first()).toBeVisible();
  });

  test("IDONEO: senza la spunta di rinuncia al recesso NON si va al checkout", async ({
    page,
  }) => {
    await page.goto(urlDemo(idoneo250.voloIata));
    await expect(page.getByText(COPY.risultato.idoneo.recesso.etichetta).first()).toBeVisible();
    await page.getByRole("link", { name: CTA_ACQUISTO }).first().click();
    // il richiamo compare e la pagina resta questa: nessun rimando a Polar
    await expect(page.getByText(COPY.risultato.idoneo.recesso.blocco).first()).toBeVisible();
    await expect(page).not.toHaveURL(/checkout=/);
  });

  test("NON IDONEO: risposta chiara, il dato mostrato, invito a riprovare", async ({ page }) => {
    await page.goto(urlDemo(nonIdoneoPerUnMinuto.voloIata));
    await expect(page.getByText(COPY.risultato.nonIdoneo.titolo).first()).toBeVisible();
    await expect(page.getByText(/2 h e 59 min/).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: COPY.risultato.nonIdoneo.cta }).first(),
    ).toBeVisible();
    // gratis vuol dire gratis: nessun prezzo in pagina
    await expect(page.getByText(/16,90|29,90/)).toHaveCount(0);
  });

  test("INCERTO (cancellato): si spiega e NON si vende", async ({ page }) => {
    await page.goto(urlDemo(cancellato.voloIata));
    await expect(page.getByText(COPY.risultato.incerto.titolo).first()).toBeVisible();
    // la spiegazione viene dal motivo del motore
    await expect(page.getByText(/cancellato/).first()).toBeVisible();
    // MAI vendere sul giallo: niente prezzi, niente bottoni d'acquisto
    await expect(page.getByText(/16,90|29,90/)).toHaveCount(0);
  });

  test("un volo demo che non esiste: pannello chiaro con l'uscita", async ({ page }) => {
    await page.goto(urlDemo("ZZ999"));
    await expect(page.getByText(COPY.risultato.nonTrovata.titolo).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: COPY.risultato.nonTrovata.cta }).first(),
    ).toBeVisible();
  });

  test("un id che non è niente: pannello chiaro, nessun errore nudo", async ({ page }) => {
    await page.goto("/verifica/qualcosa-a-caso");
    await expect(page.getByText(COPY.risultato.nonTrovata.titolo).first()).toBeVisible();
  });

  test("un UUID sconosciuto: mai un errore nudo, sempre una spiegazione", async ({ page }) => {
    // Senza chiavi risponde "non disponibile" (il database non c'è);
    // con le chiavi risponde "non trovata". Entrambe sono giuste: la
    // prova pretende solo che l'utente non veda mai un errore nudo.
    await page.goto("/verifica/00000000-0000-4000-8000-000000000000");
    const pannello = page
      .getByText(COPY.risultato.nonTrovata.titolo)
      .or(page.getByText(COPY.risultato.nonDisponibile.titolo));
    await expect(pannello.first()).toBeVisible();
  });

  test("niente scorrimento orizzontale sulla pagina del risultato", async ({ page }) => {
    await page.goto(urlDemo(idoneo250.voloIata));
    await expect(page.getByText("250€", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    const sfora = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(sfora).toBe(false);
  });

  test("/verifica pulito senza risultato recente: pannello calmo, mai un errore", async ({
    page,
  }) => {
    /* L'indirizzo pulito (scelta di Valerio, 14/08): aperto a mano, senza il
       cookie dell'ultima verifica, spiega con calma invece di rompersi. */
    await page.goto("/verifica");
    await expect(page.getByText(COPY.risultato.nessunRecente.titolo)).toBeVisible();
    await expect(page.getByRole("link", { name: COPY.risultato.nessunRecente.cta })).toBeVisible();
  });
});
