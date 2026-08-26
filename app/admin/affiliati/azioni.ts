"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, utenteCollegato } from "@/lib/supabase/server";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { codiceAffiliatoValido } from "@/lib/affiliati/codice";
import { leggiAffiliati } from "@/lib/affiliati/lettura";
import { promuoviCreatore, togliCreatore } from "@/lib/affiliati/creatore";

/**
 * Le azioni del pannello affiliati. Ognuna ricontrolla da capo che chi chiama
 * sia admin: sono endpoint pubblici con un altro vestito.
 */
async function soloAdmin(): Promise<string | null> {
  const utente = await utenteCollegato();
  if (!utente) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("profili").select("ruolo").eq("id", utente.id).single();
  return data?.ruolo === "admin" ? utente.id : null;
}

export type EsitoAffiliati = { ok?: string; errore?: string };

function numero(v: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(String(v ?? "").trim());
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}
function interoOpt(v: FormDataEntryValue | null): number | null {
  const t = String(v ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}
function euroOpt(v: FormDataEntryValue | null): number {
  const t = String(v ?? "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export async function creaAffiliato(
  _prev: EsitoAffiliati,
  form: FormData,
): Promise<EsitoAffiliati> {
  if (!(await soloAdmin())) return { errore: "Non sei autorizzato." };
  if (!SERVIZIO_ATTIVO) return { errore: "SUPABASE_SECRET_KEY assente." };

  const codice = codiceAffiliatoValido(String(form.get("codice") ?? ""));
  const nome = String(form.get("nome") ?? "").trim();
  const sconto = numero(form.get("sconto"), 0, 90);
  const commissione = numero(form.get("commissione"), 0, 100);
  const tipoAccordo =
    String(form.get("tipo_accordo") ?? "performance") === "ibrido" ? "ibrido" : "performance";

  if (!codice) return { errore: "Codice non valido: da 3 a 20 lettere o numeri (es. MARCO)." };
  if (!nome) return { errore: "Manca il nome del creator." };
  if (sconto === null) return { errore: "Sconto fra 0 e 90." };
  if (commissione === null) return { errore: "Commissione fra 0 e 100." };

  const base = {
    codice,
    nome,
    sconto_percento: Math.round(sconto),
    commissione_percento: Math.round(commissione),
  };
  const rigaPiena: Record<string, unknown> = {
    ...base,
    tipo_accordo: tipoAccordo,
    seguito: interoOpt(form.get("seguito")),
    bonus_fisso: euroOpt(form.get("bonus_fisso")),
  };

  const db = supabaseServizio();
  let { error } = await db.from("affiliati").insert(rigaPiena);
  if (error && /column|schema cache/i.test(error.message)) {
    ({ error } = await db.from("affiliati").insert(base));
  }
  if (error) {
    if (error.code === "23505") return { errore: `Il codice ${codice} esiste già.` };
    console.error("[affiliati] creazione fallita:", error.message);
    return { errore: "Non salvato: riprova." };
  }
  revalidatePath("/admin/affiliati");
  return { ok: `Creato ${codice}. Copia il suo link e daglielo.` };
}

/** Segna pagato TUTTO il dovuto: base 40%, bonus a soglie e fisso una-tantum. */
export async function segnaPagate(form: FormData): Promise<void> {
  if (!(await soloAdmin())) return;
  if (!SERVIZIO_ATTIVO) return;
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const db = supabaseServizio();
  const oraIso = new Date().toISOString();

  const { error } = await db
    .from("commissioni")
    .update({ pagata_il: oraIso })
    .eq("affiliato_id", id)
    .is("pagata_il", null);
  if (error) console.error("[affiliati] segna pagate fallito:", error.message);

  const tutti = await leggiAffiliati();
  const c = tutti?.find((x) => x.id === id);
  if (c) {
    const agg: Record<string, unknown> = { bonus_pagato: c.bonus.totale };
    if (c.tipo_accordo === "ibrido" && c.bonusFisso > 0 && !c.fissoPagatoIl) {
      agg.bonus_fisso_pagato_il = oraIso;
    }
    const { error: e2 } = await db.from("affiliati").update(agg).eq("id", id);
    if (e2 && !/column|schema cache/i.test(e2.message)) {
      console.error("[affiliati] segna bonus fallito:", e2.message);
    }
  }
  revalidatePath("/admin/affiliati");
}

export async function aggiornaAccordo(form: FormData): Promise<void> {
  if (!(await soloAdmin())) return;
  if (!SERVIZIO_ATTIVO) return;
  const id = String(form.get("id") ?? "");
  if (!id) return;
  const agg: Record<string, unknown> = {
    tipo_accordo:
      String(form.get("tipo_accordo") ?? "performance") === "ibrido" ? "ibrido" : "performance",
    seguito: interoOpt(form.get("seguito")),
    bonus_fisso: euroOpt(form.get("bonus_fisso")),
  };
  const db = supabaseServizio();
  const { error } = await db.from("affiliati").update(agg).eq("id", id);
  if (error) console.error("[affiliati] aggiorna accordo fallito:", error.message);
  revalidatePath("/admin/affiliati");
}

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

export async function rimuoviCreator(form: FormData): Promise<void> {
  if (!(await soloAdmin())) return;
  const id = String(form.get("id") ?? "");
  if (id) await togliCreatore(id);
  revalidatePath("/admin/affiliati");
}
