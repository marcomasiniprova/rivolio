import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { èNostroHost, sorgenteAI } from "./registra";
import type { TipoEvento } from "./registra";

/**
 * I NUMERI DEL CRUSCOTTO.
 *
 * Legge il registro e ne tira fuori le cose che si guardano davvero:
 * quanti arrivano, quanti provano, quanti pagano, e da dove vengono.
 *
 * ⚠️ Non lancia mai. Un cruscotto che va in errore quando il database
 * ha un singhiozzo è un cruscotto che si guarda una volta sola: qui,
 * quando un numero non si legge, si scrive che non si è potuto leggere.
 * Un `null` onesto vale più di uno zero inventato, perché uno zero
 * inventato si legge come "oggi non è venuto nessuno".
 */

export type Riga = { quando: string; tipo: string; testo: string; euro: number | null };

/** «Questa cosa, tante volte»: vale per le provenienze e per i paesi. */
export type Conteggio = { nome: string; quanti: number };

/** Un giorno della serie: cosa è successo e quanto è entrato. */
export type GiornoSerie = {
  /** La data italiana in forma "2026-08-11": è la chiave, non si mostra. */
  giorno: string;
  /** L'etichetta sotto la colonna: "lun 11". */
  etichetta: string;
  /** Quante volte è successo ogni fatto, quel giorno. */
  per: Partial<Record<TipoEvento, number>>;
  /** Quanti verdetti idonei: sono le sole analisi che possono vendere. */
  idonei: number;
  /** Quanto è entrato, in euro. */
  euro: number;
  /** È oggi? Serve alla linea tratteggiata sui grafici. */
  oggi: boolean;
};

export type Cruscotto = {
  /** I conteggi di oggi e degli ultimi 7 giorni. null = non letto. */
  oggi: Record<TipoEvento, number> | null;
  settimana: Record<TipoEvento, number> | null;
  /** Quanto è entrato, oggi e nella settimana. */
  incassoOggi: number | null;
  incassoSettimana: number | null;
  /** Da dove arrivano, negli ultimi 7 giorni. */
  provenienze: Conteggio[] | null;
  paesi: Conteggio[] | null;
  /**
   * Quanti arrivano da un motore AI (ChatGPT, Perplexity...), negli ultimi
   * 7 giorni. È il numero che dice se il marketing GEO funziona: se le
   * pagine per compagnia vengono citate, qui cresce. null = non letto.
   */
  aiMotori: Conteggio[] | null;
  /** Gli ultimi fatti, in ordine: è il "tempo reale". */
  ultimi: Riga[] | null;
  /** Quanti di quelli che hanno visto il muro hanno poi pagato. */
  conversioneMuro: number | null;
  /**
   * La lettura ha toccato il tetto: i numeri della settimana sono un
   * PEZZO, non il totale.
   * ⚠️ Un avviso nei log lo leggo io, non Valerio. Se un numero è
   * parziale lo deve dire la schermata, come già fa il grafico per
   * giorno: se no si accorcia da solo con la stessa faccia di prima.
   */
  parziale: boolean;
};

type RigaGrezza = {
  creato_il: string;
  tipo: string;
  volo: string | null;
  esito: string | null;
  importo: number | null;
  provenienza: string | null;
  paese: string | null;
  /** Il contorno del fatto. Serve a riconoscere le righe di collaudo. */
  extra?: Record<string, unknown> | null;
};

const VUOTO: Cruscotto = {
  oggi: null,
  settimana: null,
  incassoOggi: null,
  incassoSettimana: null,
  provenienze: null,
  paesi: null,
  aiMotori: null,
  ultimi: null,
  conversioneMuro: null,
  parziale: false,
};

/** Il fatto, raccontato in una riga leggibile. */
function racconta(r: RigaGrezza): string {
  const volo = r.volo ? ` ${r.volo}` : "";
  switch (r.tipo) {
    case "visita":
      /* 🔴 Le righe vecchie possono avere come provenienza un'anteprima di
         Netlify (`6a81...--rivolio.netlify.app`): finivano nel registro
         prima che il filtro fosse blindato (Valerio, 16/08). Qui le si
         chiama col loro nome: «un'anteprima interna», non traffico vero. Le
         nuove non ci arrivano proprio (vedi soloIlDominio). */
      if (r.provenienza && èNostroHost(r.provenienza))
        return "Qualcuno è arrivato da un'anteprima interna del sito";
      return `Qualcuno è arrivato sul sito${r.provenienza ? ` da ${r.provenienza}` : ""}`;
    case "check":
      return `Analisi lanciata${volo}`;
    case "muro":
      return "Ha visto il muro del pagamento";
    case "sbloccato":
      return "Ha pagato l'analisi";
    case "verdetto":
      return `Verdetto${volo}: ${r.esito ?? "?"}`;
    case "pratica":
      return `Pratica aperta${volo}`;
    case "pagato":
      return `PRATICA PAGATA${volo}`;
    case "iscritto":
      return "Nuova iscrizione all'Osservatorio";
    case "invito":
      return "Ha invitato un amico";
    case "guasto":
      return "Qualcosa non ha funzionato";
    default:
      return r.tipo;
  }
}

