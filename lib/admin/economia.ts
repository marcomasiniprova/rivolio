/**
 * IL CONTO ECONOMICO, end to end (richiesta di Valerio, 14/08:
 * «calcolami quanto faccio di soldi e quanto mi costa tutto, dal check alla
 * compensazione»).
 *
 * Regola 2 del progetto: niente numeri inventati. Ogni costo qui sotto ha la
 * sua fonte accanto; quelli che ancora non possiamo sapere (il tasso di
 * rimborso della garanzia: nessuna pratica è chiusa) sono marcati STIMA e si
 * cambiano da un posto solo quando arrivano i dati veri.
 *
 * La cosa che questo conto rende ovvia, ed è la più importante: l'infra-
 * struttura costa pochissimo. I due costi che contano davvero sono la
 * commissione di chi incassa (Stripe) e la garanzia. Il resto (dati volo,
 * OCR, email, Supabase, Netlify) è spiccioli. Quindi la profittabilità NON
 * dipende dai costi tecnici: dipende da quanta gente arriva e da quanti
 * reclami vanno a buon fine.
 */

import { LISTINO_BASE } from "@/lib/prezzi";

/* ─────────────────────────── RICAVI ─────────────────────────── */

/* Il prezzo della pratica (il check da 1,99 è un anticipo che si scala).
   Letto dal listino, non riscritto a mano: così il giorno di un cambio prezzo
   il conto economico non resta indietro in silenzio. */
export const PREZZO_PRATICA = LISTINO_BASE.singola;
export const PREZZO_FAMIGLIA = LISTINO_BASE.famiglia;

/* ──────────────────────── COSTI VARIABILI ───────────────────── */

/**
 * La cassa: Stripe Managed Payments (merchant of record). Tutto compreso, per
 * una carta europea: 3,5% del servizio MoR (IVA, frodi, dispute, assistenza)
 * + ~1,5% + 0,25 € di incasso carta = ~5% + 0,25 € a transazione (fonte:
 * support.stripe.com/questions/managed-payments-pricing, verificato 22/08).
 * ⚠️ Una carta NON europea costa di più (fino a 6,5%+ e oltre con il cambio
 * valuta): qui si usa la carta europea, che è il caso dei passeggeri italiani.
 */
export const CASSA_PERCENTO = 0.05;
export const CASSA_FISSO = 0.25;

/**
 * AeroDataBox: piano Premium 150 $/mese per 600.000 richieste, poi
 * 0,00025 $/richiesta (fonte: aerodatabox.com/pricing, verificato 14/08).
 * Con la CACHE un volo vale UNA chiamata anche con 180 passeggeri, e durante
 * un disservizio (quando tutti controllano gli stessi voli) la cache le
 * schiaccia ancora di più. Il costo marginale per check è quindi minuscolo.
 * ~0,00025 $ a richiesta × ~2 richieste (volo + a volte scalo) ≈ 0,0005 €.
 */
export const COSTO_DATI_CHECK = 0.0005; // € per check, stima prudente

/**
 * Mistral OCR: ~1 $ ogni 1000 pagine (stima, listino Mistral). Si usa solo
 * quando l'utente carica la foto della carta d'imbarco: nel check "da foto"
 * e, dopo il pagamento, dentro la pratica. La foto non si salva.
 */
export const COSTO_OCR = 0.001; // € a lettura, stima
/** Stima: quanti check usano la foto della carta (il modo predefinito è la tratta). */
export const QUOTA_CHECK_CON_OCR = 0.2;

/**
 * Resend: piano da 20 $/mese, ~0,0004 € a email. Una pratica manda circa 5
 * email nel tempo (T+0, T+2, T+42, T+56, T+90).
 */
export const COSTO_EMAIL = 0.0004; // € a email
export const EMAIL_PER_PRATICA = 5;

/**
 * ⚠️ LA GARANZIA È IL SECONDO COSTO PIÙ GROSSO, E NON LO SAPPIAMO ANCORA.
 * Scatta se la compagnia rifiuta senza un motivo valido o non risponde nei
 * termini: in quel caso si rimborsa la pratica. Nessuna pratica è ancora
 * chiusa, quindi il tasso vero non esiste. Qui c'è una STIMA prudente del
 * 15%. Nella pagina si mostra anche a 0%, 30% e 50%, così si vede quanto
 * pesa. Si cambia da qui il giorno che i dati veri arrivano.
 */
export const TASSO_RIMBORSO_GARANZIA = 0.15; // STIMA

/* ────────────────────── COSTI FISSI MENSILI ─────────────────── */

