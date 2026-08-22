"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, utenteCollegato } from "@/lib/supabase/server";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { codiceAffiliatoValido } from "@/lib/affiliati/codice";
import { promuoviCreatore, togliCreatore } from "@/lib/affiliati/creatore";

/**
 * Le azioni del pannello affiliati. Come tutte le server action, ognuna
 * ricontrolla da capo che chi chiama sia admin: sono endpoint pubblici con
 * un altro vestito, e "il bottone lo vede solo l'admin" non è una serratura.
 */
async function soloAdmin(): Promise<string | null> {
  const utente = await utenteCollegato();
  if (!utente) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profili").select("ruolo").eq("id", utente.id).single();
  return data?.ruolo === "admin" ? utente.id : null;
}

export type EsitoAffiliati = { ok?: string; errore?: string };

/** Crea un creator. Firma (prev, formData) per useActionState. */
export async function creaAffiliato(
  _prev: EsitoAffiliati,
  form: FormData,
): Promise<EsitoAffiliati> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };
  if (!SERVIZIO_ATTIVO) return { errore: "SUPABASE_SECRET_KEY assente." };

  const codice = codiceAffiliatoValido(String(form.get("codice") ?? ""));
  const nome = String(form.get("nome") ?? "").trim();
  const sconto = Number(form.get("sconto") ?? 10);
  const commissione = Number(form.get("commissione") ?? 40);

  if (!codice) return { errore: "Codice non valido: da 3 a 20 lettere o numeri (es. MARCO)." };
  if (!nome) return { errore: "Manca il nome del creator." };
  if (!Number.isFinite(sconto) || sconto < 0 || sconto > 90) return { errore: "Sconto fra 0 e 90." };
  if (!Number.isFinite(commissione) || commissione < 0 || commissione > 100) {
    return { errore: "Commissione fra 0 e 100." };
  }

  const db = supabaseServizio();
  const { error } = await db.from("affiliati").insert({
    codice,
    nome,
    sconto_percento: Math.round(sconto),
    commissione_percento: Math.round(commissione),
  });
  if (error) {
    if (error.code === "23505") return { errore: `Il codice ${codice} esiste già.` };
    console.error("[affiliati] creazione fallita:", error.message);
    return { errore: "Non salvato: riprova." };
  }
  revalidatePath("/admin/affiliati");
  return { ok: `Creato ${codice}. Copia il suo link e daglielo.` };
}

/** Segna pagate tutte le commissioni aperte di un creator. Native form. */
export async function segnaPagate(form: FormData): Promise<void> {
  if (!(await soloAdmin())) return;
  if (!SERVIZIO_ATTIVO) return;
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const db = supabaseServizio();
  const { error } = await db
    .from("commissioni")
    .update({ pagata_il: new Date().toISOString() })
    .eq("affiliato_id", id)
    .is("pagata_il", null);
  if (error) console.error("[affiliati] segna pagate fallito:", error.message);
  revalidatePath("/admin/affiliati");
}

/** Sospende o riattiva un creator. Native form. */
export async function cambiaStato(form: FormData): Promise<void> {
  if (!(await soloAdmin())) return;
  if (!SERVIZIO_ATTIVO) return;
  const id = String(form.get("id") ?? "");
  const attivo = String(form.get("attivo") ?? "") === "1";
  if (!id) return;
  const db = supabaseServizio();
  const { error } = await db.from("affiliati").update({ attivo }).eq("id", id);
  if (error) console.error("[affiliati] cambia stato fallito:", error.message);
  revalidatePath("/admin/affiliati");
}

/* --------------------------------------------- creator gratis a vita */

/**
 * Promuove un'email a creator gratis a vita. Firma (prev, formData) per
 * useActionState. Se l'account non esiste ancora lo crea (email già
 * confermata: lo decide l'admin), così il giorno che entra è già gratis.
 */
export async function promuoviCreator(
  _prev: EsitoAffiliati,
  form: FormData,
): Promise<EsitoAffiliati> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };
  if (!SERVIZIO_ATTIVO) return { errore: "SUPABASE_SECRET_KEY assente." };

  const email = String(form.get("email") ?? "").trim();
  if (!email) return { errore: "Metti l'email del creator." };

  const esito = await promuoviCreatore(email);
  if (!esito.ok) return { errore: esito.motivo ?? "Non riuscito." };
  revalidatePath("/admin/affiliati");
  return { ok: `${email} ora ha tutto gratis a vita.` };
}

/** Toglie il gratis a vita a un account. Native form. */
export async function rimuoviCreator(form: FormData): Promise<void> {
  if (!(await soloAdmin())) return;
  const id = String(form.get("id") ?? "");
  if (id) await togliCreatore(id);
  revalidatePath("/admin/affiliati");
}
