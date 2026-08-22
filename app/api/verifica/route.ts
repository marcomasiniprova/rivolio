import { NextResponse } from "next/server";
import { scadenzaStimata } from "@/lib/regole/eu261";
import { verificaVolo } from "@/lib/voli/verifica";
import { inItaliano } from "@/lib/voli/aeroporti";
import { CORS, ipDi, oltreIlLimiteCondiviso } from "@/lib/api/limite";
import { CHECK_A_PAGAMENTO, CORTESIA_SU_INCERTO } from "@/lib/check/ingresso";
import { utenteCreatore } from "@/lib/affiliati/creatore";
import {
  analisiGiaPagata,
  creditoFinito,
  passDi,
  rispostaMuro,
  segnaConsumo,
} from "@/lib/check/cancello";
import { COOKIE_PASS, consumaPass } from "@/lib/check/pass";
import { formaCodiceValida, normalizzaCodice } from "@/lib/recensioni/buono";
import { buonoIdDaCodice, consumaBuono } from "@/lib/recensioni/recensioni";
import { COOKIE_ULTIMA_VERIFICA, ULTIMA_VERIFICA_VALE_S } from "@/lib/check/verifica-cookie";
import { traccia } from "@/lib/eventi/registra";

/**
 * POST /api/verifica  {volo, data}
 *
 * Il check pubblico: senza login, senza email, senza download (SPEC §3,
 * il funnel). Risponde il verdetto e i dati oggettivi che lo motivano:
 * ogni numero mostrato all'utente nasce qui ed è apribile.
 *
 * Protezioni (il check chiama i dati di volo a pagamento, va difeso):
 *  - tetto per IP (20 al minuto) col contatore condiviso di lib/api/limite;
 *  - CORS chiuso alla NOSTRA origine, non più aperto a chiunque. Il check
 *    same-origin della landing non se ne accorge (il browser non applica
 *    il CORS allo stesso sito); l'app nativa nemmeno (non è un browser).
 */

/* 20 al minuto: un utente può controllare qualche volo di fila (la
   famiglia, l'andata e il ritorno); un ciclo automatico no. */
const MASSIMO_AL_MINUTO = 20;

