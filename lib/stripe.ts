import Stripe from "stripe";
import { tinGuasto } from "@/lib/eventi/telegram";

/**
 * Stripe, il gateway di pagamento vero: la cassa di Rivolio.
 *
 * Si incassa a nome del titolare dell'account. Con Managed Payments Stripe
 * fa da merchant of record e versa l'IVA al posto nostro, che è la ragione
 * per cui funziona senza partita IVA (vedi sotto).
 *
 * Un file solo per due motivi:
 * 1. il client si costruisce una volta e si riusa (aprire una connessione
 *    nuova a ogni richiesta è spreco);
 * 2. TEST o LIVE non è una nostra variabile: lo decide la chiave. Una
 *    chiave `sk_test_...` parla col mondo di prova, una `sk_live_...` col
 *    mondo vero. Il codice è identico, cambia solo cosa metti su Netlify.
 *    Così si collauda in test e poi si accende il live senza toccare niente.
 *
 * ⚠️ LA CHIAVE SEGRETA NON STA MAI NEL REPO. Vive solo in
 * `STRIPE_SECRET_KEY` su Netlify. Qui si legge, non si scrive.
 */

/* Il client vive quanto la chiave: se la chiave cambia (test → live) se ne
   fa uno nuovo, invece di restare incollati a quella di prima. */
let cache: { chiave: string; client: Stripe } | null = null;

function chiaveSegreta(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

/** C'è una chiave Stripe valida? Se no, chi chiama ripiega, non esplode. */
export function stripeAttivo(): boolean {
  return chiaveSegreta().startsWith("sk_");
}

/** In che mondo stiamo pagando. Serve al pannello per dirlo senza dubbi. */
export function modalitaStripe(): "test" | "live" | "assente" {
  const k = chiaveSegreta();
  if (k.startsWith("sk_live_")) return "live";
  if (k.startsWith("sk_test_")) return "test";
  return "assente";
}

/**
 * Managed Payments (Stripe come merchant of record) sulla cassa: versa lui
 * l'IVA in 80+ paesi, ed è la ragione per cui si incassa senza partita IVA.
 * Acceso di default. `MANAGED_PAYMENTS_ATTIVO=0` su Netlify lo spegne e la
 * cassa torna allo Stripe standard, senza toccare il codice: è la rete di
 * sicurezza per il giorno del live.
 */
export function managedPaymentsAttivo(): boolean {
  return process.env.MANAGED_PAYMENTS_ATTIVO !== "0";
}

/**
 * Il client Stripe. Lancia se la chiave manca: chi chiama deve prima
 * chiedere `stripeAttivo()` e, se è spento, mostrare la strada di riserva.
 */
export function stripe(): Stripe {
  const chiave = chiaveSegreta();
  if (!chiave.startsWith("sk_")) {
    throw new Error("STRIPE_SECRET_KEY assente o non valida.");
  }
  if (cache?.chiave === chiave) return cache.client;
  const client = new Stripe(chiave, {
    /* La versione dell'API la pinna il pacchetto: così un aggiornamento
       del SDK non cambia il comportamento sotto i piedi. */
    appInfo: { name: "Rivolio", url: "https://rivolio.it" },
  });
  cache = { chiave, client };
  return client;
}

/** Gli euro in centesimi interi, come li vuole Stripe (16,90 → 1690). */
export function inCentesimi(euro: number): number {
  return Math.round(euro * 100);
}

/**
 * Apre una sessione di pagamento e torna l'indirizzo dove mandare la
 * persona (o `null` se qualcosa va storto: chi chiama ripiega, non manda
 * nessuno nel vuoto).
 *
 * Il prezzo lo scriviamo qui (`price_data`), quindi NON serve creare i
 * prodotti a mano nel pannello: il giorno di un cambio prezzo si cambia una
 * riga di codice, non una scheda in un sito esterno.
 *
 * `metadata` è il filo che il webhook riavvolge dopo il pagamento: ci
 * mettiamo l'id della verifica e il tipo, così sappiamo PER COSA è arrivato
 * l'incasso.
 */
export async function creaSessioneCheckout(opts: {
  euro: number;
  nomeProdotto: string;
  descrizione?: string;
  email?: string | null;
  /** Il nostro id (verifica) anche fuori dal metadata: comodo nei report. */
  riferimento?: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  try {
    const parametri: Stripe.Checkout.SessionCreateParams & {
      managed_payments?: { enabled: boolean };
    } = {
      mode: "payment",
      locale: "it",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: inCentesimi(opts.euro),
            /* L'IVA sta DENTRO il prezzo, non sopra (Valerio, 23/08: il check
               usciva 2,43 invece di 1,99). Senza questa riga Managed Payments
               tratta il prezzo come IVA esclusa e la aggiunge sopra. Con
               "inclusive" il numero e' quello FINALE che paga il cliente, e
               Stripe ci tira fuori l'IVA da dentro: e' anche l'unico modo lecito
               per il B2C in Italia. */
            tax_behavior: "inclusive",
            product_data: {
              name: opts.nomeProdotto,
              ...(opts.descrizione ? { description: opts.descrizione } : {}),
              /* MANAGED PAYMENTS: Stripe fa da merchant of record e gestisce
                 l'IVA in 80+ paesi al posto nostro (è la ragione per cui non
                 serve la partita IVA per l'IVA, il ruolo che ci mancava e che era stato
                 il nodo di tutto). ⚠️ MP NON è automatico: va abilitato nel pannello
                 Stripe (Impostazioni, Managed Payments), se ne accettano i termini e
                 passa una revisione di idoneità (in beta, lancio graduale). Quando è
                 attivo ESIGE un tax code eleggibile su ogni prodotto, se no la cassa non
                 si apre; finché non lo è si incassa con lo Stripe standard (venditore
                 sei tu, e l'IVA la gestisci tu).
                 Rivolio consegna un documento/informazione via internet a un
                 consumatore: "Electronically Delivered Information Services,
                 personal use". ⚠️ Il codice esatto va confermato dal
                 commercialista: cambia solo l'aliquota IVA, non il
                 funzionamento. */
              tax_code: "txcd_10701411",
            },
          },
        },
      ],
      ...(opts.email ? { customer_email: opts.email } : {}),
      ...(opts.riferimento ? { client_reference_id: opts.riferimento } : {}),
      metadata: opts.metadata,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    };
    /* MANAGED PAYMENTS: con questo Stripe fa da merchant of record su questa
       cassa (versa lui l'IVA), ed è la ragione per cui si incassa senza
       partita IVA. Acceso di default; MANAGED_PAYMENTS_ATTIVO=0 lo spegne e la
       cassa torna allo Stripe standard. La versione API richiesta da Stripe
       (2025-03-31.basil o successiva) è già coperta dal pacchetto stripe 22.5. */
    if (managedPaymentsAttivo()) parametri.managed_payments = { enabled: true };
    const sessione = await stripe().checkout.sessions.create(parametri);
    return sessione.url;
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error("[stripe] sessione di checkout non creata:", motivo);
    /* Una cassa che non si apre è vendita persa: deve squillare il telefono
       col motivo VERO (chiave sbagliata, parametro rifiutato...), non finire
       in un log che nessuno guarda. Il silenziatore evita mille messaggi. */
    await tinGuasto("stripe-sessione", `Stripe non ha aperto la cassa.\nMotivo: ${motivo}`);
    return null;
  }
}
