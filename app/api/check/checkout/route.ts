import { NextResponse, type NextRequest } from "next/server";
import { casa } from "@/lib/sito";
import { CHECK_A_PAGAMENTO, prezzoCheck } from "@/lib/check/ingresso";
import { passUsabile } from "@/lib/check/cancello";
import { conteggioCheck } from "@/lib/check/conteggio";
import { creaSessioneCheckout, stripeAttivo } from "@/lib/stripe";
import { affiliatoDaCodice } from "@/lib/affiliati/affiliati";
import { COOKIE_REF } from "@/lib/affiliati/codice";
import { ipDi, oltreIlLimiteCondiviso } from "@/lib/api/limite";

/**
 * GET /api/check/checkout?origine=/  → la cassa VERA del check (Stripe).
 *
 * Il muro manda qui. Si apre una sessione di pagamento da 1,99 (o dal
 * prezzo vero se i posti di lancio sono finiti) e si va a Stripe. Al ritorno
 * la ricevuta la mette /api/check/pronto.
 *
 * Cancelli, in ordine, e sbagliano SEMPRE dalla parte di chi non paga:
 * - check gratis (interruttore spento) → a casa, non c'è niente da pagare;
 * - ha già una ricevuta buona → a casa, non si paga due volte;
 * - troppe sessioni di fila dallo stesso IP → a casa (freno anti-abuso);
 * - Stripe non c'è → la cassa di prova finché esiste, se no i prezzi.
 *
 * ⚠️ Lo sconto del creator NON si applica sul check (scelta di Valerio: su
 * 1,99 sono venti centesimi, non spostano niente). La COMMISSIONE al creator
 * invece sì: il codice entra nei metadata e il webhook la segna.
 */
export const dynamic = "force-dynamic";

const ORIGINI_OK = new Set(["/", "/app"]);
const origineDa = (v: string | null): string => (v && ORIGINI_OK.has(v) ? v : "/");

export async function GET(req: NextRequest) {
  const aCasa = (coda = "") => NextResponse.redirect(`${casa()}/${coda}`);

  if (!CHECK_A_PAGAMENTO) return aCasa();
  if (await passUsabile(req)) return aCasa();
  if (await oltreIlLimiteCondiviso("check-checkout", ipDi(req), 6)) return aCasa();

  const origine = origineDa(new URL(req.url).searchParams.get("origine"));

  if (stripeAttivo()) {
    const { pagati } = await conteggioCheck();
    const prezzo = prezzoCheck(pagati).prezzo;
    const affiliato = await affiliatoDaCodice(req.cookies.get(COOKIE_REF)?.value);
    const metadata: Record<string, string> = { prodotto: "check", origine };
    if (affiliato) metadata.ref = affiliato.codice;

    const url = await creaSessioneCheckout({
      euro: prezzo,
      nomeProdotto: "Rivolio · Analisi del volo",
      descrizione: "Il verdetto sul tuo volo secondo il Regolamento CE 261/2004.",
      metadata,
      successUrl: `${casa()}/api/check/pronto?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${casa()}${origine}`,
    });
    if (!url) return aCasa();
    return NextResponse.redirect(url, 303);
  }

  /* Stripe è l'unica cassa: se la chiave manca (misconfig su Netlify) si
     torna ai prezzi, senza vicoli ciechi e senza casse finte. */
  return aCasa("#prezzi");
}
