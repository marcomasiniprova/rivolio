import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { oltreIlLimite, ipDi } from "@/lib/api/limite";

/**
 * ROTTA DI PROVA, TEMPORANEA (audit 26/08). Serve a dimostrare, una volta,
 * che gli errori arrivano davvero nel cruscotto Sentry. Poi si toglie subito.
 *
 * ⚠️ Protetta da un gettone fisso (non un segreto vero: la rotta vive pochi
 * minuti) e da un freno per IP, così nel breve tempo in cui esiste non la si
 * può usare per spammare Sentry e bruciare la quota gratuita.
 */
export const dynamic = "force-dynamic";

const GETTONE = "collaudo-sentry-8f3a1c-26ago";
const MARCATORE = "PROVA-SENTRY-26AGO";

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get("t") !== GETTONE) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }
  if (oltreIlLimite("sentry-prova", ipDi(req), 5)) {
    return NextResponse.json({ errore: "Troppe richieste." }, { status: 429 });
  }

  const id = Sentry.captureException(
    new Error(`${MARCATORE}: errore di prova per collaudare il collegamento a Sentry.`),
  );
  /* Su Netlify la funzione si congela alla risposta: si aspetta che l'evento
     parta davvero prima di rispondere. */
  await Sentry.flush(4000);

  return NextResponse.json({ ok: true, inviato: id, marcatore: MARCATORE });
}
