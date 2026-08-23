import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

/**
 * IL CONTROLLO A CAMPIONE, E LE FRASI CHE DICEVANO IL FALSO.
 *
 * 🔴 Valerio, 13/08: «perché c'è ancora shadow mode quando l'avevamo
 * tolto? perché ci sono ancora le revisioni manuali quando il tutto è
 * stato generato? e poi le revisioni sono storte, la più recente è in
 * fondo».
 *
 * Il difetto vero non era la coda: era che il pannello continuava a
 * dichiarare un blocco che il 12/08 era stato tolto dalla cassa. Un
 * pannello che mente su cosa sta trattenendo i soldi è peggio di un
 * pannello che non c'è.
 *
 * Queste prove sono di testo perché il difetto era di testo. Una frase
 * sbagliata in un pannello non fa fallire niente: resta lì per settimane
 * e fa prendere decisioni sbagliate.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

/** Le righe vere del file: via i commenti, che spiegano il passato. */
function righeVive(sorgente: string): string[] {
  const fuori: string[] = [];
  let dentroBlocco = false;
  for (const riga of sorgente.split("\n")) {
    const t = riga.trim();
    if (t.startsWith("/*")) dentroBlocco = true;
    if (dentroBlocco) {
      if (t.includes("*/")) dentroBlocco = false;
      continue;
    }
    if (t.startsWith("//") || t.startsWith("*")) continue;
    fuori.push(riga);
  }
  return fuori;
}

test.describe("Il pannello non promette più un blocco che non esiste", () => {
  test("nessuna schermata dice che senza conferma il cliente non può pagare", () => {
    /* La frase esatta che c'era sulla Panoramica. Se qualcuno la
       riscrive, questa prova lo ferma: dal 12/08 il pagamento non
       aspetta nessuno, e prometterlo fa lavorare una coda che non
       trattiene un euro. */
    const schermate = [
      "app/admin/page.tsx",
      "app/admin/verdetti/page.tsx",
      "app/admin/impostazioni/page.tsx",
      "lib/admin/dati.ts",
    ];
    for (const f of schermate) {
      const vive = righeVive(leggi(f)).join("\n").toLowerCase();
      expect(vive, `${f}: dice che senza conferma non si può pagare`).not.toContain(
        "non possono pagare",
      );
      expect(vive, `${f}: dice che la conferma precede il pagamento`).not.toContain(
        "prima che quel cliente possa pagare",
      );
    }
  });

  test("il bottone non si chiama più Conferma: non confermava niente", () => {
    const vive = righeVive(leggi("app/admin/verdetti/page.tsx")).join("\n");
    expect(vive).toContain("Va bene");
    expect(vive).not.toContain(">Conferma<");
  });
});

test.describe("L'elenco è dal più recente", () => {
  test("l'ordinamento della coda dei verdetti è discendente", () => {
    const testo = leggi("app/admin/verdetti/page.tsx");
    const i = testo.indexOf('.eq("conferma", "in_attesa")');
    expect(i).toBeGreaterThan(0);
    const dopo = testo.slice(i, i + 600);
    expect(dopo).toContain('.order("creata_il", { ascending: false })');
    expect(dopo).not.toContain('.order("creata_il", { ascending: true })');
  });
});

test.describe("Quello che ferma davvero una vendita", () => {
  test("il cancello è la CORREZIONE, e sta sia sulla cassa sia sul webhook", () => {
    /* Se un domani sparisse da uno dei due, un caso dichiarato sbagliato
       tornerebbe vendibile da quella porta, in silenzio. */
    for (const f of [
      "app/api/pratiche/checkout/route.ts",
      // La cassa Stripe: il cancello sta nella funzione di evasione condivisa,
      // che il webhook Stripe chiama dopo aver verificato la firma.
      "lib/pratiche/evasione.ts",
    ]) {
      expect(leggi(f), f).toContain('conferma === "corretta"');
    }
  });

  test("«Va bene» non manda email e non tocca la vendita", () => {
    const testo = leggi("app/admin/azioni.ts");
    const i = testo.indexOf("export async function guardato");
    const j = testo.indexOf("export async function correggiVerifica");
    expect(i).toBeGreaterThan(0);
    const corpo = testo.slice(i, j);
    expect(corpo, "non deve spedire niente").not.toContain("spedisci");
    expect(corpo).toContain('conferma: "confermata"');
  });

  test("correggere senza scrivere il motivo non si può", () => {
    // Una vendita si blocca con un motivo scritto, non con un clic.
    const testo = leggi("app/admin/verdetti/page.tsx");
    const i = testo.indexOf('name="nota"');
    expect(i).toBeGreaterThan(0);
    expect(testo.slice(i, i + 120)).toContain("required");
  });
});
