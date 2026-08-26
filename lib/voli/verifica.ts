/**
 * L'orchestratore del check (SPEC §4, strati 1-2-3 in fila):
 *
 *   input → normalizza → cache `voli` → fornitore → (confronto seconda
 *   fonte) → upsert cache → valuta() → riga in `verifiche` → esito.
 *
 * Promesse mantenute qui dentro:
 * - CACHE per volo+data: un volo con 180 passeggeri = 1 chiamata API.
 * - payload_grezzo archiviato a ogni risposta del fornitore: è la prova
 *   se una compagnia contesta fra 6 mesi. Un fatto DEFINITIVO in cache
 *   non viene mai più riscritto (il check riparte dalla cache e basta);
 *   solo uno stato "sconosciuto" può essere aggiornato da un dato migliore.
 * - doppia fonte SOLO se entrambe le chiavi esistono: scarto > 15 minuti
 *   sull'arrivo effettivo → fonti_discordanti → il motore dirà incerto.
 * - shadow mode (SHADOW_MODE=1): il verdetto nasce 'in_attesa' e un umano
 *   lo conferma da /admin prima che si possa vendere.
 * - MAI un'eccezione verso l'alto: ogni guasto di rete o database diventa
 *   un esito incerto o un campo nullo, non un 500 in faccia all'utente.
 */

import { valuta, type FattoVolo, type Verdetto } from "@/lib/regole/eu261";
import { colonnaMancante } from "@/lib/supabase/colonne";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { aerodatabox } from "./fornitori/aerodatabox";
import { aviationstack } from "./fornitori/aviationstack";
import { aviationedge } from "./fornitori/aviationedge";
import { demo, voloDimostrativo } from "./fornitori/demo";
import { incrociaFonti } from "./incrocio";
import { classificaSciopero } from "@/lib/scioperi/scioperi";
import { dopo } from "@/lib/eventi/registra";
import { tinGuasto } from "@/lib/eventi/telegram";
import { normalizzaData, normalizzaVolo } from "./normalizza";
import type { ContestoRicerca, FattoConPayload, FornitoreVoli } from "./tipi";
import { segnaChiamataFornitore } from "@/lib/api/tetto-fornitore";

import { seSiPaga } from "@/lib/check/ingresso";
export type EsitoVerifica =
  | {
      ok: true;
      /** Null solo se il database non era raggiungibile: il verdetto resta valido. */
      verificaId: string | null;
      verdetto: Verdetto;
      fatto: FattoVolo;
      /** Vero quando il dato viene dal fornitore dimostrativo: l'interfaccia DEVE dirlo. */
      demo: boolean;
    }
  | { ok: false; errore: string };

/** Una riga della tabella `voli` (le colonne di supabase/2026-08-07-rivoglio.sql). */
type RigaVolo = {
  id: string;
  volo_iata: string;
  data_locale: string;
  vettore_operativo: string | null;
  vettore_marketing: string | null;
  partenza_iata: string | null;
  partenza_citta: string | null;
  arrivo_iata: string | null;
  arrivo_citta: string | null;
  /* Opzionale: una riga di cache salvata prima della migrazione non ce
     l'ha, e va bene così (la coincidenza a due tratte esce incerta). */
  partenza_previsto_utc?: string | null;
  arrivo_previsto_utc: string | null;
  arrivo_effettivo_utc: string | null;
  stato: FattoVolo["stato"];
  km_ortodromica: number | null;
  fonte: string;
  fonti_discordanti: boolean;
  /** NULL = riga scritta prima della regola "senza Live niente vendita". */
  orario_verificato: boolean | null;
  vettore_da_determinare: boolean | null;
  /** NULL = riga scritta prima del cancello territoriale (colonne del 14/08). */
  partenza_paese?: string | null;
  arrivo_paese?: string | null;
  partenza_icao?: string | null;
  arrivo_icao?: string | null;
};

