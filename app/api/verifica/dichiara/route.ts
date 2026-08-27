import { NextResponse } from "next/server";
import { normalizzaData, normalizzaVolo } from "@/lib/voli/normalizza";
import { CORS, ipDi, oltreIlLimiteCondiviso } from "@/lib/api/limite";
import { verificaCoerente, cancelloDelSeguito } from "@/lib/check/cancello";
import {
  rispostaCoincidenzaValida,
  rispostaDeclassamentoValida,
  rispostaNegatoValida,
  rispostaRitardoRinunciaValida,
  valutaCoincidenza,
  valutaCoincidenzaDueTratte,
  valutaDeclassamento,
  valutaNegato,
  valutaRitardoRinuncia,
} from "@/lib/regole/dichiarati";
import { verificaVolo } from "@/lib/voli/verifica";
import { aeroportoPerIata, inItaliano } from "@/lib/voli/aeroporti";
import { kmFraAeroporti } from "@/lib/voli/distanza";
import { scadenzaStimata, VERSIONE_REGOLE } from "@/lib/regole/eu261";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * POST /api/verifica/dichiara
 *
 * I casi che gli archivi non possono vedere: NEGATO IMBARCO e
 * COINCIDENZA PERSA. Un volo partito in orario non dice niente su chi è
 * rimasto al gate; un primo volo con 40 minuti di ritardo non dice
 * niente sulla coincidenza saltata a Monaco. Qui il passeggero dichiara,
 * a scelte chiuse, e il motore deterministico decide.
 *
 * Corpo:
 *   { volo, data, verificaId?, caso: "negato",
 *     presenza, volonta }
 *   { volo, data, verificaId?, caso: "coincidenza",
 *     unica, ritardoFinale, secondoVolo, secondaData? }  // sito: legge 2 voli
 *   { volo, data, verificaId?, caso: "coincidenza",
 *     unica, ritardoFinale, destinazioneFinale }          // app: IATA finale
 *   { volo, data, verificaId?, caso: "declassamento",
 *     volonta, prezzo }
 *
 * Come per i cancellati: il fatto (distanza, sciopero, codeshare) viene
 * dai NOSTRI dati, mai dal browser; le dichiarazioni si scrivono sulla
 * riga della verifica come prova; chi non ricorda resta incerto e non
 * paga.
 */