/**
 * I NUMERI, CONTATI DAL DATABASE (audit 26/08).
 *
 * 🔴 Prima si caricavano fino a 20.000 righe in memoria e si sommava in JS:
 * oltre quel tetto i totali (incassi, conversione del muro, provenienze) si
 * accorciavano in SILENZIO, dominati dal flusso delle visite. Adesso conta e
 * somma il database (funzioni `cruscotto_numeri` e `cruscotto_gruppi`), esatto
 * a qualsiasi volume, e la conversione del muro usa gli sblocchi DISTINTI per
 * ordine (un reload della pagina di successo non la gonfia più).
 *
 * ⚠️ Se le funzioni non ci sono (migrazione non applicata) o il database non
 * risponde, si DEGRADA alla vecchia lettura in memoria: un pannello coi numeri
 * un po' meno esatti è meglio di un pannello rotto.
 */
export async function leggiCruscotto(quanteRighe = 40): Promise<Cruscotto> {
  if (!SERVIZIO_ATTIVO) return VUOTO;
  try {
    const db = supabaseServizio();
    const adesso = new Date();
    const daIso = new Date(adesso.getTime() - 7 * 86_400_000).toISOString();

    const [numRes, gruppiRes, ultimiRes] = await Promise.all([
      db.rpc("cruscotto_numeri", { p_da: daIso, p_now: adesso.toISOString() }),
      db.rpc("cruscotto_gruppi", { p_da: daIso }),
      db
        .from("eventi")
        .select("creato_il, tipo, volo, esito, importo, provenienza")
        .order("creato_il", { ascending: false })
        .limit(quanteRighe),
    ]);
    if (numRes.error || gruppiRes.error) {
      throw new Error(numRes.error?.message ?? gruppiRes.error?.message ?? "rpc cruscotto");
    }

    const n = numRes.data as {
      settimana: Record<string, number>;
      oggi: Record<string, number>;
      incasso_settimana: number;
      incasso_oggi: number;
      muri: number;
      sbloccati: number;
    };
    const g = (gruppiRes.data ?? {}) as { provenienze?: Conteggio[]; paesi?: Conteggio[] };

    const record = (o: Record<string, number> | null | undefined): Record<TipoEvento, number> => ({
      visita: o?.visita ?? 0,
      check: o?.check ?? 0,
      muro: o?.muro ?? 0,
      sbloccato: o?.sbloccato ?? 0,
      verdetto: o?.verdetto ?? 0,
      pratica: o?.pratica ?? 0,
      pagato: o?.pagato ?? 0,
      iscritto: o?.iscritto ?? 0,
      invito: o?.invito ?? 0,
      guasto: o?.guasto ?? 0,
    });

    const prov = g.provenienze ?? [];
    const aiMap = new Map<string, number>();
    for (const r of prov) {
      const motore = sorgenteAI(r.nome);
      if (motore) aiMap.set(motore, (aiMap.get(motore) ?? 0) + r.quanti);
    }
    const aiMotori = [...aiMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nome, quanti]) => ({ nome, quanti }));

    const ultimi = ((ultimiRes.data ?? []) as RigaGrezza[]).map((r) => ({
      quando: r.creato_il,
      tipo: r.tipo,
      testo: racconta(r),
      euro: r.importo === null ? null : Number(r.importo),
    }));

    return {
      oggi: record(n.oggi),
      settimana: record(n.settimana),
      incassoOggi: Number(n.incasso_oggi ?? 0),
      incassoSettimana: Number(n.incasso_settimana ?? 0),
      provenienze: prov.slice(0, 8),
      paesi: g.paesi ?? [],
      aiMotori,
      ultimi,
      conversioneMuro: n.muri > 0 ? Math.round((n.sbloccati / n.muri) * 1000) / 10 : null,
      /* Contato dal database: niente tetto, niente numeri parziali. */
      parziale: false,
    };
  } catch (e) {
    console.error("[cruscotto] via SQL fallita, degrado alla lettura in memoria:", e);
    return leggiCruscottoInMemoria(quanteRighe);
  }
}

