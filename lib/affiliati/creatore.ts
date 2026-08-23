import { utenteDaRichiesta } from "@/lib/api/utente";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { controllaFormato } from "@/lib/email/indirizzo";

/**
 * I CREATOR "GRATIS A VITA".
 *
 * Un account promosso dall'admin fa check e pratiche senza pagare, per
 * sempre. Il permesso è un flag su `profili.creator`, e questa è la cosa che
 * lo tiene sicuro: vive sul server, lo scrive SOLO la chiave di servizio,
 * quindi un utente non se lo può dare da solo. Il check e la cassa
 * controllano il flag lato server, mai una parola nel browser.
 */

export type UtenteCreatore = { id: string; email: string };

/**
 * L'utente loggato SE è un creator, altrimenti null.
 *
 * ⚠️ Si chiama solo quando serve (davanti al muro, davanti alla cassa), non
 * su ogni richiesta: senza sessione `utenteDaRichiesta` torna null subito,
 * senza toccare il database.
 */
export async function utenteCreatore(req: Request): Promise<UtenteCreatore | null> {
  if (!SERVIZIO_ATTIVO) return null;
  const utente = await utenteDaRichiesta(req);
  if (!utente?.email) return null;
  try {
    const db = supabaseServizio();
    const { data } = await db
      .from("profili")
      .select("creator")
      .eq("id", utente.id)
      .maybeSingle<{ creator: boolean | null }>();
    return data?.creator === true ? { id: utente.id, email: utente.email } : null;
  } catch (e) {
    console.error("[creatore] lettura flag fallita:", e);
    return null;
  }
}

/** Il flag creator per un id utente già noto (senza rileggere la sessione). */
export async function creatorePerId(userId: string): Promise<boolean> {
  if (!SERVIZIO_ATTIVO || !userId) return false;
  try {
    const db = supabaseServizio();
    const { data } = await db
      .from("profili")
      .select("creator")
      .eq("id", userId)
      .maybeSingle<{ creator: boolean | null }>();
    return data?.creator === true;
  } catch (e) {
    console.error("[creatore] lettura flag per id fallita:", e);
    return false;
  }
}

/* ------------------------------------------------------ pannello admin */

/**
 * Promuove un'email a creator. Se l'account non esiste ancora lo crea (email
 * già confermata: lo decide l'admin), così il creator il giorno che entra è
 * già gratis. Torna un esito pulito, non lancia.
 */
export async function promuoviCreatore(
  emailGrezza: string,
): Promise<{ ok: boolean; motivo?: string }> {
  if (!SERVIZIO_ATTIVO) return { ok: false, motivo: "Servizio non disponibile." };

  const controllo = controllaFormato(emailGrezza, { insisto: true });
  if (!controllo.ok) return { ok: false, motivo: controllo.messaggio };
  const email = controllo.email;

  try {
    const db = supabaseServizio();
    let userId: string | null = null;

    const creato = await db.auth.admin.createUser({ email, email_confirm: true });
    if (!creato.error && creato.data.user) {
      userId = creato.data.user.id;
    } else {
      // Esiste già: lo si ritrova senza mandare nessuna email.
      const link = await db.auth.admin.generateLink({ type: "magiclink", email });
      userId = link.data?.user?.id ?? null;
    }
    if (!userId) return { ok: false, motivo: "Account né trovato né creato." };

    // Il profilo esiste (lo crea il trigger alla nascita dell'utente): si alza il flag.
    const { error } = await db.from("profili").update({ creator: true }).eq("id", userId);
    if (error) return { ok: false, motivo: error.message };
    return { ok: true };
  } catch (e) {
    console.error("[creatore] promozione fallita:", e);
    return { ok: false, motivo: "Errore interno." };
  }
}

/** Toglie il gratis a vita a un account. */
export async function togliCreatore(userId: string): Promise<boolean> {
  if (!SERVIZIO_ATTIVO || !userId) return false;
  try {
    const db = supabaseServizio();
    const { error } = await db.from("profili").update({ creator: false }).eq("id", userId);
    return !error;
  } catch (e) {
    console.error("[creatore] rimozione fallita:", e);
    return false;
  }
}

export type CreatoreRiga = { id: string; email: string; nickname: string | null };

/** L'elenco dei creator gratis, con l'email (dall'auth). Pochi, quindi una
    lettura per uno va bene. */
export async function leggiCreatori(): Promise<CreatoreRiga[] | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();
    const { data, error } = await db
      .from("profili")
      .select("id, nickname")
      .eq("creator", true);
    if (error) throw new Error(error.message);

    const righe: CreatoreRiga[] = [];
    for (const p of (data ?? []) as { id: string; nickname: string | null }[]) {
      const u = await db.auth.admin.getUserById(p.id);
      righe.push({ id: p.id, email: u.data.user?.email ?? "(email sconosciuta)", nickname: p.nickname });
    }
    return righe;
  } catch (e) {
    console.error("[creatore] elenco fallito:", e);
    return null;
  }
}
