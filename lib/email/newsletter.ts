import { casa } from "./posta";
import { bottone, COLORI as C, FONT, firma, rigaScalo } from "./modello";
import { completaOpenAI, openAIAttivo } from "@/lib/ai/openai";
import { ritardiAeroporti } from "@/lib/osservatorio/ritardi";
import { scioperiInArrivo, type ScioperoPubblico } from "@/lib/scioperi/scioperi";
import { seSiPaga } from "@/lib/check/ingresso";

/**
 * LA NEWSLETTER SETTIMANALE DELL'OSSERVATORIO.
 *
 * 🔴 Prima non esisteva: il sito prometteva "una email a settimana" e non
 * la mandava nessuno (l'iscritto riceveva conferma + benvenuto, poi
 * silenzio). Questo file la costruisce davvero. La manda il cron del
 * lunedì (netlify/functions/newsletter.mjs → /api/motore/newsletter).
 *
 * LA REGOLA CHE CONTA (scelta di Valerio, 28/08): dati veri, AI attorno.
 * I NUMERI (indici dei ritardi, date degli scioperi, le fasce) li mette il
 * CODICE, dai nostri dati. L'AI scrive solo il testo di contorno, caldo e
 * professionale, e un cancello lo butta se ci infila una cifra: una
 * newsletter pubblica col nostro nome sopra non può dire un numero
 * inventato. È la stessa disciplina della lettera di reclamo.
 */

const p = (testo: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.fumo};">${testo}</p>`;

const h = (testo: string) =>
  `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:27px;line-height:1.2;color:${C.inchiostro};font-weight:700;letter-spacing:-0.5px;">${testo}</h1>`;

const sopratitolo = (testo: string) =>
  `<p style="margin:26px 0 4px;font-family:${FONT};font-size:12.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.verde};">${testo}</p>`;

/** "2026-09-05" → "venerdì 5 settembre", in ora italiana. */
export function dataLeggibile(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  });
}

/** Il tipo di sciopero, in parole per chi legge. */
const ETICHETTA_TIPO: Record<ScioperoPubblico["tipo"], string> = {
  personale_compagnia: "personale di una compagnia aerea",
  atc_esterno: "controllori di volo",
  handling: "addetti a terra (handling)",
  generale: "sciopero generale",
  altro: "trasporto aereo",
};

/** L'introduzione di riserva, senza numeri, quando l'AI non c'è o sgarra. */
export const INTRO_FISSA =
  "Ecco l'Osservatorio della settimana: come stanno andando i cieli italiani in questi giorni, e cosa c'è in calendario. Se di recente hai preso un volo andato storto, in fondo trovi come controllare in trenta secondi se ti spettano dei soldi.";

/**
 * IL CANCELLO DEI NUMERI. L'AI scrive il contorno, le cifre le mette il
 * codice: se il modello infila una cifra, un euro, una percentuale o il
 * trattino lungo (vietato nei testi), il suo testo si butta e vale
 * l'intro fissa. Vero solo se il testo è pulito e non vuoto.
 */
export function introPulita(testo: string): boolean {
  return testo.trim().length > 0 && !/[0-9€%]/.test(testo) && !testo.includes("—");
}

async function introAI(contesto: string): Promise<string> {
  if (!openAIAttivo() || !contesto) return INTRO_FISSA;
  const sistema = `Scrivi l'introduzione di "L'Osservatorio dei Disservizi", la newsletter settimanale di Rivolio, un servizio che aiuta i passeggeri a riprendersi i soldi che le compagnie aeree devono per voli in ritardo o cancellati (Regolamento CE 261/2004).
Regole ferree, non negoziabili:
- Dai del tu. Frasi corte. Tono caldo ma professionale, mai da ufficio stampa. Ti firmi Valerio (la firma la mette il sistema, tu non firmarti).
- Scrivi SOLO 2 o 3 frasi di introduzione. Niente titoli, niente elenchi.
- NON scrivere MAI numeri, cifre, importi in euro, date, percentuali, né confronti quantitativi ("il doppio", "il triplo", "più del solito"): i dati veri li aggiunge il sistema SOTTO la tua introduzione. Se ti viene da scrivere una quantità, gira la frase e resta sul qualitativo.
- MAI il trattino lungo.
- Rispondi in JSON: {"intro": "..."}.`;
  const utente = `Questa settimana, sotto la tua introduzione, il sistema mostrerà:\n${contesto}\n\nScrivi un'introduzione che invita a dare un'occhiata a questi dati e che tiene caldo il legame con chi legge. Ricorda che è una cosa gratuita e utile, non una vendita.`;
  const grezzo = await completaOpenAI({ sistema, utente, json: true, maxTokens: 350, timeoutMs: 12_000 });
  if (!grezzo) return INTRO_FISSA;
  try {
    const j = JSON.parse(grezzo) as { intro?: unknown };
    const intro = typeof j.intro === "string" ? j.intro.trim() : "";
    return introPulita(intro) ? intro : INTRO_FISSA;
  } catch {
    return INTRO_FISSA;
  }
}

