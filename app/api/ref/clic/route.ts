import { NextResponse } from "next/server";
import { ipDi, oltreIlLimite } from "@/lib/api/limite";
import { codiceAffiliatoValido } from "@/lib/affiliati/codice";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * Conta l'apertura del link ?ref di un creator (la manda il beacon della
 * landing). Best-effort: se qualcosa non va, non è un guasto, è solo un
 * numero in meno. I clic sono informativi, i soldi stanno sulle commissioni.
 */
export async function POST(req: Request) {
  if (oltreIlLimite("ref-clic", ipDi(req), 20)) {
    return new NextResponse(null, { status: 429 });
  }
  const ref = new URL(req.url).searchParams.get("ref");
  const codice = codiceAffiliatoValido(ref);
  if (!codice || !SERVIZIO_ATTIVO) return new NextResponse(null, { status: 204 });
  try {
    // La funzione arriva con la migrazione del 26/08. Se non c'è, l'errore
    // resta nella risposta e lo ignoriamo: nessun clic contato, nessun danno.
    await supabaseServizio().rpc("segna_clic_affiliato", { p_codice: codice });
  } catch (e) {
    console.error("[ref-clic] rpc fallita:", e);
  }
  return new NextResponse(null, { status: 204 });
}
