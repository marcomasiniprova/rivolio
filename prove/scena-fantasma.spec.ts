import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

/**
 * LO SCANNER FANTASMA NON PUÒ PIÙ TORNARE (Valerio, 15/08 su ZZ777, chiuso
 * per davvero il 22/08).
 *
 * La storia: la pagina del verdetto rifaceva il "velo" dell'analisi a ogni
 * arrivo che non venisse dal check dell'hero (link email, segnalibro). Per
 * mesi si è provato a domarlo (segna la pagina come vista, non ripartire al
 * ricaricamento, i pallini che non rimbalzano), ma il lampo tornava: aprendo
 * la pratica dal link dell'email, per un attimo compariva la scena e poi
 * spariva, proprio mentre uno voleva solo pagare.
 *
 * La chiusura definitiva: il velo è stato TOLTO del tutto. Il teatro
 * dell'analisi vive già all'hero (SchedaCheck), dov'è al posto giusto; sulla
 * pagina del verdetto non c'è più niente da far ripartire. Questa prova
 * legge il sorgente e pretende che il velo non ci sia: se qualcuno lo
 * rimette, il fantasma torna con lui.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

test.describe("Lo scanner fantasma non può più tornare", () => {
  test("la pagina del verdetto non ha più il velo dell'analisi", () => {
    const testo = leggi("components/verifica/Risultato.tsx");
    // Niente stato della scansione, niente scena d'ingresso, niente segno in
    // sessionStorage da far ripartire: il verdetto si mostra e basta.
    expect(testo, "il velo non deve più esistere").not.toContain("setScansione");
    expect(testo, "la scena d'ingresso non deve tornare").not.toContain("ScansioneIngresso");
    expect(testo, "niente segno di pagina vista da far ripartire").not.toContain("rivolio-visto-");
    expect(testo, "niente flag scan-fatto letto sul verdetto").not.toContain("rivolio-scan-fatto");
  });
});

/**
 * I PALLINI DELL'ANALISI NON RIMBALZANO (Valerio, 18/08).
 *
 * Il bug: sbatti sul muro del pagamento, usi il codice della recensione, e
 * parte una SECONDA analisi mentre la prima non è stata spenta. Due timer
 * contano insieme sullo stesso indicatore e i pallini vanno avanti e
 * indietro ("indietreggiano di 3, avanzano di 1"). Il freno: ogni analisi
 * prende un numero (corsa) e la sequenza dei passi si ferma appena non è
 * più la corsa corrente. Chi togliesse il freno riaprirebbe il bug.
 */
test.describe("I pallini dell'analisi non rimbalzano", () => {
  test("solo l'ultima analisi muove i passi (freno per corsa)", () => {
    const testo = leggi("components/check/SchedaCheck.tsx");
    expect(testo, "manca il contatore delle corse").toContain("const corsa = useRef(0)");
    expect(testo, "avvia deve prendere il numero della sua corsa").toContain(
      "const miaCorsa = ++corsa.current",
    );
    expect(
      testo,
      "la sequenza dei passi deve fermarsi se non è più la corsa corrente",
    ).toContain("if (corsa.current !== miaCorsa) return");
  });
});
