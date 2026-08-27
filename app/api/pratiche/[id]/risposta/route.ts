import { NextResponse } from "next/server";
import { CORS, ipDi, oltreIlLimiteCondiviso } from "@/lib/api/limite";
import { utenteDaRichiesta } from "@/lib/api/utente";
import { analizzaRifiuto, coerenzaRisposta } from "@/lib/ai/replica";
import { righeMeteoVolo } from "@/lib/meteo/openmeteo";
import {
  EVENTO_ANALISI_RIFIUTO,
  EVENTO_RIFIUTO_DOCUMENTO,
  EVENTO_TESTO_RIFIUTO,
  costruisciDossier,
} from "@/lib/pratiche/dossier";
import {
  caricaPratica,
  eventiPratica,
  registraEvento,
  transizionePratica,
} from "@/lib/pratiche/pratiche";
import { schedaRifiuto } from "@/lib/pratiche/rifiuto";
import { testoDaDocumento } from "@/lib/ocr/carta-imbarco";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * POST /api/pratiche/<id>/risposta
 *   { testo }                 → hanno risposto, ecco cosa hanno scritto
 *   { base64, tipoMime }      → hanno risposto, ecco lo screenshot
 *
 * 🔴 Valerio, 13/08: «non si può fare la analisi bella figa con AI, tipo
 * carichi la foto della risposta, lo screenshot, o scrivi letteralmente
 * alla AI e ti dà la contro risposta? è tutto così rigido con domande
 * predefinite».
 *
 * Questa è quella porta. Il giro, in ordine:
 * 1. se arriva un'immagine, la legge Mistral OCR (lo stesso lettore della
 *    carta d'imbarco: un pezzo solo, non due);
 * 2. si monta il FASCICOLO del caso (lib/pratiche/dossier.ts): volo,
 *    orari certificati, fascia, documenti, storia. L'AI non lavora mai
 *    al buio su una risposta staccata dal contesto;
 * 3. il modello riconosce il motivo fra gli otto, estrae i fatti che
 *    loro dichiarano e scrive il paragrafo su misura;
 * 4. **il paragrafo passa da un controllo deterministico** che boccia
 *    sentenze fuori archivio, cifre inventate e promesse (lib/ai/replica).
 *    Se non passa, la replica resta quella fissa: verificata, meno
 *    brillante, comunque giusta;
 * 5. si salva tutto come EVENTI della pratica.
 *
 * ⚠️ PERCHÉ EVENTI E NON COLONNE NUOVE. Servirebbe una migrazione da far
 * applicare a mano sul database vero, e finché non è applicata la lettura
 * della pratica FALLISCE INTERA (Postgres non risponde "colonna vuota").
 * È già successo il 10/08 con `rifiuto_motivo`. La cronologia esiste, è
 * in ordine, ed è per definizione il posto dove sta la storia del caso.
 *
 * ⚠️ LO SCREENSHOT NON SI SALVA. Si legge, si tiene il testo, si scarta
 * l'immagine: stessa regola dei documenti, e qui vale doppio perché una
 * email della compagnia contiene il nome e spesso il numero di
 * prenotazione del passeggero.
 */
export const dynamic = "force-dynamic";

