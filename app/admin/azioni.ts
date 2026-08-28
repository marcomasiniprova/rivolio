"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, utenteCollegato } from "@/lib/supabase/server";
import { casa } from "@/lib/email/posta";

/**
 * Le azioni del pannello admin (server action).
 *
 * OGNI azione ricontrolla da capo che chi chiama sia admin: le server
 * action sono endpoint pubblici con un altro vestito, e fidarsi del fatto
 * che "il bottone lo vede solo l'admin" è il modo classico di farsi
 * eseguire un comando da una chiamata scritta a mano.
 *
 * (Il controllo a campione dei verdetti, cioè lo shadow mode, è stato tolto
 * il 28/08: le azioni «Va bene» e «Correggi» non esistono più. Restano la
 * moderazione delle recensioni, il modo sicuro e il giro di follow-up.)
 */
async function soloAdmin(): Promise<string | null> {
  const utente = await utenteCollegato();
  if (!utente) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profili").select("ruolo").eq("id", utente.id).single();
  return data?.ruolo === "admin" ? utente.id : null;
}

export type EsitoAdmin = { ok?: string; errore?: string; dettaglio?: string };

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
