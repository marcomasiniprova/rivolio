import { NextResponse } from "next/server";
import { FIRMA_RINUNCIA } from "@/lib/pratiche/recesso";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * POST /api/pratiche/recesso  { verifica: "<uuid>" }
 *
 * Registra la spunta di rinuncia al recesso (art. 59 Cod. Consumo) sulla
 * verifica, PRIMA del rimando alla cassa: momento esatto e testo versionato.
 * La rotta di checkout non lascia passare nessuno senza questa firma.
 *
 * Prima spunta vinta: se un timestamp c'è già non si sovrascrive (il
 * consenso che fa fede è il primo). Si firma solo un esito "idoneo":
 * sugli altri non c'è niente da comprare.
 */

const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let corpo: { verifica?: unknown };
  try {
    corpo = (await req.json()) as { verifica?: unknown };
  } catch {
    return NextResponse.json({ ok: false, errore: "Corpo non leggibile." }, { status: 400 });
  }

  const id = typeof corpo.verifica === "string" ? corpo.verifica : "";
  if (!UUID_OK.test(id)) {
    return NextResponse.json({ ok: false, errore: "Verifica non valida." }, { status: 400 });
  }
  if (!SERVIZIO_ATTIVO) {
    return NextResponse.json({ ok: false, errore: "Servizio non configurato." }, { status: 503 });
  }

  try {
    const db = supabaseServizio();
    const { error } = await db
      .from("verifiche")
      .update({
        rinuncia_recesso_il: new Date().toISOString(),
        rinuncia_recesso_testo: FIRMA_RINUNCIA,
      })
      .eq("id", id)
      .eq("esito", "idoneo")
      /* ⚠️ Il `.is(null)` non e' un dettaglio: e' quello che rende
         questa firma IRRIPETIBILE. Una rinuncia al recesso e' il
         documento che dimostra il consenso dell'utente (art. 59 Cod.
         Consumo); se si potesse riscrivere, la data della firma
         diventerebbe l'ultima volta che qualcuno ha premuto il bottone
         invece del momento in cui la persona ha davvero acconsentito, e
         in una contestazione varrebbe zero. */
      .is("rinuncia_recesso_il", null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[recesso] consenso non registrato:", e);
    return NextResponse.json(
      { ok: false, errore: "Registrazione fallita, riprova." },
      { status: 500 },
    );
  }
}