const MASSIMO_AL_MINUTO = 6;
const MAX_IMMAGINE = 5 * 1024 * 1024;
const MAX_TESTO = 12_000;
const MIME_OK = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  /* Il tetto è basso di proposito: ogni chiamata costa un giro di OCR e
     uno di modello. Sei al minuto bastano a chiunque stia lavorando la
     propria pratica, e non bastano a nessun altro. */
  if (await oltreIlLimiteCondiviso("risposta-compagnia", ipDi(req), MASSIMO_AL_MINUTO)) {
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
  const { testo, base64, tipoMime } = (corpo ?? {}) as Record<string, unknown>;

  const utente = await utenteDaRichiesta(req);
  if (!utente) {
    return NextResponse.json(
      { ok: false, errore: "Devi entrare per aggiornare la pratica." },
      { status: 401, headers: CORS },
    );
  }
  if (!SERVIZIO_ATTIVO) {
    return NextResponse.json(
      { ok: false, errore: "Servizio non disponibile." },
      { status: 503, headers: CORS },
    );
  }

  const pratica = await caricaPratica(id);
  if (!pratica || pratica.utente_id !== utente.id) {
    return NextResponse.json(
      { ok: false, errore: "Pratica non trovata." },
      { status: 404, headers: CORS },
    );
  }
  if (pratica.stato === "creata" || pratica.stato === "pagata" || pratica.stato === "pronta") {
    return NextResponse.json(
      { ok: false, errore: "Il reclamo non risulta ancora inviato." },
      { status: 409, headers: CORS },
    );
  }

  /* ---------------------------------------- 1. il testo della risposta */
  let rispostaLoro = typeof testo === "string" ? testo.trim().slice(0, MAX_TESTO) : "";

  /* 🔴 IL "NO" ARRIVA DA UN DOCUMENTO VERO O DA TESTO SCRITTO A MANO? Serve
     alla garanzia (Valerio, 15/08: col testo scritto a mano si truffava il
     rimborso). Si guarda ORA, prima che l'OCR riempia `rispostaLoro`: testo
     vuoto + un'immagine in arrivo = documento. Il testo scritto a mano
     prepara comunque la replica, ma non fa scattare il rimborso. */
  const daDocumento = rispostaLoro.length === 0 && typeof base64 === "string";

  if (!rispostaLoro && typeof base64 === "string" && typeof tipoMime === "string") {
    if (!MIME_OK.includes(tipoMime)) {
      return NextResponse.json(
        { ok: false, errore: "Formato non supportato: usa una foto (JPG, PNG, WebP) o un PDF." },
        { status: 400, headers: CORS },
      );
    }
    // La lunghezza in base64 è circa 4/3 dei byte veri.
    if (base64.length * 0.75 > MAX_IMMAGINE) {
      return NextResponse.json(
        { ok: false, errore: "Il file supera i 5MB: riprova con una foto più leggera." },
        { status: 400, headers: CORS },
      );
    }
    const letto = await testoDaDocumento(base64, tipoMime);
    if (!letto) {
      return NextResponse.json(
        {
          ok: false,
          errore:
            "Non sono riuscito a leggere l'immagine. Riprova con uno scatto più nitido, oppure incolla il testo della risposta.",
        },
        { status: 422, headers: CORS },
      );
    }
    rispostaLoro = letto.trim().slice(0, MAX_TESTO);
  }

  if (rispostaLoro.length < 20) {
    return NextResponse.json(
      {
        ok: false,
        errore:
          "Serve la loro risposta: incolla il testo dell'email che ti hanno mandato, oppure carica lo screenshot.",
      },
      { status: 400, headers: CORS },
    );
  }

  /* ---------------------------------------------- 2. il fascicolo */
  const eventi = await eventiPratica(pratica.id);
  const sb = supabaseServizio();
  const { data: volo } = pratica.volo_id
    ? await sb
        .from("voli")
        .select(
          "volo_iata, data_locale, vettore_operativo, km_ortodromica, fonte, payload_grezzo, arrivo_previsto_utc, arrivo_effettivo_utc",
        )
        .eq("id", pratica.volo_id)
        .maybeSingle()
    : { data: null };
  const { data: verifica } = pratica.verifica_id
    ? await sb
        .from("verifiche")
        .select("importo, ritardo_minuti, motivo, versione_regole")
        .eq("id", pratica.verifica_id)
        .maybeSingle()
    : { data: null };

  const dossier = costruisciDossier({ pratica, volo, verifica, eventi });

  /* -------------------------- 2-bis. È DAVVERO LA RISPOSTA A QUESTO CASO?
     🔴 Valerio, 13/08: ha incollato dentro la pratica del volo ZZ400 la
     risposta di un altro volo (FR1234) e il sistema ha scritto la replica
     come se niente fosse. Il controllo che c'era guardava il testo
     GENERATO; nessuno guardava quello IN INGRESSO.
     Sta PRIMA del modello di proposito: non si spendono soldi di API per
     analizzare l'email sbagliata, e soprattutto l'AI non ha modo di
     "aggiustare" un caso che non torna. Vedi lib/ai/replica.ts. */
  const coerente = coerenzaRisposta(rispostaLoro, dossier);
  if (!coerente.ok) {
    /* Non si registra niente: il testo non appartiene a questa pratica, e
       scriverlo nella sua cronologia vorrebbe dire sporcare il fascicolo
       con i fatti di un altro volo, che è esattamente il danno che stiamo
       evitando. */
    return NextResponse.json(
      {
        ok: false,
        incoerente: true,
        voloTrovato: coerente.voloTrovato,
        voloAtteso: coerente.voloAtteso,
        errore: coerente.messaggio,
      },
      { status: 409, headers: CORS },
    );
  }

  /* ------------------------------------------------ 3 e 4. l'analisi */
  /* IL METEO VERIFICATO ai due estremi del volo, se il modulo è acceso.
     Entra nell'analisi: se la compagnia dà la colpa al maltempo, l'AI
     risponde coi numeri reali di quel giorno. Torna null senza fare danni
     se spento o non letto: la lettera non muore mai per il meteo. */
  const v = volo as { payload_grezzo?: unknown; arrivo_effettivo_utc?: string | null } | null;
  const meteo = await righeMeteoVolo(v?.payload_grezzo, v?.arrivo_effettivo_utc ?? null);
  const analisi = await analizzaRifiuto(dossier, rispostaLoro, meteo);
  if (!analisi) {
    /* Niente modello, o modello che non ha capito. Il testo della loro
       risposta si salva lo stesso: è materiale del fascicolo e serve
       anche solo a farglielo rileggere. Poi si torna alla lista. */
    await registraEvento(pratica.id, EVENTO_TESTO_RIFIUTO, rispostaLoro);
    return NextResponse.json(
      {
        ok: false,
        letto: true,
        errore:
          "Ho salvato la loro risposta ma non sono riuscito a capirla da solo. Dimmi tu di cosa parla e ti preparo la replica.",
      },
      { status: 200, headers: CORS },
    );
  }

  /* 🔴 «L'AI NON HA CAPITO UN CAZZO DELLA RISPOSTA» (Valerio, 18/08, col
     test "SEI GAY NON MERITI RIMBORSO"). Quando l'utente INCOLLA un testo,
     "silenzio" non è un esito possibile: il modello lo sceglie solo se il
     testo non è affatto una risposta della compagnia (vedi replica.ts).
     Quindi qui è il segnale che ha incollato la cosa sbagliata: lo diciamo
     chiaro e NON prepariamo una replica a caso. Non si registra niente: non
     è un fatto del fascicolo. Il "silenzio" vero (la compagnia non risponde)
     si dichiara dall'elenco o lo porta il tempo, non da un testo incollato. */
  if (analisi.motivo === "silenzio") {
    return NextResponse.json(
      {
        ok: false,
        errore:
          "Questa non sembra una risposta della compagnia. Controlla di aver incollato quella giusta, oppure qui sotto scegli dall'elenco che motivo ti hanno dato.",
      },
      { status: 200, headers: CORS },
    );
  }

  /* ------------------------------------------------------ 5. si salva */
  const scheda = schedaRifiuto(analisi.motivo);
  await registraEvento(pratica.id, EVENTO_TESTO_RIFIUTO, rispostaLoro);
  await registraEvento(pratica.id, EVENTO_ANALISI_RIFIUTO, JSON.stringify(analisi));

  const { error } = await sb
    .from("pratiche")
    .update({
      rifiuto_motivo: analisi.motivo,
      rifiuto_il: new Date().toISOString(),
      aggiornata_il: new Date().toISOString(),
    })
    .eq("id", pratica.id);
  if (error) {
    console.error("[risposta] salvataggio del motivo fallito:", error.message);
    return NextResponse.json(
      { ok: false, errore: "Ho letto la risposta ma non sono riuscito a salvarla. Riprova." },
      { status: 500, headers: CORS },
    );
  }

  await registraEvento(
    pratica.id,
    "rifiuto",
    `La compagnia ha risposto no: ${scheda?.etichetta ?? analisi.motivo} (letto dalla loro risposta)`,
  );
  /* Se il no è arrivato come DOCUMENTO vero (foto/email/PDF), lo si segna:
     è questo evento, e non il solo `rifiuto_motivo`, che sblocca la
     garanzia dei 14,90. Un testo scritto a mano non lo lascia. */
  if (daDocumento) {
    await registraEvento(
      pratica.id,
      EVENTO_RIFIUTO_DOCUMENTO,
      "La risposta della compagnia è stata caricata come documento (foto o PDF).",
    );
  }
  if (pratica.stato === "inviata") {
    await transizionePratica(pratica.id, "sollecito", "Risposta della compagnia letta: replica pronta.");
  }

  return NextResponse.json(
    {
      ok: true,
      motivo: analisi.motivo,
      etichetta: scheda?.etichetta ?? null,
      peso: scheda?.peso ?? null,
      sicurezza: analisi.sicurezza,
      riassunto: analisi.riassunto,
      fattiLoro: analisi.fattiLoro,
      /* ⚠️ Il paragrafo NON torna al browser: è il cuore della lettera che
         il cliente ha pagato, e la pagina della lettera lo prende dal
         server. Mandarlo qui vorrebbe dire regalarlo a chiunque abbia una
         pratica aperta e sappia leggere una risposta di rete. */
      suMisura: analisi.paragrafo !== null,
    },
    { headers: CORS },
  );
}
