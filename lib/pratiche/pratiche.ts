import { SERVIZIO_ATTIVO, supabaseServizio } from "../supabase/servizio";
import { controllaFormato } from "../email/indirizzo";
import { scadenzaStimata } from "../regole/eu261";

/**
 * La pratica: la macchina a stati di un reclamo (SPEC §6, strato 6).
 *
 * creata → pagata → pronta → inviata → sollecito → enac →
 * esito_pagata | esito_rifiutata | rimborsata
 *
 * REGOLE DI QUESTO FILE:
 * - Le transizioni le fa SOLO il server (chiave di servizio). L'utente, via
 *   RLS, può soltanto leggere le sue pratiche e i suoi eventi.
 * - Ogni transizione lascia un evento in `pratiche_eventi`: è la cronologia
 *   che l'utente vede nel tracker, e la memoria del cron dei follow-up.
 * - Niente eccezioni verso chi chiama: ogni funzione torna un esito pulito.
 *   Un webhook che esplode fa ritentare Stripe all'infinito; un cron che
 *   esplode salta il giro di tutti per colpa di una pratica sola.
 */

import type { MotivoRifiuto } from "./rifiuto";

export type StatoPratica =
  | "creata"
  | "pagata"
  | "pronta"
  | "inviata"
  | "sollecito"
  | "enac"
  | "esito_pagata"
  | "esito_rifiutata"
  | "rimborsata";

export type TipoPratica = "singola" | "famiglia";

/** Fino a 5 per la famiglia; il primo è l'intestatario. */
export type Passeggero = { nome: string; cognome: string };

export type Pratica = {
  id: string;
  utente_id: string | null;
  verifica_id: string | null;
  volo_id: string | null;
  stato: StatoPratica;
  tipo: TipoPratica;
  passeggeri: Passeggero[];
  importo_fascia: number | null;
  prezzo_pagato: number | null;
  ordine_pagamento: string | null;
  email: string;
  scadenza_stimata: string | null;
  garanzia_fino_al: string | null;
  inviata_il: string | null;
  /**
   * Il motivo per cui la compagnia ha detto no, dichiarato dal cliente a
   * scelta chiusa. Decide la replica nel sollecito. NULL = non ha ancora
   * risposto, o il cliente non ce l'ha detto.
   * (Colonne della migrazione 2026-08-15.)
   */
  rifiuto_motivo?: MotivoRifiuto | null;
  rifiuto_il?: string | null;
  /**
   * Diritto di cura (art. 9): il cliente ha spese di assistenza
   * (pasti/hotel) da farsi rimborsare, documentate dai suoi scontrini.
   * Aggiunge un paragrafo alla lettera del reclamo, senza un secondo
   * pagamento (scelta di Valerio, 14/08). NULL/false = niente spese.
   */
  cura_richiesta?: boolean | null;
  creata_il: string;
  aggiornata_il: string;
};

export type EventoPratica = {
  id: string;
  pratica_id: string;
  tipo: string;
  nota: string | null;
  creato_il: string;
};

/** La pratica col suo volo agganciato: serve al cron per scrivere le email. */
export type PraticaConVolo = Pratica & {
  voli: {
    /** Lo scalo di partenza: le email di seguito lo usano per l'ente. */
    partenza_iata?: string | null;
    volo_iata: string;
    data_locale: string;
    vettore_operativo: string | null;
  } | null;
};

/** Gli stati in cui il cron dei follow-up ha ancora qualcosa da fare. */
export const STATI_APERTI: StatoPratica[] = [
  "pagata",
  "pronta",
  "inviata",
  "sollecito",
  "enac",
];

