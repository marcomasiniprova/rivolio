import { NextResponse, type NextRequest } from "next/server";
import { casa, versoCasa } from "@/lib/sito";
import { inCollaudo, passDi } from "@/lib/check/cancello";
import { CHECK_A_PAGAMENTO, prezzoPagatoPerIlCheck } from "@/lib/check/ingresso";
import { linkCheckout } from "@/lib/polar";
import { COOKIE_PREZZO, TEST_DUE_PREZZI, listinoDi, varianteValida } from "@/lib/prezzi";
import { creaSessioneCheckout, stripeAttivo } from "@/lib/stripe";
import { affiliatoDaCodice } from "@/lib/affiliati/affiliati";
import { COOKIE_REF } from "@/lib/affiliati/codice";
import { listinoScontato } from "@/lib/pratiche/prezzo";
import { traccia } from "@/lib/eventi/registra";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * GET /api/pratiche/checkout?verifica=<id>&tipo=singola|famiglia
 *
 * Il ponte fra il bottone d'acquisto e Polar. Esiste perché i checkout
 * link vivono negli env del server (lib/polar.ts): il client naviga qui
 * e questa rotta risponde con un redirect al link giusto, con l'id della
 * verifica agganciato come `reference_id` e l'email precompilata se c'è.
 *
 * Cancelli, in ordine:
 * - id "demo-..." → si torna alla pagina con l'avviso onesto: sugli
 *   esempi dimostrativi non si vende niente (regola 3 del progetto);
 * - id che non è un UUID → home, non c'è una pagina a cui tornare;
 * - esito diverso da "idoneo" o verdetto in shadow (`in_attesa`) →
 *   si torna alla pagina, che spiega da sola. MAI vendere sul giallo
 *   (SPEC §4): il cancello sta anche qui, non solo nel webhook;
 * - link Polar non configurato → avviso "non-attivo".
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

    /* #21: senza la spunta di rinuncia al recesso (art. 59 Cod. Consumo),
       registrata da /api/pratiche/recesso, non si va a Polar. Vale anche
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

    /* LA CASSA VERA: Stripe. Se la chiave c'è, si apre una sessione di
       pagamento e si va lì. Prende il posto di Polar (che ci ha detto no) e
       della cassa di prova. Il prezzo lo scriviamo noi, quindi non ci sono
       prodotti da creare a mano nel pannello. */
    if (stripeAttivo()) {
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
      traccia(req, {
        tipo: "pratica",
        extra: { tipo, variante, venditore: "stripe", ref: affiliato?.codice ?? null },
      });
      return NextResponse.redirect(url, 303);
    }

    /* Ripiego finché la chiave Stripe non è su Netlify: il vecchio Polar,
       o la cassa di prova per il collaudatore. */
    const link = linkCheckout(tipo, verifica.id, verifica.email, variante);
    /* ⚠️ SENZA VENDITORE, IL COLLAUDATORE PASSA DALLA CASSA DI PROVA.
       Finche' non c'e' Polar (o chi per lui) questo bottone finisce in un
       vicolo cieco, e tutto quello che viene DOPO il pagamento (i quattro
       fogli, il no della compagnia, la replica, la conciliazione) non lo
       puo' vedere nessuno: e' meta' del prodotto che vale i soldi.
       Solo per il browser che porta la chiave del collaudatore, e solo
       sui voli dimostrativi: il controllo vero sta dentro la rotta. */
    if (!link) {
      if (inCollaudo(req)) {
        /* 🔴 QUI SI SALTAVA LA CASSA, e Valerio l'ha chiesto esplicito il
           12/08: «anche quando paga i 14,90, SEMPRE checkout finto, il
           muro c'è sempre anche se finto». Prima questo rimando apriva la
           pratica da solo, quindi il passaggio che nel prodotto vero
           decide se incassi o no non lo vedeva nessuno: un percorso
           provato saltando il pezzo dei soldi non è provato.
           Adesso si passa dalla cassa, che poi chiama la stessa rotta. */
        return NextResponse.redirect(
          versoCasa(`/cassa-prova?pratica=${verifica.id}&tipo=${tipo}`, req),
        );
      }
      return paginaRisultato("non-attivo");
    }

    /* «Ha aperto la pratica»: da qui in poi la persona è alla cassa. La
       distanza fra questo numero e quello dei pagamenti è la cosa più
       importante del cruscotto, perché è l'unico punto dove si perde
       gente che aveva già deciso di pagare. */
    traccia(req, { tipo: "pratica", extra: { tipo, variante } });

    return NextResponse.redirect(link);
  } catch (e) {
    console.error("[checkout] redirect verso Polar fallito:", e);
    return paginaRisultato("errore");
  }
}
