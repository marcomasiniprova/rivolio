import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

const R = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(R, p), "utf8");

/**
 * IL CRUSCOTTO DEL CREATOR: trasparente sui SUOI numeri, muto sui margini
 * interni. Un creator non deve mai vedere IVA, commissione della cassa o il
 * margine di Rivolio: quella è roba di Valerio.
 */
test.describe("La vista del creator", () => {
  test("non mostra i margini interni (IVA, cassa, margine)", () => {
    /* Si guarda il codice VIVO, non i commenti: la nota in cima spiega che
       il creator NON vede l'IVA, e per dirlo la cita. È giusto che lo faccia. */
    const vivo = leggi("components/creator/DashboardCreator.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const proibito of ["IVA", "Stripe", "margineCompleto", "CASSA_PERCENTO", "exIva"]) {
      expect(vivo, `il creator non deve vedere "${proibito}"`).not.toContain(proibito);
    }
  });

  test("si apre solo con un gettone firmato valido", () => {
    expect(leggi("app/creator/cruscotto/page.tsx")).toContain("codiceDaGettone");
  });

  test("il conteggio clic non conta due volte e valida il codice", () => {
    const src = leggi("components/creator/ContaClic.tsx");
    expect(src).toContain("sessionStorage");
    expect(src).toContain("[A-Z0-9]{3,20}");
  });

  test("la rotta dei clic ha il freno e valida il codice", () => {
    const src = leggi("app/api/ref/clic/route.ts");
    expect(src).toContain("oltreIlLimite");
    expect(src).toContain("codiceAffiliatoValido");
    expect(src).toContain("segna_clic_affiliato");
  });
});
