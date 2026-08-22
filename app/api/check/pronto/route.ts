import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { casa } from "@/lib/sito";
import { stripe, stripeAttivo } from "@/lib/stripe";
import { CHECK_PER_PAGAMENTO } from "@/lib/check/ingresso";
import { COOKIE_PASS, creaPass } from "@/lib/check/pass";
import { traccia } from "@/lib/eventi/registra";

/**
 * DOVE ATTERRA CHI HA PAGATO IL CHECK (success_url della sessione Stripe).
 *
 * Qui si emette la ricevuta (il pass firmato) e la si mette nel cookie, poi
 * si torna al check con l'ordine di ripartire: l'analisi riparte da sola sul
 * volo che la persona aveva scritto (lib/check/ripresa.ts).
 *
 * ⚠️ È UNA ROTTA, non una pagina, perché SOLO una rotta può scrivere il
 * cookie httpOnly della ricevuta. E la ricevuta si emette solo dopo aver
 * riletto la sessione da Stripe e averla trovata PAGATA: l'id della sessione
 * sta nell'indirizzo e ce l'ha solo chi è appena tornato dalla cassa.
 *
 * L'ordine della ricevuta è l'id della sessione: il registro nel database
 * conta le analisi per ordine, quindi riaprire questo indirizzo dieci volte
 * non regala dieci check. Il tetto vero è lì, non nel cookie.
 */
export const dynamic = "force-dynamic";

const BISCOTTO = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

const ORIGINI_OK = new Set(["/", "/app"]);

export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  const aCasa = NextResponse.redirect(`${casa()}/`);
  if (!sessionId || !stripeAttivo()) return aCasa;

  let sess: Stripe.Checkout.Session | null = null;
  try {
    sess = await stripe().checkout.sessions.retrieve(sessionId);
  } catch (e) {
    console.error("[check/pronto] sessione non recuperata:", e);
  }
  if (!sess || sess.payment_status !== "paid" || sess.metadata?.prodotto !== "check") {
    return aCasa;
  }

  const pass = creaPass(sessionId, CHECK_PER_PAGAMENTO);
  if (!pass) return aCasa; // server non configurato per firmare

  const grezza = sess.metadata?.origine ?? "/";
  const origine = ORIGINI_OK.has(grezza) ? grezza : "/";

  traccia(req, { tipo: "sbloccato", extra: { ordine: sessionId } });
  const risposta = NextResponse.redirect(`${casa()}${origine}?ripresa=1#controllo`);
  risposta.cookies.set(COOKIE_PASS, pass, BISCOTTO);
  return risposta;
}