/**
 * In euro (i listini sono in dollari, convertiti a ~0,92 €/$). Da aggiornare
 * quando cambiano i piani. Valerio oggi ha già Supabase Pro e Netlify Pro;
 * Resend e AeroDataBox Premium si comprano coi primi grandi volumi.
 */
export const FISSI_MENSILI: Record<string, { euro: number; nota: string }> = {
  supabasePro: { euro: 23, nota: "Supabase Pro, 25 $/mese (ce l'hai)" },
  netlifyPro: { euro: 17, nota: "Netlify Pro, 19 $/mese (ce l'hai)" },
  resend: { euro: 18, nota: "Resend, 20 $/mese (coi primi volumi)" },
  aerodataboxPremium: { euro: 138, nota: "AeroDataBox Premium, 150 $/mese, 600k richieste" },
};

export function fissiMensiliTotale(): number {
  return Object.values(FISSI_MENSILI).reduce((s, v) => s + v.euro, 0);
}

/* ────────────────────────── I CONTI ─────────────────────────── */

/** Il costo di UN check (dati volo + la quota che usa l'OCR). */
export function costoCheck(): number {
  return COSTO_DATI_CHECK + QUOTA_CHECK_CON_OCR * COSTO_OCR;
}

export type ContoPratica = {
  ricavo: number;
  cassa: number;
  ocr: number;
  email: number;
  /** La perdita ATTESA per la garanzia, al tasso dato. */
  garanzia: number;
  /** Quel che resta in tasca, per pratica. */
  netto: number;
};

/**
 * Il conto di una singola pratica pagata, al tasso di rimborso dato.
 * Tutto quello che consuma una pratica dal pagamento alla compensazione.
 */
export function contoPratica(
  prezzo: number = PREZZO_PRATICA,
  tassoRimborso: number = TASSO_RIMBORSO_GARANZIA,
): ContoPratica {
  const cassa = prezzo * CASSA_PERCENTO + CASSA_FISSO;
  const ocr = COSTO_OCR; // una lettura della carta dentro la pratica
  const email = EMAIL_PER_PRATICA * COSTO_EMAIL;
  const garanzia = prezzo * tassoRimborso;
  const netto = prezzo - cassa - ocr - email - garanzia;
  return { ricavo: prezzo, cassa, ocr, email, garanzia, netto };
}

export type Scenario = {
  /** La quota di check che diventa una pratica pagata. */
  conversione: number;
  checkAlGiorno: number;
  paganti: number;
  ricavo: number;
  costoDeiCheck: number;
  costiPratiche: number;
  /** Netto al giorno, PRIMA dei costi fissi mensili. */
  nettoGiorno: number;
};

/**
 * Uno scenario: dato quanti check al giorno e a che tasso convertono, quanto
 * si incassa e quanto resta. I costi fissi mensili NON sono qui dentro (sono
 * al giorno una briciola e si tolgono a parte): così si vede il margine vero
 * del meccanismo.
 */
export function scenario(
  checkAlGiorno: number,
  conversione: number,
  tassoRimborso: number = TASSO_RIMBORSO_GARANZIA,
): Scenario {
  const paganti = checkAlGiorno * conversione;
  const conto = contoPratica(PREZZO_PRATICA, tassoRimborso);
  const ricavo = paganti * conto.ricavo;
  const costoDeiCheck = checkAlGiorno * costoCheck();
  const costiPratiche = paganti * (conto.cassa + conto.ocr + conto.email + conto.garanzia);
  const nettoGiorno = ricavo - costoDeiCheck - costiPratiche;
  return { conversione, checkAlGiorno, paganti, ricavo, costoDeiCheck, costiPratiche, nettoGiorno };
}

/**
 * Quanti check al giorno servono per arrivare al traguardo di Valerio: 1000
 * pratiche pagate al giorno, a un dato tasso di conversione.
 */
export function checkPerPaganti(pagantiVoluti: number, conversione: number): number {
  return conversione > 0 ? Math.round(pagantiVoluti / conversione) : 0;
}

/* ─────────── IL MODELLO COMPLETO: IVA, INCASSO, CREATOR, GARANZIA ────────────
 *
 * Il conto qui sopra (contoPratica) è la versione semplice: non toglie l'IVA,
 * non ha i creator, e tratta la garanzia come un rimborso in CONTANTI. Questo
 * pezzo, chiesto da Valerio il 16/08, aggiunge le tre leve che decidono
 * davvero se il business regge quando arriva il traffico e si lavora con gli
 * influencer:
 *  1. l'IVA (chi la versa dipende da come incassi);
 *  2. il modo di incassare (merchant-of-record o Stripe diretto);
 *  3. la commissione ai creator, pagata SUBITO;
 *  4. la forma della garanzia: rimborso in CREDITO (un buono) o in CONTANTI.
 *
 * La scoperta che rende tutto solido: col rimborso in CREDITO non esce mai
 * cassa, quindi la commissione già pagata al creator è sempre coperta e il
 * netto per pratica NON va mai in negativo, a qualsiasi tasso di rimborso.
 */