export type Newsletter = { oggetto: string; corpo: string; testo: string };

/**
 * Compone la newsletter UNA volta (una sola chiamata all'AI), condivisa da
 * tutti gli iscritti. Il link di disdetta cambia da persona a persona: lo
 * aggiunge chi manda (la rotta), avvolgendo `corpo` in `vestito`.
 *
 * Torna null se questa settimana non c'è NIENTE da dire (né ritardi né
 * scioperi): meglio il silenzio di un'email vuota che allena la gente a
 * ignorarci.
 */
export async function componiNewsletter(): Promise<Newsletter | null> {
  const [ritardiTutti, scioperiTutti] = await Promise.all([
    ritardiAeroporti(),
    scioperiInArrivo(6),
  ]);

  const ritardi = ritardiTutti
    .filter((r) => r.indice !== null)
    .sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0));
  const scioperi = scioperiTutti ?? [];

  if (ritardi.length === 0 && scioperi.length === 0) return null;

  // Il contesto per l'AI: le PAROLE, non i numeri (quelli non li deve ripetere).
  const contesto = [
    ritardi.length
      ? `Alcuni aeroporti italiani con ritardi in corso: ${ritardi.map((r) => r.nome).join(", ")}.`
      : "Gli aeroporti italiani sono sostanzialmente in orario.",
    scioperi.length
      ? `Scioperi in arrivo che toccano il trasporto aereo: ${scioperi.map((s) => ETICHETTA_TIPO[s.tipo]).join("; ")}.`
      : "In calendario non risultano scioperi.",
  ].join("\n");

  const intro = await introAI(contesto);

  // ── I NUMERI, resi dal codice dai dati veri ──────────────────────────
  const tabellaRitardi = ritardi.length
    ? sopratitolo("Gli aeroporti italiani, adesso") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">${ritardi
        .map((r) =>
          rigaScalo(
            r.nome,
            r.indice!.toLocaleString("it-IT", { maximumFractionDigits: 1 }),
            r.medianaMinuti !== null ? `mediana ${r.medianaMinuti} min di ritardo` : "indice ritardi",
          ),
        )
        .join("")}</table>` +
      `<p style="margin:8px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.fumo2};">Indice da 0 (tutto in orario) a 5, sugli arrivi delle ultime due ore. Fonte: tracciamento AeroDataBox.</p>`
    : "";

  const listaScioperi = scioperi.length
    ? sopratitolo("Scioperi in arrivo") +
      scioperi
        .map(
          (s) =>
            `<p style="margin:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.fumo};"><strong style="color:${C.inchiostro};">${dataLeggibile(s.data)}</strong>: ${s.descrizione || `sciopero ${ETICHETTA_TIPO[s.tipo]}`}. ${
              s.tipo === "personale_compagnia"
                ? "Se il tuo volo salta per questo, in genere la compensazione spetta."
                : "Se il tuo volo salta, dipende dalla causa: controllalo."
            }</p>`,
        )
        .join("")
    : "";

  const corpo =
    h("L'Osservatorio della settimana") +
    p(intro) +
    tabellaRitardi +
    listaScioperi +
    bottone(seSiPaga("Controlla un tuo volo", "Controlla un tuo volo, gratis"), `${casa()}/app`) +
    p(
      `<strong style="color:${C.inchiostro}">Un volo andato storto nell'ultimo anno?</strong> Se è atterrato con più di tre ore di ritardo, il check ti dice in trenta secondi in che fascia rientri: 250, 400 o 600 euro.`,
    ) +
    firma();

  const oggetto = scioperi.length
    ? `L'Osservatorio: i ritardi della settimana e ${scioperi.length === 1 ? "uno sciopero" : `${scioperi.length} scioperi`} in arrivo`
    : "L'Osservatorio: i ritardi della settimana sui cieli italiani";

  const testo =
    `L'Osservatorio della settimana\n\n${intro}\n\n` +
    (ritardi.length
      ? `Gli aeroporti italiani adesso:\n${ritardi
          .map(
            (r) =>
              `- ${r.nome}: ${r.indice!.toLocaleString("it-IT", { maximumFractionDigits: 1 })}/5${r.medianaMinuti !== null ? ` (mediana ${r.medianaMinuti} min)` : ""}`,
          )
          .join("\n")}\n\n`
      : "") +
    (scioperi.length
      ? `Scioperi in arrivo:\n${scioperi.map((s) => `- ${dataLeggibile(s.data)}: ${s.descrizione || `sciopero ${ETICHETTA_TIPO[s.tipo]}`}`).join("\n")}\n\n`
      : "") +
    `${seSiPaga("Controlla un tuo volo", "Controlla un tuo volo, gratis")}: ${casa()}/app\n\nValerio\nRivolio`;

  return { oggetto, corpo, testo };
}