async function leggiCruscottoInMemoria(quanteRighe = 40): Promise<Cruscotto> {
  if (!SERVIZIO_ATTIVO) return VUOTO;
  try {
    const db = supabaseServizio();
    const adesso = new Date();
    /* 🔴 "OGGI" VOLEVA DIRE DUE COSE DIVERSE NELLA STESSA SCHERMATA.
       Qui il giorno cominciava a mezzanotte dell'OROLOGIO DEL SERVER, che
       su Netlify è a Londra; nel grafico qui sotto comincia a mezzanotte
       ITALIANA. Fra l'una e le due di notte italiane i due numeri
       parlavano di giornate diverse: la casella diceva "oggi 0" mentre la
       colonna di oggi ne mostrava tre. Adesso il giorno è quello italiano
       in tutte e due, e si confronta la data scritta invece di sommare
       ore: così l'ora legale non sposta niente.
       Trovato dall'ispezione del 12/08. */
    const oggiIt = GIORNO_ROMA.format(adesso);
    const settimanaFa = new Date(adesso.getTime() - 7 * 86_400_000);

    /* Una lettura sola per la settimana, poi si conta in memoria: sette
       giorni di eventi stanno in una manciata di migliaia di righe, e
       fare otto interrogazioni separate costerebbe di più. */
    const { data, error } = await db
      .from("eventi")
      .select("creato_il, tipo, volo, esito, importo, provenienza, paese, extra")
      .gte("creato_il", settimanaFa.toISOString())
      .order("creato_il", { ascending: false })
      .limit(20_000);

    if (error || !data) {
      /* Tabella non ancora creata = non è un guasto, è un "non ancora". */
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        console.error("[cruscotto] lettura fallita:", error.message);
      }
      return VUOTO;
    }

    const righe = data as RigaGrezza[];
    /* 🔴 IL TETTO TAGLIAVA I NUMERI IN SILENZIO. Superate le 20.000 righe
       nella settimana, questa lettura ne riporta ventimila e i totali
       della Panoramica e del Traffico si accorciano da soli, con la
       stessa faccia di prima. Il grafico per giorno lo dice già (vedi
       `leggiSerie`): qui non lo diceva nessuno.
       Trovato dall'ispezione del 12/08. */
    if (righe.length >= 20_000) {
      console.warn(
        "[cruscotto] tetto di 20.000 righe raggiunto: i numeri della settimana sono PARZIALI.",
      );
    }
    /* 🔴 LA MAPPA DEVE NASCERE COMPLETA, E QUI NASCEVA A META'.
       `{} as Record<TipoEvento, number>` mente al compilatore: dichiara
       che ogni tipo di fatto ha un numero, ma dentro ci finiscono solo i
       tipi INCONTRATI. Se oggi nessuno ha lanciato un'analisi, la chiave
       "check" semplicemente non c'e', e chi legge `oggi.check` riceve
       `undefined`. A quel punto ogni `?? null` a valle diventa "non
       letto" per uno ZERO VERO.
       E' il difetto che questo progetto ha gia' rincorso due volte, ed
       e' la causa comune di quattro schermate del pannello che dicevano
       "non letto" dove il dato era letto e valeva zero (ispezione del
       12/08). Il compilatore non poteva accorgersene: il cast glielo
       impediva.
       Adesso si parte da zero su TUTTI i tipi, e il cast sparisce. */
    const conta = (dentro: RigaGrezza[]): Record<TipoEvento, number> => {
      const m: Record<TipoEvento, number> = {
        visita: 0,
        check: 0,
        muro: 0,
        sbloccato: 0,
        verdetto: 0,
        pratica: 0,
        pagato: 0,
        iscritto: 0,
        invito: 0,
        guasto: 0,
      };
      for (const r of dentro) {
        const t = r.tipo as TipoEvento;
        if (t in m) m[t] += 1;
      }
      return m;
    };
    const diOggi = righe.filter((r) => GIORNO_ROMA.format(new Date(r.creato_il)) === oggiIt);
    const somma = (dentro: RigaGrezza[]) =>
      dentro.reduce((s, r) => s + (r.tipo === "pagato" ? Number(r.importo ?? 0) : 0), 0);

    const perChiave = (campo: "provenienza" | "paese") => {
      const m = new Map<string, number>();
      for (const r of righe) {
        const v = r[campo];
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([nome, quanti]) => ({ nome, quanti }));
    };

    /* Da quali motori AI: si prende la provenienza di ogni riga e si guarda
       se è un motore (chatgpt, perplexity...). Conta a parte da "da dove
       arrivano" perché è la domanda che il marketing GEO fa a sé stesso:
       "le pagine che ho scritto per farmi citare stanno funzionando?". */
    const contaAI = () => {
      const m = new Map<string, number>();
      for (const r of righe) {
        const motore = sorgenteAI(r.provenienza);
        if (motore) m.set(motore, (m.get(motore) ?? 0) + 1);
      }
      return [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([nome, quanti]) => ({ nome, quanti }));
    };

    /* 🔴 LE PROVE DI COLLAUDO CONTAVANO COME VENDITE. Oggi l'unico posto
       che scrive "analisi pagata" è la cassa di collaudo, cioè Valerio
       che percorre il prodotto: un venditore vero non c'è ancora. Senza
       questo filtro, il giorno che ne fa dieci il pannello direbbe
       "conversione del muro: 100%", che è il numero su cui si decide se
       il prezzo del check funziona. Le righe di prova restano nel
       registro (sono successe), ma fuori dai numeri che si guardano per
       decidere. Trovato dall'ispezione del 12/08. */
    const diProva = (r: RigaGrezza) =>
      Boolean((r.extra as { prova?: unknown } | null | undefined)?.prova);
    const muri = righe.filter((r) => r.tipo === "muro" && !diProva(r)).length;
    const sbloccati = righe.filter((r) => r.tipo === "sbloccato" && !diProva(r)).length;

    return {
      oggi: conta(diOggi),
      settimana: conta(righe),
      incassoOggi: somma(diOggi),
      incassoSettimana: somma(righe),
      provenienze: perChiave("provenienza"),
      paesi: perChiave("paese"),
      aiMotori: contaAI(),
      ultimi: righe.slice(0, quanteRighe).map((r) => ({
        quando: r.creato_il,
        tipo: r.tipo,
        testo: racconta(r),
        euro: r.importo === null ? null : Number(r.importo),
      })),
      /* Si mostra solo se qualcuno il muro l'ha visto davvero: una
         percentuale su zero visite non è un dato, è una divisione per
         zero travestita. */
      conversioneMuro: muri > 0 ? Math.round((sbloccati / muri) * 1000) / 10 : null,
      parziale: righe.length >= 20_000,
    };
  } catch (e) {
    console.error("[cruscotto] lettura fallita:", e);
    return VUOTO;
  }
}

