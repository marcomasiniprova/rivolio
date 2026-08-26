import { NextResponse } from "next/server";
import { CORS } from "@/lib/api/limite";
import { colonnaMancante } from "@/lib/supabase/colonne";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { conteggioCheck } from "./conteggio";
import { CHECK_A_PAGAMENTO, postiRimasti, prezzoCheck } from "./ingresso";
import { stripeAttivo } from "@/lib/stripe";
import { COOKIE_PASS, leggiPass, type Pass } from "./pass";

/**
 * IL CANCELLO, in un posto solo.
 *
 * Prima la regola viveva dentro `/api/verifica` e basta. Ma il verdetto
 * non esce solo da lì: `/api/verifica/cancellato`, `/dichiara` e
 * `/operativo` chiamano `verificaVolo()` per conto loro, e la ricerca
 * per tratta mostra l'orario di atterraggio vero, cioè esattamente la
 * cosa che stiamo vendendo. Con il muro su una porta sola bastava
 * conoscere l'indirizzo di un'altra per non pagare mai (verificato
 * l'11/08 leggendo le rotte). Una regola scritta in quattro punti
 * diversi diventa quattro regole diverse al primo cambio: qui è una.
 */

/** Un cookie preso dall'intestazione grezza: la richiesta arriva anche dall'app. */
export function cookieDi(req: Request, nome: string): string | null {
  const testa = req.headers.get("cookie");
  if (!testa) return null;
  for (const pezzo of testa.split(";")) {
    const [k, ...resto] = pezzo.trim().split("=");
    if (k === nome) return decodeURIComponent(resto.join("="));
  }
  return null;
}

/** La ricevuta di chi ha pagato. null col muro spento: non serve a niente. */
export function passDi(req: Request): Pass | null {
  if (!CHECK_A_PAGAMENTO) return null;
  return leggiPass(cookieDi(req, COOKIE_PASS));
}

/**
 * LA RICEVUTA, CONTROLLATA SUL REGISTRO E NON SUL COOKIE.
 *
 * 🔴 IL COOKIE SI COPIA. `passDi` guarda solo che la ricevuta sia firmata
 * e non scaduta: il credito residuo lo porta il cookie stesso, e il
 * cookie sta nel browser dell'utente. Bastava copiarne il valore PRIMA
 * di usarlo e rimetterlo dopo per tornare al credito pieno, e da lì in
 * poi avere trenta giorni di letture della carta d'imbarco (che paghiamo
 * a chiamata) e di orari di atterraggio veri, cioè la cosa che il muro
 * esiste per far pagare.
 * Il registro che chiude proprio questo buco c'era già (`creditoFinito`,
 * scritto per il giro #54) ma lo consultava soltanto `/api/verifica`: le
 * due porte laterali guardavano il solo cookie.
 * Trovato dall'ispezione del 12/08.
 *
 * ⚠️ Torna `null` anche quando il credito è finito: chi chiama non deve
 * distinguere "non ha mai pagato" da "ha già speso", perché la risposta
 * è la stessa e distinguerle vorrebbe dire spiegare a un estraneo come
 * funziona la serratura.
 */
export async function passUsabile(req: Request): Promise<Pass | null> {
  const pass = passDi(req);
  if (!pass) return null;
  return (await creditoFinito(pass)) ? null : pass;
}


/**
 * IL REGISTRO: quante analisi ha già consumato questo ordine.
 *
 * 🔴 IL BUCO CHE CHIUDE, trovato attaccando il muro l'11/08. Il cookie
 * della ricevuta si "consuma" scrivendone uno nuovo col credito calato,
 * ma **il cookie sta nel browser dell'utente**: chi si copiava il valore
 * di prima e lo rimetteva a mano tornava ad avere il credito pieno.
 * Provato: prima analisi 200, seconda con la STESSA ricevuta già
 * consumata, ancora 200. Uno paga 1,99 e controlla mille voli, o passa
 * la stringa agli amici.
 *
 * La ricevuta firmata dimostra CHE HAI PAGATO, non QUANTO TI RESTA:
 * quanto ti resta è un conto, e un conto lo tiene chi non lo può
 * cambiare, cioè il nostro database. Ogni analisi consumata scrive il
 * proprio ordine sulla riga di `verifiche`; qui si contano.
 *
 * ⚠️ Se il registro non si può leggere (colonna non ancora aggiunta,
 * database irraggiungibile) si torna al conto del cookie: degradato ma
 * funzionante, e scritto nei log. Non si blocca chi ha pagato per un
 * guasto nostro.
 */
