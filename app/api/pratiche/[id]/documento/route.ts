import { NextResponse, type NextRequest } from "next/server";
import { ipDi, oltreIlLimiteCondiviso } from "@/lib/api/limite";
import { utenteCollegato } from "@/lib/supabase/server";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { caricaPratica, registraEvento } from "@/lib/pratiche/pratiche";
import {
  confrontaConVerifica,
  estraiCampi,
  testoDaDocumento,
} from "@/lib/ocr/carta-imbarco";

/**
 * La seconda fonte, dentro la pratica: l'utente carica la carta
 * d'imbarco (o l'email della compagnia) e Rivolio la incrocia coi dati
 * verificati del volo.
 *
 * Il FILE NON SI SALVA: si estraggono i campi (deterministico, regex su
 * testo OCR), si registra l'esito del confronto come evento della
 * pratica, e il byte se ne va. Meno dati custoditi = meno rischi.
 * Se i dati discordano, la verifica torna in conferma umana: l'AI legge,
 * non decide (regola di casa).
 */

const MAX_BASE64 = 7_000_000; // ~5MB di file
const TIPI_AMMESSI = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(
  richiesta: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  /* ⚠️ QUI IL FRENO NON C'ERA. La rotta chiede l'account e la proprietà
     della pratica, quindi non è aperta al mondo; ma ogni chiamata è un
     giro di OCR a pagamento, e un cliente con una pratica vera che
     ricarica in loop ce li fa spendere lo stesso. Sei al minuto bastano
     a chiunque stia caricando la propria carta d'imbarco. */
  if (await oltreIlLimiteCondiviso("documento", ipDi(richiesta), 6)) {
    return NextResponse.json(
      { ok: false, errore: "Troppe richieste di fila. Aspetta un minuto." },
      { status: 429 },
    );
  }

  const { id } = await params;

  const utente = await utenteCollegato();
  if (!utente) {
    return NextResponse.json({ errore: "Entra per caricare i documenti." }, { status: 401 });
  }
  /* 🔴 QUI C'ERA SCRITTO «la RLS fa il resto», ED ERA FALSO.
     `caricaPratica` legge con la chiave di SERVIZIO, che salta le regole
     di riga per definizione: è il suo mestiere. Quindi il controllo
     "questa pratica è tua" non lo faceva nessuno, e bastava essere
     collegati (anche come cliente qualsiasi) più conoscere l'id di una
     pratica per caricarci dentro un documento. Trovato dall'ispezione
     del 12/08.
     Le rotte sorelle (`/rifiuto`, `/conferma-invio`) il confronto lo
     fanno da sempre: questa se l'era perso.
     ⚠️ 404 e non 403: dire "non è tua" conferma che quella pratica
     esiste, e a chi non è suo non serve saperlo. */
  const pratica = await caricaPratica(id);
  if (!pratica || pratica.utente_id !== utente.id) {
    return NextResponse.json({ errore: "Pratica non trovata." }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY && !process.env.MISTRAL_API_KEY) {
    return NextResponse.json(
      { errore: "La lettura dei documenti non è attiva su questo ambiente." },
      { status: 503 },
    );
  }

  let corpo: { base64?: string; tipoMime?: string } | null = null;
  try {
    corpo = await richiesta.json();
  } catch {
    /* risposta sotto */
  }
  const base64 = (corpo?.base64 ?? "").trim();
  const tipoMime = (corpo?.tipoMime ?? "").trim().toLowerCase();
  if (!base64 || !TIPI_AMMESSI.has(tipoMime)) {
    return NextResponse.json(
      { errore: "Carica una foto (JPG, PNG, WebP) o un PDF." },
      { status: 400 },
    );
  }
  if (base64.length > MAX_BASE64) {
    return NextResponse.json(
      { errore: "Il file supera i 5MB: riprova con una foto più leggera." },
      { status: 413 },
    );
  }

  // I dati verificati del volo della pratica, dal server.
  if (!SERVIZIO_ATTIVO || !pratica.volo_id) {
    return NextResponse.json(
      { errore: "I dati del volo non sono disponibili: riprova più tardi." },
      { status: 503 },
    );
  }
  const { data: volo } = await supabaseServizio()
    .from("voli")
    .select("volo_iata, data_locale")
    .eq("id", pratica.volo_id)
    .maybeSingle<{ volo_iata: string; data_locale: string }>();
  if (!volo) {
    return NextResponse.json(
      { errore: "I dati del volo non sono disponibili: riprova più tardi." },
      { status: 503 },
    );
  }

  const testo = await testoDaDocumento(base64, tipoMime);
  if (!testo) {
    return NextResponse.json(
      { errore: "Non sono riuscito a leggere il documento. Riprova con una foto più nitida." },
      { status: 422 },
    );
  }

  const confronto = confrontaConVerifica(estraiCampi(testo), volo.volo_iata, volo.data_locale);

  /* L'esito diventa un evento della pratica: è la memoria che l'admin e
     il tracker leggono. Il testo del documento NON si salva per intero. */
  await registraEvento(
    pratica.id,
    "documento_incrociato",
    confronto.esito === "concorde"
      ? `Documento caricato e CONCORDE. ${confronto.dettagli}`
      : confronto.esito === "discorde"
        ? `Documento caricato e DISCORDE. ${confronto.dettagli}`
        : `Documento caricato ma illeggibile. ${confronto.dettagli}`,
  );

  /* Un documento DISCORDE resta scritto nella cronologia della pratica
     (evento `documento_incrociato` qui sopra): è lì che Valerio lo vede.
     Prima, con lo shadow mode, rimetteva la verifica "in attesa" per una
     revisione a mano; lo shadow è stato tolto il 28/08, e comunque a quel
     punto la pratica è già pagata, quindi quel flag non cambiava nulla.
     MAI un cambio di verdetto da codice: il documento si registra, non
     decide. */

  return NextResponse.json({
    ok: true,
    esito: confronto.esito,
    dettagli: confronto.dettagli,
  });
}