/** IVA ordinaria italiana, B2C. I prezzi mostrati la includono. */
export const IVA = 0.22;

/** I due modi di incassare, a confronto. */
export const INCASSO = {
  mor: {
    nome: "Stripe Managed Payments (merchant of record)",
    percento: 0.05,
    fisso: 0.25,
    nota: "Versa IVA e imposte indirette al posto tuo in 80+ paesi. È quello che usiamo: funziona senza partita IVA.",
  },
  stripe: {
    nome: "Stripe diretto (tua partita IVA)",
    percento: 0.015,
    fisso: 0.25,
    nota: "Commissione bassa, ma IVA, OSS e fatture le gestisci tu (serve un commercialista e la partita IVA).",
  },
} as const;
export type ModoIncasso = keyof typeof INCASSO;

/** La commissione ai creator, sulla PRATICA (non sul check: è un anticipo che
    si scala). 40% a tutti (scelta di Valerio, 22/08). */
export const CREATOR_PCT = 0.4;

export type LeveMargine = {
  prezzo: number;
  incasso: ModoIncasso;
  /** 0..1 sulla pratica. */
  creatorPct: number;
  /** 0..1: quanti reclami falliscono e fanno scattare la garanzia. */
  tassoRimborso: number;
  /** true = rimborso in credito (un buono), false = rimborso in contanti. */
  garanziaCredito: boolean;
};

export type MargineCompleto = {
  exIva: number;
  iva: number;
  commissione: number;
  creator: number;
  serviziPratica: number;
  /** Quello che resta su una vendita che RESTA (nessun rimborso). */
  tieni: number;
  /** Il netto su una vendita RIMBORSATA: ~positivo col credito, negativo coi contanti. */
  nettoSuRimborso: number;
  /** La media pesata al tasso di rimborso: il netto vero per pratica. */
  medioPerPratica: number;
  /** Il tasso di rimborso oltre cui vai in perdita. null = non ci vai mai. */
  pareggioRimborso: number | null;
};

/** I costi vivi di una pratica oltre incasso e creator (OCR + email). Briciole. */
function serviziDiUnaPratica(): number {
  return COSTO_OCR + EMAIL_PER_PRATICA * COSTO_EMAIL;
}

/**
 * Il conto completo di una pratica, con tutte le leve. È una funzione PURA
 * (nessuna dipendenza dal server): la usa anche il simulatore nel browser.
 */
export function margineCompleto(leve: LeveMargine): MargineCompleto {
  const { prezzo, incasso, creatorPct, tassoRimborso, garanziaCredito } = leve;
  const inc = INCASSO[incasso];
  const exIva = prezzo / (1 + IVA);
  const iva = prezzo - exIva;
  const commissione = prezzo * inc.percento + inc.fisso;
  const creator = prezzo * creatorPct;
  const serviziPratica = serviziDiUnaPratica();
  // Quello che resta se la vendita non torna indietro.
  const tieni = exIva - commissione - creator - serviziPratica;

  // Su un rimborso:
  //  - in CREDITO non esce cassa: tieni i soldi, dai un buono. Costa al
  //    massimo il servizio di una pratica in più se il buono viene usato.
  //  - in CONTANTI ridai il prezzo pieno; recuperi l'IVA (nota di credito),
  //    ma la commissione e il creator sono già usciti: resti sotto di quelli.
  const nettoSuRimborso = garanziaCredito
    ? tieni - serviziPratica
    : -(commissione + creator + serviziPratica);

  const medioPerPratica = (1 - tassoRimborso) * tieni + tassoRimborso * nettoSuRimborso;

  // Il tasso di rimborso che porta il netto medio a zero. Se anche una
  // vendita rimborsata resta positiva (il credito), non ci arrivi mai.
  const pareggioRimborso =
    nettoSuRimborso >= 0 ? null : tieni / (tieni - nettoSuRimborso);

  return {
    exIva,
    iva,
    commissione,
    creator,
    serviziPratica,
    tieni,
    nettoSuRimborso,
    medioPerPratica,
    pareggioRimborso,
  };
}