/** Come si scrive il cookie della ricevuta: solo server, solo nostro sito. */
const BISCOTTO = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (await oltreIlLimiteCondiviso("verifica", ipDi(req), MASSIMO_AL_MINUTO)) {
    return NextResponse.json(
      {
        ok: false,
        errore: "Troppe richieste di fila. Aspetta un minuto e riprova.",
      },
      { status: 429, headers: CORS },
    );
  }

  /* ── IL CANCELLO (spento finché CHECK_PREZZO_ATTIVO non vale "1") ───
     Chi ha pagato porta con sé una ricevuta firmata nel cookie: niente
     account, niente password, niente attesa. Chi non ce l'ha riceve un
     402 con dentro il motivo, e la pagina mostra il muro col prezzo.
     Il controllo sta QUI, sul server, e non in una schermata: un muro
     che vive solo nel browser lo scavalca chiunque apra gli strumenti
     per sviluppatori, e ogni check scavalcato è una chiamata pagata da
     noi. */
  /* Il corpo si legge PRIMA del cancello: serve anche a ritrovare il buono
     di riserva (vedi sotto). */
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, errore: "Richiesta non leggibile." },
      { status: 400, headers: CORS },
    );
  }
  const {
    volo,
    data,
    codice: codiceDalCorpo,
  } = (corpo ?? {}) as { volo?: unknown; data?: unknown; codice?: unknown };

  const pass = passDi(req);
  /* IL CODICE DELL'ANALISI GRATIS (da recensione) apre il cancello quando
     non c'è un pass pagato. La persona lo incolla al muro e arriva qui nel
     corpo della richiesta: il registro dice se esiste ed è ancora libero, e
     lo brucia appena l'analisi produce un verdetto (vedi sotto).
     ⚠️ NIENTE PIÙ COOKIE. Il cookie era fragile (a volte non arrivava e il
     muro compariva su un buono valido) E riusabile (un incerto non lo
     spendeva, quindi restava vivo all'infinito: «gratis quanto voglio»,
     Valerio 15/08). Il codice si brucia al primo verdetto, punto. */
  const codice = typeof codiceDalCorpo === "string" ? normalizzaCodice(codiceDalCorpo) : "";
  const buonoId =
    CHECK_A_PAGAMENTO && !pass && formaCodiceValida(codice) ? await buonoIdDaCodice(codice) : null;
  const buonoOk = Boolean(buonoId);
  /* ⚠️ Chi sbatte sul muro conta ANCHE come "ha lanciato un'analisi": se
     no il cruscotto mostrerebbe più muri che analisi, cioè un imbuto che
     si allarga scendendo, e un numero impossibile fa dubitare di tutti
     gli altri. */
  if (CHECK_A_PAGAMENTO && !pass && !buonoOk) {
    /* Un creator "gratis a vita" salta il muro: check illimitati, senza
       pagare. Il flag si legge dal SERVER (utenteCreatore), mai dal browser,
       e solo QUI davanti al muro: chi non è loggato non tocca il database. */
    if (!(await utenteCreatore(req))) {
      traccia(req, { tipo: "check" }, { tipo: "muro" });
      return rispostaMuro(req);
    }
  }

  if (typeof volo !== "string" || typeof data !== "string") {
    return NextResponse.json(
      {
        ok: false,
        errore: "Servono il numero del volo e la data di partenza.",
      },
      { status: 400, headers: CORS },
    );
  }

  /* ⚠️ IL CANCELLO DEL CREDITO STA QUI, DOPO AVER LETTO IL VOLO, e il
     motivo vale un cliente.

     Non basta avere una ricevuta valida: bisogna che le analisi comprate
     non siano già finite, e il conto lo tiene il database perché il
     cookie sta nel browser di chi lo usa (chi si copiava il valore di
     prima tornava al credito pieno: provato l'11/08).

     🔴 Ma prima questo controllo girava PRIMA di sapere di che volo si
     parlasse, e quindi non poteva distinguere «un'analisi nuova» da
     «la stessa analisi rifatta». Valerio, 13/08: «un utente paga mentre
     fa l'analisi, lì si refresha il browser, e da quanto vedo gli fa
     ripagare per forza». Ricaricare la pagina, tornare indietro col
     tasto del browser o riaprire il link dopo che il telefono si è
     spento mangiava un secondo credito sullo STESSO volo.
     Adesso si guarda anche il volo: quello che uno ha comprato è la
     risposta su quel volo, non un'esecuzione del programma. */
  const giaPagata = pass ? await analisiGiaPagata(pass, volo, data) : false;
  if (pass && !giaPagata && (await creditoFinito(pass))) {
    traccia(req, { tipo: "check", volo }, { tipo: "muro", extra: { motivo: "credito finito" } });
    return rispostaMuro(req);
  }

  // Da qui in giù verificaVolo non lancia mai: un guasto diventa esito incerto.
  const esito = await verificaVolo(volo, data);
  if (!esito.ok) {
    /* Non è un guasto: quasi sempre è un numero di volo scritto male o
       un volo che quel giorno non esiste. Si conta come analisi lanciata
       perché la persona ci ha provato davvero. */
    traccia(req, { tipo: "check", volo, esito: "non trovato" });
    return NextResponse.json(
      { ok: false, errore: esito.errore },
      { status: 400, headers: CORS },
    );
  }

  const { verdetto, fatto } = esito;
  traccia(
    req,
    { tipo: "check", volo },
    { tipo: "verdetto", volo, esito: verdetto.esito, extra: esito.demo ? { demo: true } : null },
  );

  /* Il check si consuma SOLO se abbiamo dato una risposta. Su un incerto
     il credito resta: chi paga per sapere e si sente rispondere "non lo
     so" non ha comprato niente, e trattenergli i soldi è la strada più
     breve per una contestazione sulla carta (vedi CORTESIA_SU_INCERTO). */
  const siConsuma =
    Boolean(pass) &&
    /* Lo stesso volo non si paga due volte: vedi `analisiGiaPagata`. */
    !giaPagata &&
    !(CORTESIA_SU_INCERTO && verdetto.esito === "incerto");
  const daConsumare = siConsuma && pass ? consumaPass(pass) : undefined;

  /* Il consumo si scrive nel REGISTRO, non solo nel cookie: è quello che
     impedisce di riusare la stessa ricevuta copiandola a mano. */
  if (siConsuma && pass) await segnaConsumo(esito.verificaId, pass.ordine);

  /* Il codice si brucia appena l'analisi dà un verdetto VERO (idoneo o non
     idoneo). Un volo non trovato non arriva fin qui (torna 400 prima),
     quindi un errore di battitura non lo consuma.
     🔴 MA NON SU UN INCERTO (Valerio, 15/08: «tutti i codici non
     funzionano»). Chi riscatta il codice e si sente rispondere «non lo so»
     non ha ottenuto niente: bruciargli il codice è come trattenere il
     credito a chi ha pagato e ha avuto un incerto, e infatti lì NON si
     consuma (CORTESIA_SU_INCERTO, vedi `siConsuma` sopra). Le due strade
     ora si comportano uguale. Il buco del «gratis quanto voglio» resta
     chiuso: un incerto non è una risposta vendibile, quindi non è un giro
     gratis rubato. */
  const codiceSiConsuma =
    buonoOk && buonoId && !(CORTESIA_SU_INCERTO && verdetto.esito === "incerto");
  if (codiceSiConsuma && buonoId) {
    await consumaBuono(buonoId, esito.verificaId);
  }

  const risposta = NextResponse.json(
    {
      ok: true,
      id: esito.verificaId,
      esito: verdetto.esito,
      ...(verdetto.esito === "idoneo" ? { importo: verdetto.importo } : {}),
      ...("ritardoMinuti" in verdetto && verdetto.ritardoMinuti !== null
        ? { ritardoMinuti: verdetto.ritardoMinuti }
        : {}),
      motivo: verdetto.motivo,
      // I dati oggettivi dietro il verdetto: la trasparenza è il prodotto.
      dato: {
        /* La tratta in chiaro: l'utente riconosce le città, non i codici.
           E le riconosce in italiano: l'archivio scrive "Milan", noi
           mostriamo "Milano" (inItaliano). */
        da: inItaliano(fatto.partenzaCitta) ?? fatto.partenzaIata ?? null,
        a: inItaliano(fatto.arrivoCitta) ?? fatto.arrivoIata ?? null,
        previsto: fatto.arrivoPrevistoUtc,
        effettivo: fatto.arrivoEffettivoUtc,
        vettoreOperativo: fatto.vettoreOperativo,
        km: fatto.kmOrtodromica,
      },
      demo: esito.demo,
      // La prescrizione è una STIMA dichiarata (SPEC §4), e solo dove ha senso.
      ...(verdetto.esito === "idoneo"
        ? {
            scadenzaStimata: scadenzaStimata(
              fatto.dataLocale,
              fatto.vettoreOperativo,
            ),
          }
        : {}),
    },
    { headers: CORS },
  );

  /* 🔴 LA RICEVUTA NON SI CANCELLA PIÙ, e prima si cancellava appena
     finiva il credito. Sembrava pulizia, era un buco nei soldi: quel
     cookie è anche la prova che l'analisi è stata pagata, e senza prova
     lo sconto di 1,99 sulla pratica non si applica. Chi pagava l'analisi
     si vedeva chiedere 14,90 pieni, cioè 16,89 in tutto, contro i 14,90
     promessi in quattro punti del sito. Trovato col collaudo del 13/08.
     Adesso arriva a zero e resta: a impedire una seconda analisi ci
     pensa il registro nel database, non il cookie. */
  if (pass && daConsumare) risposta.cookies.set(COOKIE_PASS, daConsumare, BISCOTTO);

  /* L'id dell'ultima verifica in un cookie: così il risultato si apre su
     /verifica (indirizzo pulito) invece che su /verifica/<uuid> (Valerio,
     14/08). Vale un'ora, come la ripresa dopo la cassa. Solo per i verdetti
     veri: la demo ha un suo indirizzo esplicito. */
  if (esito.verificaId) {
    risposta.cookies.set(COOKIE_ULTIMA_VERIFICA, esito.verificaId, {
      ...BISCOTTO,
      maxAge: ULTIMA_VERIFICA_VALE_S,
    });
  }
  return risposta;
}
