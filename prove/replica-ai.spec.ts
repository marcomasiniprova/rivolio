import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { controlla, fontiAmmesse } from "../lib/ai/replica";
import {
  costruisciDossier,
  dossierInParole,
  paragrafoSuMisura,
  EVENTO_ANALISI_RIFIUTO,
} from "../lib/pratiche/dossier";
import type { Pratica } from "../lib/pratiche/pratiche";

/**
 * L'AI SCRIVE, MA NON PUÒ INVENTARE.
 *
 * Scelta di Valerio col popup del 13/08: il modello legge la risposta
 * della compagnia e scrive il paragrafo del caso; sentenze e principi
 * però li prende solo dal nostro archivio verificato.
 *
 * Queste prove sono sul CANCELLO, cioè sull'unica cosa che sta fra un
 * modello che sbrocca e una lettera che il cliente manda col nostro nome
 * sopra. Il modello non si prova (risponde diverso ogni volta e costa a
 * chiamata); si prova quello che succede quando risponde male.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

const pratica = {
  id: "p1",
  utente_id: "u1",
  verifica_id: "v1",
  volo_id: "vo1",
  stato: "sollecito",
  tipo: "singola",
  passeggeri: [{ nome: "Mario", cognome: "Rossi" }],
  importo_fascia: 600,
  prezzo_pagato: null,
  ordine_pagamento: null,
  email: "mario@esempio.it",
  scadenza_stimata: null,
  garanzia_fino_al: null,
  inviata_il: "2026-08-13T10:00:00Z",
  rifiuto_motivo: "meteo",
  creata_il: "2026-08-12T22:52:00Z",
  aggiornata_il: "2026-08-13T10:00:00Z",
} as unknown as Pratica;

const dossier = costruisciDossier({
  pratica,
  volo: {
    volo_iata: "ZZ600",
    data_locale: "2026-08-11",
    vettore_operativo: "ZZ",
    partenza_citta: "Roma",
    arrivo_citta: "New York",
    km_ortodromica: 6500,
    fonte: "demo",
    arrivo_previsto_utc: "2026-08-11T18:00:00Z",
    arrivo_effettivo_utc: "2026-08-11T23:05:00Z",
  },
  verifica: { importo: 600, ritardo_minuti: 305, motivo: "Arrivo con 5 h e 5 min di ritardo" },
  eventi: [],
});

/** Un paragrafo scritto bene, che deve passare. */
const BUONO = `La vostra risposta riconduce il ritardo alle condizioni meteorologiche del mattino dell'11 agosto, mentre il volo era programmato in serata. Non è sufficiente che quel giorno vi fossero condizioni avverse nello scalo: occorre che esse abbiano inciso su questo specifico volo. Vi chiedo di indicare l'orario e la natura del fenomeno e la sua incidenza sulla rotazione dell'aeromobile assegnato a questo volo, come previsto dall'articolo 5 del Regolamento.`;

test.describe("Il cancello sul testo generato", () => {
  test("un paragrafo scritto bene passa", () => {
    expect(controlla(BUONO, dossier)).toEqual({ ok: true });
  });

  test("🔴 una sentenza fuori archivio fa buttare via tutto", () => {
    const finto = `${BUONO} Si veda in proposito Corte di giustizia UE, causa C-999/99.`;
    const esito = controlla(finto, dossier);
    expect(esito.ok).toBe(false);
    expect(!esito.ok && esito.motivo).toContain("C-999/99");
  });

  test("le sentenze che usiamo davvero passano", () => {
    // Wallentin-Hermann è nel nostro archivio: deve restare utilizzabile.
    const vero = `${BUONO} Si veda Corte di giustizia UE, causa C-549/07.`;
    expect(controlla(vero, dossier).ok).toBe(true);
  });

  test("🔴 «come stabilito dalla giurisprudenza» senza dire quale non passa", () => {
    /* È il modo elegante di inventarsi una sentenza: chi legge la lettera
       non può controllare niente, e chi la manda non sa cosa sta dicendo. */
    const vago = `${BUONO} La giurisprudenza costante è in questo senso.`;
    const esito = controlla(vago, dossier);
    expect(esito.ok).toBe(false);
  });

  test("🔴 la Cassazione non è nel nostro archivio, quindi non si cita", () => {
    const cass = `${BUONO} Lo ha ribadito la Corte di Cassazione, causa C-549/07.`;
    expect(controlla(cass, dossier).ok).toBe(false);
  });

  test("🔴 un articolo che non usiamo non passa", () => {
    const art = `${BUONO} Come previsto dall'articolo 42 del Regolamento.`;
    const esito = controlla(art, dossier);
    expect(esito.ok).toBe(false);
    expect(!esito.ok && esito.motivo).toContain("42");
  });
});

test.describe("Le cifre non si inventano", () => {
  test("🔴 una somma che non è nel fascicolo blocca il paragrafo", () => {
    // Promettere più di quanto spetta è il danno peggiore di tutti.
    const gonfio = `${BUONO} Vi chiedo pertanto il pagamento di 1200 euro.`;
    const esito = controlla(gonfio, dossier);
    expect(esito.ok).toBe(false);
    expect(!esito.ok && esito.motivo).toContain("1200");
  });

  test("l'importo vero del fascicolo passa", () => {
    expect(controlla(`${BUONO} Vi chiedo il pagamento di 600 euro.`, dossier).ok).toBe(true);
  });

  test("le fasce di legge passano: sono fatti, non promesse nostre", () => {
    for (const f of ["250", "400", "600"]) {
      expect(controlla(`${BUONO} La fascia applicabile è di ${f} euro.`, dossier).ok, f).toBe(true);
    }
  });
});

