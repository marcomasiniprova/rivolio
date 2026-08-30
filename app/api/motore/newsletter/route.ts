import { NextResponse, type NextRequest } from "next/server";
import { chiamataAutorizzata } from "@/lib/motore/autorizza";
import { modoSicuroAttivo } from "@/lib/motore/modo-sicuro";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { componiNewsletter } from "@/lib/email/newsletter";
import { iscrittiConfermati } from "@/lib/iscritti/lista";
import { vestito } from "@/lib/email/modello";
import { casa, spedisciLotto } from "@/lib/email/posta";
import { linkDisdetta } from "@/lib/iscritti/gettone";

/**
 * LA NEWSLETTER SETTIMANALE DELL'OSSERVATORIO (28/08).
 *
 * La manda il cron del lunedì (netlify/functions/newsletter.mjs). Compone
 * l'email UNA volta (una chiamata all'AI), poi la spedisce a tutti gli
 * iscritti confermati, ognuno col suo link di disdetta.
 *
 * ⚠️ L'INVIO È A LOTTI (Resend batch, 100 per chiamata), non a una email per
 * volta. Prima un ciclo singolo mandava una email ogni ~mezzo secondo: dentro
 * il budget di 8 secondi non consegnava a migliaia di iscritti, e chi restava
 * fuori NON riceveva mai. A lotti una lista realistica finisce in un colpo.
 *
 * ⚠️ NON MANDA DUE VOLTE NELLA STESSA SETTIMANA, e adesso senza mentire. Prima
 * si "prenotava" la settimana PRIMA di spedire: se il budget interrompeva
 * l'invio, la settimana risultava mandata anche a chi non l'aveva ricevuta
 * (silent-miss, trovato il 30/08). Ora la settimana si CHIUDE (una riga in
 * `newsletter_uscite`) solo DOPO che sono arrivati TUTTI. Se il guardiano non
 * è disponibile (tabella assente) si manda lo stesso: è un extra, non un
 * cancello che blocca il prodotto.
 *
 * ⚠️ MODO SICURO: se l'interruttore d'emergenza è acceso, non parte niente.
 *
 * ⚠️ IL LIMITE CHE RESTA, dichiarato: una lista così grande da non entrare
 * nemmeno a lotti nel budget lascia la settimana APERTA e logga quanti non
 * sono stati raggiunti (mai un invio muto). Oltre quella scala serve un
 * avanzamento per-persona (una colonna): è in ARRETRATI, e non serve al
 * pre-lancio.
 */
export const dynamic = "force-dynamic";

const CODA =
  "Ricevi questa email perché hai confermato l'iscrizione all'Osservatorio dei Disservizi di Rivolio.";

/** Il massimo che Resend accetta in un lotto solo. */
const PER_LOTTO = 100;

/** Il lunedì della settimana in corso (UTC), "2026-08-31": chiude il doppio invio. */
function settimanaCorrente(): string {
  const ora = new Date();
  const g = ora.getUTCDay(); // 0=domenica .. 6=sabato
  const diff = g === 0 ? -6 : 1 - g;
  const lunedi = new Date(Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth(), ora.getUTCDate() + diff));
  return lunedi.toISOString().slice(0, 10);
}

/**
 * Vero se la newsletter di questa settimana è GIÀ stata chiusa (arrivata a
 * tutti). Solo lettura: non prenota niente. Se il guardiano non è disponibile
 * (tabella assente, database giù) torna false e si manda lo stesso (fail-open).
 */
async function settimanaChiusa(settimana: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServizio()
      .from("newsletter_uscite")
      .select("settimana")
      .eq("settimana", settimana)
      .maybeSingle();
    if (error) {
      console.warn("[newsletter] guardiano doppio invio non disponibile:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.warn("[newsletter] guardiano doppio invio non disponibile:", e);
    return false;
  }
}

/**
 * Chiude la settimana: la newsletter è arrivata a TUTTI, il giro non riparte.
 * Idempotente: se la riga c'è già (23505) va bene lo stesso.
 */
async function chiudiSettimana(settimana: string): Promise<void> {
  try {
    const { error } = await supabaseServizio().from("newsletter_uscite").insert({ settimana });
    if (error && (error as { code?: string }).code !== "23505") {
      console.warn("[newsletter] settimana non chiusa:", error.message);
    }
  } catch (e) {
    console.warn("[newsletter] settimana non chiusa:", e);
  }
}

async function giroNewsletter({ budgetMs = 8000 } = {}) {
  if (!SERVIZIO_ATTIVO) return { ok: false as const, motivo: "SUPABASE_SECRET_KEY assente." };

  if (await modoSicuroAttivo()) {
    return { ok: true as const, modoSicuro: true as const, iscritti: 0, inviate: 0 };
  }

  // Prima si compone: se non c'è niente da dire, non si chiude la settimana
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
  if (await settimanaChiusa(settimana)) {
    return { ok: true as const, motivo: "Già mandata questa settimana.", settimana, inviate: 0 };
  }

  const iscritti = await iscrittiConfermati();
  if (iscritti.length === 0) {
    return {
      ok: true as const,
      motivo: "Nessun iscritto confermato.",
      settimana,
      iscritti: 0,
      inviate: 0,
    };
  }

  // Ognuno riceve la STESSA email, ma col SUO link di disdetta.
  const messaggi = iscritti.map((email) => {
    const disdetta = linkDisdetta(casa(), email);
    return {
      a: email,
      oggetto: composto.oggetto,
      html: vestito({
        titolo: "L'Osservatorio dei Disservizi",
        corpo: composto.corpo,
        coda: CODA,
        disdetta,
      }),
      testo:
        composto.testo + (disdetta ? `\n\nPer non ricevere più queste email: ${disdetta}` : ""),
    };
  });

  const inizio = Date.now();
  let inviate = 0;
  let fallite = 0;
  let saltati = 0;

  for (let i = 0; i < messaggi.length; i += PER_LOTTO) {
    if (Date.now() - inizio > budgetMs) {
      saltati = messaggi.length - i;
      break;
    }
    const esito = await spedisciLotto(messaggi.slice(i, i + PER_LOTTO));
    inviate += esito.inviate;
    fallite += esito.fallite;
  }

  /* La settimana si CHIUDE solo se sono arrivati TUTTI. Se il budget ci ha
     interrotti resta aperta, e lo diciamo forte: mai un invio muto. */
  if (saltati === 0) {
    await chiudiSettimana(settimana);
  } else {
    console.warn(
      `[newsletter] budget finito: ${saltati} iscritti non raggiunti, settimana lasciata aperta`,
    );
  }

  return {
    ok: true as const,
    settimana,
    iscritti: iscritti.length,
    inviate,
    fallite,
    saltati,
    chiusa: saltati === 0,
  };
}

export async function POST(req: NextRequest) {
  if (!chiamataAutorizzata(req)) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }
  const esito = await giroNewsletter();
  return NextResponse.json(esito, { status: esito.ok ? 200 : 503 });
}
