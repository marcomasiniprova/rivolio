import type { FattoVolo, Verdetto } from "@/lib/regole/eu261";
import type { Passeggero, Pratica } from "@/lib/pratiche/pratiche";
import { type CanaleCompagnia, compagniaPerVettore } from "./compagnie";
import { paeseDiScalo } from "@/lib/regole/territorio";
import { ELENCO_UFFICIALE_NEB, nebPerPaese, nomeBreveNeb } from "./neb";
import { type MotivoRifiuto, schedaRifiuto } from "@/lib/pratiche/rifiuto";

import {
  corpoDichiarato,
  oggettoDichiarato,
  type DatiDichiarazione,
} from "./dichiarati";
/**
 * Il generatore di documenti (strato 5, SPEC §4). In v1 è un modello
 * RIGIDO e deterministico: stesso input, stessa lettera, per sempre.
 * Qui non entra nessun LLM, e non è un ripiego: una lettera legale non
 * può cambiare tono a seconda del giorno, e ogni parola deve essere
 * difendibile davanti alla compagnia.
 *
 * Regole del testo:
 * - formale ma umano: niente latinismi da azzeccagarbugli, niente
 *   minacce vuote. Si annuncia solo ciò che il prodotto fa davvero
 *   (sollecito, reclamo ENAC).
 * - ogni numero ha accanto il suo perché (ritardo, tratta, fascia).
 * - le coordinate di pagamento restano campi da compilare: i soldi
 *   passano dal passeggero, mai da noi.
 *
 * I riferimenti citati (verificati con ricerca web il 2026-08-07):
 * - Artt. 5 e 7 del Regolamento (CE) n. 261/2004.
 * - CGUE, sentenza 19 novembre 2009, cause riunite C-402/07 e C-432/07
 *   (Sturgeon): il ritardo all'arrivo di 3 ore o più dà diritto alla
 *   stessa compensazione della cancellazione, salvo circostanze
 *   eccezionali. La sentenza è pubblicata anche da ENAC
 *   (enac.gov.it/app/uploads/2024/04/sentenza_091119_ritardosopra3ore.pdf).
 */

export type Lettera = { oggetto: string; corpo: string };

/**
 * LA RIGA CHE DICE COS'È QUESTA LETTERA, in fondo a ogni foglio.
 *
 * Serve a due cose insieme, e sono tutte e due nostre.
 * 1. Ci tiene lontani dall'esercizio abusivo della professione: noi
 *    generiamo un documento da norme e sentenze pubbliche, non diamo un
 *    parere su un caso. È una distinzione vera, e va scritta.
 * 2. NON toglie forza alla lettera, perché la forza non sta nel
 *    presentarsi come avvocati: sta negli orari certificati e nelle
 *    sentenze citate, che sono pubbliche e verificabili da chiunque.
 *
 * Sta in fondo di proposito: chi legge alla compagnia arriva prima ai
 * fatti.
 */
export const NOTA_TRASPARENZA =
  "Questa comunicazione è stata redatta a partire dalla normativa e dalla giurisprudenza pubbliche applicabili e dai dati di volo verificati. Non costituisce parere legale.";

/**
 * Ciò che la lettera legge dalla pratica. Il resto non le serve.
 *
 * ⚠️ `email` è entrata il 12/08 e non è un vezzo: la lettera chiudeva con
 * «[indirizzo email con cui è stata fatta la prenotazione]», cioè un
 * campo da riempire a mano dentro un documento che vendiamo come
 * "pronto". Quell'indirizzo è lo stesso con cui la pratica è stata
 * aperta: lo sapevamo già e lo lasciavamo scrivere all'utente.
 */
export type PraticaPerLettera = Pick<Pratica, "passeggeri" | "tipo"> & {
  email?: string | null;
};