/** Data (solo giorno, UTC) fra `giorni` giorni da oggi. */
function giornoFra(giorni: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/**
 * Trova l'utente auth per email, o lo crea (email già confermata: ha appena
 * pagato, la casella è per forza sua e viva).
 *
 * Non esiste un "getUserByEmail" nell'admin API: si prova prima a creare,
 * e se l'indirizzo esiste già lo si ritrova con `generateLink`, che per gli
 * utenti esistenti restituisce l'utente SENZA mandare nessuna email.
 */
async function trovaOCreaUtente(
  email: string,
): Promise<{ ok: true; id: string; nuovo: boolean } | { ok: false; motivo: string }> {
  const db = supabaseServizio();

  /* L'ULTIMO CANCELLO PRIMA DI APRIRE UN ACCOUNT (13/08).
     Il controllo vero sta molto più a monte, sul campo del verdetto, ed è
     lì che si prendono i refusi. Questo è la rete sotto: qui l'account
     nasce DAVVERO, e un indirizzo scritto male diventa un cliente che ha
     pagato e non riesce a entrare.
     ⚠️ Niente DNS in questo punto: gira dentro il webhook di Stripe, e un
     DNS lento farebbe ritentare il pagamento all'infinito. La forma e le
     caselle usa e getta si controllano senza toccare la rete. */
  const controllo = controllaFormato(email, { insisto: true });
  if (!controllo.ok) {
    return { ok: false, motivo: `indirizzo non utilizzabile (${controllo.motivo}): ${email}` };
  }
  email = controllo.email;

  const creato = await db.auth.admin.createUser({ email, email_confirm: true });
  if (!creato.error && creato.data.user) {
    return { ok: true, id: creato.data.user.id, nuovo: true };
  }

  const esistente = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (!esistente.error && esistente.data.user) {
    return { ok: true, id: esistente.data.user.id, nuovo: false };
  }

  return {
    ok: false,
    motivo: `utente né creato né trovato per ${email}: ${
      creato.error?.message ?? "?"
    } / ${esistente.error?.message ?? "?"}`,
  };
}

/**
 * Apre la pratica: utente auth (creato se non esiste), riga in `pratiche`
 * con scadenza stimata, evento `creata`.
 *
 * NON controlla l'esito della verifica: quel cancello ("non si vende sul
 * giallo, mai") sta nel webhook, PRIMA di arrivare qui.
 */
export async function creaPratica({
  verificaId,
  email,
  tipo = "singola",
  passeggeri = [],
}: {
  verificaId: string;
  email: string;
  tipo?: TipoPratica;
  passeggeri?: Passeggero[];
}): Promise<
  | { ok: true; pratica: Pratica; utenteNuovo: boolean; giaEsisteva?: boolean }
  | { ok: false; motivo: string }
> {
  if (!SERVIZIO_ATTIVO) return { ok: false, motivo: "SUPABASE_SECRET_KEY assente." };

  try {
    const db = supabaseServizio();

    const { data: verifica, error: errV } = await db
      .from("verifiche")
      .select("id, volo_id, volo_iata, data_locale, importo")
      .eq("id", verificaId)
      .maybeSingle();
    if (errV || !verifica) {
      return {
        ok: false,
        motivo: `verifica ${verificaId} non trovata${errV ? `: ${errV.message}` : "."}`,
      };
    }

    let vettore: string | null = null;
    if (verifica.volo_id) {
      const { data: volo } = await db
        .from("voli")
        .select("vettore_operativo")
        .eq("id", verifica.volo_id)
        .maybeSingle();
      vettore = volo?.vettore_operativo ?? null;
    }

    const utente = await trovaOCreaUtente(email);
    if (!utente.ok) return { ok: false, motivo: utente.motivo };

    // Senza vettore in cache si usa il codice volo: la sigla del vettore
    // è nelle prime lettere, e la scadenza resta comunque una STIMA.
    const scadenza = scadenzaStimata(verifica.data_locale, vettore ?? verifica.volo_iata);

    const { data: pratica, error: errP } = await db
      .from("pratiche")
      .insert({
        utente_id: utente.id,
        verifica_id: verifica.id,
        volo_id: verifica.volo_id,
        stato: "creata",
        tipo,
        passeggeri,
        importo_fascia: verifica.importo ?? null,
        email,
        scadenza_stimata: scadenza.dataStimata,
        /* ⚠️ NON è più la promessa fatta al cliente. Dal 9/08/2026 la
           garanzia è legata all'ESITO (rifiuto senza motivo valido o
           silenzio oltre i termini), non a una data. Questa colonna resta
           per non richiedere una migrazione e vale come promemoria interno:
           passato questo giorno la pratica va guardata, perché una
           compagnia che tace da tre mesi ha di fatto taciuto. Nessun testo
           mostrato all'utente la usa più. */
        garanzia_fino_al: giornoFra(90),
      })
      .select()
      .single();
    if (errP || !pratica) {
      /* IDEMPOTENZA A LIVELLO DATABASE (audit 14/08, insieme all'indice unico
         pratiche_verifica_unica della migrazione 2026-08-14-scala.sql). Due
         consegne dello stesso pagamento Stripe in parallelo passano entrambe il
         controllo "esiste già?" e provano a creare: l'indice unico fa fallire
         la seconda con 23505. Non è un errore, la pratica c'è: la rileggiamo e
         lo diciamo (giaEsisteva), così il webhook che ha perso la corsa NON
         manda una seconda email di benvenuto. Se la migrazione non è ancora
         applicata, il 23505 non scatta e il comportamento resta identico. */
      if (errP?.code === "23505") {
        const esistente = await praticaPerVerifica(verificaId);
        if (esistente) return { ok: true, pratica: esistente, utenteNuovo: false, giaEsisteva: true };
      }
      return { ok: false, motivo: `pratica non creata: ${errP?.message ?? "?"}` };
    }

    await registraEvento(
      pratica.id,
      "creata",
      `Pratica aperta per il volo ${verifica.volo_iata} del ${verifica.data_locale}.`,
    );

    return { ok: true, pratica: pratica as Pratica, utenteNuovo: utente.nuovo };
  } catch (e) {
    console.error("[pratiche] creaPratica fallita:", e);
    return { ok: false, motivo: "Errore interno nella creazione della pratica." };
  }
}

/**
 * Cambia stato: aggiorna `stato` e `aggiornata_il`, registra l'evento.
 * `campi` permette di scrivere nello stesso colpo le colonne che viaggiano
 * con la transizione (es. `prezzo_pagato` con `pagata`, `inviata_il` con
 * `inviata`).
 */
export async function transizionePratica(
  id: string,
  statoNuovo: StatoPratica,
  nota?: string,
  campi?: Record<string, string | number | null>,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!SERVIZIO_ATTIVO) return { ok: false, motivo: "SUPABASE_SECRET_KEY assente." };

  try {
    const db = supabaseServizio();
    const { error } = await db
      .from("pratiche")
      .update({
        stato: statoNuovo,
        aggiornata_il: new Date().toISOString(),
        ...(campi ?? {}),
      })
      .eq("id", id);
    if (error) return { ok: false, motivo: error.message };

    await registraEvento(id, statoNuovo, nota ?? null);
    return { ok: true };
  } catch (e) {
    console.error(`[pratiche] transizione a "${statoNuovo}" fallita:`, e);
    return { ok: false, motivo: "Errore interno nella transizione." };
  }
}

