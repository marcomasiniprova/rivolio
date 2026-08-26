"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, utenteCollegato } from "@/lib/supabase/server";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { casa } from "@/lib/email/posta";

/**
 * Le azioni sul controllo a campione dei verdetti.
 *
 * ⚠️ NON SBLOCCANO NIENTE, e il commento che c'era qui diceva il
 * contrario ("un umano lo conferma PRIMA che l'utente possa pagare").
 * Era vero fino al 12/08; dal 12/08 la cassa non aspetta più nessuno.
 * L'unica azione che pesa è la CORREZIONE: da lì in avanti su quel caso
 * non si vende, e il caso diventa materiale per il golden set.
 *
 * OGNI azione ricontrolla da capo che chi chiama sia admin: le server
 * action sono endpoint pubblici con un altro vestito, e fidarsi del fatto
 * che "il bottone lo vede solo l'admin" è il modo classico di farsi
 * confermare i verdetti da una chiamata scritta a mano.
 */
async function soloAdmin(): Promise<string | null> {
  const utente = await utenteCollegato();
  if (!utente) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profili").select("ruolo").eq("id", utente.id).single();
  return data?.ruolo === "admin" ? utente.id : null;
}

export type EsitoAdmin = { ok?: string; errore?: string; dettaglio?: string };

type EsitoVerifica = "idoneo" | "incerto" | "non_idoneo";
const ESITI: EsitoVerifica[] = ["idoneo", "incerto", "non_idoneo"];

/**
 * «VA BENE»: l'ho guardato e il verdetto regge.
 *
 * 🔴 QUESTA AZIONE SI CHIAMAVA `confermaVerifica` E NON CONFERMAVA
 * NIENTE. Nata per lo shadow mode, quando la conferma umana apriva la
 * cassa. Il 12/08 quel cancello è stato tolto (in produzione lo shadow
 * è acceso da solo, quindi teneva chiusa la cassa a chiunque), ma
 * l'azione è rimasta col nome, col testo e con l'email di prima:
 * mandava al cliente «Ricontrollato a mano: il verdetto regge», cioè
 * una rassicurazione su un blocco che non esisteva più, a gente che nel
 * frattempo poteva aver già pagato.
 *
 * Adesso fa una cosa sola e la dice: marca la riga come guardata, così
 * sparisce dall'elenco del campione. Nessuna email, nessuno sblocco.
 * Quello che ferma davvero una vendita è `correggiVerifica`, qui sotto.
 */
export async function guardato(id: string): Promise<EsitoAdmin> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };
  if (!SERVIZIO_ATTIVO) return { errore: "SUPABASE_SECRET_KEY assente." };

  const db = supabaseServizio();
  // Il filtro su `conferma` chiude la corsa fra due mani che premono insieme.
  const { data: cambiata, error } = await db
    .from("verifiche")
    .update({ conferma: "confermata" })
    .eq("id", id)
    .eq("conferma", "in_attesa")
    .select("id");
  if (error || !cambiata?.length) return { errore: "Non salvato: ricarica la pagina." };

  revalidatePath("/admin/pratiche");
  revalidatePath("/admin");
  return { ok: "Segnato come guardato." };
}

/**
 * MODERA UNA RECENSIONE: approvala (compare in landing) o nascondila.
 *
 * Come tutte le azioni qui, ricontrolla da capo che chi chiama sia admin:
 * è un endpoint pubblico, e "il bottone lo vede solo l'admin" non è una
 * serratura. La landing legge le approvate da sola (con una cache di
 * pochi minuti), quindi non serve ricostruire niente: basta cambiare lo
 * stato.
 */
export async function moderaRecensione(
  id: string,
  azione: "approva" | "nascondi",
): Promise<EsitoAdmin> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };
  const { decidiRecensione } = await import("@/lib/recensioni/recensioni");
  const ok = await decidiRecensione(id, azione);
  if (!ok) return { errore: "Non salvato: ricarica la pagina." };
  revalidatePath("/admin/recensioni");
  return { ok: azione === "approva" ? "Approvata: comparirà in landing." : "Nascosta." };
}

/**
 * Corregge un verdetto: il motore ha detto una cosa, l'umano un'altra.
 * La verifica passa a `corretta` con l'esito giusto.
 *
 * ⚠️ È L'UNICA AZIONE DEL PANNELLO CHE FERMA UNA VENDITA: sia la rotta
 * della cassa sia il webhook di Stripe rifiutano un caso con
 * `conferma === "corretta"`. Per questo il campo della nota è
 * obbligatorio: una vendita si blocca con un motivo scritto, non con un
 * clic.
 *
 * Il caso completo finisce nei log in modo VISTOSO: ogni correzione è un
 * caso nuovo per il golden set (prove del motore).
 */
