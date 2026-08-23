import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TETTO_ORA } from "@/lib/api/tetto-fornitore";

/**
 * IL FRENO, E COSA DEVE DIFENDERE.
 *
 * Il rischio non è teorico: le chiamate al fornitore dei dati di volo si
 * pagano, e il sito le fa per chiunque, senza account. Un estraneo che
 * gira un elenco di voli ci svuota il portafoglio senza comprare niente.
 *
 * Ci sono due difese e fanno due mestieri diversi:
 *  - il freno per IP («questo signore esagera»), che vale davvero solo
 *    col contatore condiviso, perché quello in memoria vive dentro una
 *    copia sola della funzione;
 *  - il tetto orario sulle chiamate («oggi abbiamo speso abbastanza»),
 *    che non guarda chi chiama e funziona anche con cento indirizzi
 *    diversi.
 */

const RADICE = process.cwd();

/** Legge una rotta togliendo i commenti: un difetto non si nasconde in una spiegazione. */
function codice(percorso: string): string {
  return readFileSync(join(RADICE, percorso), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Tutte le rotte dell'API, cercate a mano nella cartella. */
function rotte(dir = "app/api"): string[] {
  const trovate: string[] = [];
  for (const voce of readdirSync(join(RADICE, dir), { withFileTypes: true })) {
    const dentro = `${dir}/${voce.name}`;
    if (voce.isDirectory()) trovate.push(...rotte(dentro));
    else if (voce.name === "route.ts") trovate.push(dentro);
  }
  return trovate;
}

test("ogni rotta che ci costa soldi passa dal freno condiviso", () => {
  /* Le rotte che chiamano il fornitore dei dati di volo, leggono un
     documento con l'AI o emettono una ricevuta. Sono quelle dove una
     richiesta in più è un euro in meno. */
  const care = [
    "app/api/verifica/route.ts",
    "app/api/verifica/cancellato/route.ts",
    "app/api/verifica/dichiara/route.ts",
    "app/api/verifica/operativo/route.ts",
    "app/api/voli-tratta/route.ts",
    "app/api/leggi-carta/route.ts",
  ];
  for (const rotta of care) {
    const testo = codice(rotta);
    expect(testo, `${rotta} deve usare il freno condiviso`).toContain("oltreIlLimiteCondiviso");
  }
});

test("il tetto sulla spesa sta dove passano TUTTE le chiamate, non rotta per rotta", () => {
  /* Se il conto si facesse nelle rotte, la rotta numero sei nascerebbe
     senza. Sta nella funzione che parla col fornitore: da lì non si
     scappa. */
  const chiamata = codice("lib/voli/fornitori/chiamata.ts");
  expect(chiamata).toContain("segnaChiamataFornitore");
  const primaDelCiclo = chiamata.indexOf("segnaChiamataFornitore(");
  const ciclo = chiamata.indexOf("for (let tentativo");
  expect(primaDelCiclo).toBeGreaterThan(-1);
  expect(ciclo).toBeGreaterThan(-1);
  /* Fuori dal ciclo dei ritentativi: un fornitore che fa i capricci non
     deve consumare il tetto tre volte per una chiamata sola. */
  expect(primaDelCiclo).toBeLessThan(ciclo);
});

test("il tetto è un numero sensato, e si può cambiare senza toccare il codice", () => {
  expect(TETTO_ORA).toBeGreaterThan(100);
  expect(codice("lib/api/tetto-fornitore.ts")).toContain("TETTO_FORNITORE_ORA");
});

test("il contatore del tetto non tiene traccia di nessuno", () => {
  /* ⚠️ È l'unica cosa che rende questo contatore accettabile: conta i
     fatti, non le persone. Un contatore per IP sul database sarebbe
     l'unico posto del sito dove teniamo traccia di chi passa, e la
     privacy dichiara il contrario (giro #56). */
  const testo = codice("lib/api/tetto-fornitore.ts");
  for (const vietato of ["ipDi", "x-forwarded-for", "x-nf-client-connection-ip"]) {
    expect(testo, `il tetto non deve usare ${vietato}`).not.toContain(vietato);
  }
});

test("se il conto non si può fare, non si blocca nessuno", () => {
  /* Un freno rotto che chiude il sito a tutti fa più danni del freno
     assente: il primo ferma le vendite, il secondo costa qualche euro. */
  const testo = readFileSync(join(RADICE, "lib/api/tetto-fornitore.ts"), "utf8");
  const ritorni = [...testo.matchAll(/return \{ chiuso: (\w+), fatte: null \}/g)].map((m) => m[1]);
  expect(ritorni.length).toBeGreaterThanOrEqual(3);
  for (const r of ritorni) expect(r).toBe("false");
});

test("nessuna rotta nuova nasce senza difesa, se tocca il fornitore", () => {
  /* Rete di sicurezza per il futuro: se una rotta nomina verificaVolo o
     il lettore dei documenti, deve avere una porta chiusa di qualche
     tipo.
     ⚠️ Le due porte non sono la stessa cosa e vanno bene tutte e due: il
     freno per IP serve alle rotte PUBBLICHE, la parola segreta del
     motore serve ai lavori automatici, che non li chiama nessuna
     persona. Pretendere il freno anche lì sarebbe una regola scritta
     male: il cron notturno gira una volta e non ha un IP da limitare. */
  for (const rotta of rotte()) {
    const testo = codice(rotta);
    const costa = /verificaVolo|testoDaDocumento|chiamaConRitentativo/.test(testo);
    if (!costa) continue;
    expect(testo, `${rotta} chiama roba a pagamento senza nessuna porta`).toMatch(
      /oltreIlLimite|chiamataAutorizzata/,
    );
  }
});