/**
 * COME SI CHIUDE OGNI LETTERA, e perché non c'è più nessun trattino.
 *
 * 🔴 Valerio, 12/08: «ci sono dei piccoli segni di AI e di automatismo,
 * tipo --- o -, insomma c'è sporco e non sembra ancora pronta come email
 * umana e professionale». Aveva ragione su tutta la linea:
 * - una riga di tre trattini prima della nota finale: nessuno la scrive
 *   in un'email, è un separatore da documento generato;
 * - i fatti in elenco puntato con i trattini: una lettera formale
 *   italiana i fatti li racconta in prosa;
 * - i campi fra parentesi quadre: sono un modulo, non una lettera.
 *
 * Qui la nota di trasparenza diventa l'ultimo capoverso, staccato da una
 * riga vuota come qualsiasi altro. Dice la stessa cosa e non sembra
 * uscita da una macchina.
 */
function chiusura(firma: string, email?: string | null): string {
  const recapito = email ? `\n${email}` : "";
  return `Distinti saluti,\n\n${firma}${recapito}\n\n${NOTA_TRASPARENZA}`;
}

/** Gli allegati che l'utente mette nella SUA email. */
export const ALLEGATI = [
  "Carta d'imbarco, o email di conferma della prenotazione",
  "Documento d'identità dell'intestatario della pratica",
  "Ricevute delle spese causate dal disservizio, se ci sono (pasti, trasporti, una notte in albergo)",
] as const;

/* ------------------------------------------------ formattazione, fissa */