export async function correggiVerifica(
  id: string,
  esitoGiusto: string,
  nota: string,
): Promise<EsitoAdmin> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };
  if (!SERVIZIO_ATTIVO) return { errore: "SUPABASE_SECRET_KEY assente." };
  if (!ESITI.includes(esitoGiusto as EsitoVerifica)) {
    return { errore: "Esito non valido: idoneo, incerto o non_idoneo." };
  }

  const db = supabaseServizio();
  const { data: v, error: errLettura } = await db
    .from("verifiche")
    .select(
      "*, voli(volo_iata, data_locale, vettore_operativo, arrivo_previsto_utc, arrivo_effettivo_utc, stato, km_ortodromica, fonte, fonti_discordanti)",
    )
    .eq("id", id)
    .maybeSingle();
  if (errLettura || !v) return { errore: "Verifica non trovata." };
  if (v.conferma !== "in_attesa") return { errore: "Già lavorata: ricarica la pagina." };

  const campi: Record<string, string | number | null> = {
    conferma: "corretta",
    esito: esitoGiusto,
  };
  // Un caso che non è più idoneo non ha una fascia: lasciarla sarebbe
  // un numero finto pronto a finire davanti a un utente.
  if (esitoGiusto !== "idoneo") campi.importo = null;
  if (nota.trim()) campi.motivo = nota.trim();

  const { data: cambiata, error } = await db
    .from("verifiche")
    .update(campi)
    .eq("id", id)
    .eq("conferma", "in_attesa")
    .select("id");
  if (error || !cambiata?.length) return { errore: "Correzione fallita: ricarica la pagina." };

  // Il log vistoso: è il canale con cui il caso arriva al golden set.
  console.error(
    [
      "",
      "⚠️ ══════════ VERDETTO CORRETTO A MANO: CASO NUOVO PER IL GOLDEN SET ══════════ ⚠️",
      "Il motore ha sbagliato su un caso vero. Va etichettato a mano e aggiunto",
      "alle prove del motore (lib/regole/casi-oro.ts) prima di fidarsi di nuovo.",
      `verifica:         ${v.id}`,
      `volo:             ${v.volo_iata} del ${v.data_locale}`,
      `esito del motore: ${v.esito} (importo ${v.importo ?? "-"}€, ritardo ${v.ritardo_minuti ?? "-"} min)`,
      `motivo del motore: ${v.motivo ?? "-"}`,
      `versione regole:  ${v.versione_regole}`,
      `esito corretto:   ${esitoGiusto}`,
      `nota dell'admin:  ${nota.trim() || "(nessuna)"}`,
      `fatto del volo:   ${JSON.stringify(v.voli ?? null)}`,
      "═══════════════════════════════════════════════════════════════════════════════",
      "",
    ].join("\n"),
  );

  revalidatePath("/admin/pratiche");
  revalidatePath("/admin");
  return { ok: `Corretta in "${esitoGiusto}". Il caso è nei log per il golden set.` };
}

/**
 * IL MODO SICURO: l'interruttore d'emergenza (audit 26/08).
 *
 * Acceso, mette in pausa le email automatiche (cron dei promemoria e
 * recupero) e la replica AI (torna al testo fisso). Check, verdetto,
 * pagamento e apertura pratica NON si toccano.
 *
 * Come ogni azione qui, ricontrolla da capo che chi chiama sia admin: è un
 * endpoint pubblico, non basta che il bottone lo veda solo l'admin.
 */
export async function impostaModoSicuroAdmin(on: boolean): Promise<EsitoAdmin> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };
  const { impostaModoSicuro } = await import("@/lib/motore/modo-sicuro");
  const ok = await impostaModoSicuro(on);
  if (!ok) return { errore: "Non salvato: ricarica la pagina." };
  revalidatePath("/admin/impostazioni");
  revalidatePath("/admin");
  return {
    ok: on
      ? "Modo sicuro ACCESO: email automatiche e replica AI in pausa. Cassa e verdetti restano vivi."
      : "Modo sicuro spento: gli automatismi ripartono.",
  };
}

type RispostaSegui = {
  ok?: boolean;
  motivo?: string;
  errore?: string;
  aperte?: number;
  esaminate?: number;
  inviate?: { pratica: string; passo: string }[];
};

/**
 * Un giro di follow-up, a mano: la stessa logica del cron
 * (app/api/motore/segui), chiamata via fetch interno. La rotta non può
 * esportare la funzione (Next accetta solo i verbi HTTP), quindi la si
 * chiama come farà l'orologio in produzione: stessa porta, stessa prova.
 */
export async function giroFollowUp(): Promise<EsitoAdmin> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };

  try {
    const risposta = await fetch(`${casa()}/api/motore/segui`, {
      method: "POST",
      headers: { "x-motore-segreto": process.env.MOTORE_SEGRETO ?? "" },
      cache: "no-store",
    });
    const corpo = (await risposta.json()) as RispostaSegui;
    if (!risposta.ok || !corpo.ok) {
      return { errore: corpo.motivo ?? corpo.errore ?? `Giro fallito (HTTP ${risposta.status}).` };
    }

    revalidatePath("/admin/pratiche");
    revalidatePath("/admin");
    const inviate = corpo.inviate ?? [];
    return {
      ok: `${corpo.aperte ?? 0} pratiche aperte, ${corpo.esaminate ?? 0} esaminate, ${inviate.length} email partite.`,
      dettaglio:
        inviate.map((i) => `${i.pratica} → ${i.passo}`).join("\n") ||
        "Nessuna email dovuta oggi: le pratiche sono tutte al passo.",
    };
  } catch (e) {
    console.error("[admin] giro di follow-up fallito:", e);
    return { errore: "Il giro non è partito: il server non risponde." };
  }
}