/**
 * Scrive un evento in cronologia. Torna `false` senza lanciare: un evento
 * perso è un problema da log, non un motivo per far fallire l'azione madre.
 */
export async function registraEvento(
  praticaId: string,
  tipo: string,
  nota?: string | null,
): Promise<boolean> {
  try {
    const db = supabaseServizio();
    const { error } = await db
      .from("pratiche_eventi")
      .insert({ pratica_id: praticaId, tipo, nota: nota ?? null });
    if (error) {
      console.error(`[pratiche] evento "${tipo}" non registrato per ${praticaId}:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[pratiche] evento "${tipo}" non registrato per ${praticaId}:`, e);
    return false;
  }
}

/* ------------------------------------------------- letture per il server */

export async function caricaPratica(id: string): Promise<Pratica | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();
    const { data, error } = await db.from("pratiche").select().eq("id", id).maybeSingle();
    if (error) {
      console.error("[pratiche] lettura fallita:", error.message);
      return null;
    }
    return (data as Pratica | null) ?? null;
  } catch (e) {
    console.error("[pratiche] lettura fallita:", e);
    return null;
  }
}

/** La pratica (più recente) nata da una verifica: è il lucchetto contro i webhook doppi. */
export async function praticaPerVerifica(verificaId: string): Promise<Pratica | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();
    const { data, error } = await db
      .from("pratiche")
      .select()
      .eq("verifica_id", verificaId)
      .order("creata_il", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[pratiche] lettura per verifica fallita:", error.message);
      return null;
    }
    return (data as Pratica | null) ?? null;
  } catch (e) {
    console.error("[pratiche] lettura per verifica fallita:", e);
    return null;
  }
}

