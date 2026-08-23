import { NextResponse, type NextRequest } from "next/server";
import { casa, versoCasa } from "@/lib/sito";
import { passDi } from "@/lib/check/cancello";
import { CHECK_A_PAGAMENTO, prezzoPagatoPerIlCheck } from "@/lib/check/ingresso";
import { COOKIE_PREZZO, TEST_DUE_PREZZI, listinoDi, varianteValida } from "@/lib/prezzi";
import { creaSessioneCheckout, stripeAttivo } from "@/lib/stripe";
import { affiliatoDaCodice } from "@/lib/affiliati/affiliati";
import { COOKIE_REF } from "@/lib/affiliati/codice";
import { utenteCreatore } from "@/lib/affiliati/creatore";
import { listinoScontato } from "@/lib/pratiche/prezzo";
import { creaPratica, registraEvento, transizionePratica } from "@/lib/pratiche/pratiche";
import { traccia } from "@/lib/eventi/registra";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * GET /api/pratiche/checkout?verifica=<id>&tipo=singola|famiglia
 *
 * Il ponte fra il bottone d'acquisto e Stripe. Il client naviga qui e la
 * rotta apre una sessione di pagamento Stripe (prezzo scritto da noi in
 * linea), con l'id della verifica agganciato e l'email precompilata se c'è,
 * poi rimanda a checkout.stripe.com.
 *
 * Cancelli, in ordine:
 * - id "demo-..." → si torna alla pagina con l'avviso onesto: sugli
 *   esempi dimostrativi non si vende niente (regola 3 del progetto);
 * - id che non è un UUID → home, non c'è una pagina a cui tornare;
 * - esito diverso da "idoneo" o verdetto corretto a mano →
 *   si torna alla pagina, che spiega da sola. MAI vendere sul giallo
 *   (SPEC §4): il cancello sta anche qui, non solo nel webhook;
 * - account creator → la pratica nasce gratis, senza cassa;
 * - chiave Stripe assente → avviso "non-attivo".
 *
 * L'email della verifica si legge SOLO qui, lato server, per
 * precompilare il checkout: al client non arriva mai.
 */

