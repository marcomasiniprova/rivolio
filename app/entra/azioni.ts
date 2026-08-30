"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURATO } from "@/lib/supabase/chiavi";
import { benvenuto } from "@/lib/email/messaggi";
import { percorsoInterno } from "@/lib/api/percorso";
import { controllaIndirizzo } from "@/lib/email/dominio";
import { controllaFormato } from "@/lib/email/indirizzo";
import { ipDaHeaders, oltreIlLimite } from "@/lib/api/limite";

export type Esito = { errore?: string; avviso?: string };

/**
 * DUE PESI, E SONO DUE MESTIERI DIVERSI.
 *
 * Chi ENTRA ha già un account: si controlla solo che l'indirizzo sia
 * scritto come un indirizzo. Bloccarlo perché il suo dominio oggi non
 * risponde al DNS vorrebbe dire chiudere fuori di casa un cliente che ha
 * pagato, per un guasto altrui.
 *
 * Chi si REGISTRA (o entra col link, che l'account lo crea) passa da
 * tutti i cancelli, DNS compreso: è lì che nascono gli account con
 * indirizzi inesistenti.
 */
async function emailPerEntrare(grezza: string): Promise<{ ok: true; email: string } | Esito> {
  const e = controllaFormato(grezza, { insisto: true });
  if (!e.ok) return { errore: "Controlla l'indirizzo email." };
  return { ok: true, email: e.email };
}

async function emailPerRegistrarsi(grezza: string): Promise<{ ok: true; email: string } | Esito> {
  const e = await controllaIndirizzo(grezza);
  if (!e.ok) return { errore: e.messaggio };
  return { ok: true, email: e.email };
}

/** Da dove sta arrivando la richiesta: serve per costruire il link di ritorno. */
async function origine() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocollo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocollo}://${host}`;
}

/**
 * IL FRENO SUL LOGIN (audit esterno, 30/08). La pagina d'accesso non aveva
 * un tetto d'app: solo i freni di Supabase sotto. Senza, chi prova mille
 * password a raffica non incontrava niente di nostro. Dieci tentativi al
 * minuto per IP: un utente vero che sbaglia la password ne fa tre o quattro,
 * un ciclo automatico si ferma. Zero attrito, nessun captcha.
 * ⚠️ È il contatore in memoria di lib/api/limite: ferma il curl in loop di un
 * singolo IP, non un attacco distribuito. Sotto c'è comunque Supabase.
 */
async function troppiTentativi(chiave: string, massimo: number): Promise<boolean> {
  return oltreIlLimite(chiave, ipDaHeaders(await headers()), massimo);
}

/**
 * Dove mandare l'utente dopo il login: solo un percorso interno vero.
 * La regola sta in un punto solo (percorsoInterno), condivisa con le altre
 * porte d'ingresso, così non si può indurire qui e dimenticare altrove.
 */
function destinazioneSicura(poi: FormDataEntryValue | null): string {
  return percorsoInterno(poi);
}

function nonConfigurato(): Esito {
  return {
    errore:
      "L'accesso non è ancora collegato: manca il file .env.local con le chiavi di Supabase.",
  };
}

/**
 * Supabase risponde in inglese. All'utente italiano non si mostra
 * "Email address is invalid": si mostra una frase che gli dice cosa fare.
 * Quello che non riconosciamo diventa un messaggio generico, mai il testo
 * originale: non deve mai uscire inglese davanti a un utente.
 */