export async function eventiPratica(praticaId: string): Promise<EventoPratica[]> {
  if (!SERVIZIO_ATTIVO) return [];
  try {
    const db = supabaseServizio();
    const { data, error } = await db
      .from("pratiche_eventi")
      .select()
      .eq("pratica_id", praticaId)
      /* 🔴 L'ORDINE ERA CASUALE FRA EVENTI DELLO STESSO SECONDO, e Valerio
         se n'è accorto: «con lo stesso identico click la cronologia mi ha
         mostrato due versioni diverse in momenti diversi».
         Dichiarare il no della compagnia scrive QUATTRO righe nello stesso
         istante (il testo, l'analisi, il rifiuto, il passaggio di stato).
         Ordinandole solo per data e ora, Postgres è libero di restituirle
         nell'ordine che gli conviene, e quell'ordine può cambiare da una
         lettura all'altra: nessuna riga sparisce, ma la storia si racconta
         al contrario e sembra un'altra pratica.
         L'`id` come secondo criterio non è un dettaglio: è quello che
         rende la cronologia sempre uguale a se stessa. */
      .order("creato_il", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      console.error("[pratiche] eventi non letti:", error.message);
      return [];
    }
    return (data as EventoPratica[] | null) ?? [];
  } catch (e) {
    console.error("[pratiche] eventi non letti:", e);
    return [];
  }
}

/**
 * Le pratiche su cui il cron ha ancora qualcosa da fare, col volo agganciato.
 * Le più vecchie prima: se il budget di tempo taglia il giro, chi aspetta
 * da più tempo passa per primo.
 */
export async function praticheDaSeguire(limite = 100): Promise<PraticaConVolo[]> {
  if (!SERVIZIO_ATTIVO) return [];
  try {
    const db = supabaseServizio();
    const { data, error } = await db
      .from("pratiche")
      /* `partenza_iata` serve alle email di seguito: l'ente nazionale
         lo decide lo Stato dell'aeroporto di PARTENZA (art. 16 par. 1), e
         senza questo campo l'email scriveva ENAC a tutti. */
      .select("*, voli(volo_iata, data_locale, vettore_operativo, partenza_iata)")
      .in("stato", STATI_APERTI)
      .order("creata_il", { ascending: true })
      .limit(limite);
    if (error) {
      console.error("[pratiche] lista da seguire non letta:", error.message);
      return [];
    }
    return (data as unknown as PraticaConVolo[] | null) ?? [];
  } catch (e) {
    console.error("[pratiche] lista da seguire non letta:", e);
    return [];
  }
}

/**
 * Gli eventi già registrati per un gruppo di pratiche, come insieme di
 * chiavi `praticaId:tipo`. È la memoria del cron: prima di mandare
 * un'email si controlla qui, così nessuna parte due volte.
 */
export async function eventiRegistrati(
  praticaIds: string[],
  prefisso = "email_",
): Promise<Set<string>> {
  const insieme = new Set<string>();
  if (!SERVIZIO_ATTIVO || praticaIds.length === 0) return insieme;
  try {
    const db = supabaseServizio();
    const { data, error } = await db
      .from("pratiche_eventi")
      .select("pratica_id, tipo")
      .in("pratica_id", praticaIds)
      .like("tipo", `${prefisso}%`);
    if (error) {
      console.error("[pratiche] eventi registrati non letti:", error.message);
      return insieme;
    }
    for (const e of data ?? []) insieme.add(`${e.pratica_id}:${e.tipo}`);
    return insieme;
  } catch (e) {
    console.error("[pratiche] eventi registrati non letti:", e);
    return insieme;
  }
}