const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_OK = /^demo-[a-z0-9]{2,8}-[0-9]{4}-[0-9]{2}-[0-9]{2}$/i;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("verifica") ?? "";
  const tipo = url.searchParams.get("tipo") === "famiglia" ? "famiglia" : "singola";

  // L'id entra in un Location header: si costruisce l'URL SOLO dopo che
  // il formato è riconosciuto (UUID o demo), mai da testo libero.
  const paginaRisultato = (coda?: "demo" | "non-attivo" | "errore" | "recesso") =>
    NextResponse.redirect(
      versoCasa(`/verifica/${id}${coda ? `?checkout=${coda}` : ""}`, req),
    );

  if (DEMO_OK.test(id)) return paginaRisultato("demo");
  if (!UUID_OK.test(id)) return NextResponse.redirect(versoCasa("/", req));

  if (!SERVIZIO_ATTIVO) return paginaRisultato("non-attivo");

  try {
    const db = supabaseServizio();
    const { data: verifica, error } = await db
      .from("verifiche")
      .select("id, esito, conferma, email, rinuncia_recesso_il")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        esito: string;
        conferma: string;
        email: string | null;
        rinuncia_recesso_il: string | null;
      }>();
    if (error) throw new Error(error.message);

    // Verifica inesistente: la pagina del risultato sa dirlo meglio di noi.
    if (!verifica) return paginaRisultato();

    /* Si vende solo un idoneo.
       🔴 QUI C'ERA ANCHE `conferma === "in_attesa"`, ED È IL DIFETTO CHE
       HA ROTTO IL COLLAUDO DI VALERIO. In produzione lo shadow mode è
       acceso da solo, quindi OGNI verdetto nasce "in attesa": il bottone
       non compariva e la cassa non si apriva finché una persona non
       confermava a mano dal pannello. Lui ha dovuto farlo davvero per
       andare avanti; un cliente vero non può, e se ne va senza sapere
       perché.
       Il controllo umano non sparisce, si sposta DOPO la vendita
       (decisione di Valerio, 12/08). A fermare la cassa resta un caso
       solo, ed è quello giusto: un verdetto che una persona ha guardato
       e **corretto**, cioè dichiarato sbagliato. Su quello non si vende
       niente, mai. */
    if (verifica.esito !== "idoneo" || verifica.conferma === "corretta") {
      return paginaRisultato();
    }

    /* CREATOR GRATIS A VITA: se chi apre la pratica è un account creator, la
       pratica nasce gratis (prezzo 0) sotto il SUO account, senza cassa. Il
       flag è server-side (utenteCreatore legge la sessione, mai una parola
       del browser). Sta PRIMA del recesso: una pratica gratis non è un
       acquisto, e il recesso dei 14 giorni è una tutela sugli acquisti. */
    const creatore = await utenteCreatore(req);
    if (creatore) {
      const creata = await creaPratica({
        verificaId: verifica.id,
        email: creatore.email,
        tipo,
        passeggeri: [],
      });
      if (!creata.ok) return paginaRisultato("errore");
      // Già aperta (doppio clic, corsa dei webhook): si va a quella, non se ne fa un'altra.
      if (!creata.giaEsisteva) {
        await transizionePratica(creata.pratica.id, "pagata", "Pratica gratuita: account creator.", {
          prezzo_pagato: 0,
        });
        await registraEvento(
          creata.pratica.id,
          "creator_gratis",
          "Aperta gratis da un account creator.",
        );
      }
      traccia(req, { tipo: "pratica", extra: { tipo, creator: true } });
      return NextResponse.redirect(versoCasa(`/pratica/${creata.pratica.id}`, req));
    }

    /* #21: senza la spunta di rinuncia al recesso (art. 59 Cod. Consumo),
       registrata da /api/pratiche/recesso, non si va alla cassa. Vale anche
       per chi arriva con l'URL diretto: il cancello sta sul server. */
    if (!verifica.rinuncia_recesso_il) return paginaRisultato("recesso");

    /* Il prezzo che questa persona ha visto da quando è arrivata: il
       cookie lo scrive il proxy alla prima visita. Se manca (o è sporco)
       si serve il listino di sempre.
       ⚠️ COL TEST SPENTO IL COOKIE SI IGNORA, e non è pignoleria: quel
       cookie dura sei mesi, quindi chi l'ha preso quando il test era
       acceso leggerebbe 14,90 sulla landing e si troverebbe 24,90 alla
       cassa. Un prezzo che cambia fra il bottone e il pagamento non è un
       dettaglio: è il motivo per cui uno chiude la pagina. */
    const variante =
      (TEST_DUE_PREZZI ? varianteValida(req.cookies.get(COOKIE_PREZZO)?.value) : null) ?? "a";

    /* LA CASSA È STRIPE, e basta. Il prezzo lo scriviamo noi (price_data in
       linea), quindi non ci sono prodotti da creare a mano nel pannello.
       Se la chiave Stripe manca (una misconfig su Netlify), non si vende:
       meglio un onesto "non attivo" che un vicolo cieco o una cassa finta. */
    if (!stripeAttivo()) return paginaRisultato("non-attivo");

    /* I due sconti, calcolati come sulla pagina del risultato (stessa
       funzione, stessi ingredienti: il prezzo del bottone e quello della
       cassa non possono divergere). Lo sconto del creator se è arrivata da
       un suo link; l'anticipo del check se ha già pagato l'analisi. */
    const affiliato = await affiliatoDaCodice(req.cookies.get(COOKIE_REF)?.value);
    const scalaCheck = CHECK_A_PAGAMENTO && passDi(req) ? prezzoPagatoPerIlCheck() : 0;
    const listino = listinoScontato(listinoDi(variante), { affiliato, scalaCheck });
    const prezzo = tipo === "famiglia" ? listino.famiglia : listino.singola;

    const metadata: Record<string, string> = {
      prodotto: "pratica",
      verifica_id: verifica.id,
      tipo,
      variante,
    };
    // Il filo che lega la vendita al creator: il webhook lo riavvolge per
    // segnare la commissione.
    if (affiliato) metadata.ref = affiliato.codice;

    const url = await creaSessioneCheckout({
      euro: prezzo,
      nomeProdotto: tipo === "famiglia" ? "Rivolio · Pratica famiglia" : "Rivolio · Pratica",
      descrizione: "Reclamo CE 261/2004 pronto da inviare, seguito fino all'esito.",
      email: verifica.email,
      riferimento: verifica.id,
      metadata,
      /* Stripe rimpiazza {CHECKOUT_SESSION_ID} con l'id vero: la pagina di
         arrivo lo usa per confermare che il pagamento è andato a buon fine. */
      successUrl: `${casa()}/pratica/pronta?session_id={CHECKOUT_SESSION_ID}`,
      /* Se annulla torna al risultato, col bottone ancora lì. */
      cancelUrl: `${casa()}/verifica/${verifica.id}`,
    });
    if (!url) return paginaRisultato("errore");
    /* «Ha aperto la pratica»: da qui in poi la persona è alla cassa. La
       distanza fra questo numero e quello dei pagamenti è la cosa più
       importante del cruscotto, perché è l'unico punto dove si perde
       gente che aveva già deciso di pagare. */
    traccia(req, {
      tipo: "pratica",
      extra: { tipo, variante, venditore: "stripe", ref: affiliato?.codice ?? null },
    });
    return NextResponse.redirect(url, 303);
  } catch (e) {
    console.error("[checkout] apertura sessione Stripe fallita:", e);
    return paginaRisultato("errore");
  }
}