const MASSIMO_AL_MINUTO = 40;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (await oltreIlLimiteCondiviso("dichiara", ipDi(req), MASSIMO_AL_MINUTO)) {
    return NextResponse.json(
      { ok: false, errore: "Troppe richieste di fila. Aspetta un minuto." },
      { status: 429, headers: CORS },
    );
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, errore: "Richiesta non leggibile." },
      { status: 400, headers: CORS },
    );
  }
  const c = (corpo ?? {}) as Record<string, unknown>;
  if (typeof c.volo !== "string" || typeof c.data !== "string") {
    return NextResponse.json(
      { ok: false, errore: "Manca il volo o la data." },
      { status: 400, headers: CORS },
    );
  }
  if (
    c.caso !== "negato" &&
    c.caso !== "coincidenza" &&
    c.caso !== "declassamento" &&
    c.caso !== "ritardo_rinuncia"
  ) {
    return NextResponse.json(
      { ok: false, errore: "Caso non riconosciuto." },
      { status: 400, headers: CORS },
    );
  }

  /* IL CANCELLO: vedi lib/check/cancello.ts. Questa rotta dà un verdetto
     vero, e col muro acceso il verdetto si paga. */
  const chiuso = await cancelloDelSeguito(req, c.verificaId, {
    /* Si normalizzano come li normalizza il verificatore: se no
       "fr 4001" e "FR4001" sembrerebbero due voli diversi e il cancello
       si chiuderebbe in faccia a chi ha pagato. */
    voloIata: (() => { const n = normalizzaVolo(c.volo); return n.ok ? n.valore : c.volo; })(),
    dataLocale: (() => { const n = normalizzaData(c.data); return n.ok ? n.valore : c.data; })(),
  });
  if (chiuso) return chiuso;

  const esito = await verificaVolo(c.volo, c.data);
  if (!esito.ok) {
    return NextResponse.json({ ok: false, errore: esito.errore }, { status: 404, headers: CORS });
  }
  const fatto = esito.fatto;

  let verdetto;
  let dichiarazione: Record<string, unknown>;
  let destinazione: { iata: string; citta: string } | null = null;

  if (c.caso === "negato") {
    const r = { presenza: c.presenza, volonta: c.volonta };
    if (!rispostaNegatoValida(r)) {
      return NextResponse.json(
        { ok: false, errore: "Rispondi a tutte e due le domande." },
        { status: 400, headers: CORS },
      );
    }
    verdetto = valutaNegato(fatto, r);
    dichiarazione = { caso: "negato", ...r };
  } else if (c.caso === "declassamento") {
    /* Il prezzo può arrivare come numero o come stringa "129,90": si
       normalizza qui, la virgola all'italiana compresa. */
    const grezzo =
      typeof c.prezzo === "number"
        ? c.prezzo
        : Number(String(c.prezzo ?? "").replace(/[^\d.,]/g, "").replace(",", "."));
    const r = { volonta: c.volonta, prezzo: grezzo };
    if (!rispostaDeclassamentoValida(r)) {
      return NextResponse.json(
        {
          ok: false,
          errore: "Dimmi se il declassamento l'hai scelto tu o no, e quanto avevi pagato il biglietto.",
        },
        { status: 400, headers: CORS },
      );
    }
    verdetto = valutaDeclassamento(fatto, r);
    dichiarazione = { caso: "declassamento", volonta: r.volonta, prezzo: r.prezzo };
  } else if (c.caso === "ritardo_rinuncia") {
    /* Ritardo di 5 ore e più con rinuncia (art. 6 → art. 8): il prezzo del
       biglietto lo dà l'utente, come nel declassamento. La virgola
       all'italiana ("129,90") si normalizza qui. */
    const grezzo =
      typeof c.prezzo === "number"
        ? c.prezzo
        : Number(String(c.prezzo ?? "").replace(/[^\d.,]/g, "").replace(",", "."));
    const r = { rinuncia: c.rinuncia, giaRimborsato: c.giaRimborsato, prezzo: grezzo };
    if (!rispostaRitardoRinunciaValida(r)) {
      return NextResponse.json(
        {
          ok: false,
          errore:
            "Dimmi se hai rinunciato a partire, se ti hanno già rimborsato, e quanto avevi pagato il biglietto.",
        },
        { status: 400, headers: CORS },
      );
    }
    verdetto = valutaRitardoRinuncia(fatto, r);
    dichiarazione = {
      caso: "ritardo_rinuncia",
      rinuncia: r.rinuncia,
      giaRimborsato: r.giaRimborsato,
      prezzo: r.prezzo,
    };
  } else {
    const r = { unica: c.unica, ritardoFinale: c.ritardoFinale };
    if (!rispostaCoincidenzaValida(r)) {
      return NextResponse.json(
        { ok: false, errore: "Rispondi a tutte le domande." },
        { status: 400, headers: CORS },
      );
    }
    if (typeof c.secondoVolo === "string" && c.secondoVolo.trim()) {
      /* IL SECONDO VOLO, la coincidenza persa letta a DUE TRATTE (sito, dal
         14/08). Il motore lo LEGGE (scelta di Valerio: «verifico entrambi i
         voli»): serve la sua partenza per provare che il primo ritardo l'ha
         fatto perdere, e il suo arrivo per la distanza dell'intero viaggio.
         Se manca la data, si prova lo stesso giorno del primo volo, che è il
         caso normale di una coincidenza. */
      const nVolo = normalizzaVolo(c.secondoVolo);
      if (!nVolo.ok) {
        return NextResponse.json(
          { ok: false, errore: "Dimmi il numero del volo di coincidenza, quello che hai perso." },
          { status: 400, headers: CORS },
        );
      }
      const secondaDataGrezza =
        typeof c.secondaData === "string" && c.secondaData ? c.secondaData : c.data;
      const nData = normalizzaData(secondaDataGrezza);
      const esitoSecondo = await verificaVolo(
        nVolo.valore,
        nData.ok ? nData.valore : secondaDataGrezza,
      );
      if (!esitoSecondo.ok) {
        /* Non troviamo la coincidenza: non si vende su un dato che non c'è.
           Non è un errore della richiesta, è un verdetto incerto onesto. */
        verdetto = {
          esito: "incerto",
          motivo:
            "Non riesco a trovare il volo di coincidenza che mi hai indicato: controlla numero e data. Senza leggerlo non posso provare che il ritardo del primo volo te l'ha fatto perdere, e non ti faccio pagare per un forse.",
          versioneRegole: VERSIONE_REGOLE,
        };
        dichiarazione = { caso: "coincidenza", ...r, secondoVolo: nVolo.valore };
      } else {
        const secondo = esitoSecondo.fatto;
        const kmViaggio =
          fatto.partenzaIata && secondo.arrivoIata
            ? kmFraAeroporti(fatto.partenzaIata, secondo.arrivoIata)
            : null;
        verdetto = valutaCoincidenzaDueTratte(fatto, secondo, r, kmViaggio);
        dichiarazione = {
          caso: "coincidenza",
          ...r,
          secondoVolo: secondo.voloIata,
          secondaData: secondo.dataLocale,
          destinazioneFinale: secondo.arrivoIata ?? null,
        };
        destinazione = secondo.arrivoIata
          ? { iata: secondo.arrivoIata, citta: inItaliano(secondo.arrivoCitta) ?? secondo.arrivoIata }
          : null;
      }
    } else {
      /* IL VECCHIO PERCORSO, a DESTINAZIONE DICHIARATA. Lo usa ancora l'app
         mobile e chi non passa il secondo volo: la fascia si calcola sul
         viaggio intero (partenza del primo → destinazione finale scelta a
         mano), e il ritardo finale lo dichiara l'utente. Resta perché
         togliere il campo destinazione romperebbe l'app senza aggiungere
         niente: il verdetto è lo stesso motore, solo con un dato in meno. */
      const iataFinale =
        typeof c.destinazioneFinale === "string" ? c.destinazioneFinale.trim().toUpperCase() : "";
      const scalo = iataFinale ? aeroportoPerIata(iataFinale) : null;
      if (!scalo) {
        return NextResponse.json(
          {
            ok: false,
            errore: "Dimmi il volo di coincidenza o l'aeroporto della destinazione finale.",
          },
          { status: 400, headers: CORS },
        );
      }
      const kmViaggio = fatto.partenzaIata ? kmFraAeroporti(fatto.partenzaIata, scalo.iata) : null;
      verdetto = valutaCoincidenza(fatto, r, kmViaggio, scalo.iata);
      dichiarazione = { caso: "coincidenza", ...r, destinazioneFinale: scalo.iata };
      /* scalo.citta è già in italiano (aeroportoPerIata lo traduce). */
      destinazione = { iata: scalo.iata, citta: scalo.citta };
    }
  }

  /* La prova: dichiarazione ed esito sulla riga della verifica. */
  let salvato = false;
  /* 🔴 L'id che arriva dal CORPO si accetta solo se quella riga parla
     dello stesso volo e della stessa data che abbiamo appena verificato.
     Senza questo controllo bastava conoscere l'id di un'altra persona
     (sta nell'indirizzo /verifica/<id>, che si condivide) per scriverle
     addosso il verdetto di un volo che non era il suo. Trovato
     dall'ispezione del 12/08 su tre rotte identiche. */
  const dalCorpo =
    typeof c.verificaId === "string" && c.verificaId
      ? (await verificaCoerente(c.verificaId, esito.fatto.voloIata, esito.fatto.dataLocale))
        ? c.verificaId
        : null
      : null;
  const id = dalCorpo ?? esito.verificaId;
  if (id && SERVIZIO_ATTIVO) {
    try {
      const { error } = await supabaseServizio()
        .from("verifiche")
        .update({
          esito: verdetto.esito,
          importo: verdetto.esito === "idoneo" ? verdetto.importo : null,
          motivo: verdetto.motivo,
          /* 🔴 IL RITARDO VA RISCRITTO, e prima non lo era. La riga
             conservava quello del check di partenza (155 minuti per
             FR4001), e la pagina del verdetto e la LETTERA lo
             rileggevano da lì: uscivano 400 euro accanto a «2 h e 35
             min di ritardo». Per negato imbarco, coincidenza e
             declassamento il ritardo del volo non c'entra col diritto,
             e infatti il motore torna 0. Per il ritardo con rinuncia il
             ritardo È il diritto (le 5 ore), quindi lo si tiene: si
             scrive `verdetto.ritardoMinuti`, che vale 0 per gli altri
             casi (comportamento invariato) e il ritardo vero per questo.
             Trovato l'11/08 da Valerio. */
          ritardo_minuti: verdetto.esito === "idoneo" ? verdetto.ritardoMinuti : null,
          caso_dichiarato: dichiarazione.caso,
          dichiarazione,
          dichiarato_il: new Date().toISOString(),
        })
        .eq("id", id);
      salvato = !error;
      if (error) console.error("[dichiara] salvataggio fallito:", error.message);
    } catch (e) {
      console.error("[dichiara] salvataggio fallito:", e);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      salvato,
      esito: verdetto.esito,
      motivo: verdetto.motivo,
      ...(verdetto.esito === "idoneo" ? { importo: verdetto.importo } : {}),
      dato: {
        da: inItaliano(fatto.partenzaCitta) ?? fatto.partenzaIata ?? null,
        a: inItaliano(fatto.arrivoCitta) ?? fatto.arrivoIata ?? null,
        km: fatto.kmOrtodromica,
        vettoreOperativo: fatto.vettoreOperativo,
        destinazioneFinale: destinazione,
      },
      scadenza:
        verdetto.esito === "idoneo"
          ? scadenzaStimata(fatto.dataLocale, fatto.vettoreOperativo)
          : null,
      demo: esito.demo,
    },
    { headers: CORS },
  );
}
