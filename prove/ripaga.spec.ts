import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * NESSUNO PAGA DUE VOLTE LA STESSA COSA.
 *
 * 🔴 Valerio, 13/08: «un utente paga mentre fa l'analisi, lì si refresha
 * il browser. Da quanto vedo io adesso gli fa ripagare per forza».
 *
 * Aveva ragione, e il difetto stava in cosa si contava. Il credito si
 * consumava a ogni ANALISI, e ogni analisi scrive una riga nuova nel
 * registro: quindi ricaricare la pagina sullo stesso volo, tornare
 * indietro col tasto del browser, riaprire il link dopo che il telefono
 * si è spento, o rifare lo stesso check dieci minuti dopo, mangiava un
 * secondo credito e portava al muro.
 *
 * Quello che uno compra non è un'esecuzione del programma: è la risposta
 * su QUEL volo. Queste prove guardano il codice, perché il difetto si
 * riapre spostando due righe e una riga spostata non si vede.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

const senzaCommenti = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

test.describe("Lo stesso volo non si paga due volte", () => {
  test("il registro sa rispondere «questo volo l'ha già pagato»", () => {
    const c = leggi("lib/check/cancello.ts");
    expect(c).toContain("export async function analisiGiaPagata");
    const dentro = c.slice(c.indexOf("export async function analisiGiaPagata"));
    /* La domanda deve essere fatta su volo E data: solo sull'ordine
       tornerebbe sempre vero dopo la prima analisi, e il credito non si
       consumerebbe più per nessun volo. */
    expect(dentro.slice(0, 1400)).toContain("volo_iata");
    expect(dentro.slice(0, 1400)).toContain("data_locale");
    expect(dentro.slice(0, 1400)).toContain("ordine_check");
  });

  test("🔴 il cancello del credito gira DOPO aver letto il volo", () => {
    /* È il cuore della riparazione: prima girava per primo, quindi non
       poteva distinguere «un'analisi nuova» da «la stessa rifatta». */
    const r = senzaCommenti(leggi("app/api/verifica/route.ts"));
    // Il volo si legge dal corpo qui: dopo l'aggiunta del codice del buono
    // la destrutturazione porta anche `codice`, ma il punto è lo stesso.
    const iVolo = r.indexOf("(corpo ?? {})");
    const iCredito = r.indexOf("creditoFinito(pass)");
    expect(iVolo, "la rotta deve leggere il volo").toBeGreaterThan(-1);
    expect(iCredito, "la rotta deve controllare il credito").toBeGreaterThan(-1);
    expect(iCredito, "il credito si controlla dopo aver letto il volo").toBeGreaterThan(iVolo);
  });

  test("chi rifà lo stesso volo non viene mandato al muro", () => {
    const r = senzaCommenti(leggi("app/api/verifica/route.ts"));
    const i = r.indexOf("creditoFinito(pass)");
    const riga = r.slice(Math.max(0, i - 200), i + 60);
    expect(riga, "il muro deve saltare chi ha già pagato quel volo").toContain("!giaPagata");
  });

  test("e non gli si consuma un secondo credito", () => {
    const r = senzaCommenti(leggi("app/api/verifica/route.ts"));
    const i = r.indexOf("let siConsuma");
    expect(i, "il consumo del credito deve esistere").toBeGreaterThan(-1);
    /* La riserva atomica (giro #96) tiene il conto: lo stesso volo gia'
       pagato torna "gia", che non e' ne' "riservato" ne' "errore", quindi il
       consumo resta a false. Nel degrado (database giu') il consumo e'
       guardato da !giaPagataDegrado, l'erede diretto del vecchio !giaPagata. */
    const blocco = r.slice(i, i + 400);
    expect(blocco, "il consumo vero parte solo da una riserva nuova").toContain(
      'riserva === "riservato"',
    );
    expect(blocco, "il degrado non riconsuma un volo gia' pagato").toContain("!giaPagataDegrado");
  });

  test("⚠️ un volo DIVERSO continua a consumare: è quello che vendiamo", () => {
    /* Se il controllo guardasse solo l'ordine, dopo la prima analisi
       nessun volo consumerebbe più niente e il muro diventerebbe una
       decorazione. */
    const c = senzaCommenti(leggi("lib/check/cancello.ts"));
    const i = c.indexOf("export async function analisiGiaPagata");
    const corpo = c.slice(i, i + 1200);
    expect(corpo.match(/\.eq\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  test("un guasto al registro lascia passare, non blocca", () => {
    /* Fra regalare un'analisi e far ripagare una persona che ha già
       pagato, il secondo è quello che costa un cliente. */
    const c = leggi("lib/check/cancello.ts");
    const i = c.indexOf("export async function analisiGiaPagata");
    const corpo = c.slice(i, c.indexOf("export async function segnaConsumo"));
    /* In tutti i rami d'errore torna false, cioè "non l'ha già pagata",
       che è il valore che NON blocca nessuno e lascia decidere al
       credito vero. */
    expect(corpo).toContain("return false");
    expect(corpo).not.toMatch(/catch[\s\S]{0,120}return true/);
  });
});