/* ── IL REGISTRO PER INTERO ──────────────────────────────────────────
   Il cruscotto mostra gli ultimi fatti; questa serve alla sezione
   Registro, che li vuole tutti, filtrabili e cercabili. */

export type RigaRegistro = Riga & {
  volo: string | null;
  provenienza: string | null;
  paese: string | null;
};

export type Registro = {
  righe: RigaRegistro[];
  /** Quante volte compare ogni tipo, dentro la finestra letta. */
  perTipo: Record<string, number>;
};

/**
 * Ripulisce il testo cercato.
 *
 * ⚠️ NON È PIGNOLERIA. Il filtro di PostgREST si scrive come una stringa
 * (`volo.ilike.%x%,paese.ilike.%y%`), quindi una virgola o una parentesi
 * dentro quello che l'utente ha scritto cambierebbe la struttura della
 * domanda invece del suo contenuto. Si tolgono i caratteri che quella
 * grammatica usa, e si taglia la lunghezza.
 */
function ripulisci(cerca: string): string {
  return cerca.replace(/[,()"\\%*]/g, " ").trim().slice(0, 40);
}

/**
 * I fatti, dal più recente, eventualmente filtrati per testo.
 *
 * Il filtro per TIPO invece si fa a valle, in memoria: così i contatori
 * sulle linguette continuano a dire quanti ce ne sono di ogni tipo anche
 * mentre ne guardi uno solo. Con un filtro in SQL, scelto "guasto",
 * tutte le altre linguette direbbero zero.
 */
export async function leggiRegistro(cerca = "", quante = 400): Promise<Registro | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();
    let domanda = db
      .from("eventi")
      .select("creato_il, tipo, volo, esito, importo, provenienza, paese")
      .order("creato_il", { ascending: false })
      .limit(quante);

    const testo = ripulisci(cerca);
    if (testo) {
      domanda = domanda.or(
        [
          `volo.ilike.%${testo}%`,
          `provenienza.ilike.%${testo}%`,
          `paese.ilike.%${testo}%`,
          `tipo.ilike.%${testo}%`,
          `esito.ilike.%${testo}%`,
        ].join(","),
      );
    }

    const { data, error } = await domanda;
    if (error || !data) {
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        console.error("[registro] lettura fallita:", error.message);
      }
      return null;
    }

    const righe = (data as RigaGrezza[]).map((r) => ({
      quando: r.creato_il,
      tipo: r.tipo,
      testo: racconta(r),
      euro: r.importo === null ? null : Number(r.importo),
      volo: r.volo,
      provenienza: r.provenienza,
      paese: r.paese,
    }));

    const perTipo: Record<string, number> = {};
    for (const r of righe) perTipo[r.tipo] = (perTipo[r.tipo] ?? 0) + 1;

    return { righe, perTipo };
  } catch (e) {
    console.error("[registro] lettura fallita:", e);
    return null;
  }
}

