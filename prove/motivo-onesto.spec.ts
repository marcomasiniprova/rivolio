import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { valuta, type FattoVolo } from "@/lib/regole/eu261";

/**
 * 🔴 DUE MODI DI DIRE LA COSA SBAGLIATA A CHI HA APPENA PAGATO.
 *
 * Trovati col collaudo del 13/08, provando dieci voli sul sito vero.
 *
 * 1. Di due voli il fornitore non sapeva niente, e la pagina rispondeva
 *    "non riconosciamo l'aeroporto di partenza": dava la colpa alla
 *    nostra copertura degli scali per un volo di cui non avevamo NESSUN
 *    dato. Chi legge non può farci niente.
 * 2. La frase onesta sui voli appena fatti ("il dato arriva entro un
 *    giorno, oppure il numero non è quello giusto") veniva scritta DOPO
 *    il salvataggio: nel database finiva quella grezza, e la pagina del
 *    verdetto legge il database. Scritta a giugno, mai letta da nessuno.
 */

const base: FattoVolo = {
  voloIata: "XX123",
  dataLocale: "2026-01-15",
  partenzaIata: null,
  arrivoIata: null,
  partenzaCitta: null,
  arrivoCitta: null,
  arrivoPrevistoUtc: null,
  arrivoEffettivoUtc: null,
  stato: "sconosciuto",
  kmOrtodromica: null,
  vettoreOperativo: "XX",
  fonte: "aerodatabox",
};

test("di un volo che non conosciamo non si dà la colpa all'aeroporto", () => {
  const v = valuta(base);
  expect(v.esito).toBe("incerto");
  expect(v.motivo).toContain("Non abbiamo ancora un dato certo");
  expect(v.motivo).not.toContain("aeroporto di partenza");
});

test("con lo scalo di partenza noto il cancello territoriale resta il primo", () => {
  /* La scorciatoia vale solo quando non c'è niente su cui applicare il
     cancello: qui lo scalo c'è, e il cancello deve parlare lui. È il
     controllo che impedisce di indebolire la difesa contro i falsi
     positivi mentre si sistema un messaggio. */
  const v = valuta({ ...base, partenzaIata: "JFK", partenzaPaese: "US" });
  expect(v.esito).toBe("incerto");
  expect(v.motivo).toContain("aeroporto");
});

test("il motivo si finisce PRIMA di scriverlo nel database", () => {
  /* La pagina del verdetto legge la riga salvata, non la risposta della
     rotta: se la frase buona si scrive dopo l'insert, non la legge mai
     nessuno. Qui si guarda l'ordine nel file, che è l'unico posto dove
     questo difetto può tornare. */
  const codice = readFileSync("lib/voli/verifica.ts", "utf8");
  const frase = codice.indexOf("non abbiamo ancora l'orario di arrivo certificato");
  const salvataggio = codice.indexOf('.from("verifiche")');
  expect(frase).toBeGreaterThan(-1);
  expect(salvataggio).toBeGreaterThan(-1);
  expect(frase).toBeLessThan(salvataggio);
});