export async function creditoFinito(pass: Pass): Promise<boolean> {
  if (!SERVIZIO_ATTIVO) return pass.restano <= 0;
  try {
    const { count, error } = await supabaseServizio()
      .from("verifiche")
      .select("id", { count: "exact", head: true })
      .eq("ordine_check", pass.ordine);
    if (error) {
      if (!colonnaMancante(error.message)) {
        console.error("[cancello] registro non leggibile:", error.message);
      }
      return pass.restano <= 0;
    }
    return (count ?? 0) >= pass.quanti;
  } catch (e) {
    console.error("[cancello] registro non leggibile:", e);
    return pass.restano <= 0;
  }
}

/**
 * 🔴 QUESTA ANALISI L'HA GIÀ PAGATA, PER QUESTO STESSO VOLO?
 *
 * Valerio, 13/08: «un utente paga mentre fa l'analisi, lì si refresha il
 * browser. Da quanto vedo io adesso gli fa ripagare per forza».
 *
 * Aveva ragione, e il difetto era nella cosa che si conta. Il credito si
 * consumava a ogni ANALISI, e ogni analisi scrive una riga nuova: quindi
 * ricaricare la pagina sullo stesso volo, tornare indietro col tasto del
 * browser, riaprire il link dopo che il telefono si è spento, o
 * semplicemente rifare lo stesso check dieci minuti dopo, mangiava un
 * secondo credito e portava al muro. Chi aveva pagato per sapere del suo
 * volo si ritrovava a dover pagare di nuovo per lo stesso volo.
 *
 * Ma quello che uno compra non è "un'esecuzione del programma": è la
 * risposta su QUEL volo. Quindi il conto si tiene per volo e data: la
 * prima volta si paga, tutte le altre volte su quello stesso volo sono
 * gratis e per sempre, dentro la durata della ricevuta.
 *
 * ⚠️ Non è un buco: per analizzare un volo DIVERSO serve un credito
 * diverso, ed è quello che stiamo vendendo. Qui si regala solo la
 * ripetizione di una risposta già data e già pagata.
 */
export async function analisiGiaPagata(
  pass: Pass,
  voloIata: string,
  dataLocale: string,
): Promise<boolean> {
  if (!SERVIZIO_ATTIVO) return false;
  try {
    const { count, error } = await supabaseServizio()
      .from("verifiche")
      .select("id", { count: "exact", head: true })
      .eq("ordine_check", pass.ordine)
      .eq("volo_iata", voloIata.trim().toUpperCase())
      .eq("data_locale", dataLocale);
    if (error) {
      /* Nel dubbio si lascia passare: il rischio è regalare un'analisi,
         e l'altro è far ripagare una persona che ha già pagato. Fra i
         due, il secondo è quello che costa un cliente. */
      if (!colonnaMancante(error.message)) {
        console.error("[cancello] registro non leggibile:", error.message);
      }
      return false;
    }
    return (count ?? 0) > 0;
  } catch (e) {
    console.error("[cancello] registro non leggibile:", e);
    return false;
  }
}

/**
 * Scrive nel registro che questa analisi è stata consumata da quest'ordine.
 * Se fallisce lo dice forte: senza questa riga la stessa ricevuta si
 * potrebbe riusare, ed è il buco che il registro esiste per chiudere.
 */
export async function segnaConsumo(verificaId: string | null, ordine: string): Promise<void> {
  if (!verificaId || !SERVIZIO_ATTIVO) return;
  try {
    const { error } = await supabaseServizio()
      .from("verifiche")
      .update({ ordine_check: ordine })
      .eq("id", verificaId);
    if (error && !colonnaMancante(error.message)) {
      console.error("[cancello] consumo NON registrato:", error.message);
    }
  } catch (e) {
    console.error("[cancello] consumo NON registrato:", e);
  }
}

/** L'esito della riserva atomica del posto. */
export type EsitoRiserva = "riservato" | "gia" | "finito" | "errore";

/** La chiave del posto: lo stesso volo, nello stesso giorno, è un posto solo. */
const chiaveRiserva = (voloIata: string, dataLocale: string) =>
  `${voloIata.trim().toUpperCase()}|${dataLocale}`;