/* ── LA SERIE PER GIORNO ─────────────────────────────────────────────
   Sta in una funzione SUA e non dentro `leggiCruscotto`, e il motivo è
   che allargando la finestra là dentro cambierebbe in silenzio il
   significato di "7 giorni" per tutti quelli che già la chiamano: la
   riga della conversione sul cruscotto e il riepilogo della sera su
   Telegram direbbero un'altra cosa senza che nessuno l'abbia chiesto.
   Due letture su una tabella di eventi costano meno di un numero che
   cambia senso da solo. */

/** La data italiana in forma "2026-08-11": è la chiave dei mucchietti. */
const GIORNO_ROMA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Quello che si legge sotto la colonna: "lun 11". */
const ETICHETTA_GIORNO = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "short",
  day: "numeric",
});

/**
 * Cosa è successo giorno per giorno, negli ultimi `giorni` giorni.
 *
 * ⚠️ I giorni sono quelli ITALIANI, non quelli del server: su Netlify
 * l'orologio è a Londra, e un'analisi fatta alle 00:30 di martedì
 * finirebbe nella colonna di lunedì. Chi guarda il grafico la mattina
 * confronta con la propria giornata, non con quella della macchina.
 *
 * ⚠️ Torna `null` se il registro non si è aperto. Uno zero al posto di un
 * "non letto" qui sarebbe peggio che altrove: un grafico piatto a zero si
 * legge come "non è venuto nessuno per due settimane", ed è una bugia
 * detta in grande.
 *
 * Gli zeri VERI invece restano zeri: un giorno letto in cui non è
 * successo niente è un dato, e va disegnato.
 */
/**
 * La serie giorno per giorno, CONTATA DAL DATABASE (audit 26/08): niente più
 * tetto a 20.000 righe che tagliava i giorni più vecchi. Se la funzione non
 * c'è, si degrada alla lettura in memoria.
 */
export async function leggiSerie(giorni = 14): Promise<GiornoSerie[] | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();
    const oggiRoma = GIORNO_ROMA.format(new Date());
    const ancora = Date.parse(`${oggiRoma}T12:00:00Z`);
    const scheletro: GiornoSerie[] = [];
    for (let i = giorni - 1; i >= 0; i--) {
      const quando = new Date(ancora - i * 86_400_000);
      scheletro.push({
        giorno: GIORNO_ROMA.format(quando),
        etichetta: ETICHETTA_GIORNO.format(quando).replace(".", ""),
        per: {},
        idonei: 0,
        euro: 0,
        oggi: i === 0,
      });
    }
    /* Due ore di margine per l'ora legale, come nella versione in memoria. */
    const da = new Date(ancora - (giorni - 1) * 86_400_000 - 14 * 3_600_000).toISOString();
    const { data, error } = await db.rpc("serie_giorni", { p_da: da });
    if (error) throw new Error(error.message);

    const perGiorno = new Map(scheletro.map((s) => [s.giorno, s]));
    for (const r of (data ?? []) as {
      giorno: string;
      per: Partial<Record<TipoEvento, number>>;
      idonei: number;
      euro: number;
    }[]) {
      const g = perGiorno.get(r.giorno);
      if (!g) continue; // fuori finestra: è il margine delle due ore
      g.per = r.per ?? {};
      g.idonei = r.idonei ?? 0;
      g.euro = Number(r.euro ?? 0);
    }
    return scheletro;
  } catch (e) {
    console.error("[serie] via SQL fallita, degrado alla lettura in memoria:", e);
    return leggiSerieInMemoria(giorni);
  }
}

