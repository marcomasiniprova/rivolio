import { test, expect } from "@playwright/test";
import { COPY } from "../lib/copy";
import { COOKIE_PREZZO } from "../lib/prezzi";
import { apriModoNumero } from "./aiuti";

/**
 * La landing di Rivolio: lo scanner dei rimborsi (SPEC §1, §3).
 * L'hero È il prodotto: il form volo+data, senza email e senza account.
 * I testi vengono da lib/copy.ts: le prove agganciano quelli, non stringhe
 * duplicate a mano che poi divergono.
 */

test.describe("Landing page", () => {
  test("il messaggio principale c'è e si legge", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /Hai preso un volo/i }),
    ).toBeVisible();
    await expect(page.getByText(COPY.hero.sottotitolo).first()).toBeVisible();
    // la rassicurazione del funnel: niente email, niente account (SPEC §3)
    await expect(page.getByText(COPY.hero.form.rassicurazione).first()).toBeVisible();
  });

  test("l'hero ha il form volo+data, che è il prodotto", async ({ page }) => {
    await page.goto("/");
    // il modo predefinito è la tratta (standard dell'8/08): il numero sta
    // dietro il suo selettore, e la prova segue la strada dell'utente
    await apriModoNumero(page);
    const volo = page.getByLabel(COPY.hero.form.volo.etichetta).first();
    const data = page.getByLabel(COPY.hero.form.data.etichetta).first();
    await expect(volo).toBeVisible();
    await expect(data).toBeVisible();
    await expect(data).toHaveAttribute("type", "date");
    await expect(
      page.getByRole("button", { name: COPY.hero.form.bottone }).first(),
    ).toBeVisible();
  });

  test("il form vuoto non parte: dice cosa manca, senza giro di rete", async ({ page }) => {
    await page.goto("/");
    await apriModoNumero(page);
    await page.getByRole("button", { name: COPY.hero.form.bottone }).first().click();
    await expect(page.getByText(COPY.hero.form.errori.voloMancante).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/verifica\//);
  });

  test("i numeri dell'hero sono apribili: il 600€ e i 5 anni si spiegano", async ({
    page,
  }) => {
    await page.goto("/");

    // "fino a 600€": il bottone apre la nota con le fasce del CE 261/2004
    await page.getByRole("button", { name: COPY.hero.apriImporto }).click();
    await expect(page.getByText(COPY.hero.notaImporto)).toBeVisible();

    // "ultimi 5 anni": la finestra è dichiarata come stima, mai come certezza
    await page.getByRole("button", { name: COPY.hero.apriFinestra }).click();
    await expect(page.getByText(COPY.hero.notaFinestra)).toBeVisible();
  });

  test("il confronto prezzi torna: 600 - 210 = 390, 600 - 16,90 = 583,10", async ({
    page,
  }) => {
    /* Dal 9/08 il sito serve due listini a caso (test dei prezzi): qui si
       fissa quello base, se no la prova passa o fallisce a testa o croce. */
    await page.context().addCookies([
      { name: COOKIE_PREZZO, value: "a", url: "http://localhost:3100" },
    ]);
    await page.goto("/#prezzi");
    const prezzi = page.locator("#prezzi");

    /* ⚠️ SI ASPETTA, NON SI LEGGE E BASTA. Questa prova falliva a caso, e
       solo quando la suite gira intera: i numeri del confronto arrivano
       da un contatore che sale mentre la sezione entra in scena, quindi
       leggendo subito si prende un fotogramma di mezzo (con la macchina
       carica, il primo). Una prova che passa o fallisce secondo quanto è
       occupato il computer non dice più niente su quello che doveva
       controllare, ed è peggio di una prova che non c'è.
       `toContainText` riprova finché non trova, entro il suo tempo. */
    // i due prezzi chiusi in SPEC §5
    await expect(prezzi).toContainText("16,90€");
    await expect(prezzi).toContainText("29,90€");

    // il conto del confronto coi portali a percentuale: la somma regge
    await expect(prezzi).toContainText("210€");
    await expect(prezzi).toContainText("390€");
    await expect(prezzi).toContainText("583,10€");
    const testo = await prezzi.innerText();

    /* E la cifra si apre: il dettaglio dichiara da dove viene il 35-50%.
       ⚠️ Si punta al dettaglio che CONTIENE la nota, non a `.first()`.
       "Come nasce questa cifra" compare più volte dentro la sezione
       prezzi (ogni numero mostrato è apribile, è la regola del progetto),
       quindi `.first()` apriva un dettaglio a caso: quando ne apriva un
       altro la nota restava chiusa e la prova falliva. Passava solo
       perché di solito l'ordine nel DOM era quello comodo, e infatti
       nella suite piena su telefono ha ceduto (11/08). */
    const conto = prezzi.locator("details", {
      has: page.getByText(COPY.prezzi.notaConfronto),
    });
    await conto.getByText(COPY.comune.apriIlConto).click();
    await expect(conto.getByText(COPY.prezzi.notaConfronto)).toBeVisible();
  });

  test("il modulo dell'Osservatorio c'è e rifiuta un'email sbagliata", async ({ page }) => {
    await page.goto("/#osservatorio");
    // il titolo è spezzato su due righe (corsivo): si aggancia il heading
    await expect(page.getByRole("heading", { name: /Osservatorio/i })).toBeVisible();
    const campo = page.locator("#osservatorio-email");
    await campo.fill("non-e-una-email");
    // il browser blocca da solo: il campo non è valido
    await expect(campo).toHaveJSProperty("validity.valid", false);
  });

  /* Questa prova tocca il Supabase VERO passando da /api/iscriviti, e per
     mesi è stata l'unica rossa della suite: negli ambienti dove la rete
     verso *.supabase.co è chiusa (sandbox con allowlist) il salvataggio
     risponde 500 e la prova fallisce **per l'ambiente, non per il
     codice**. Due rosse permanenti sono peggio di zero prove: ci si
     abitua a leggere "verde tranne quelle due", e il giorno che diventano
     tre nessuno se ne accorge. Adesso la prova si accorge da sola che il
     database non è raggiungibile e si dichiara SALTATA; dove il database
     c'è (il PC di Valerio, Netlify) gira per davvero come prima. */
  test("il modulo dell'Osservatorio accetta un'email valida e conferma", async ({ page }) => {
    await page.goto("/#osservatorio");
    await page.locator("#osservatorio-email").fill(`prova+${Date.now()}@rivolio.it`);

    const rispostaIscrizione = page.waitForResponse(
      (r) => r.url().includes("/api/iscriviti") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: COPY.osservatorio.bottone }).click();

    const risposta = await rispostaIscrizione.catch(() => null);
    test.skip(
      risposta?.status() === 500,
      "database non raggiungibile da questo ambiente: la prova vale solo dove Supabase risponde",
    );
    /* Doppio opt-in (9/08): non si è iscritti finché non si clicca il
       link nell'email, e il pannello deve dirlo. La prima frase della
       conferma di COPY fa da titolo. */
    await expect(page.getByText(/^Controlla la posta\./).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("mai 'hai diritto a': il claim è un fatto, non una promessa", async ({ page }) => {
    // SPEC §3: il claim onesto. La frase vietata non deve comparire mai.
    await page.goto("/");
    const testo = await page.locator("body").innerText();
    expect(testo.toLowerCase()).not.toContain("hai diritto a");
    // e niente trattino lungo nei testi visibili (regola BRAND)
    expect(testo).not.toContain("—");
  });

  test("non si scorre in orizzontale (rottura classica sul telefono)", async ({ page }) => {
    await page.goto("/");
    const largo = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(largo, "la pagina esce dallo schermo in larghezza").toBe(false);
  });

  test("la home dichiara le domande ai motori AI (FAQPage per il GEO)", async ({ page }) => {
    /* GEO/AIO (17/08): le domande della home escono anche come dati
       strutturati FAQPage, così ChatGPT e Perplexity possono citarle. Non
       è per il riquadro di Google (riservato ai siti pubblici), è per farsi
       ripetere dalle AI. Se un domani sparisce, questa prova se ne accorge. */
    await page.goto("/");
    const blocchi = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faq = blocchi.map((t) => JSON.parse(t)).find((d) => d["@type"] === "FAQPage");
    expect(faq, "manca il FAQPage sulla home").toBeTruthy();
    expect(faq.mainEntity.length).toBe(COPY.faq.voci.length);
    // le domande strutturate sono le stesse che si leggono a schermo
    expect(faq.mainEntity[0].name).toBe(COPY.faq.voci[0].domanda);
  });

  test("il logo regge a 24px (è lì che si vede quasi sempre)", async ({ page }) => {
    await page.goto("/");
    // il segno nuovo è un'immagine (la lente), non più un svg disegnato
    const logo = page.locator("header img").first();
    await expect(logo).toBeVisible();
    await logo.evaluate((el) => {
      (el as HTMLElement).style.width = "24px";
      (el as HTMLElement).style.height = "24px";
    });
    await logo.screenshot({ path: "prove/schermate/logo-24px.png" });
  });
});