function fattoDaRiga(riga: RigaVolo): FattoVolo {
  return {
    voloIata: riga.volo_iata,
    dataLocale: riga.data_locale,
    vettoreOperativo: riga.vettore_operativo ?? riga.volo_iata.slice(0, 2),
    vettoreMarketing: riga.vettore_marketing,
    partenzaIata: riga.partenza_iata,
    partenzaCitta: riga.partenza_citta,
    arrivoIata: riga.arrivo_iata,
    arrivoCitta: riga.arrivo_citta,
    partenzaPaese: riga.partenza_paese ?? null,
    arrivoPaese: riga.arrivo_paese ?? null,
    partenzaIcao: riga.partenza_icao ?? null,
    arrivoIcao: riga.arrivo_icao ?? null,
    partenzaPrevistoUtc: riga.partenza_previsto_utc ?? null,
    arrivoPrevistoUtc: riga.arrivo_previsto_utc,
    arrivoEffettivoUtc: riga.arrivo_effettivo_utc,
    stato: riga.stato,
    kmOrtodromica: riga.km_ortodromica,
    fontiDiscordanti: riga.fonti_discordanti,
    orarioVerificato: riga.orario_verificato ?? undefined,
    vettoreDaDeterminare: riga.vettore_da_determinare ?? undefined,
    fonte: riga.fonte,
  };
}

/**
 * LA RIGA IN CACHE VALE SOLO SE SA RISPONDERE ALLA PRIMA DOMANDA DEL
 * MOTORE, cioè "da dove parte e dove arriva questo aereo".
 *
 * Perché esiste questo controllo: il cancello territoriale è nato il
 * 9/08, la cache è nata il 7/08. Tutte le righe scritte in mezzo non
 * hanno gli scali, e senza scali il verdetto è "non riconosciamo
 * l'aeroporto di partenza" PER SEMPRE: la cache è una fotografia, e una
 * fotografia sbagliata non si corregge da sola. È il caso di FR4001 del
 * 6 agosto, il volo che ha provato Valerio.
 *
 * Non è un problema di ieri: vale ogni volta che il motore impara a
 * usare un dato nuovo. Da qui in avanti una riga che non porta quel dato
 * viene scartata e il volo si richiede al fornitore, che costa una
 * chiamata e chiude il caso, invece di zero chiamate e un utente perso.
 */
export function rigaUsabile(riga: RigaVolo): boolean {
  const scaloNoto = (iata: string | null, paese?: string | null, icao?: string | null) =>
    Boolean(iata?.trim() || paese?.trim() || icao?.trim());

  if (!scaloNoto(riga.partenza_iata, riga.partenza_paese, riga.partenza_icao)) return false;
  if (!scaloNoto(riga.arrivo_iata, riga.arrivo_paese, riga.arrivo_icao)) return false;

  /* La distanza decide l'importo. Un volo atterrato senza distanza in
     cache dà "non conosciamo la distanza della tratta", che è un altro
     incerto evitabile: il fornitore la sa. Sui cancellati e sui dirottati
     non serve: quei verdetti non passano mai dalle fasce. */
  if (riga.stato === "atterrato" && !(riga.km_ortodromica && riga.km_ortodromica > 0)) return false;

  return true;
}

const COLONNE_CACHE_BASE =
  "id, volo_iata, data_locale, vettore_operativo, vettore_marketing, partenza_iata, partenza_citta, arrivo_iata, arrivo_citta, partenza_previsto_utc, arrivo_previsto_utc, arrivo_effettivo_utc, stato, km_ortodromica, fonte, fonti_discordanti, orario_verificato, vettore_da_determinare";
const COLONNE_CACHE = `${COLONNE_CACHE_BASE}, partenza_paese, arrivo_paese, partenza_icao, arrivo_icao`;

/**
 * AeroDataBox se c'è la chiave, altrimenti la demo marcata.
 * I voli ZZ* vanno SEMPRE alla demo, anche con la chiave vera: ZZ non è
 * un codice IATA assegnato, sono i nostri casi dimostrativi (la landing
 * e le prove ci contano), e mandarli all'API vera brucerebbe unità per
 * un errore garantito.
 */
function fornitoreAttivo(voloIata: string): FornitoreVoli {
  if (voloIata.toUpperCase().startsWith("ZZ")) return demo;
  return process.env.AERODATABOX_API_KEY ? aerodatabox : demo;
}

/**
 * La SECONDA fonte per l'incrocio, se configurata. Provider-agnostica: si
 * preferisce AviationEdge quando c'è la sua chiave (scelta di Valerio del
 * 14/08, con lo storico che copre i voli passati), altrimenti AviationStack.
 * Torna null se nessuna riserva è impostata: allora niente incrocio, e il
 * verdetto resta severo come sempre (nessuna regressione, il giorno che manca
 * la chiave).
 */