/**
 * RISERVA UN POSTO DEL CHECK, IN MODO ATOMICO (audit 26/08).
 *
 * 🔴 Prima il credito si controllava (`creditoFinito`) e si consumava
 * (`segnaConsumo`) in due momenti, con in mezzo `verificaVolo` (fino a 8s):
 * 20 richieste in parallelo su voli diversi passavano tutte prima che una
 * consumasse. Qui il posto si prende in un colpo solo, sul database, con un
 * lock per ordine: solo `quanti` posti per pass, e lo stesso volo resta
 * gratis (torna "gia").
 *
 * ⚠️ Torna "errore" se la funzione non c'è (migrazione non applicata) o il
 * database non risponde: chi chiama DEVE degradare alla vecchia logica, mai
 * bloccare chi ha pagato per un guasto nostro.
 */
export async function riservaCheckAtomica(
  pass: Pass,
  voloIata: string,
  dataLocale: string,
): Promise<EsitoRiserva> {
  if (!SERVIZIO_ATTIVO) return "errore";
  try {
    const { data, error } = await supabaseServizio().rpc("riserva_check", {
      p_ordine: pass.ordine,
      p_quanti: pass.quanti,
      p_chiave: chiaveRiserva(voloIata, dataLocale),
    });
    if (error) {
      if (!/does not exist|schema cache|function/i.test(error.message)) {
        console.error("[cancello] riserva atomica non riuscita:", error.message);
      }
      return "errore";
    }
    return data === "riservato" || data === "gia" || data === "finito" ? data : "errore";
  } catch (e) {
    console.error("[cancello] riserva atomica non riuscita:", e);
    return "errore";
  }
}

/**
 * Rilascia il posto riservato: si usa quando il verdetto esce "incerto", che
 * non si vende (CORTESIA_SU_INCERTO). Senza questo, un "non lo so" mangerebbe
 * un posto pagato.
 */
export async function rilasciaCheck(
  pass: Pass,
  voloIata: string,
  dataLocale: string,
): Promise<void> {
  if (!SERVIZIO_ATTIVO) return;
  try {
    await supabaseServizio().rpc("rilascia_check", {
      p_ordine: pass.ordine,
      p_chiave: chiaveRiserva(voloIata, dataLocale),
    });
  } catch (e) {
    console.error("[cancello] rilascio posto non riuscito:", e);
  }
}

/** I dati che il muro mostra: prezzo, posti, e dove si paga. */
export async function datiDelMuro(req: Request) {
  /* Il prezzo e i posti rimasti li calcola il SERVER: sono un dato, non
     una decisione del browser. E i posti si scrivono solo se sono stati
     contati davvero (vedi postiRimasti). */
  const { pagati } = await conteggioCheck();
  const prezzo = prezzoCheck(pagati);
  return {
    /* La cassa è Stripe: /api/check/checkout apre la sessione e manda a
       Stripe. Se la chiave manca, il muro non ha dove mandare e il bottone
       porta ai prezzi (lo decide il client sul null).
       ⚠️ Nessun segreto viaggia mai qui dentro: l'indirizzo è nudo, e una
       prova lo vieta per sempre (era il buco dell'11/08). */
    cassa: stripeAttivo() ? "/api/check/checkout" : null,
    prezzoTesto: prezzo.prezzoTesto,
    prezzoPienoTesto: prezzo.prezzoPienoTesto,
    inLancio: prezzo.inLancio,
    postiRimasti: postiRimasti(pagati),
  };
}

/** Il 402 col muro, uguale da qualunque rotta arrivi. */
export async function rispostaMuro(req: Request) {
  return NextResponse.json(
    {
      ok: false,
      serveIlPass: true,
      errore: "L'analisi di questo volo si sblocca con un pagamento.",
      muro: await datiDelMuro(req),
    },
    { status: 402, headers: CORS },
  );
}

/**
 * Il cancello delle rotte che continuano un check già fatto.
 *
 * ⚠️ Qui NON basta chiedere la ricevuta, e il motivo vale soldi: chi ha
 * pagato e ha già ricevuto il suo verdetto ha finito il credito, e il
 * cookie è stato cancellato. Se poi il verdetto era "non idoneo" e lui
 * dichiara di essere rimasto a terra, quella domanda fa parte di quello
 * che ha comprato: sbattergli in faccia il muro una seconda volta
 * sarebbe farsi pagare due volte lo stesso volo.
 *
 * Quindi passa chi ha la ricevuta **oppure** chi porta l'identificativo
 * di una verifica che esiste davvero. Quell'identificativo si ottiene in
 * un modo solo: passando dal cancello principale.
 *
 * Torna la risposta da restituire, oppure null se si può proseguire.
 */