const dataLunga = (isoGiorno: string) =>
  new Date(`${isoGiorno}T12:00:00Z`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** "22:55 del 14 agosto 2026 (UTC)": orari in UTC, dichiarato. È il dato
 *  oggettivo delle fonti volo; il fuso locale qui non serve e ambiguerebbe. */
const oraUtc = (iso: string) => {
  const d = new Date(iso);
  const ora = d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const giorno = d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${ora} del ${giorno} (UTC)`;
};

const durata = (minuti: number) => {
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  if (h === 0) return `${m} minuti`;
  if (m === 0) return `${h} ore`;
  return `${h} ore e ${m} minuti`;
};

const km = (n: number) => `${Math.round(n).toLocaleString("it-IT")} km`;

const euro = (n: number) => `${n.toLocaleString("it-IT")} euro`;

/** L'elenco passeggeri. Se la pratica non li ha ancora, campi da compilare. */
function elencoPasseggeri(passeggeri: Passeggero[], tipo: PraticaPerLettera["tipo"]): string[] {
  const compilati = passeggeri
    .filter((p) => p.nome.trim() || p.cognome.trim())
    .map((p) => `${p.nome.trim()} ${p.cognome.trim()}`.trim());
  if (compilati.length > 0) return compilati;
  /* 🔴 SU UNA PRATICA FAMIGLIA QUI USCIVANO DUE SEGNAPOSTO, e da quei due
     la lettera tirava fuori un conto: «600 euro per ciascuno dei seguenti
     2 passeggeri, per un totale di 1200 euro». Trovato col collaudo del
     13/08, aprendo una pratica famiglia vera.
     Erano due numeri inventati da noi in un documento che chiede soldi a
     una compagnia aerea. La pratica famiglia si vende «fino a 5
     passeggeri», i nomi non li chiediamo da nessuna parte, e nessuno ci
     ha mai detto quanti erano: quel 2 non l'ha scelto nessuno. Chi vola
     in quattro chiede la metà di quello che gli spetta, e non se ne
     accorge.
     Adesso il segnaposto è UNO, e la lettera che si costruisce sopra non
     dichiara né quantità né totale: dice «per ciascuno dei passeggeri
     sotto elencati» e lascia le righe da riempire. Un documento che
     chiede di completare una riga è onesto; uno che dichiara un totale
     sbagliato no. */
  return tipo === "famiglia" ? ["[Nome e cognome di ogni passeggero, uno per riga]"] : ["[Nome e cognome]"];
}

/** Il destinatario in testa alla lettera: ragione sociale se la conosciamo. */
function intestazione(fatto: FattoVolo, compagnia: CanaleCompagnia | null): string {
  if (compagnia) return `Spett.le ${compagnia.nomeLegale}`;
  if (fatto.vettoreOperativo) return `Spett.le ${fatto.vettoreOperativo}`;
  return "Spett.le [compagnia aerea operativa]";
}

/** La spiegazione della fascia: il numero mostrato con il suo perché. */
function percheFascia(importo: number, ritardoMinuti: number, kmTratta: number | null): string {
  const tratta = kmTratta === null ? "la distanza della tratta" : `una tratta di ${km(kmTratta)}`;
  return `Per un ritardo all'arrivo di ${durata(ritardoMinuti)} su ${tratta}, l'articolo 7 del Regolamento fissa la compensazione in ${euro(importo)} a passeggero.`;
}

/**
 * Come si nomina, dentro la lettera, l'ente a cui si farà reclamo se la
 * compagnia tace. NON è sempre l'ENAC: l'art. 16 par. 1 dà la competenza
 * all'organismo dello Stato dell'AEROPORTO DI PARTENZA, quindi per un volo
 * partito da Barcellona è quello spagnolo.
 *
 * Se il paese di partenza non è nella nostra tabella, la frase resta vera
 * ma generica ("l'organismo nazionale competente dello Stato di partenza"):
 * meglio dirlo così che spedire una persona all'ufficio sbagliato.
 */
function organismoDiPartenza(fatto: FattoVolo): string {
  const neb = nebPerPaese(paeseDiScalo(fatto.partenzaIata));
  if (!neb) return "l'organismo nazionale competente dello Stato da cui è partito il volo";
  const sigla = nomeBreveNeb(neb);
  return sigla === neb.nome ? `${neb.nome}` : `${sigla} (${neb.nome})`;
}

/* ----------------------------------------------------------- reclamo */

/**
 * Il reclamo formale. Solo per verdetti IDONEI: su tutto il resto questa
 * funzione torna `null`, e non è un limite ma il prodotto (SPEC §4: non
 * si vende, e non si scrive, sul giallo).
 */
export function generaReclamo(
  pratica: PraticaPerLettera,
  fatto: FattoVolo,
  verdetto: Verdetto,
  /* Righe opzionali già pronte (es. il meteo all'arrivo da lib/meteo):
     il chiamante le procura, qui restano input deterministici.
     `dichiarato` c'è SOLO per negato imbarco e coincidenza persa: quei
     casi hanno una norma diversa e una lettera diversa (vedi
     lib/lettera/dichiarati.ts). Senza questo ramo la lettera chiedeva
     400 euro citando la regola delle tre ore accanto a un ritardo di
     due e mezza: si contraddiceva da sola. */
  extra?: { meteo?: string | null; dichiarato?: DatiDichiarazione | null; cura?: boolean },
): Lettera | null {
  if (verdetto.esito !== "idoneo") return null;
  /* Il negato imbarco non ha un orario d'arrivo da confrontare: chi non
     è salito non è mai arrivato. Solo il ritardo ne ha bisogno. */
  const caso = extra?.dichiarato?.caso ?? null;
  if (!caso && (!fatto.arrivoPrevistoUtc || !fatto.arrivoEffettivoUtc)) return null;

  const compagnia = compagniaPerVettore(fatto.vettoreOperativo) ?? compagniaPerVettore(fatto.voloIata);
  const passeggeri = elencoPasseggeri(pratica.passeggeri, pratica.tipo);
  const n = passeggeri.length;
  const totale = verdetto.importo * n;
  const giornoVolo = dataLunga(fatto.dataLocale);
  /* Pratica famiglia di cui non sappiamo i nomi: quanti fossero non ce
     l'ha detto nessuno, quindi non si dichiara né il numero né il totale. */
  const famigliaSenzaNomi =
    pratica.tipo === "famiglia" &&
    !(pratica.passeggeri ?? []).some((p) => p.nome.trim() || p.cognome.trim());

  const oggetto = caso
    ? oggettoDichiarato(caso, fatto.voloIata, giornoVolo)
    : `Richiesta di compensazione pecuniaria ex artt. 5 e 7 Reg. (CE) 261/2004, volo ${fatto.voloIata} del ${giornoVolo}`;

  const vettoreMarketing =
    fatto.vettoreMarketing &&
    fatto.vettoreOperativo &&
    fatto.vettoreMarketing.trim().toUpperCase() !== fatto.vettoreOperativo.trim().toUpperCase()
      ? `\nIl biglietto è stato venduto con il codice di ${fatto.vettoreMarketing}; la presente è indirizzata a voi in quanto vettore operativo effettivo, come previsto dall'articolo 3, paragrafo 5, del Regolamento.`
      : "";

  /* IL BLOCCO CENTRALE: i fatti e la norma. È l'unico pezzo che cambia
     fra i tre casi, e va costruito PRIMA del corpo: dentro un template
     TypeScript non riesce a capire che gli orari, nel ramo del ritardo,
     ci sono per forza (li ha già garantiti il controllo in cima). */
  const fattiENorma =
    caso && extra?.dichiarato
      ? corpoDichiarato(caso, fatto, verdetto, extra.dichiarato, km, euro)
      : `Il volo era previsto in arrivo alle ${oraUtc(fatto.arrivoPrevistoUtc as string)} ed è atterrato alle ${oraUtc(fatto.arrivoEffettivoUtc as string)}, con un ritardo all'arrivo di ${durata(verdetto.ritardoMinuti)}${fatto.kmOrtodromica ? ` su una tratta di ${km(fatto.kmOrtodromica)}` : ""}. Gli orari risultano dai dati di volo archiviati (fonte: ${fatto.fonte}).
${extra?.meteo ? `\n${extra.meteo}\n` : ""}
Ai sensi degli articoli 5 e 7 del Regolamento (CE) n. 261/2004, come interpretati dalla Corte di giustizia dell'Unione europea nella sentenza del 19 novembre 2009, cause riunite C-402/07 e C-432/07 (Sturgeon), un ritardo all'arrivo pari o superiore a tre ore dà diritto alla stessa compensazione pecuniaria prevista per la cancellazione del volo, salvo circostanze eccezionali che spetta al vettore provare.

${percheFascia(verdetto.importo, verdetto.ritardoMinuti, fatto.kmOrtodromica)}`;

  const corpo = `${intestazione(fatto, compagnia)},

${n === 1 ? "scrivo in qualità di passeggero" : "scrivo a nome dei passeggeri sotto elencati"} del volo ${fatto.voloIata} del ${giornoVolo}, operato dalla vostra compagnia.${vettoreMarketing}

${fattiENorma}

${
  famigliaSenzaNomi
    ? /* Nessuna quantità e nessun totale: non li sappiamo. Vedi il
         commento in `elencoPasseggeri`. */
      `Chiedo pertanto il pagamento di ${euro(verdetto.importo)} per ciascuno dei passeggeri sotto elencati, che hanno viaggiato sulla stessa prenotazione:

[Nome e cognome di ogni passeggero, uno per riga]`
    : n === 1
      ? `Chiedo pertanto il pagamento di ${euro(verdetto.importo)} in favore di ${passeggeri[0]}.`
      : `Chiedo pertanto il pagamento di ${euro(verdetto.importo)} per ciascuno dei seguenti ${n} passeggeri, per un totale di ${euro(totale)}:

${passeggeri.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
}
${
  /* Diritto di cura (art. 9): si aggancia al reclamo solo se il cliente
     dichiara di aver sostenuto spese di tasca sua. Non chiediamo un
     importo: le cifre le portano le sue ricevute, e la compagnia le
     verifica una per una. Vedi la scelta di Valerio del 14/08. */
  extra?.cura
    ? `\nChiedo inoltre, ai sensi dell'articolo 9 del Regolamento, il rimborso delle spese di assistenza (pasti e bevande, ed eventuale pernottamento con il relativo trasporto da e per l'aeroporto) che ho dovuto sostenere a causa del disservizio, non essendomi state offerte dal vettore. Le spese risultano dalle ricevute che allego alla presente.\n`
    : ""
}
Il pagamento potrà essere effettuato con bonifico bancario sulle seguenti coordinate:
Intestato a: ${famigliaSenzaNomi ? "[Nome e cognome dell'intestatario del conto]" : passeggeri[0]}
IBAN: [qui il tuo IBAN]

Chiedo il pagamento, o una risposta scritta e motivata, entro 30 giorni dal ricevimento della presente. Se intendete invocare circostanze eccezionali, chiedo che siano indicate in modo specifico e documentate: l'onere della prova è a vostro carico, e l'esonero richiede anche la dimostrazione di aver adottato tutte le misure ragionevoli, ivi compresa la riprotezione su voli alternativi, anche operati da altri vettori.

La presente vale quale formale costituzione in mora ai sensi dell'articolo 1219 del codice civile. In mancanza di pagamento entro il termine indicato, sulla somma dovuta decorreranno gli interessi legali ai sensi dell'articolo 1224 del codice civile dalla data della presente.

In mancanza di riscontro nel termine indicato, presenterò reclamo a ${organismoDiPartenza(fatto)}, l'organismo nazionale responsabile dell'applicazione del Regolamento (CE) 261/2004 per lo Stato di partenza, e valuterò ogni ulteriore tutela nelle sedi competenti.

In allegato: carta d'imbarco, documento d'identità e le eventuali ricevute delle spese sostenute.

${chiusura(passeggeri[0], pratica.email)}`;

  return { oggetto, corpo };
}

/* --------------------------------------------------------- sollecito */

/**
 * Il sollecito: il secondo colpo, quello dove il 60% molla (SPEC §5).
 * Richiama la prima lettera, cita il silenzio, preannuncia l'ENAC.
 * `dataPrimoInvio` è il giorno ISO in cui l'utente ha inviato il reclamo;
 * se non è stato registrato resta un campo da compilare.
 */
export function generaSollecito(
  pratica: PraticaPerLettera,
  fatto: FattoVolo,
  verdetto: Verdetto,
  dataPrimoInvio: string | null,
  /**
   * Il motivo per cui la compagnia ha detto no, dichiarato dall'utente a
   * scelta chiusa. Da qui esce il PARAGRAFO CENTRALE del sollecito: a un
   * guasto tecnico si risponde in un modo, a uno sciopero del personale
   * in un altro. Senza, la replica resterebbe generica e varrebbe la
   * metà. `null` o "silenzio" = nessuna risposta ricevuta.
   */
  motivoRifiuto: MotivoRifiuto | null = null,
  /**
   * IL PARAGRAFO SU MISURA, scritto sui fatti che la compagnia ha
   * dichiarato nella SUA risposta (lib/ai/replica.ts). Arriva già
   * controllato: se avesse citato una sentenza fuori dal nostro archivio
   * o una cifra inventata sarebbe stato scartato prima, e qui arriverebbe
   * `null`.
   *
   * ⚠️ SI AGGIUNGE, NON SOSTITUISCE. Il paragrafo fisso del motivo dice
   * il principio di diritto ed è verificato a mano; questo dice perché
   * quel principio si applica a QUELLO che hanno scritto loro. Togliere
   * il primo per tenere il secondo vorrebbe dire far reggere tutta la
   * replica su un testo generato.
   */
  paragrafoSuMisura: string | null = null,
): Lettera | null {
  if (verdetto.esito !== "idoneo") return null;

  const passeggeri = elencoPasseggeri(pratica.passeggeri, pratica.tipo);
  const n = passeggeri.length;
  const totale = verdetto.importo * n;
  const giornoVolo = dataLunga(fatto.dataLocale);
  const giornoInvio = dataPrimoInvio ? dataLunga(dataPrimoInvio) : "[data di invio del primo reclamo]";
  const compagnia = compagniaPerVettore(fatto.vettoreOperativo) ?? compagniaPerVettore(fatto.voloIata);
  const scheda = schedaRifiuto(motivoRifiuto) ?? schedaRifiuto("silenzio")!;
  const haRisposto = scheda.motivo !== "silenzio";

  const oggetto = haRisposto
    ? `Riscontro al vostro diniego: compensazione volo ${fatto.voloIata} del ${giornoVolo}`
    : `Sollecito: richiesta di compensazione volo ${fatto.voloIata} del ${giornoVolo}`;

  const corpo = `${intestazione(fatto, compagnia)},

in data ${giornoInvio} vi ho inviato una richiesta di compensazione pecuniaria ai sensi degli articoli 5 e 7 del Regolamento (CE) n. 261/2004, relativa al volo ${fatto.voloIata} del ${giornoVolo}, per ${
    n === 1
      ? `l'importo di ${euro(totale)}`
      : `un totale di ${euro(totale)} (${euro(verdetto.importo)} per ${n} passeggeri)`
  }.

${scheda.replica}${paragrafoSuMisura ? `\n\n${paragrafoSuMisura.trim()}` : ""}

Vi chiedo il pagamento, o una risposta scritta e motivata, entro 14 giorni dal ricevimento della presente. Resta ferma la costituzione in mora già intervenuta con il primo reclamo: sulla somma dovuta decorrono gli interessi legali ai sensi dell'articolo 1224 del codice civile.

Decorso inutilmente questo termine, presenterò reclamo a ${organismoDiPartenza(fatto)}, l'organismo nazionale responsabile dell'applicazione del Regolamento (CE) 261/2004 per lo Stato di partenza, che può accertare la violazione e applicare le sanzioni previste. Valuterò inoltre ogni ulteriore tutela nelle sedi competenti.

${chiusura(passeggeri[0], pratica.email)}`;

  return { oggetto, corpo };
}

/* ------------------------------------------------------------- ENAC */

export type IstruzioniEnac = {
  titolo: string;
  premessa: string;
  passi: string[];
  /** La pagina ENAC che spiega le modalità di reclamo. */
  urlModalita: string;
  /** Il portale dove si compila il modulo online. */
  urlPortale: string;
  avvertenza: string;
  fonte: string;
};

/**
 * Le istruzioni per il reclamo all'organismo nazionale, scelte in base al
 * paese dell'AEROPORTO DI PARTENZA (art. 16 par. 1).
 *
 * Tre casi, in ordine di quanto sappiamo:
 * 1. partenza dall'Italia (o scalo sconosciuto): la guida ENAC completa,
 *    con gli URL verificati. È anche la riserva sensata, visto che il
 *    nostro pubblico parte quasi sempre da qui;
 * 2. partenza da un altro paese che abbiamo in tabella: guida più corta
 *    ma col nome e il sito giusti di quell'ente;
 * 3. paese non in tabella: si dice apertamente che l'ente va cercato
 *    nell'elenco ufficiale della Commissione. Mai un ufficio inventato.
 */
export function istruzioniOrganismo(partenzaIata?: string | null): IstruzioniEnac {
  const paese = paeseDiScalo(partenzaIata);
  if (!paese || paese === "Italy") return testoEnac();

  const neb = nebPerPaese(paese);
  if (!neb) {
    return {
      titolo: "Il reclamo all'organismo nazionale, passo per passo",
      premessa: `Il tuo volo è partito da un aeroporto in ${paese}. Il reclamo va all'organismo di quel paese, non all'ENAC: lo dice l'articolo 16 del Regolamento, che assegna la competenza allo Stato dell'aeroporto di partenza. Non abbiamo ancora verificato quale sia per ${paese}: lo trovi nell'elenco ufficiale della Commissione europea, qui sotto.`,
      passi: [
        "Aspetta 6 settimane dall'invio del reclamo alla compagnia, oppure la sua risposta se arriva prima.",
        `Apri l'elenco ufficiale della Commissione e cerca ${paese}: trovi l'ente competente e come contattarlo.`,
        "Tieni a portata di mano: numero e data del volo, il reclamo inviato alla compagnia, la sua eventuale risposta, la carta d'imbarco.",
        "Indica i fatti come stanno nella tua lettera: orari previsto ed effettivo, ritardo all'arrivo, richiesta già inviata alla compagnia.",
        "Invia e conserva la ricevuta della segnalazione insieme al resto della pratica.",
      ],
      urlModalita: ELENCO_UFFICIALE_NEB,
      urlPortale: ELENCO_UFFICIALE_NEB,
      avvertenza:
        "L'organismo nazionale accerta le violazioni e può sanzionare la compagnia, ma non liquida la compensazione al posto suo. Serve a farla rispondere: per il pagamento la strada resta il reclamo diretto ed eventualmente il giudice.",
      fonte: `Ente non ancora verificato per ${paese}. Elenco ufficiale: Commissione europea, National enforcement bodies (NEB).`,
    };
  }

  const breve = nomeBreveNeb(neb);
  const dove = neb.url ?? ELENCO_UFFICIALE_NEB;
  return {
    titolo: `Il reclamo a ${breve}, passo per passo`,
    premessa: `Il tuo volo è partito da un aeroporto in ${paese}, quindi l'organismo competente è ${neb.nome}${neb.sigla ? ` (${neb.sigla})` : ""}, non l'ENAC: la competenza è dello Stato dell'aeroporto di partenza (art. 16 del Regolamento). Il reclamo è gratuito e lo presenti tu.`,
    passi: [
      "Aspetta 6 settimane dall'invio del reclamo alla compagnia, oppure la sua risposta se arriva prima.",
      "Tieni a portata di mano: numero e data del volo, il reclamo inviato alla compagnia, la sua eventuale risposta, la carta d'imbarco.",
      `Apri il sito di ${breve} e cerca la sezione dei reclami per i diritti del passeggero.`,
      "Indica i fatti come stanno nella tua lettera: orari previsto ed effettivo, ritardo all'arrivo, richiesta già inviata alla compagnia.",
      "Invia e conserva la ricevuta della segnalazione insieme al resto della pratica.",
    ],
    urlModalita: dove,
    urlPortale: dove,
    avvertenza:
      "L'organismo nazionale accerta le violazioni e può sanzionare la compagnia, ma non liquida la compensazione al posto suo. Serve a farla rispondere: per il pagamento la strada resta il reclamo diretto ed eventualmente il giudice.",
    fonte: `Ente competente per ${paese}: ${neb.nome}. Vedi lib/lettera/neb.ts per la fonte di ogni riga.`,
  };
}

