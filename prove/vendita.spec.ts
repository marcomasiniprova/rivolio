import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COPY } from "../lib/copy";

/**
 * IL GIRO CHE PORTA AI SOLDI NON DEVE PIÙ FERMARSI.
 *
 * Il 12/08 Valerio ha percorso il prodotto di persona e si è fermato
 * quattro volte di fila. Ognuna di quelle quattro ha qui la sua prova,
 * perché sono tutte del tipo che non si vede leggendo il codice: si
 * vedono solo cliccando, e senza una prova rientrano dalla finestra.
 *
 * ⚠️ E IO GLI AVEVO SCRITTO CHE FUNZIONAVA. L'avevo provato coi comandi,
 * che parlano al server e rispondono "ok" a ogni passo; lui l'ha provato
 * col dito. Da qui in poi: quello che si dichiara funzionante si prova
 * come lo prova lui.
 */

const RADICE = join(__dirname, "..");
const demo = "/verifica/demo-ZZ250-2026-08-11";

test.describe("Il giro che porta ai soldi", () => {
  test("il velo dell'analisi si toglie e resta il verdetto", async ({ page }) => {
    /* 🔴 Ci sono cascato mentre chiudevo gli altri tre: scrivendo il
       segno "già vista" all'inizio invece che alla fine, in sviluppo il
       velo non spariva più e copriva tutto il verdetto. Uguale identica
       alla schermata che mi aveva mandato lui. */
    await page.goto(demo);
    await expect(page.getByText("250€").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /Prepara la pratica/ }).first()).toBeVisible();
  });

  test("l'email non si chiede due volte: sull'esempio non si chiede affatto", async ({ page }) => {
    await page.goto(demo);
    await expect(page.getByText(COPY.risultato.idoneo.recesso.etichetta).first()).toBeVisible();
    expect(await page.locator('input[type="email"]').count()).toBe(0);
  });

  test("senza la spunta il giro si ferma, e lo dice", async ({ page }) => {
    await page.goto(demo);
    await page.getByRole("link", { name: /Prepara la pratica/ }).first().click();
    await expect(page.getByText(COPY.risultato.idoneo.recesso.blocco).first()).toBeVisible();
    await expect(page).not.toHaveURL(/checkout=/);
  });

  test("tornando indietro dalla cassa l'analisi NON riparte", async ({ page }) => {
    /* Valerio: «premo fai la pratica e mi rifà un'altra analisi, mi
       riporta nella stessa pagina, è un loop continuo». */
    await page.goto(`${demo}?checkout=recesso`);
    await expect(page.getByText("250€").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(COPY.comeFunziona.verifica.titolo)).toHaveCount(0);
  });

  test("il verdetto in attesa di controllo si vende comunque", () => {
    /* 🔴 In produzione lo shadow mode è acceso da solo, quindi OGNI
       verdetto nasce "in attesa". Finché quello stato bloccava la
       vendita, il prodotto era invendibile per costruzione: il bottone
       non compariva e la cassa rimbalzava. A fermare tutto resta il caso
       giusto, cioè un verdetto che una persona ha guardato e dichiarato
       sbagliato. */
    for (const file of [
      "app/api/pratiche/checkout/route.ts",
      // La cassa Stripe evade il pagamento da qui: il cancello vive nella
      // funzione condivisa (chiamata dal webhook Stripe), e la stessa regola vale.
      "lib/pratiche/evasione.ts",
    ]) {
      const testo = readFileSync(join(RADICE, file), "utf8");
      const righe = testo.split("\n");
      const colpevoli = righe
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => /if\s*\(.*conferma\s*===\s*"in_attesa"/.test(r));
      expect(
        colpevoli.map((c) => `${file}:${c.i + 1}`),
        `qui la vendita tornerebbe a fermarsi su OGNI verdetto: usa "corretta"`,
      ).toEqual([]);
      expect(testo, `${file} deve fermarsi sui verdetti corretti a mano`).toContain(
        'conferma === "corretta"',
      );
    }
  });

  test("il consenso al recesso si registra anche sui voli dimostrativi", () => {
    /* 🔴 C'era una scorciatoia: "se il volo è demo salta la
       registrazione". Ma un volo ZZ analizzato davvero ha una riga vera e
       percorre la strada vera, quindi la cassa non trovava il consenso e
       rispondeva «manca la spunta» a chi l'aveva appena messa.
       La distinzione giusta non è "il volo è finto" ma "esiste una riga
       su cui scrivere". */
    const testo = readFileSync(join(RADICE, "components/verifica/Risultato.tsx"), "utf8");
    expect(testo, "non si decide più in base a `demo`, ma a `idVerifica`").toContain(
      "if (!dati.idVerifica) {",
    );
    expect(testo).not.toMatch(/if \(dati\.demo\) \{\s*\n\s*window\.location\.assign/);
  });
});