async function leggiSerieInMemoria(giorni = 14): Promise<GiornoSerie[] | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();

    /* Il mezzogiorno come ancora: sommare e sottrarre giorni da
       mezzanotte salta (o ripete) una data nelle due notti dell'ora
       legale, e il grafico si ritroverebbe due colonne uguali. */
    const oggiRoma = GIORNO_ROMA.format(new Date());
    const ancora = Date.parse(`${oggiRoma}T12:00:00Z`);
    const scheletro: GiornoSerie[] = [];
    for (let i = giorni - 1; i >= 0; i--) {
      const quando = new Date(ancora - i * 86_400_000);
      scheletro.push({
        giorno: GIORNO_ROMA.format(quando),
        etichetta: ETICHETTA_GIORNO.format(quando).replace(".", ""),
        per: {},
        idonei: 0,
        euro: 0,
        oggi: i === 0,
      });
    }

    /* Due ore di margine: la finestra è in giorni italiani, la colonna
       nel database è in UTC, e in estate l'Italia è due ore avanti. */
    const da = new Date(ancora - (giorni - 1) * 86_400_000 - 14 * 3_600_000);
    /* 🔴 IL TETTO C'ERA MA SENZA UN ORDINE, e un tetto senza ordine è la
       peggiore delle due cose. Postgres, quando non gli si dice come
       ordinare, restituisce le righe nell'ordine che gli fa comodo:
       superate le 20.000 righe nella finestra, tornavano ventimila righe
       QUALSIASI, sparse a caso fra i quattordici giorni. Il grafico non
       si sarebbe accorto di niente: avrebbe disegnato quattordici colonne
       tutte più basse del vero, con la stessa faccia di sempre.
       Adesso l'ordine c'è (dalla più recente), quindi le righe che
       mancano sono sempre quelle dei giorni PIÙ VECCHI, e quei giorni si
       tolgono invece di disegnarli sbagliati: meglio un grafico corto che
       un grafico falso. Trovato dall'ispezione del 12/08. */
    const TETTO = 20_000;
    const { data, error } = await db
      .from("eventi")
      .select("creato_il, tipo, esito, importo")
      .gte("creato_il", da.toISOString())
      .order("creato_il", { ascending: false })
      .limit(TETTO);

    if (error || !data) {
      if (error && !/does not exist|schema cache/i.test(error.message)) {
        console.error("[serie] lettura fallita:", error.message);
      }
      return null;
    }

    const perGiorno = new Map(scheletro.map((g) => [g.giorno, g]));
    const righe = data as Pick<RigaGrezza, "creato_il" | "tipo" | "esito" | "importo">[];
    for (const r of righe) {
      const g = perGiorno.get(GIORNO_ROMA.format(new Date(r.creato_il)));
      if (!g) continue; // fuori finestra: è il margine delle due ore
      const t = r.tipo as TipoEvento;
      g.per[t] = (g.per[t] ?? 0) + 1;
      if (t === "verdetto" && r.esito === "idoneo") g.idonei += 1;
      if (t === "pagato") g.euro += Number(r.importo ?? 0);
    }

    /* Tetto raggiunto: dei giorni più vecchi abbiamo letto solo un pezzo,
       e disegnarli sarebbe dire una cosa falsa con l'aria di un dato.
       Si tiene dal giorno della riga più vecchia che è arrivata in poi. */
    if (righe.length >= TETTO) {
      const piuVecchia = righe[righe.length - 1];
      const daQui = GIORNO_ROMA.format(new Date(piuVecchia.creato_il));
      console.warn(
        `[serie] tetto di ${TETTO} righe raggiunto: il grafico parte dal ${daQui} invece che dal ${scheletro[0].giorno}.`,
      );
      /* Il giorno della riga più vecchia è a sua volta tagliato a metà:
         si parte dal successivo. */
      const primoIntero = scheletro.findIndex((g) => g.giorno > daQui);
      if (primoIntero > 0) return scheletro.slice(primoIntero);
    }

    return scheletro;
  } catch (e) {
    console.error("[serie] lettura fallita:", e);
    return null;
  }
}