function inItaliano(messaggio: string): string {
  const m = messaggio.toLowerCase();

  if (m.includes("invalid") && m.includes("email")) {
    return "Quell'indirizzo non viene accettato. Usa un'email vera che leggi davvero.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Con questa email esiste già un account. Entra dalla linguetta accanto.";
  }
  if (m.includes("password") && m.includes("least")) {
    return "La password è troppo corta: almeno 8 caratteri.";
  }
  if (m.includes("weak") || m.includes("pwned")) {
    return "Quella password è troppo comune. Cambiane qualche pezzo.";
  }
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) {
    /* 🔴 IL MESSAGGIO LASCIAVA LA PERSONA FERMA (Valerio, 12/08: «come
       vedi da errore sempre con troppe richieste, non so perché»).
       Non era un guasto: è il freno di Supabase, che fra due richieste
       dello stesso link vuole un minuto. Ma il messaggio diceva solo
       "aspetta", e non diceva la cosa che sblocca davvero: il link
       mandato PRIMA è ancora valido e sta già in casella. Chi non lo sa
       ripreme, il freno riparte, e si resta fuori più a lungo di quanto
       serviva. */
    return "Il link te l'ho già mandato: cercalo in posta, funziona ancora (guarda anche nello spam). Se proprio non arriva, riprova fra un minuto.";
  }
  if (m.includes("signups not allowed") || m.includes("disabled")) {
    return "Le registrazioni sono chiuse in questo momento.";
  }

  console.error("[entra] messaggio Supabase non tradotto:", messaggio);
  return "Non ci sono riuscito. Riprova fra un attimo.";
}

/** Accesso con email e password. */
export async function accedi(_precedente: Esito, dati: FormData): Promise<Esito> {
  if (!SUPABASE_CONFIGURATO) return nonConfigurato();

  if (await troppiTentativi("login", 10)) {
    return { errore: "Troppi tentativi di accesso. Aspetta un minuto e riprova." };
  }

  const controllo = await emailPerEntrare(String(dati.get("email") ?? ""));
  if (!("ok" in controllo)) return controllo;
  const email = controllo.email;
  const password = String(dati.get("password") ?? "");
  if (!password) return { errore: "Scrivi la password." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Messaggio volutamente generico: dire "questa email non esiste" regala a
    // chiunque la lista di chi è iscritto.
    return { errore: "Email o password non corrispondono." };
  }

  revalidatePath("/", "layout");
  redirect(destinazioneSicura(dati.get("poi")));
}

/** Registrazione. */
export async function registrati(_precedente: Esito, dati: FormData): Promise<Esito> {
  if (!SUPABASE_CONFIGURATO) return nonConfigurato();

  if (await troppiTentativi("login-email", 10)) {
    return { errore: "Troppi tentativi. Aspetta un minuto e riprova." };
  }

  const controllo = await emailPerRegistrarsi(String(dati.get("email") ?? ""));
  if (!("ok" in controllo)) return controllo;
  const email = controllo.email;
  const password = String(dati.get("password") ?? "");
  if (password.length < 8) return { errore: "La password deve avere almeno 8 caratteri." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await origine()}/auth/conferma` },
  });

  if (error) return { errore: inItaliano(error.message) };

  // Sessione già attiva: nel pannello Supabase la conferma email è spenta.
  if (data.session) {
    // Il benvenuto parte da Resend, non da Supabase, e non blocca l'ingresso.
    void benvenuto(email).then((e) => {
      if (!e.ok) console.warn("[registrati] benvenuto non spedito:", e.motivo);
    });
    revalidatePath("/", "layout");
    redirect(destinazioneSicura(dati.get("poi")));
  }

  return {
    avviso: `Ti ho mandato un'email a ${email}. Apri il link dentro e sei dentro. Controlla anche lo spam.`,
  };
}

/** Accesso senza password: arriva un link via email. */
export async function linkMagico(_precedente: Esito, dati: FormData): Promise<Esito> {
  if (!SUPABASE_CONFIGURATO) return nonConfigurato();

  if (await troppiTentativi("login-email", 10)) {
    return { errore: "Troppi tentativi. Aspetta un minuto e riprova." };
  }

  /* Il link magico CREA l'account se non esiste: quindi qui si passa
     dal controllo pieno, non da quello di chi entra. */
  const controllo = await emailPerRegistrarsi(String(dati.get("email") ?? ""));
  if (!("ok" in controllo)) return controllo;
  const email = controllo.email;

  const poi = destinazioneSicura(dati.get("poi"));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await origine()}/auth/conferma?poi=${encodeURIComponent(poi)}`,
    },
  });

  if (error) return { errore: inItaliano(error.message) };

  return {
    avviso: `Link mandato a ${email}. Aprilo da questo dispositivo. Controlla anche lo spam.`,
  };
}

/** Uscita. */
export async function esci() {
  if (SUPABASE_CONFIGURATO) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}
