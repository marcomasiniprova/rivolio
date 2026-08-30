import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * LA CRONOLOGIA DEVE ESSERE SEMPRE UGUALE A SE STESSA.
 *
 * 🔴 Valerio, 13/08: «con lo stesso identico click, la cronologia mi ha
 * mostrato due versioni diverse in momenti diversi».
 *
 * La causa: dichiarare il no della compagnia scrive QUATTRO righe nello
 * stesso istante (il testo della loro email, l'analisi, il rifiuto, il
 * passaggio di stato). La lettura le ordinava solo per data e ora, e a
 * parità di secondo Postgres è libero di restituirle nell'ordine che gli
 * conviene: un ordine che può cambiare fra una lettura e l'altra.
 * Nessuna riga sparisce, ma la storia si racconta al contrario, e da
 * fuori sembra un'altra pratica.
 */
const RADICE = join(__dirname, "..");
/* Normalizziamo le terminazioni di riga: su Windows il file e' CRLF, e una
   ricerca che contiene "\n" non troverebbe una riga che finisce con "\r\n".
   Senza questo la prova falliva sul PC di Valerio ma passava nel cloud. */
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8").replace(/\r\n/g, "\n");

test("gli eventi si ordinano anche per id, non solo per data", () => {
  const f = leggi("lib/pratiche/pratiche.ts");
  const i = f.indexOf('.from("pratiche_eventi")\n      .select()');
  expect(i, "la lettura degli eventi deve esistere").toBeGreaterThan(-1);
  const lettura = f.slice(i, i + 1400);
  expect(lettura).toContain('.order("creato_il"');
  expect(
    lettura,
    "senza un secondo criterio l'ordine fra eventi dello stesso secondo è casuale",
  ).toContain('.order("id"');
});

test("il testo dell'elenco pratiche segue i fatti, non lo stato del database", () => {
  /* Allo stesso `sollecito` si arriva per silenzio o perché hanno
     risposto: l'elenco scriveva «sei settimane, nessuna risposta»
     accanto a una pratica in cui la risposta era arrivata. */
  const f = leggi("app/app/page.tsx");
  expect(f).toContain("percorso.chiaveTesto");
});

test("scegliere il motivo del no salva subito, senza un secondo bottone", () => {
  /* Valerio ha cliccato «maltempo» e non è successo niente di visibile:
     la scelta coloriva il riquadro e basta, e il bottone che salvava
     stava sotto il bordo dello schermo. Un gesto, un effetto. */
  const c = leggi("components/pratica/DichiaraRifiuto.tsx");
  expect(c, "il clic sul motivo deve mandare").toContain("void manda(m.motivo)");
  /* I commenti si tolgono prima di guardare: la spiegazione di perché il
     secondo bottone è sparito contiene il suo nome, ed è giusto così. */
  const senzaCommenti = c.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  expect(senzaCommenti, "il secondo bottone non deve tornare").not.toContain(
    "Preparami la risposta",
  );
  /* E l'effetto si deve vedere: la pagina si rifà col motivo nuovo. */
  expect(c).toContain("window.location.reload()");
});

test("il riquadro dei documenti sparisce dopo che il reclamo è partito", () => {
  /* «Se fai una cosa rimane tutto il resto vecchio»: la carta d'imbarco
     rinforza la lettera PRIMA che parta, dopo è solo una cosa rimasta
     accesa. */
  const p = leggi("lib/pratiche/passi.ts");
  /* `lastIndexOf`: la prima occorrenza è la dichiarazione del tipo. */
  const i = p.lastIndexOf("documentoExtra:");
  expect(p.slice(i, i + 120)).toContain("!reclamoPartito");
});