function secondaFonte(): FornitoreVoli | null {
  if (process.env.AVIATIONEDGE_API_KEY) return aviationedge;
  if (process.env.AVIATIONSTACK_API_KEY) return aviationstack;
  return null;
}

/**
 * DEDUPLICA DELLE CHIAMATE AL FORNITORE (single-flight), per NON moltiplicare
 * il costo quando molti controllano lo STESSO volo nello stesso istante.
 *
 * Scenario dell'audit del 14/08: un video porta 500 persone a controllare lo
 * stesso volo virale. La cache `voli` è ancora vuota (nessuno l'ha chiesto
 * prima), quindi senza questo ogni richiesta concorrente chiama AeroDataBox,
 * bruciando il tetto di 3 richieste/secondo su un volo solo. Qui le richieste
 * concorrenti per lo stesso volo+data CONDIVIDONO una sola chiamata: la prima
 * chiama, le altre aspettano il suo risultato.
 *
 * ⚠️ Vale DENTRO una macchina Netlify (coalizza le richieste che la stessa
 * istanza gestisce insieme). Fra istanze diverse non aiuta: servirebbe un
 * lock condiviso, più complesso; questo è il primo taglio, a costo e rischio
 * zero. Ogni check resta la SUA verifica (riga propria in `verifiche`): qui si
 * condivide solo il FATTO del volo, non l'esito dell'utente.
 */
const inVolo = new Map<string, Promise<FattoConPayload | null>>();

function cercaCoalescata(
  primario: FornitoreVoli,
  voloIata: string,
  dataLocale: string,
): Promise<FattoConPayload | null> {
  const chiave = `${primario.nome}:${voloIata}:${dataLocale}`;
  const gia = inVolo.get(chiave);
  if (gia) return gia;
  const p = primario.cerca(voloIata, dataLocale).finally(() => inVolo.delete(chiave));
  inVolo.set(chiave, p);
  return p;
}

/**
 * LA SECONDA FONTE, DENTRO LE STESSE DIFESE DEL PRIMARIO (audit 26/08).
 *
 * 🔴 Prima la seconda fonte (AviationEdge, a pagamento) era chiamata con un
 * fetch nudo: fuori dal single-flight e fuori dal tetto sulla spesa. Un video
 * che porta 500 persone sullo stesso volo condivideva UNA chiamata al
 * primario ma ne sparava 500 al secondario, non contate: il fornitore a
 * pagamento martellato e la spesa fuori controllo. Adesso le richieste
 * concorrenti per lo stesso volo condividono una chiamata sola, e ogni
 * chiamata vera si conta nel tetto: se il tetto è chiuso si salta l'incrocio
 * (il volo resta come l'ha lasciato il primario, mai un errore).
 *
 * ⚠️ Quando si accende la seconda fonte (con la sua chiave), il suo
 * adattatore andrà fatto passare anche da `chiamaConRitentativo` per avere il
 * freno d'emergenza; oggi la fonte è spenta, quindi questo giro chiude
 * l'esposizione che conta (concorrenza e spesa).
 */
const inVoloSeconda = new Map<string, Promise<FattoConPayload | null>>();

function cercaSecondaCoalescata(
  seconda: FornitoreVoli,
  voloIata: string,
  dataLocale: string,
  contesto: ContestoRicerca,
): Promise<FattoConPayload | null> {
  const chiave = `${seconda.nome}:${voloIata}:${dataLocale}`;
  const gia = inVoloSeconda.get(chiave);
  if (gia) return gia;
  const p = (async () => {
    const t = await segnaChiamataFornitore();
    if (t.chiuso) return null;
    return seconda.cerca(voloIata, dataLocale, contesto);
  })().finally(() => inVoloSeconda.delete(chiave));
  inVoloSeconda.set(chiave, p);
  return p;
}