/**
 * La segnalazione all'ENAC, passo per passo. URL verificati con ricerca
 * web il 2026-08-07: entrambe le pagine risultano sul dominio ufficiale
 * enac.gov.it (la sandbox non apre il sito, l'esistenza degli URL viene
 * dall'indice di ricerca).
 */
export function testoEnac(): IstruzioniEnac {
  return {
    titolo: "Il reclamo all'ENAC, passo per passo",
    premessa:
      "L'ENAC è l'organismo italiano che vigila sul Regolamento (CE) 261/2004. Il reclamo è gratuito e lo presenti tu, senza avvocati e senza intermediari.",
    passi: [
      "Aspetta 6 settimane dall'invio del reclamo alla compagnia. Puoi rivolgerti all'ENAC prima solo se la compagnia ti ha già risposto in modo non conforme al Regolamento.",
      "Tieni a portata di mano: numero e data del volo, il reclamo che hai inviato alla compagnia, la sua eventuale risposta, la carta d'imbarco.",
      "Apri il portale ENAC dei diritti del passeggero e compila il modulo online nella sezione dedicata ai reclami. È l'unico canale: niente email, niente carta.",
      "Indica i fatti come stanno nella tua lettera: orari previsto ed effettivo, ritardo all'arrivo, richiesta già inviata alla compagnia.",
      "Invia e conserva la ricevuta della segnalazione insieme al resto della pratica.",
    ],
    urlModalita:
      "https://www.enac.gov.it/passeggeri/diritti-dei-passeggeri/modalita-di-reclamo-per-negato-imbarco-cancellazione-ritardo/",
    urlPortale: "https://carta-diritti.enac.gov.it/",
    avvertenza:
      "L'ENAC accerta le violazioni e può sanzionare la compagnia, ma non liquida la compensazione al posto suo. Serve a farla rispondere: per il pagamento, la strada resta il reclamo diretto ed eventualmente il giudice.",
    fonte:
      "Ricerca web 2026-08-07: pagina 'Modalità di reclamo per negato imbarco, cancellazione e ritardo prolungato del volo' e portale carta-diritti.enac.gov.it, entrambi sul dominio ufficiale ENAC. Regola delle 6 settimane confermata dalla FAQ ENAC 'Cosa devo fare se la compagnia aerea non risponde al reclamo presentato'.",
  };
}

