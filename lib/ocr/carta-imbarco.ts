/**
 * La SECONDA FONTE: i documenti del passeggero, letti da Mistral OCR.
 *
 * Decisione di Valerio (8/08): la seconda fonte non è un'altra API di
 * voli (AviationStack free è solo tempo reale e licenza personale), sono
 * i documenti di chi vola: carta d'imbarco, email della compagnia,
 * comunicazione di ritardo. In un reclamo valgono più di un secondo
 * database: sono prova diretta.
 *
 * DIVISIONE DEI RUOLI, scolpita:
 * - l'OCR (AI) fa UNA cosa: trasforma l'immagine in testo;
 * - l'ESTRAZIONE dei campi è a regex, deterministica;
 * - il CONFRONTO con i dati verificati è deterministico;
 * - il VERDETTO non cambia mai qui: se i documenti discordano, la
 *   pratica va in conferma umana (shadow mode). L'AI non decide MAI.
 */

import { openAIAttivo, trascriviImmagineOpenAI } from "@/lib/ai/openai";

const MODELLO_OCR = "mistral-ocr-latest";

/* Cosa chiediamo al modello vision: trascrivere, non interpretare. I campi
   li tira fuori la regex qui sotto, deterministica. */
const ISTRUZIONE_OCR =
  "Trascrivi ESATTAMENTE tutto il testo che vedi in questa immagine, riga per riga, senza aggiungere, togliere o interpretare niente. È una carta d'imbarco, un biglietto aereo o una comunicazione di una compagnia aerea (email o screenshot). Riporta numeri di volo, date, orari, aeroporti e nomi così come appaiono. Se non c'è testo leggibile, rispondi con una riga vuota.";

export type EstrattoDocumento = {
  /** "FR4001" se trovato nel documento. */
  volo: string | null;
  /** "2026-08-06" se trovata. */
  data: string | null;
  /** Orari "HH:MM" trovati nel testo (max 6, in ordine di apparizione). */
  orari: string[];
  /** Le prime ~40 parole, per l'occhio umano in admin. */
  anteprima: string;
};

export type ConfrontoDocumento = {
  esito: "concorde" | "discorde" | "illeggibile";
  /** Cosa combacia e cosa no, per l'evento e per l'admin. */
  dettagli: string;
  estratto: EstrattoDocumento | null;
};