export async function verificaVolo(voloGrezzo: string, dataGrezza: string): Promise<EsitoVerifica> {
  // ── Strato 1: normalizzazione ────────────────────────────────────────
  const volo = normalizzaVolo(voloGrezzo);
  if (!volo.ok) return { ok: false, errore: volo.errore };
  const data = normalizzaData(dataGrezza);
  if (!data.ok) return { ok: false, errore: data.errore };

  const sb = SERVIZIO_ATTIVO ? supabaseServizio() : null;

  // ── Strato 2a: la cache dei fatti ────────────────────────────────────
  let fatto: FattoConPayload | null = null;
  let voloId: string | null = null;
  if (sb) {
    try {
      const leggi = (colonne: string) =>
        sb
          .from("voli")
          .select(colonne)
          .eq("volo_iata", volo.valore)
          .eq("data_locale", data.valore)
          .maybeSingle<RigaVolo>();

      const primoGiro = await leggi(COLONNE_CACHE);
      /* Le quattro colonne del paese e dell'ICAO sono del 14/08: finché la
         migrazione non è applicata sul database vero, chiederle fa fallire
         tutta la lettura. Meglio riprovare senza che perdere la cache. */
      const riga =
        primoGiro.error && colonnaMancante(primoGiro.error.message)
          ? (await leggi(COLONNE_CACHE_BASE)).data
          : primoGiro.data;
      /* Uno "sconosciuto" in cache non fa fede: magari il volo è atterrato
         dopo l'ultima chiamata. E un "atterrato" senza il tracciamento
         verificato (o scritto prima che la colonna esistesse) si richiede:
         il Live può essersi consolidato nel frattempo. Si aggiorna. */
      if (
        riga &&
        riga.stato !== "sconosciuto" &&
        !(riga.stato === "atterrato" && riga.orario_verificato !== true) &&
        rigaUsabile(riga)
      ) {
        fatto = fattoDaRiga(riga);
        voloId = riga.id;
      }
    } catch (e) {
      console.warn("[verifica] cache non leggibile, chiedo al fornitore:", e);
    }
  }

  // ── Strato 2b: il fornitore ──────────────────────────────────────────
  if (!fatto) {
    const primario = fornitoreAttivo(volo.valore);
    /* 🔴 ALLARME CHIAVE MANCANTE (audit 14/08): se un volo VERO viene servito
       dalla demo, la chiave AeroDataBox manca o è scritta male su Netlify, e da
       quel momento OGNI check esce "incerto" senza che nessuno lo sappia (è
       stato il caso di FR4001). Un TIN sul telefono, silenziato a un quarto
       d'ora come gli altri: mille check muti restano un messaggio solo. La demo
       sui voli ZZ è voluta e non fa scattare niente. */
    if (primario.nome === "demo" && !voloDimostrativo(volo.valore)) {
      dopo(() =>
        tinGuasto(
          "aerodatabox-chiave",
          'AeroDataBox non è configurato: un volo vero è stato servito dalla demo.\nLa chiave AERODATABOX_API_KEY manca o è sbagliata su Netlify, e i check escono tutti "non lo so". Da guardare adesso.',
        ),
      );
    }
    fatto = await cercaCoalescata(primario, volo.valore, data.valore);

    if (!fatto) {
      // Nessun dato: fatto sconosciuto, il motore dirà incerto. Niente cache.
      fatto = {
        voloIata: volo.valore,
        dataLocale: data.valore,
        vettoreOperativo: volo.valore.slice(0, 2),
        vettoreMarketing: null,
        arrivoPrevistoUtc: null,
        arrivoEffettivoUtc: null,
        stato: "sconosciuto",
        kmOrtodromica: null,
        fonte: primario.nome,
      };
    } else {
      /* L'INCROCIO DELLE FONTI (lib/voli/incrocio.ts). Con una seconda fonte
         configurata: due orari d'accordo CONFERMANO un volo che il solo
         AeroDataBox lascerebbe incerto (recupera vendite vere), due orari in
         disaccordo lo lasciano incerto (niente false promesse). Gira solo su
         un fatto del primario VERO, mai sulla demo. */
      /* 🔴 NON SI INTERROGA LA SECONDA FONTE SE IL PRIMARIO È GIÀ CERTO.
         Un volo tracciato Live è un fatto solido: l'incrocio non serve (e
         `incrociaFonti` lo dice, torna NIENTE), quindi chiamare la fonte a
         pagamento sarebbe spesa buttata. Trovato dall'audit (26/08). */
      const seconda =
        fatto.fonte === "aerodatabox" && fatto.orarioVerificato !== true ? secondaFonte() : null;
      if (seconda) {
        const altra = await cercaSecondaCoalescata(seconda, volo.valore, data.valore, {
          partenzaIata: fatto.partenzaIata,
          arrivoIata: fatto.arrivoIata,
        });
        const incrocio = incrociaFonti(fatto, altra?.arrivoPrevistoUtc, altra?.arrivoEffettivoUtc);
        if (incrocio.discordanti) {
          fatto = { ...fatto, fontiDiscordanti: true };
        } else if (incrocio.confermato) {
          fatto = { ...fatto, orarioVerificato: true, verificatoIncrociato: true };
        }
      }

      if (sb) {
        try {
          const base = {
            volo_iata: fatto.voloIata,
            data_locale: fatto.dataLocale,
            vettore_operativo: fatto.vettoreOperativo,
            vettore_marketing: fatto.vettoreMarketing ?? null,
            partenza_iata: fatto.partenzaIata ?? null,
            partenza_citta: fatto.partenzaCitta ?? null,
            arrivo_iata: fatto.arrivoIata ?? null,
            arrivo_citta: fatto.arrivoCitta ?? null,
            partenza_previsto_utc: fatto.partenzaPrevistoUtc ?? null,
            arrivo_previsto_utc: fatto.arrivoPrevistoUtc,
            arrivo_effettivo_utc: fatto.arrivoEffettivoUtc,
            stato: fatto.stato,
            km_ortodromica: fatto.kmOrtodromica,
            fonte: fatto.fonte,
            fonti_discordanti: fatto.fontiDiscordanti ?? false,
            orario_verificato: fatto.orarioVerificato ?? null,
            vettore_da_determinare: fatto.vettoreDaDeterminare ?? false,
            payload_grezzo: fatto.payloadGrezzo ?? null,
            recuperato_il: new Date().toISOString(),
          };
          /* Il paese e l'ICAO degli scali si SALVANO, non solo si leggono:
             se restassero fuori dalla cache, il secondo passeggero dello
             stesso volo ripartirebbe senza il dato che ha appena chiuso il
             caso al primo. */
          const conScali = {
            ...base,
            partenza_paese: fatto.partenzaPaese ?? null,
            arrivo_paese: fatto.arrivoPaese ?? null,
            partenza_icao: fatto.partenzaIcao ?? null,
            arrivo_icao: fatto.arrivoIcao ?? null,
          };

          const scrivi = (riga: Record<string, unknown>) =>
            sb
              .from("voli")
              .upsert(riga, { onConflict: "volo_iata,data_locale" })
              .select("id")
              .single();

          let { data: rigaNuova, error } = await scrivi(conScali);
          if (error && colonnaMancante(error.message)) {
            ({ data: rigaNuova, error } = await scrivi(base));
          }
          if (error) console.warn("[verifica] cache non scrivibile:", error.message);
          voloId = rigaNuova?.id ?? null;
        } catch (e) {
          console.warn("[verifica] cache non scrivibile:", e);
        }
      }
    }
  }

  // ── Strato 2c: gli scioperi noti del giorno (tabella a mano) ─────────
  /* Fail-open dichiarato: se il DB tace, niente flag e si procede; il
     rischio residuo lo copre lo shadow mode (conferma umana). I voli
     demo (ZZ*) non interrogano il DB: restano deterministici. */
  if (!fatto.voloIata.startsWith("ZZ")) {
    /* Alla tabella serve il codice IATA, non il nome del vettore: lo
       prendiamo dal numero di volo (per i casi vendibili, IsOperator,
       coincide col vettore operativo). */
    const sciopero = await classificaSciopero(fatto.dataLocale, fatto.voloIata.slice(0, 2));
    if (sciopero === "compagnia") {
      // Sciopero della compagnia stessa: idoneo (C-28/20), non incerto.
      fatto = { ...fatto, scioperoNoto: true, scioperoCompagnia: true };
    } else if (sciopero === "esterno") {
      fatto = { ...fatto, scioperoNoto: true };
    }
  }

  // ── Strato 3: le regole. Solo codice, mai AI. ────────────────────────
  let verdetto = valuta(fatto);

  /* Il caso più comune di "incerto" è un volo APPENA fatto: l'orario
     certificato arriva ore dopo l'atterraggio, e il messaggio generico
     ("controlla numero e data") faceva credere a un errore dell'utente.
     Qui, e solo qui, il motivo diventa una spiegazione onesta: il
     verdetto resta identico, cambia la frase. Trovato nello stress test
     dell'8/08: 10 voli freschi, tutti incerti, utente convinto che il
     sito fosse rotto.

     🔴 E QUESTA FRASE NON L'HA MAI LETTA NESSUNO FINO AL 13/08, perché
     stava DOPO il salvataggio: nel database finiva il motivo grezzo, e
     la pagina del verdetto legge il database, non la risposta della
     rotta. Uno vedeva la frase buona per un istante sul riquadro del
     check e poi, sulla pagina che resta, quella vecchia. Trovato col
     collaudo, confrontando la risposta della rotta con la riga salvata.
     ⚠️ Chi tocca questo pezzo si ricordi l'ordine: il motivo si finisce
     PRIMA di scriverlo, perché la riga salvata è quella che la persona
     legge davvero. */
  const dueGiorniFa = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  if (
    verdetto.esito === "incerto" &&
    fatto.stato === "sconosciuto" &&
    fatto.dataLocale >= dueGiorniFa
  ) {
    verdetto = {
      ...verdetto,
      /* Due possibilità, e vanno dette tutte e due. Quella gentile (il
         dato non è ancora arrivato) era l'unica scritta, e mandava a
         "riprova domani" anche chi aveva semplicemente sbagliato a
         scrivere il numero: domani quel volo non esisterà lo stesso.
         Un refuso è comune quanto un volo fresco. */
      motivo: seSiPaga(
        "Di questo volo non abbiamo ancora l'orario di arrivo certificato. Può essere per due motivi: il volo è di ieri o dell'altro ieri e il dato arriva di solito entro un giorno, oppure il numero non è quello giusto. Controlla il numero sulla carta d'imbarco; se è corretto, ricontrolla domani. Questa analisi non si consuma: il credito resta, e se ci lasci l'email ti avvisiamo noi.",
        "Di questo volo non abbiamo ancora l'orario di arrivo certificato. Può essere per due motivi: il volo è di ieri o dell'altro ieri e il dato arriva di solito entro un giorno, oppure il numero non è quello giusto. Controlla il numero sulla carta d'imbarco; se è corretto, ricontrolla domani. Il check resta gratuito, e se ci lasci l'email ti avvisiamo noi.",
      ),
    };
  }

  // ── La memoria dell'imbuto: una riga in `verifiche` per ogni check ───
  let verificaId: string | null = null;
  if (sb) {
    try {
      const { data: riga, error } = await sb
        .from("verifiche")
        .insert({
          volo_id: voloId,
          volo_iata: fatto.voloIata,
          data_locale: fatto.dataLocale,
          esito: verdetto.esito,
          importo: verdetto.esito === "idoneo" ? verdetto.importo : null,
          ritardo_minuti: "ritardoMinuti" in verdetto ? verdetto.ritardoMinuti : null,
          motivo: verdetto.motivo,
          versione_regole: verdetto.versioneRegole,
          // Shadow mode (SPEC §4): il verdetto aspetta la conferma umana in /admin.
          /* Shadow mode ACCESO di default in produzione (11/08): prima
             serviva la variabile SHADOW_MODE=1 su Netlify, e una
             variabile che va messa a mano è una variabile che un giorno
             qualcuno dimentica, spegnendo la conferma umana senza
             volerlo. Adesso in produzione è acceso da solo e si spegne
             solo scrivendo esplicitamente SHADOW_MODE=0: dimenticarsene
             porta dalla parte prudente, non dall'altra. */
          /* ⚠️ Dal 12/08 "in attesa" non ferma più la vendita (il
             controllo umano avviene DOPO, vedi checkout/route.ts), quindi
             questo campo dice solo se il verdetto è ancora da rivedere.
             Resta acceso da solo in produzione: dimenticarsene porta
             dalla parte prudente. */
          conferma:
            process.env.SHADOW_MODE === "0"
              ? "automatica"
              : process.env.SHADOW_MODE === "1" || process.env.NODE_ENV === "production"
                ? "in_attesa"
                : "automatica",
        })
        .select("id")
        .single();
      if (error) console.warn("[verifica] riga verifica non salvata:", error.message);
      verificaId = riga?.id ?? null;
    } catch (e) {
      console.warn("[verifica] riga verifica non salvata:", e);
    }
  }

  // Il payload grezzo resta nel database, non esce dall'orchestratore.
  const { payloadGrezzo: _scarta, ...fattoPulito } = fatto;
  void _scarta;

  return { ok: true, verificaId, verdetto, fatto: fattoPulito, demo: fatto.fonte === "demo" };
}