/* ------------------------------------- la segnalazione all'ente */

/**
 * LA SEGNALAZIONE ALL'ORGANISMO NAZIONALE, GIÀ SCRITTA.
 *
 * Terzo e ultimo documento della pratica. Le istruzioni per arrivarci
 * esistevano già (`istruzioniOrganismo`), ma davanti a un modulo
 * ufficiale la gente si ferma: quello che serve è il testo pronto, con
 * dentro i suoi dati, il ritardo verificato e le date dei due invii.
 *
 * ⚠️ Cosa NON promette. L'ente accerta la violazione e può sanzionare la
 * compagnia, ma non liquida la compensazione al posto suo. La lettera lo
 * dice chiaramente al passeggero (nel testo che gli mostriamo, non in
 * quella che manda), perché una promessa non mantenuta qui costa la
 * garanzia e una recensione a una stella.
 *
 * `dataSollecito` è il giorno in cui l'utente ha mandato il secondo
 * colpo; se non c'è, resta un campo da compilare. Mai una data inventata.
 */
export function generaSegnalazioneEnte(
  pratica: PraticaPerLettera,
  fatto: FattoVolo,
  verdetto: Verdetto,
  dataPrimoInvio: string | null,
  dataSollecito: string | null,
  motivoRifiuto: MotivoRifiuto | null = null,
): Lettera | null {
  if (verdetto.esito !== "idoneo") return null;
  if (!fatto.arrivoPrevistoUtc || !fatto.arrivoEffettivoUtc) return null;

  const passeggeri = elencoPasseggeri(pratica.passeggeri, pratica.tipo);
  const n = passeggeri.length;
  const totale = verdetto.importo * n;
  const giornoVolo = dataLunga(fatto.dataLocale);
  const compagnia = compagniaPerVettore(fatto.vettoreOperativo) ?? compagniaPerVettore(fatto.voloIata);
  const nomeCompagnia = compagnia?.nomeLegale ?? fatto.vettoreOperativo ?? "[compagnia aerea operativa]";
  const scheda = schedaRifiuto(motivoRifiuto);

  const primo = dataPrimoInvio ? dataLunga(dataPrimoInvio) : "[data del primo reclamo]";
  const secondo = dataSollecito ? dataLunga(dataSollecito) : "[data del sollecito]";

  /* Cosa è successo dopo il reclamo: o hanno taciuto, o hanno detto no
     per un motivo che qui si dichiara. Sono le due sole strade. */
  const cosaHannoFatto = scheda && scheda.motivo !== "silenzio"
    ? `Il vettore ha respinto la richiesta invocando: ${scheda.etichetta.toLowerCase()}. Ritengo il diniego infondato per le ragioni esposte nel sollecito, che allego.`
    : `Il vettore non ha dato alcun riscontro, né al reclamo né al successivo sollecito.`;

  const oggetto = `Reclamo ex art. 16 Reg. (CE) 261/2004 nei confronti di ${nomeCompagnia}, volo ${fatto.voloIata} del ${giornoVolo}`;

  const corpo = `Spett.le ${organismoDiPartenza(fatto)},

il sottoscritto ${passeggeri[0]} presenta reclamo ai sensi dell'articolo 16 del Regolamento (CE) n. 261/2004 nei confronti di ${nomeCompagnia}.

IL VOLO
Volo ${fatto.voloIata} del ${giornoVolo}${fatto.partenzaIata && fatto.arrivoIata ? `, da ${fatto.partenzaIata} a ${fatto.arrivoIata}` : ""}. Era previsto in arrivo alle ${oraUtc(fatto.arrivoPrevistoUtc)} ed è atterrato alle ${oraUtc(fatto.arrivoEffettivoUtc)}, con un ritardo all'arrivo di ${durata(verdetto.ritardoMinuti)}${fatto.kmOrtodromica ? ` su una tratta di ${km(fatto.kmOrtodromica)}` : ""}.

LA RICHIESTA GIÀ AVANZATA AL VETTORE
In data ${primo} ho chiesto al vettore la compensazione pecuniaria di ${
    n === 1 ? euro(totale) : `${euro(totale)} complessivi (${euro(verdetto.importo)} per ${n} passeggeri)`
  }, ai sensi degli articoli 5 e 7 del Regolamento. In data ${secondo} ho inviato sollecito.

${cosaHannoFatto}

COSA CHIEDO
Chiedo che codesto organismo accerti la violazione del Regolamento e adotti i provvedimenti di competenza nei confronti del vettore.

Allego: copia del reclamo inviato al vettore, copia del sollecito, la carta d'imbarco o la conferma di prenotazione${scheda && scheda.motivo !== "silenzio" ? ", copia della risposta del vettore" : ""}.

Resto a disposizione per ogni chiarimento.

${chiusura(passeggeri.join("\n"), pratica.email)}`;

  return { oggetto, corpo };
}
