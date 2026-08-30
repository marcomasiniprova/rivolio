import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

/**
 * QUELLO CHE FERMA DAVVERO UNA VENDITA: LA CORREZIONE, SUI DUE LATI.
 *
 * ⚠️ Il vecchio "controllo a campione" (shadow mode) e' stato TOLTO il 28/08:
 * il pannello ControlloVerdetti, le azioni "Va bene"/"Correggi" e la coda dei
 * verdetti da confermare non esistono piu'. Le prove che li guardavano sono
 * state tolte con loro (30/08): far leggere un file cancellato fa fallire la
 * suite senza dire niente di vero sul prodotto.
 *
 * Resta la cosa che conta davvero, e che NON e' stata tolta: il cancello che
 * impedisce di vendere un caso segnato "corretto a mano". Vive sui due lati
 * della cassa, e se sparisse da uno solo quel caso tornerebbe vendibile da
 * quella porta, in silenzio.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

test("il cancello e' la CORREZIONE, e sta sia sulla cassa sia sul webhook", () => {
  for (const f of [
    "app/api/pratiche/checkout/route.ts",
    // La cassa Stripe: il cancello sta nella funzione di evasione condivisa,
    // che il webhook Stripe chiama dopo aver verificato la firma.
    "lib/pratiche/evasione.ts",
  ]) {
    expect(leggi(f), f).toContain('conferma === "corretta"');
  }
});
