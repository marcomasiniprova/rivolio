import { NextResponse, type NextRequest } from "next/server";
import { chiamataAutorizzata } from "@/lib/motore/autorizza";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * LA PULIZIA DEI DATI VECCHI (audit 14/08, scelta di Valerio: cancella oltre
 * i termini, ma TIENI le visite).
 *
 * La privacy dichiara: registro (`eventi`) 12 mesi, verifiche 24 mesi. Senza
 * un lavoro che li rispetta, le due tabelle crescono per sempre e sotto un
 * video virale diventano lente e care (è uno dei rischi dell'audit). Qui:
 * - il registro `eventi` oltre 12 mesi si CANCELLA (non c'è nome di persona,
 *   solo dominio e paese; è la fetta più voluminosa e la meno utile da vecchia);
 * - sulle `verifiche` oltre 24 mesi si toglie l'unico dato personale, l'email:
 *   la riga resta, anonima, e serve ancora per i conti e come prova.
 *
 * ⚠️ Sbaglia dalla parte della prudenza: se il database non risponde, non
 * cancella niente e lo dice. Gira una volta a settimana
 * (netlify/functions/pulizia.mjs). Con l'indice su `creato_il` (migrazione
 * 2026-08-14-scala.sql) la cancellazione per data è veloce.
 */
export const dynamic = "force-dynamic";

const GIORNO_MS = 86_400_000;
const giornoIso = (giorniFa: number) => new Date(Date.now() - giorniFa * GIORNO_MS).toISOString();

export async function POST(req: NextRequest) {
  if (!chiamataAutorizzata(req)) {
    return NextResponse.json({ errore: "non autorizzato" }, { status: 401 });
  }
  if (!SERVIZIO_ATTIVO) {
    return NextResponse.json({ errore: "servizio non attivo" }, { status: 500 });
  }

  const db = supabaseServizio();
  const dodiciMesiFa = giornoIso(365);
  const ventiquattroMesiFa = giornoIso(365 * 2);
  const risultato: Record<string, number | string> = {};

  // 1) Il registro oltre 12 mesi: via.
  try {
    const { count, error } = await db
      .from("eventi")
      .delete({ count: "exact" })
      .lt("creato_il", dodiciMesiFa);
    risultato.eventiCancellati = error ? `errore: ${error.message}` : (count ?? 0);
  } catch (e) {
    risultato.eventiCancellati = `errore: ${String(e)}`;
  }

  // 2) Le verifiche oltre 24 mesi: si toglie l'email, la riga resta anonima.
  try {
    const { count, error } = await db
      .from("verifiche")
      .update({ email: null }, { count: "exact" })
      .lt("creata_il", ventiquattroMesiFa)
      .not("email", "is", null);
    risultato.verificheAnonimizzate = error ? `errore: ${error.message}` : (count ?? 0);
  } catch (e) {
    risultato.verificheAnonimizzate = `errore: ${String(e)}`;
  }

  /* 3) Il registro anti-doppione dei webhook Stripe (audit 26/08). Serve
     solo a riconoscere un evento rimandato: Stripe ritenta un webhook per 3
     giorni, quindi una riga più vecchia di 7 giorni non protegge più niente
     e va tolta perché la tabella non cresca all'infinito. */
  try {
    const { count, error } = await db
      .from("webhook_eventi_stripe")
      .delete({ count: "exact" })
      .lt("ricevuto_il", giornoIso(7));
    if (error && /does not exist|schema cache/i.test(error.message)) {
      risultato.webhookEventiPuliti = "tabella assente";
    } else {
      risultato.webhookEventiPuliti = error ? `errore: ${error.message}` : (count ?? 0);
    }
  } catch (e) {
    risultato.webhookEventiPuliti = `errore: ${String(e)}`;
  }

  console.log("[pulizia]", risultato);
  return NextResponse.json({ ok: true, ...risultato });
}