export async function cancelloDelSeguito(
  req: Request,
  verificaId: unknown,
  /* 🔴 IL VOLO SERVE, E PRIMA NON ARRIVAVA. Senza, questo cancello
     controllava soltanto che quella riga esistesse da qualche parte nel
     database: non di chi fosse, non di che volo parlasse. Un
     identificativo qualsiasi (anche di un altro, visto che le pagine del
     verdetto sono pubbliche e fatte per essere condivise) diventava una
     chiave universale per avere verdetti a pagamento su QUALUNQUE volo,
     all'infinito, e ogni verdetto ci costa una chiamata al fornitore.
     Adesso la verifica deve parlare dello stesso volo e dello stesso
     giorno che si sta chiedendo. Trovato dall'ispezione del 12/08. */
  volo?: { voloIata: string; dataLocale: string },
): Promise<Response | null> {
  if (!CHECK_A_PAGAMENTO) return null;
  if (await passUsabile(req)) return null;

  /* ⚠️ SI CHIUDE, NON SI APRE, QUANDO QUALCOSA VA STORTO.
     Senza database non si può dimostrare che quella verifica esiste, e
     `supabaseServizio()` alza un'eccezione se la chiave manca: lasciarla
     scappare farebbe rispondere 500 alla rotta, cioè un guasto al posto
     del muro. Qualunque cosa succeda qui dentro, la risposta è il muro:
     sbagliare dall'altra parte vuol dire regalare il prodotto. */
  if (typeof verificaId === "string" && verificaId && SERVIZIO_ATTIVO) {
    try {
      if (volo) {
        if (await verificaCoerente(verificaId, volo.voloIata, volo.dataLocale)) return null;
      } else {
        /* Senza il volo non si può dimostrare che parlano della stessa
           cosa: si resta chiusi. Sbagliare dall'altra parte vuol dire
           regalare il prodotto. */
        console.warn("[cancello] chiamata senza volo: resta chiuso");
      }
    } catch (e) {
      console.warn("[cancello] verifica non controllabile, resta chiuso:", e);
    }
  }

  return rispostaMuro(req);
}

/**
 * 🔴 L'ID DELLA VERIFICA NON BASTA A DIMOSTRARE CHE È LA TUA.
 *
 * Trovato dall'ispezione del 12/08 su tre rotte identiche
 * (`/api/verifica/cancellato`, `/dichiara`, `/operativo`): il
 * `verificaId` arrivava dal CORPO della richiesta e finiva dritto in una
 * `.update().eq("id", id)` che riscrive esito, importo e motivo.
 *
 * Il verdetto lo calcola sempre il motore, quindi nessuno può farsi
 * scrivere "idoneo 600€" a piacere. Ma l'id di una verifica gira: sta
 * nell'indirizzo `/verifica/<id>`, e quell'indirizzo si condivide.
 * Chiunque ne avesse uno poteva mandare **il proprio** volo con **l'id
 * di un altro**, e la riga di quella persona si ritrovava addosso il
 * verdetto di un volo che non era il suo.
 *
 * Il controllo è semplice e non costa niente: la riga che stai per
 * riscrivere deve parlare dello STESSO volo e della STESSA data che hai
 * appena verificato. Se non combaciano, l'id non è tuo e non si tocca.
 */
export async function verificaCoerente(
  id: string | null | undefined,
  voloIata: string,
  dataLocale: string,
): Promise<boolean> {
  if (!id || !SERVIZIO_ATTIVO) return false;
  try {
    const { data, error } = await supabaseServizio()
      .from("verifiche")
      .select("volo_iata, data_locale")
      .eq("id", id)
      .maybeSingle<{ volo_iata: string | null; data_locale: string | null }>();
    if (error || !data) return false;
    return (
      (data.volo_iata ?? "").toUpperCase() === voloIata.toUpperCase() &&
      data.data_locale === dataLocale
    );
  } catch (e) {
    console.error("[cancello] coerenza verifica non controllabile:", e);
    return false;
  }
}
