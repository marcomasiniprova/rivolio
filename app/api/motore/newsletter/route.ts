import { NextResponse, type NextRequest } from "next/server";
import { chiamataAutorizzata } from "@/lib/motore/autorizza";
import { modoSicuroAttivo } from "@/lib/motore/modo-sicuro";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { componiNewsletter } from "@/lib/email/newsletter";
import { iscrittiConfermati } from "@/lib/iscritti/lista";
import { vestito } from "@/lib/email/modello";
import { casa, spedisci } from "@/lib/email/posta";
import { linkDisdetta } from "@/lib/iscritti/gettone";

/**
 * LA NEWSLETTER SETTIMANALE DELL'OSSERVATORIO (28/08).
 *
 * La manda il cron del lunedì (netlify/functions/newsletter.mjs). Compone
 * l'email UNA volta (una chiamata all'AI), poi la spedisce a tutti gli
 * iscritti confermati, ognuno col suo link di disdetta.
 *
 * ⚠️ NON PUÒ MANDARE DUE VOLTE NELLA STESSA SETTIMANA. Prima di spedire si
 * "prenota" la settimana con un insert atomico in `newsletter_uscite`: se
 * quella riga c'è già (23505), il giro è già stato fatto e ci si ferma. Se
 * la tabella non esiste ancora, il guardiano si fa da parte (fail-open) e
 * la newsletter parte lo stesso: la protezione è un extra, non un cancello
 * che blocca il prodotto.
 *
 * ⚠️ MODO SICURO: se l'interruttore d'emergenza è acceso, non parte niente
 * (come il cron dei follow-up).
 *
 * ⚠️ SCALA. Per ora la lista è corta e il giro finisce in un attimo. Oltre
 * un centinaio di iscritti conviene passare all'invio a lotti di Resend
 * (send-batch) e a un avanzamento per persona: con budget di 8 secondi un
 * loop a una email per volta non consegna a migliaia di iscritti. In
 * ARRETRATI.
 */
export const dynamic = "force-dynamic";

const CODA =
  "Ricevi questa email perché hai confermato l'iscrizione all'Osservatorio dei Disservizi di Rivolio.";

/** Il lunedì della settimana in corso (UTC), "2026-08-31": chiude il doppio invio. */
function settimanaCorrente(): string {
  const ora = new Date();
  const g = ora.getUTCDay(); // 0=domenica .. 6=sabato
  const diff = g === 0 ? -6 : 1 - g;
  const lunedi = new Date(Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth(), ora.getUTCDate() + diff));
  return lunedi.toISOString().slice(0, 10);
}

/**
 * Prenota la settimana. Torna true se è GIÀ stata mandata (ci si ferma),
 * false se l'abbiamo prenotata ora oppure se il guardiano non è
 * disponibile (fail-open: si manda comunque).
 */
async function giaMandata(settimana: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServizio()
      .from("newsletter_uscite")
      .insert({ settimana })
      .select("settimana");
    if (error) {
      // 23505 = quella settimana c'è già: il giro è stato fatto.
      if ((error as { code?: string }).code === "23505") return true;
      // Tabella mancante o altro: il guardiano si fa da parte, si manda lo stesso.
      console.warn("[newsletter] guardiano doppio invio non disponibile:", error.message);
      return false;
    }
    return !data || data.length === 0;
  } catch (e) {
    console.warn("[newsletter] guardiano doppio invio non disponibile:", e);
    return false;
  }
}

async function giroNewsletter({ budgetMs = 8000 } = {}) {
  if (!SERVIZIO_ATTIVO) return { ok: false as const, motivo: "SUPABASE_SECRET_KEY assente." };

  if (await modoSicuroAttivo()) {
    return { ok: true as const, modoSicuro: true as const, iscritti: 0, inviate: 0 };
  }

  // Prima si compone: se non c'è niente da dire, non si prenota la settimana
  // (così quando arrivano i dati la si può ancora mandare).
  const composto = await componiNewsletter();
  if (!composto) {
    return {
      ok: true as const,
      motivo: "Niente da dire questa settimana: né ritardi né scioperi in calendario.",
      inviate: 0,
    };
  }

  const settimana = settimanaCorrente();
  if (await giaMandata(settimana)) {
    return { ok: true as const, motivo: "Già mandata questa settimana.", settimana, inviate: 0 };
  }

  const iscritti = await iscrittiConfermati();
  if (iscritti.length === 0) {
    return { ok: true as const, motivo: "Nessun iscritto confermato.", settimana, iscritti: 0, inviate: 0 };
  }

  const inizio = Date.now();
  let inviate = 0;
  let fallite = 0;
  let saltatiPerTempo = 0;

  for (const email of iscritti) {
    if (Date.now() - inizio > budgetMs) {
      saltatiPerTempo = iscritti.length - inviate - fallite;
      break;
    }
    const disdetta = linkDisdetta(casa(), email);
    const html = vestito({
      titolo: "L'Osservatorio dei Disservizi",
      corpo: composto.corpo,
      coda: CODA,
      disdetta,
    });
    const testo = composto.testo + (disdetta ? `\n\nPer non ricevere più queste email: ${disdetta}` : "");
    const esito = await spedisci({ a: email, oggetto: composto.oggetto, html, testo });
    if (esito.ok) inviate++;
    else fallite++;
  }

  return { ok: true as const, settimana, iscritti: iscritti.length, inviate, fallite, saltatiPerTempo };
}

export async function POST(req: NextRequest) {
  if (!chiamataAutorizzata(req)) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }
  const esito = await giroNewsletter();
  return NextResponse.json(esito, { status: esito.ok ? 200 : 503 });
}
