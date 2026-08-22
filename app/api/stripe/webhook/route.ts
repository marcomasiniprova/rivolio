import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeAttivo } from "@/lib/stripe";
import { evadiPagamentoPratica } from "@/lib/pratiche/evasione";
import type { TipoPratica } from "@/lib/pratiche/pratiche";
import { registraCommissione } from "@/lib/affiliati/commissioni";

/**
 * Il webhook di Stripe: qui un pagamento diventa una pratica.
 *
 * pagamento → firma verificata → cancello anti-giallo → creaPratica →
 * stato `pagata` → email T+0 con link magico. Tutto il pezzo dopo la firma
 * vive in lib/pratiche/evasione.ts, identico per ogni venditore.
 *
 * ⚠️ LA FIRMA NON SI SALTA MAI IN PRODUZIONE. Un webhook di pagamento non
 * firmato è chiunque su internet che si inventa un ordine e apre una pratica
 * senza pagare. Il corpo va letto CRUDO (`req.text()`) prima di qualunque
 * parse: la firma è sui byte, non sul JSON.
 *
 * Risposte: 200 a tutto ciò che non ci riguarda o non può aggiustarsi da
 * solo (Stripe altrimenti riprova), 5xx solo quando un nuovo tentativo può
 * davvero riuscire (database giù per un attimo). Lo decide l'evasione.
 */
export const dynamic = "force-dynamic";

/* Carta e simili pagano subito: arriva "completed" già pagata. I metodi
   ritardati (bonifici SEPA, ecc.) confermano dopo con async_payment_succeeded. */
const EVENTI_BUONI = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

export async function POST(req: NextRequest) {
  if (!stripeAttivo()) {
    console.error("[stripe] webhook ricevuto ma STRIPE_SECRET_KEY assente.");
    return NextResponse.json({ errore: "Stripe non configurato." }, { status: 500 });
  }

  const corpo = await req.text();
  const firma = req.headers.get("stripe-signature");
  const segreto = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let evento: Stripe.Event;
  if (segreto && firma) {
    try {
      evento = await stripe().webhooks.constructEventAsync(corpo, firma, segreto);
    } catch (e) {
      console.error("[stripe] firma webhook non valida:", e instanceof Error ? e.message : e);
      return NextResponse.json({ errore: "Firma non valida." }, { status: 400 });
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      console.error("[stripe] STRIPE_WEBHOOK_SECRET assente: webhook RESPINTO.");
      return NextResponse.json({ errore: "Segreto webhook assente." }, { status: 400 });
    }
    // Solo in sviluppo si passa senza firma, per provare in locale.
    console.warn("[stripe] STRIPE_WEBHOOK_SECRET assente: firma NON verificata (solo sviluppo).");
    try {
      evento = JSON.parse(corpo) as Stripe.Event;
    } catch {
      return NextResponse.json({ errore: "Corpo non è JSON." }, { status: 400 });
    }
  }

  if (!EVENTI_BUONI.includes(evento.type)) {
    return NextResponse.json({ ok: true, ignorato: evento.type });
  }

  const sessione = evento.data.object as Stripe.Checkout.Session;
  /* Su "completed" con un metodo ritardato lo stato può essere "unpaid":
     lì NON è ancora un incasso, si aspetta l'evento del pagamento vero. */
  if (sessione.payment_status !== "paid") {
    return NextResponse.json({ ok: true, nota: `Non ancora pagato (${sessione.payment_status}).` });
  }

  const meta = sessione.metadata ?? {};
  const verificaId =
    (typeof meta.verifica_id === "string" && meta.verifica_id) || sessione.client_reference_id || null;
  const email = sessione.customer_details?.email ?? sessione.customer_email ?? null;
  const tipo: TipoPratica = meta.tipo === "famiglia" ? "famiglia" : "singola";
  const prezzo = typeof sessione.amount_total === "number" ? Math.round(sessione.amount_total) / 100 : null;
  const ref = typeof meta.ref === "string" ? meta.ref : null;

  /* IL CHECK: qui si segna solo la commissione del creator. La ricevuta (il
     pass) la mette /api/check/pronto, l'unica che può scrivere il cookie sul
     browser di chi torna dalla cassa. Nessuna pratica da creare. */
  if (meta.prodotto === "check") {
    if (ref) {
      await registraCommissione({
        codice: ref,
        tipo: "check",
        prezzoPagato: prezzo ?? 0,
        riferimento: sessione.id,
      });
    }
    return NextResponse.json({ ok: true, prodotto: "check" });
  }

  const esito = await evadiPagamentoPratica(req, {
    verificaId,
    email,
    prezzo,
    tipo,
    ordineId: sessione.id,
    venditore: "Stripe",
    ref,
  });
  return NextResponse.json(esito.body, { status: esito.http });
}
