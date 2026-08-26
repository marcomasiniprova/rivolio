import { NextResponse } from "next/server";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * LA SALUTE DEL SITO, per la sonda di uptime esterna (audit 26/08).
 *
 * Una sonda esterna (UptimeRobot, BetterStack, gratis) chiama questo
 * indirizzo ogni pochi minuti: 200 = tutto risponde, 503 = il database è giù.
 * È il modo per sapere che il sito è in difficoltà dal MONITOR, non dal
 * cliente che stava pagando.
 *
 * ⚠️ Nessun dato sensibile: solo "sì/no" e cosa è stato controllato. Non
 * chiede l'admin di proposito: la sonda non ha una sessione.
 *
 * ⚠️ Il controllo del database è LEGGERO e con un tetto di tempo: un ping,
 * non una scansione. Se resta appeso, si conta come giù invece di far morire
 * la funzione.
 */
export const dynamic = "force-dynamic";

const TETTO_MS = 3000;

export async function GET() {
  const controlli: Record<string, "ok" | "giu" | "spento"> = {};

  if (!SERVIZIO_ATTIVO) {
    controlli.database = "spento";
  } else {
    try {
      const ping = supabaseServizio()
        .from("eventi")
        .select("creato_il", { head: true, count: "estimated" });
      const esito = (await Promise.race([
        ping,
        new Promise((_, rifiuta) => setTimeout(() => rifiuta(new Error("timeout")), TETTO_MS)),
      ])) as { error?: unknown };
      controlli.database = esito?.error ? "giu" : "ok";
    } catch {
      controlli.database = "giu";
    }
  }

  const sano = controlli.database !== "giu";
  return NextResponse.json(
    { ok: sano, controlli, quando: new Date().toISOString() },
    { status: sano ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