/** OCR via API Mistral: dentro base64, fuori il testo markdown. */
export async function testoDaDocumento(
  base64: string,
  tipoMime: string,
): Promise<string | null> {
  /* OpenAI (gpt-5.6-terra) legge l'immagine e la trascrive: è il modo
     nuovo, dal 27/08. Se non c'è la chiave OpenAI, o non torna niente e
     Mistral è ancora configurato, si ripiega sull'OCR di Mistral qui sotto
     (rete di sicurezza durante il passaggio; sparirà quando la chiave
     Mistral verrà tolta). */
  if (openAIAttivo()) {
    const trascritto = await trascriviImmagineOpenAI(base64, tipoMime, ISTRUZIONE_OCR);
    if (trascritto) return trascritto;
    if (!process.env.MISTRAL_API_KEY) return null;
  }

  const chiave = process.env.MISTRAL_API_KEY;
  if (!chiave) return null;
  try {
    const r = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chiave}`,
      },
      body: JSON.stringify({
        model: MODELLO_OCR,
        document: tipoMime === "application/pdf"
          ? { type: "document_url", document_url: `data:${tipoMime};base64,${base64}` }
          : { type: "image_url", image_url: `data:${tipoMime};base64,${base64}` },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      console.warn("[ocr] Mistral ha risposto", r.status);
      return null;
    }
    const dati = (await r.json()) as { pages?: { markdown?: string }[] };
    const testo = (dati.pages ?? [])
      .map((p) => p.markdown ?? "")
      .join("\n")
      .trim();
    return testo || null;
  } catch (e) {
    console.warn("[ocr] chiamata fallita:", e);
    return null;
  }
}

/* ─────────────────── I MESI COME LI STAMPANO LE CARTE D'IMBARCO ─────────
   Quasi nessuna carta d'imbarco scrive "06/08/2026": scrivono "06AUG",
   "06 AUG 26", "6 AGO 2026". Senza queste tabelle il lettore falliva
   proprio sul documento per cui è nato. */
const MESI: Record<string, number> = {
  JAN: 1, GEN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5, MAG: 5,
  JUN: 6, GIU: 6,
  JUL: 7, LUG: 7,
  AUG: 8, AGO: 8,
  SEP: 9, SET: 9,
  OCT: 10, OTT: 10,
  NOV: 11,
  DEC: 12, DIC: 12,
};

/**
 * Le sigle davanti a cui un numero NON è un volo: gate, posto, fila,
 * sequenza. Senza questo filtro "GATE B12" diventava il volo "B12".
 */
const NON_VOLO = /(GATE|SEAT|POSTO|POSTI|SEQ|ROW|FILA|VARCO|BOARDING\s?ZONE|ZONE)\s*$/i;

/** I due caratteri iniziali delle compagnie che trattiamo davvero. */
const CODICI_NOTI = new Set([
  "FR", "U2", "W6", "AZ", "XZ", "VY", "V7", "LH", "AF", "KL",
  "BA", "IB", "DY", "LX", "OS", "TK", "EK", "QR", "UX", "HV",
]);

/**
 * Da giorno e mese senza anno all'anno giusto.
 * Una carta d'imbarco che arriva a noi è di un volo GIÀ FATTO: se col
 * anno corrente la data cadesse nel futuro, allora era l'anno scorso.
 */
function annoSensato(giorno: number, mese: number): number {
  const oggi = new Date();
  const anno = oggi.getUTCFullYear();
  const conQuestAnno = Date.UTC(anno, mese - 1, giorno);
  // Un giorno di margine: il fuso può spostare "oggi" di poche ore.
  return conQuestAnno > oggi.getTime() + 86_400_000 ? anno - 1 : anno;
}

/** Estrazione DETERMINISTICA dei campi dal testo OCR. Zero AI qui. */
export function estraiCampi(testo: string): EstrattoDocumento {
  /* Numero volo: 2 alfanumerici + 1-4 cifre (FR4001, U2 1234, AZ 610).
     Si raccolgono TUTTI i candidati e si preferisce quello di una
     compagnia che conosciamo: su una carta d'imbarco ci sono altri
     codici (posto, gate, coda) che la sola prima occorrenza sbagliava. */
  const candidati: { codice: string; numero: string; prima: string }[] = [];
  for (const m of testo.matchAll(/\b([A-Z][A-Z0-9])\s?0*([0-9]{1,4})\b/g)) {
    candidati.push({
      codice: m[1].toUpperCase(),
      numero: m[2],
      prima: testo.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0),
    });
  }
  const utili = candidati.filter((c) => !NON_VOLO.test(c.prima));
  const scelto = utili.find((c) => CODICI_NOTI.has(c.codice)) ?? utili[0] ?? null;

  // Date: 2026-08-06, 06/08/2026, e le forme delle carte d'imbarco.
  const dataIso = testo.match(/\b(20\d{2})-([01]\d)-([0-3]\d)\b/);
  const dataIt = testo.match(/\b([0-3]?\d)[/.]([01]?\d)[/.](20\d{2})\b/);
  const dataMese = testo.match(
    /\b([0-3]?\d)\s?(JAN|GEN|FEB|MAR|APR|MAY|MAG|JUN|GIU|JUL|LUG|AUG|AGO|SEP|SET|OCT|OTT|NOV|DEC|DIC)\s?(\d{4}|\d{2})?\b/i,
  );

  let data: string | null = null;
  if (dataIso) {
    data = `${dataIso[1]}-${dataIso[2]}-${dataIso[3]}`;
  } else if (dataIt) {
    const g = dataIt[1].padStart(2, "0");
    const m = dataIt[2].padStart(2, "0");
    data = `${dataIt[3]}-${m}-${g}`;
  } else if (dataMese) {
    const giorno = Number(dataMese[1]);
    const mese = MESI[dataMese[2].toUpperCase()];
    const grezzo = dataMese[3];
    /* Anno scritto (2026 o 26) oppure dedotto: mai inventato in avanti,
       perché un volo nel futuro non si può ancora verificare. */
    const anno = grezzo
      ? grezzo.length === 4
        ? Number(grezzo)
        : 2000 + Number(grezzo)
      : annoSensato(giorno, mese);
    if (giorno >= 1 && giorno <= 31 && mese) {
      data = `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
    }
  }

  const orari = [...testo.matchAll(/\b([0-2]\d):([0-5]\d)\b/g)]
    .map((m) => `${m[1]}:${m[2]}`)
    .slice(0, 6);

  return {
    volo: scelto ? `${scelto.codice}${scelto.numero}` : null,
    data,
    orari,
    anteprima: testo.split(/\s+/).slice(0, 40).join(" "),
  };
}

/**
 * Il confronto coi dati verificati del volo. Deterministico:
 * - volo E data combaciano → concorde;
 * - uno dei due è diverso → discorde (conferma umana);
 * - non si legge niente di utile → illeggibile (non sporca il verdetto).
 */
export function confrontaConVerifica(
  estratto: EstrattoDocumento,
  voloVerificato: string,
  dataVerificata: string,
): ConfrontoDocumento {
  if (!estratto.volo && !estratto.data) {
    return {
      esito: "illeggibile",
      dettagli: "Dal documento non si leggono volo o data.",
      estratto,
    };
  }
  const voloOk = estratto.volo === null || estratto.volo === voloVerificato.toUpperCase();
  const dataOk = estratto.data === null || estratto.data === dataVerificata;
  if (voloOk && dataOk) {
    const visti = [
      estratto.volo ? `volo ${estratto.volo}` : null,
      estratto.data ? `data ${estratto.data}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      esito: "concorde",
      dettagli: `Il documento concorda coi dati verificati (${visti}).`,
      estratto,
    };
  }
  const problemi: string[] = [];
  if (!voloOk) problemi.push(`volo nel documento ${estratto.volo}, verificato ${voloVerificato}`);
  if (!dataOk) problemi.push(`data nel documento ${estratto.data}, verificata ${dataVerificata}`);
  return {
    esito: "discorde",
    dettagli: `Il documento NON concorda: ${problemi.join("; ")}. Serve la verifica umana.`,
    estratto,
  };
}
