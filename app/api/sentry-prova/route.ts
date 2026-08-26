import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * ROTTA DI PROVA, TEMPORANEA (audit 26/08). Serve a dimostrare, una volta,
 * che gli errori arrivano davvero nel cruscotto Sentry. Poi si toglie.
 *
 * ⚠️ Protetta dal segreto del motore: senza, risponde 401 e non fa niente.
 * Non è un buco: un estraneo non la può usare per spammare Sentry.
 */
export const dynamic = "force-dynamic";

const MARCATORE = "PROVA-SENTRY-26AGO";

export async function GET(req: NextRequest) {
  const segreto = new URL(req.url).searchParams.get("segreto");
  if (!process.env.MOTORE_SEGRETO || segreto !== process.env.MOTORE_SEGRETO) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }

  const id = Sentry.captureException(
    new Error(`${MARCATORE}: errore di prova per collaudare il collegamento a Sentry.`),
  );
  /* Su Netlify la funzione si congela alla risposta: si aspetta che l'evento
     parta davvero prima di rispondere. */
  await Sentry.flush(4000);

  return NextResponse.json({ ok: true, inviato: id, marcatore: MARCATORE });
}