test.describe("Non si spaccia per quello che non è", () => {
  test("🔴 promettere un esito non passa", () => {
    expect(controlla(`${BUONO} Vi assicuro che otterrò quanto dovuto.`, dossier).ok).toBe(false);
  });

  test("🔴 spacciarsi per uno studio legale non passa", () => {
    expect(controlla(`${BUONO} Scrivo per conto dello studio legale incaricato.`, dossier).ok).toBe(
      false,
    );
  });

  test("🔴 una firma non passa: è un paragrafo, non una lettera", () => {
    expect(controlla(`${BUONO}\n\nCordiali saluti`, dossier).ok).toBe(false);
  });

  test("un paragrafo troppo corto o troppo lungo non passa", () => {
    expect(controlla("Non sono d'accordo.", dossier).ok).toBe(false);
    expect(controlla(BUONO + " lorem ipsum".repeat(400), dossier).ok).toBe(false);
  });
});

test.describe("Il fascicolo", () => {
  test("dice «non lo sappiamo» dove non sappiamo, mai zero", () => {
    const vuoto = costruisciDossier({
      pratica: { ...pratica, importo_fascia: null } as Pratica,
      volo: null,
      verifica: null,
      eventi: [],
    });
    const parole = dossierInParole(vuoto);
    expect(parole).toContain("non lo sappiamo");
    expect(parole).not.toContain(": 0");
  });

  test("i numeri veri arrivano al modello con la loro unità", () => {
    const parole = dossierInParole(dossier);
    expect(parole).toContain("305 minuti");
    expect(parole).toContain("6500 km");
    expect(parole).toContain("600 euro");
    expect(parole).toContain("Roma → New York");
  });

  test("il totale è la fascia per i passeggeri, non un numero a caso", () => {
    const famiglia = costruisciDossier({
      pratica: {
        ...pratica,
        passeggeri: [
          { nome: "A", cognome: "B" },
          { nome: "C", cognome: "D" },
        ],
      } as Pratica,
      volo: null,
      verifica: { importo: 600 },
      eventi: [],
    });
    expect(famiglia.diritto.totale).toBe(1200);
  });
});

test.describe("Il paragrafo su misura arriva alla lettera", () => {
  const evento = (nota: string) => [{ tipo: EVENTO_ANALISI_RIFIUTO, nota }];

  test("si legge dall'ultima analisi", () => {
    expect(paragrafoSuMisura(evento(JSON.stringify({ paragrafo: BUONO })))).toBe(BUONO);
  });

  test("un JSON rotto non finisce nella lettera", () => {
    expect(paragrafoSuMisura(evento("{non è json"))).toBe(null);
  });

  test("un paragrafo scartato (null) non finisce nella lettera", () => {
    expect(paragrafoSuMisura(evento(JSON.stringify({ paragrafo: null })))).toBe(null);
  });

  test("vale l'ULTIMA analisi, non la prima", () => {
    const eventi = [
      { tipo: EVENTO_ANALISI_RIFIUTO, nota: JSON.stringify({ paragrafo: BUONO }) },
      { tipo: EVENTO_ANALISI_RIFIUTO, nota: JSON.stringify({ paragrafo: `${BUONO} Secondo giro.` }) },
    ];
    expect(paragrafoSuMisura(eventi)).toContain("Secondo giro.");
  });

  test("la lettera aggiunge il paragrafo, non sostituisce quello verificato", () => {
    const genera = leggi("lib/lettera/genera.ts");
    // Il testo fisso del motivo resta, e il su misura viene dopo.
    expect(genera).toContain("${scheda.replica}${paragrafoSuMisura");
  });
});

test.describe("Le regole di casa reggono anche qui", () => {
  test("il modello riceve l'elenco chiuso delle fonti che può citare", () => {
    const fonti = fontiAmmesse();
    expect(fonti.length).toBeGreaterThan(4);
    expect(fonti.some((f) => f.includes("C-549/07"))).toBe(true);
    expect(leggi("lib/ai/replica.ts")).toContain("fontiAmmesse()");
  });

  test("temperatura zero: su una lettera legale la fantasia non è una qualità", () => {
    expect(leggi("lib/ai/replica.ts")).toContain("temperature: 0");
  });

  test("lo screenshot della risposta non si salva", () => {
    const rotta = leggi("app/api/pratiche/[id]/risposta/route.ts");
    expect(rotta).toContain("testoDaDocumento");
    // Nessuna scrittura dell'immagine da nessuna parte.
    expect(rotta).not.toContain("storage");
    expect(rotta).not.toContain("upload");
  });

  test("il paragrafo non torna al browser: la lettera è quello che si paga", () => {
    const rotta = leggi("app/api/pratiche/[id]/risposta/route.ts");
    const i = rotta.lastIndexOf("NextResponse.json(");
    expect(rotta.slice(i)).not.toContain("paragrafo:");
    expect(rotta.slice(i)).toContain("suMisura:");
  });
});
